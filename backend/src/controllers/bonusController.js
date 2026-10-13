const {
  evaluateBonusUsers,
  getSummary,
  buildProcessedWorkbook,
} = require("../services/bonusService");

const parsePaymentPeriod = (req) => {
  const paymentYear = Number(req.body?.year);
  const paymentMonth = Number(req.body?.month);

  if (
    !Number.isInteger(paymentYear) ||
    !Number.isInteger(paymentMonth) ||
    paymentMonth < 1 ||
    paymentMonth > 12
  ) {
    throw new Error("Selecciona un mes y año de pago válidos.");
  }

  return { paymentYear, paymentMonth };
};

const previewBonuses = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        message: "Debes seleccionar un archivo Excel.",
      });
    }

    const { paymentYear, paymentMonth } = parsePaymentPeriod(req);

    const evaluation = await evaluateBonusUsers({
      buffer: req.file.buffer,
      paymentYear,
      paymentMonth,
    });

    const summary = getSummary(evaluation);

    return res.json({
      payment: {
        year: paymentYear,
        month: paymentMonth,
      },
      evaluated: evaluation.evaluatedMonth,
      summary,
      rows: evaluation.results.map((item) => ({
        username: item.usernameRaw,
        matched: item.matched,
        eligible: item.eligible,
        reason: item.reason,
        memberName: item.member?.name || "",
        circle: item.member?.circle || "",
        admissionDate: item.member?.ambassadorAdmissionDate || null,
      })),
    });
  } catch (error) {
    console.error("Error previsualizando bonos:", error);
    return res.status(500).json({
      message: error?.message || "No se pudo procesar el archivo de bonos.",
    });
  }
};

const processBonuses = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        message: "Debes seleccionar un archivo Excel.",
      });
    }

    const { paymentYear, paymentMonth } = parsePaymentPeriod(req);

    const evaluation = await evaluateBonusUsers({
      buffer: req.file.buffer,
      paymentYear,
      paymentMonth,
    });

    const output = await buildProcessedWorkbook({
      buffer: req.file.buffer,
      evaluation,
    });

    const fileName = `bonos_${paymentYear}_${String(paymentMonth).padStart(2, "0")}.xlsx`;

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${fileName}"`
    );

    return res.send(output);
  } catch (error) {
    console.error("Error generando Excel de bonos:", error);
    return res.status(500).json({
      message: error?.message || "No se pudo generar el archivo de bonos.",
    });
  }
};

module.exports = {
  previewBonuses,
  processBonuses,
};
