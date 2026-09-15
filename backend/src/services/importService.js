const User = require("../models/User");
const Circle = require("../models/Circle");

const normalizeHeader = (value) => {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "");
};

const normalizeValue = (value) => {
  if (value === null || value === undefined) return "";
  return String(value).trim();
};

const HEADER_MAP = {
  dni: "doc",
  doc: "doc",
  documento: "doc",
  numerodocumento: "doc",

  nombre: "name",
  nombres: "name",
  nombreyapellido: "name",
  nombreapellido: "name",
  nombrecompleto: "name",
  name: "name",

  usuario: "username",
  username: "username",
  user: "username",

  circulo: "circle",
  circuloasignado: "circle",
  circuloarchivo: "circle",
  circle: "circle",

  rango: "job",
  rangos: "job",
  cargo: "job",
  puesto: "job",
  job: "job",

  correo: "email",
  email: "email",

  telefono: "phone",
  celular: "phone",
  movil: "phone",
  phone: "phone",
};

const mapRow = (row, headers) => {
  const mapped = {};

  for (const header of headers) {
    const normalized = normalizeHeader(header);
    const field = HEADER_MAP[normalized];
    if (!field) continue;
    mapped[field] = normalizeValue(row[header]);
  }

  return mapped;
};

const hasAnyMemberData = (user) => {
  return Boolean(
    user.doc ||
    user.name ||
    user.username ||
    user.circle ||
    user.job ||
    user.email ||
    user.phone
  );
};

const importUsersFromRows = async (
  rows,
  targetCircle = "",
  allowedCircles = null
) => {
  const errors = [];
  const validRows = [];
  const cleanTargetCircle = normalizeValue(targetCircle);

  const allowedCircleSet = Array.isArray(allowedCircles)
    ? new Set(
        allowedCircles.map((circle) =>
          String(circle).trim().toUpperCase()
        )
      )
    : null;

  const circles = await Circle.find({ active: true });

  if (!rows.length) {
    return {
      inserted: 0,
      updated: 0,
      skipped: 0,
      errors: [{ row: 0, message: "El archivo no contiene registros." }],
    };
  }

  const headers = Object.keys(rows[0]);
  const seenDni = new Set();

  rows.forEach((row, index) => {
    const excelRow = index + 2;
    const user = mapRow(row, headers);

    // Una fila completamente vacía no representa a ningún miembro.
    if (!hasAnyMemberData(user)) {
      errors.push({
        row: excelRow,
        message: "La fila está completamente vacía.",
      });
      return;
    }

    // DNI y nombre pueden quedar vacíos. Solo comprobamos duplicados
    // cuando realmente existe un DNI.
    if (user.doc) {
      if (seenDni.has(user.doc)) {
        errors.push({
          row: excelRow,
          dni: user.doc,
          message: "El DNI está duplicado dentro del archivo.",
        });
        return;
      }
      seenDni.add(user.doc);
    }

    // El círculo destino siempre lo determina el selector de la interfaz.
    if (!cleanTargetCircle) {
      errors.push({
        row: excelRow,
        message: "El círculo destino es obligatorio.",
      });
      return;
    }

    const matchingCircle = circles.find(
      (circle) =>
        String(circle.name || "").trim().toUpperCase() ===
        cleanTargetCircle.toUpperCase()
    );

    if (!matchingCircle) {
      errors.push({
        row: excelRow,
        dni: user.doc || "",
        message: `El círculo destino "${cleanTargetCircle}" no existe o está inactivo.`,
      });
      return;
    }

    if (
      allowedCircleSet &&
      !allowedCircleSet.has(cleanTargetCircle.toUpperCase())
    ) {
      errors.push({
        row: excelRow,
        dni: user.doc || "",
        message: `No tienes permisos para importar miembros al círculo "${cleanTargetCircle}".`,
      });
      return;
    }

    validRows.push({
      ...user,
      circle: matchingCircle.name,
      excelRow,
    });
  });

  // Solo buscamos usuarios existentes cuando hay DNIs reales.
  const docs = validRows
    .map((row) => row.doc)
    .filter(Boolean);

  const existingUsers = docs.length
    ? await User.find({ doc: { $in: docs } }).select("doc active")
    : [];

  const existingDocs = new Set(existingUsers.map((user) => user.doc));
  const usersToInsert = [];
  let skipped = 0;
  let updated = 0;

  for (const row of validRows) {
    // Un DNI permite actualizar al usuario existente.
    if (row.doc && existingDocs.has(row.doc)) {
      const existingUser = await User.findOne({ doc: row.doc });

      if (!existingUser) {
        skipped++;
        continue;
      }

      const changed =
        String(existingUser.name || "") !== String(row.name || "") ||
        String(existingUser.username || "") !== String(row.username || "") ||
        String(existingUser.circle || "") !== String(row.circle || "") ||
        String(existingUser.job || "") !== String(row.job || "") ||
        String(existingUser.email || "") !== String(row.email || "") ||
        String(existingUser.phone || "") !== String(row.phone || "");

      const wasInactive = existingUser.active === false;

      if (changed || wasInactive) {
        existingUser.name = row.name || "";
        existingUser.username = row.username || "";
        existingUser.circle = row.circle;
        existingUser.job = row.job || "";
        existingUser.email = row.email || "";
        existingUser.phone = row.phone || "";
        existingUser.active = true;
        existingUser.deletedAt = null;
        existingUser.deletedBy = "";
        await existingUser.save();
        updated++;
      } else {
        skipped++;
      }

      continue;
    }

    // Para un DNI vacío NO enviamos doc: "" a MongoDB. Se omite el campo
    // para que el índice sparse permita múltiples miembros sin DNI.
    const newUser = {
      name: row.name || "",
      username: row.username || "",
      circle: row.circle,
      job: row.job || "",
      email: row.email || "",
      phone: row.phone || "",
    };

    if (row.doc) {
      newUser.doc = row.doc;
    }

    usersToInsert.push(newUser);
  }

  let inserted = 0;

  if (usersToInsert.length) {
    const created = await User.insertMany(usersToInsert, {
      ordered: false,
    });
    inserted = created.length;
  }

  return {
    inserted,
    updated,
    skipped,
    errors,
  };
};

const previewUsersFromRows = async (rows) => {
  const errors = [];
  const validRows = [];

  if (!Array.isArray(rows) || !rows.length) {
    return {
      validRows: [],
      errors: [{ row: 0, message: "El archivo no contiene registros." }],
    };
  }

  const headers = Object.keys(rows[0] || {});
  const seenDni = new Set();

  rows.forEach((row, index) => {
    const excelRow = index + 2;
    const user = mapRow(row, headers);

    if (!hasAnyMemberData(user)) {
      errors.push({
        row: excelRow,
        message: "La fila está completamente vacía.",
      });
      return;
    }

    if (user.doc) {
      if (seenDni.has(user.doc)) {
        errors.push({
          row: excelRow,
          dni: user.doc,
          message: "El DNI está duplicado dentro del archivo.",
        });
        return;
      }
      seenDni.add(user.doc);
    }

    validRows.push({
      doc: user.doc || "",
      name: user.name || "",
      username: user.username || "",
      circle: user.circle || "",
      job: user.job || "",
      email: user.email || "",
      phone: user.phone || "",
      excelRow,
    });
  });

  return { validRows, errors };
};

module.exports = {
  importUsersFromRows,
  previewUsersFromRows,
};
