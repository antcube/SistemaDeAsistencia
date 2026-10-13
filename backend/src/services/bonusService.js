const XLSX = require("xlsx");
const ExcelJS = require("exceljs");

const User = require("../models/User");
const { getMonthlyCircleReport } = require("./reportService");

const normalizeText = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();

const normalizeHeader = (value) =>
  normalizeText(value).replace(/[^A-Z0-9]/g, "");

const shiftMonth = (year, month, offset) => {
  const date = new Date(Date.UTC(year, month - 1 + offset, 1));
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
  };
};

const monthKey = (year, month) =>
  `${year}-${String(month).padStart(2, "0")}`;

const getTrialStartMonth = (admissionDate) => {
  if (!admissionDate) return null;

  const date = new Date(admissionDate);
  if (Number.isNaN(date.getTime())) return null;

  return shiftMonth(
    date.getUTCFullYear(),
    date.getUTCMonth() + 1,
    1
  );
};

const compareMonth = (a, b) => {
  const aValue = a.year * 12 + a.month;
  const bValue = b.year * 12 + b.month;
  return aValue - bValue;
};

const getMonthsInclusive = (start, end) => {
  const months = [];
  let cursor = { ...start };

  while (compareMonth(cursor, end) <= 0) {
    months.push(cursor);
    cursor = shiftMonth(cursor.year, cursor.month, 1);
  }

  return months;
};

const findHeaderInfo = (worksheet) => {
  const matrix = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    defval: "",
    raw: false,
  });

  const limit = Math.min(matrix.length, 60);

  for (let rowIndex = 0; rowIndex < limit; rowIndex += 1) {
    const row = matrix[rowIndex] || [];
    let usernameColumn = -1;
    let bonusColumn = -1;

    row.forEach((cell, columnIndex) => {
      const normalized = normalizeHeader(cell);
      if (normalized === "USUARIO" || normalized === "USERNAME") {
        usernameColumn = columnIndex;
      }
      if (normalized === "BONO" || normalized === "BONUS") {
        bonusColumn = columnIndex;
      }
    });

    if (usernameColumn >= 0 && bonusColumn >= 0) {
      return {
        matrix,
        headerRowIndex: rowIndex,
        usernameColumn,
        bonusColumn,
      };
    }
  }

  throw new Error(
    'No se encontraron las columnas "USUARIO" y "Bono" en el archivo.'
  );
};

const getWorkbookContext = (buffer) => {
  const workbook = XLSX.read(buffer, {
    type: "buffer",
    cellDates: true,
    cellStyles: true,
  });

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error("El archivo Excel no contiene hojas.");
  }

  const worksheet = workbook.Sheets[sheetName];
  const headerInfo = findHeaderInfo(worksheet);
  const range = XLSX.utils.decode_range(worksheet["!ref"] || "A1:A1");

  return {
    workbook,
    worksheet,
    sheetName,
    rangeStartRow: range.s.r,
    rangeStartColumn: range.s.c,
    ...headerInfo,
  };
};

const buildReportMap = async (year, month) => {
  const report = await getMonthlyCircleReport({
    year,
    month,
    circle: null,
  });

  const map = new Map();

  for (const member of report.members || []) {
    const username = normalizeText(member?.user?.username || member?.username);
    if (!username) continue;

    map.set(username, {
      perfect: Boolean(member?.totals?.bonus),
      member,
    });
  }

  return map;
};

const getReportsForMonths = async (months) => {
  const unique = new Map();

  for (const item of months) {
    unique.set(monthKey(item.year, item.month), item);
  }

  const entries = await Promise.all(
    [...unique.values()].map(async (item) => [
      monthKey(item.year, item.month),
      await buildReportMap(item.year, item.month),
    ])
  );

  return new Map(entries);
};

const findFirstCompletedTrial = ({
  user,
  evaluatedMonth,
  reportsByMonth,
}) => {
  const trialStart = getTrialStartMonth(user.ambassadorAdmissionDate);

  if (!trialStart) {
    return {
      required: false,
      completed: true,
      start: null,
      end: null,
      streakMonths: [],
    };
  }

  const latestNeededMonth = shiftMonth(
    evaluatedMonth.year,
    evaluatedMonth.month,
    2
  );

  if (compareMonth(latestNeededMonth, trialStart) < 0) {
    return {
      required: true,
      completed: false,
      start: null,
      end: null,
      streakMonths: [],
    };
  }

  const months = getMonthsInclusive(trialStart, latestNeededMonth);
  let streak = [];

  for (const item of months) {
    const report = reportsByMonth.get(monthKey(item.year, item.month));
    const memberResult = report?.get(normalizeText(user.username));
    const perfect = Boolean(memberResult?.perfect);

    if (perfect) {
      streak.push(item);
    } else {
      streak = [];
    }

    if (streak.length === 3) {
      return {
        required: true,
        completed: true,
        start: streak[0],
        end: streak[2],
        streakMonths: [...streak],
      };
    }
  }

  return {
    required: true,
    completed: false,
    start: null,
    end: null,
    streakMonths: [],
  };
};

