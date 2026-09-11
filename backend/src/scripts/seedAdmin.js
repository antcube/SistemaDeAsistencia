require("dotenv").config();

const bcrypt = require("bcryptjs");

const connectDatabase = require("../config/database");
const Admin = require("../models/Admin");

const seedAdmin = async () => {
  try {
    await connectDatabase();

    const existingAdmin = await Admin.findOne({
      adminId: "ADM-001",
    });

    if (existingAdmin) {
      console.log("ADM-001 ya existe.");

      process.exit(0);
    }

    const passwordHash = await bcrypt.hash(
      "2026",
      10
    );

    await Admin.create({
      adminId: "ADM-001",

      doc: "00000000",

      name: "Administrador Principal",

      email: "admin@empresa.com",

      passwordHash,

      role: "Administrador General",

      circleScope: ["Todos los Círculos"],

      active: true,
    });

    console.log(
      "Administrador Principal ADM-001 creado correctamente."
    );

    console.log(
      "Correo: admin@empresa.com"
    );

    console.log(
      "Contraseña inicial: 2026"
    );

    process.exit(0);
  } catch (error) {
    console.error(
      "Error creando ADM-001:",
      error
    );

    process.exit(1);
  }
};

seedAdmin();