const evaluateBonusUsers = async ({ buffer, paymentYear, paymentMonth }) => {
  const evaluatedMonth = shiftMonth(paymentYear, paymentMonth, -3);
  const { matrix, headerRowIndex, usernameColumn } = getWorkbookContext(buffer);

  const rows = [];
  const usernames = [];

  for (let rowIndex = headerRowIndex + 1; rowIndex < matrix.length; rowIndex += 1) {
    const usernameRaw = matrix[rowIndex]?.[usernameColumn];
    const normalizedUsername = normalizeText(usernameRaw);

    if (!normalizedUsername) continue;

    rows.push({
      rowIndex,
      usernameRaw: String(usernameRaw).trim(),
      normalizedUsername,
    });
    usernames.push(normalizedUsername);
  }

  const users = usernames.length
    ? await User.find({
        username: { $nin: [null, ""] },
      })
    : [];

  const userMap = new Map(
    users
      .filter((user) => normalizeText(user.username))
      .map((user) => [normalizeText(user.username), user])
  );

  const monthsNeeded = [evaluatedMonth];

  for (const user of users) {
    const trialStart = getTrialStartMonth(user.ambassadorAdmissionDate);
    if (!trialStart) continue;

    const end = shiftMonth(evaluatedMonth.year, evaluatedMonth.month, 2);
    if (compareMonth(end, trialStart) < 0) continue;

    monthsNeeded.push(...getMonthsInclusive(trialStart, end));
  }

  const reportsByMonth = await getReportsForMonths(monthsNeeded);
  const evaluatedReport = reportsByMonth.get(
    monthKey(evaluatedMonth.year, evaluatedMonth.month)
  );

  const results = rows.map((row) => {
    const user = userMap.get(row.normalizedUsername);

    if (!user) {
      return {
        ...row,
        matched: false,
        eligible: false,
        reason: "Usuario no encontrado en SEINFINITY",
        member: null,
      };
    }

    const monthlyResult = evaluatedReport?.get(normalizeText(user.username));
    const perfectMonth = Boolean(monthlyResult?.perfect);

    if (!perfectMonth) {
      return {
        ...row,
        matched: true,
        eligible: false,
        reason: "No tuvo asistencia perfecta en el mes evaluado",
        member: user,
      };
    }

    if (!user.ambassadorAdmissionDate) {
      return {
        ...row,
        matched: true,
        eligible: true,
        reason: "Embajador antiguo con asistencia perfecta",
        member: user,
      };
    }

    const trial = findFirstCompletedTrial({
      user,
      evaluatedMonth,
      reportsByMonth,
    });

    if (!trial.completed) {
      return {
        ...row,
        matched: true,
        eligible: false,
        reason: "Periodo de prueba aún no completado",
        member: user,
        trial,
      };
    }

    if (compareMonth(evaluatedMonth, trial.start) < 0) {
      return {
        ...row,
        matched: true,
        eligible: false,
        reason: "El mes evaluado es anterior a la racha válida de prueba",
        member: user,
        trial,
      };
    }

    return {
      ...row,
      matched: true,
      eligible: true,
      reason: "Cumple asistencia y periodo de prueba",
      member: user,
      trial,
    };
  });

  return {
    evaluatedMonth,
    results,
  };
};

const getSummary = (evaluation) => {
  const total = evaluation.results.length;
  const matched = evaluation.results.filter((item) => item.matched).length;
  const eligible = evaluation.results.filter((item) => item.eligible).length;

  return {
    total,
    matched,
    notMatched: total - matched,
    eligible,
    notEligible: total - eligible,
  };
};

const buildProcessedWorkbook = async ({ buffer, evaluation }) => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new Error("El archivo Excel no contiene hojas.");
  }

  let usernameColumn = 0;
  let bonusColumn = 0;
  let headerRowNumber = 0;

  const maxRows = Math.min(worksheet.rowCount, 60);

  for (let rowNumber = 1; rowNumber <= maxRows; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);

    row.eachCell({ includeEmpty: true }, (cell, columnNumber) => {
      const normalized = normalizeHeader(cell.value);

      if (normalized === "USUARIO" || normalized === "USERNAME") {
        usernameColumn = columnNumber;
      }

      if (normalized === "BONO" || normalized === "BONUS") {
        bonusColumn = columnNumber;
      }
    });

    if (usernameColumn && bonusColumn) {
      headerRowNumber = rowNumber;
      break;
    }
  }

  if (!headerRowNumber || !bonusColumn) {
    throw new Error('No se encontraron las columnas "USUARIO" y "Bono" en el archivo.');
  }

  const resultMap = new Map(
    evaluation.results.map((item) => [
      normalizeText(item.usernameRaw),
      item,
    ])
  );

  for (let rowNumber = headerRowNumber + 1; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    const username = normalizeText(row.getCell(usernameColumn).value);

    if (!username) continue;

    const result = resultMap.get(username);
    if (!result) continue;

    const cell = row.getCell(bonusColumn);

    if (result.eligible) {
      cell.value = "BONO";
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFC6EFCE" },
      };
      cell.font = {
        ...(cell.font || {}),
        bold: true,
        color: { argb: "FF006100" },
      };
      cell.alignment = {
        ...(cell.alignment || {}),
        horizontal: "center",
        vertical: "middle",
      };
    } else {
      cell.value = "";
    }
  }

  const output = await workbook.xlsx.writeBuffer();
  return Buffer.from(output);
};

module.exports = {
  evaluateBonusUsers,
  getSummary,
  buildProcessedWorkbook,
  shiftMonth,
};
