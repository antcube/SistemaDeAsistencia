const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const Admin = require("../models/Admin");

const {
  createAuditLog,
} = require("../services/auditService");

const ALLOWED_ADMIN_ROLES = [
  "Administrador General",
  "Gestor de Círculo",
];

const JWT_SECRET =
  process.env.JWT_SECRET || "ordenado_jwt_secret";

// ======================================================
// GENERAR TOKEN
// ======================================================

const generateToken = (admin) => {
  return jwt.sign(
    {
      id: admin._id,
      adminId: admin.adminId,
      role: admin.role,
      circleScope: admin.circleScope,
    },
    JWT_SECRET,
    {
      expiresIn: "8h",
    }
  );
};

// ======================================================
// NORMALIZAR CIRCLE SCOPE
// ======================================================

const normalizeCircleScope = (circleScope) => {
  if (Array.isArray(circleScope)) {
    return circleScope
      .map((circle) =>
        String(circle || "").trim()
      )
      .filter(Boolean);
  }

  if (circleScope) {
    return [
      String(circleScope).trim(),
    ].filter(Boolean);
  }

  return [];
};

// ======================================================
// LOGIN
// ======================================================

const login = async (req, res) => {
  try {
    const {
      email,
      password,
    } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message:
          "Correo y contraseña son obligatorios",
      });
    }

    const admin =
      await Admin.findOne({
        email: String(email)
          .trim()
          .toLowerCase(),
      });

    if (!admin) {
      return res.status(401).json({
        message:
          "Credenciales incorrectas",
      });
    }

    if (!admin.active) {
      return res.status(403).json({
        message:
          "Esta cuenta administrativa está desactivada",
      });
    }

    const passwordCorrect =
      await bcrypt.compare(
        String(password),
        admin.passwordHash
      );

    if (!passwordCorrect) {
      return res.status(401).json({
        message:
          "Credenciales incorrectas",
      });
    }

    admin.lastLoginAt =
      new Date();

    await admin.save();

    const token =
      generateToken(admin);

    res.json({
      message:
        "Inicio de sesión correcto",
      token,

      admin: {
        id: admin._id,
        adminId:
          admin.adminId,
        doc: admin.doc,
        name: admin.name,
        email: admin.email,
        role: admin.role,
        circleScope:
          admin.circleScope,
        active:
          admin.active,
      },
    });
  } catch (error) {
    console.error(
      "Error en login:",
      error
    );

    res.status(500).json({
      message:
        "Error al iniciar sesión",
    });
  }
};

// ======================================================
// OBTENER PERFIL DEL ADMINISTRADOR ACTUAL
// ======================================================

const getCurrentAdmin =
  async (req, res) => {
    try {
      const admin =
        await Admin.findById(
          req.user.id
        ).select(
          "-passwordHash"
        );

      if (!admin) {
        return res.status(404).json({
          message:
            "Administrador no encontrado",
        });
      }

      res.json(admin);
    } catch (error) {
      console.error(
        "Error obteniendo administrador actual:",
        error
      );

      res.status(500).json({
        message:
          "Error al obtener el administrador",
      });
    }
  };

// ======================================================
// OBTENER ADMINISTRADORES
// ======================================================

const getAdmins =
  async (req, res) => {
    try {
      const admins =
        await Admin.find()
          .select(
            "-passwordHash"
          )
          .sort({
            name: 1,
          });

      res.json(admins);
    } catch (error) {
      console.error(
        "Error obteniendo administradores:",
        error
      );

      res.status(500).json({
        message:
          "Error al obtener los administradores",
      });
    }
  };

// ======================================================
// OBTENER ADMINISTRADOR POR ID
// ======================================================

const getAdminById =
  async (req, res) => {
    try {
      const admin =
        await Admin.findById(
          req.params.id
        ).select(
          "-passwordHash"
        );

      if (!admin) {
        return res.status(404).json({
          message:
            "Administrador no encontrado",
        });
      }

      res.json(admin);
    } catch (error) {
      console.error(
        "Error obteniendo administrador:",
        error
      );

      res.status(500).json({
        message:
          "Error al obtener el administrador",
      });
    }
  };

// ======================================================
// CREAR ADMINISTRADOR
// ======================================================

const createAdmin =
  async (req, res) => {
    try {
      const {
        adminId,
        doc,
        name,
        email,
        password,
        role,
        circleScope,
      } = req.body;

      if (
        !adminId ||
        !name ||
        !email ||
        !password ||
        !role
      ) {
        return res.status(400).json({
          message:
            "ID administrativo, nombre, correo, contraseña y rol son obligatorios",
        });
      }

      if (!ALLOWED_ADMIN_ROLES.includes(role)) {
        return res.status(400).json({
          message:
            "El rol seleccionado no está permitido. Solo Administrador General y Gestor de Círculo están disponibles.",
        });
      }

      const normalizedAdminId =
        String(adminId).trim();

      const normalizedEmail =
        String(email)
          .trim()
          .toLowerCase();

      const existingAdmin =
        await Admin.findOne({
          $or: [
            {
              adminId:
                normalizedAdminId,
            },
            {
              email:
                normalizedEmail,
            },
          ],
        });

      if (existingAdmin) {
        return res.status(409).json({
          message:
            "Ya existe un administrador con ese ID o correo",
        });
      }

      if (
        String(password).length < 4
      ) {
        return res.status(400).json({
          message:
            "La contraseña debe tener al menos 4 caracteres",
        });
      }

      let normalizedScope =
        normalizeCircleScope(
          circleScope
        );

      // ==================================================
      // ADMINISTRADOR GENERAL
      // ==================================================

      if (
        role ===
        "Administrador General"
      ) {
        normalizedScope = [
          "Todos los Círculos",
        ];
      }

      // ==================================================
      // DEMÁS ROLES
      // ==================================================

      if (
        role !==
          "Administrador General" &&
        normalizedScope.length === 0
      ) {
        return res.status(400).json({
          message:
            "Debe asignarse al menos un círculo",
        });
      }

      const passwordHash =
        await bcrypt.hash(
          String(password),
          10
        );

      const admin =
        await Admin.create({
          adminId:
            normalizedAdminId,
          doc: doc
            ? String(doc).trim()
            : "",
          name:
            String(name).trim(),
          email:
            normalizedEmail,
          passwordHash,
          role,
          circleScope:
            normalizedScope,
          active: true,
        });

      await createAuditLog({
        admin: req.user || req.admin,
        action: "CREATE_ADMIN",
        module: "admins",
        description: `Se creó el usuario administrativo ${admin.name} (${admin.role}).`,
        targetId: admin._id,
        targetName: admin.name,
        circle: admin.circleScope?.join(", ") || "",
        metadata: {
          adminId: admin.adminId,
          doc: admin.doc,
          name: admin.name,
          email: admin.email,
          role: admin.role,
          circleScope: admin.circleScope,
          active: admin.active,
        },
      });

      const responseAdmin =
        admin.toObject();

      delete responseAdmin.passwordHash;

      res.status(201).json(
        responseAdmin
      );
    } catch (error) {
      console.error(
        "Error creando administrador:",
        error
      );

      res.status(500).json({
        message:
          "Error al crear el administrador",
      });
    }
  };

// ======================================================
// ACTUALIZAR ADMINISTRADOR
// ======================================================

const updateAdmin =
  async (req, res) => {
    try {
      const admin =
        await Admin.findById(
          req.params.id
        );

      if (!admin) {
        return res.status(404).json({
          message:
            "Administrador no encontrado",
        });
      }

      const {
        adminId,
        doc,
        name,
        email,
        password,
        role,
        circleScope,
        active,
      } = req.body;

      const previousAdmin = {
        adminId: admin.adminId,
        doc: admin.doc,
        name: admin.name,
        email: admin.email,
        role: admin.role,
        circleScope: admin.circleScope,
        active: admin.active,
      };

      // ==================================================
      // ID ADMINISTRATIVO
      // ==================================================

      if (
        adminId !== undefined
      ) {
        const normalizedAdminId =
          String(adminId).trim();

        if (
          !normalizedAdminId
        ) {
          return res.status(400).json({
            message:
              "El ID administrativo no puede estar vacío",
          });
        }

        const duplicate =
          await Admin.findOne({
            _id: {
              $ne: admin._id,
            },
            adminId:
              normalizedAdminId,
          });

        if (duplicate) {
          return res.status(409).json({
            message:
              "Ese ID administrativo ya está en uso",
          });
        }

        admin.adminId =
          normalizedAdminId;
      }

      // ==================================================
      // NOMBRE
      // ==================================================

      if (
        name !== undefined
      ) {
        if (
          !String(name).trim()
        ) {
          return res.status(400).json({
            message:
              "El nombre no puede estar vacío",
          });
        }

        admin.name =
          String(name).trim();
      }

      // ==================================================
      // DNI / DOCUMENTO
      // ==================================================

      if (
        doc !== undefined
      ) {
        admin.doc =
          String(doc).trim();
      }

      // ==================================================
      // EMAIL
      // ==================================================

      if (
        email !== undefined
      ) {
        const normalizedEmail =
          String(email)
            .trim()
            .toLowerCase();

        const duplicateEmail =
          await Admin.findOne({
            _id: {
              $ne: admin._id,
            },
            email:
              normalizedEmail,
          });

        if (duplicateEmail) {
          return res.status(409).json({
            message:
              "Ese correo ya está en uso",
          });
        }

        admin.email =
          normalizedEmail;
      }

      // ==================================================
      // ROL
      // ==================================================

      if (
        role !== undefined
      ) {
        if (!ALLOWED_ADMIN_ROLES.includes(role)) {
          return res.status(400).json({
            message:
              "El rol seleccionado no está permitido. Solo Administrador General y Gestor de Círculo están disponibles.",
          });
        }

        admin.role = role;
      }

      // ==================================================
      // CÍRCULOS ASIGNADOS
      // ==================================================

      if (
        circleScope !== undefined
      ) {
        admin.circleScope =
          normalizeCircleScope(
            circleScope
          );
      }

      // ==================================================
      // ADMINISTRADOR GENERAL
      // ==================================================

      if (
        admin.role ===
        "Administrador General"
      ) {
        admin.circleScope = [
          "Todos los Círculos",
        ];
      }

      // ==================================================
      // ROLES CON ALCANCE
      // ==================================================

      if (
        admin.role !==
          "Administrador General" &&
        admin.circleScope.length === 0
      ) {
        return res.status(400).json({
          message:
            "Debe asignarse al menos un círculo",
        });
      }

      // ==================================================
      // CONTRASEÑA
      // ==================================================

      if (
        password !== undefined &&
        String(password).length > 0
      ) {
        if (
          String(password).length < 4
        ) {
          return res.status(400).json({
            message:
              "La contraseña debe tener al menos 4 caracteres",
          });
        }

        admin.passwordHash =
          await bcrypt.hash(
            String(password),
            10
          );
      }

      // ==================================================
      // ESTADO
      // ==================================================

      if (
        active !== undefined
      ) {
        admin.active =
          Boolean(active);
      }

      // ADM-001 siempre permanece
      // activo como administrador principal.
      if (
        admin.adminId ===
        "ADM-001"
      ) {
        admin.active = true;
        admin.role =
          "Administrador General";
        admin.circleScope = [
          "Todos los Círculos",
        ];
      }

      const updatedAdmin =
        await admin.save();

      await createAuditLog({
        admin: req.user || req.admin,
        action: "UPDATE_ADMIN",
        module: "admins",
        description: `Se actualizó el usuario administrativo ${updatedAdmin.name}.`,
        targetId: updatedAdmin._id,
        targetName: updatedAdmin.name,
        circle: updatedAdmin.circleScope?.join(", ") || "",
        metadata: {
          previous: previousAdmin,
          current: {
            adminId: updatedAdmin.adminId,
            doc: updatedAdmin.doc,
            name: updatedAdmin.name,
            email: updatedAdmin.email,
            role: updatedAdmin.role,
            circleScope: updatedAdmin.circleScope,
            active: updatedAdmin.active,
          },
          passwordChanged:
            password !== undefined && String(password).length > 0,
        },
      });

      const responseAdmin =
        updatedAdmin.toObject();

      delete responseAdmin.passwordHash;

      res.json(
        responseAdmin
      );
    } catch (error) {
      console.error(
        "Error actualizando administrador:",
        error
      );

      res.status(500).json({
        message:
          "Error al actualizar el administrador",
      });
    }
  };

// ======================================================
// DESACTIVAR ADMINISTRADOR
// ======================================================

const deleteAdmin =
  async (req, res) => {
    try {
      const admin =
        await Admin.findById(
          req.params.id
        );

      if (!admin) {
        return res.status(404).json({
          message:
            "Administrador no encontrado",
        });
      }

      // ==================================================
      // ADMINISTRADOR PRINCIPAL
      // ==================================================

      if (
        admin.adminId ===
        "ADM-001"
      ) {
        return res.status(403).json({
          message:
            "El Administrador Principal ADM-001 no puede eliminarse",
        });
      }

      // ==================================================
      // DESACTIVACIÓN
      // ==================================================

      admin.active = false;

      await admin.save();

      await createAuditLog({
        admin: req.user || req.admin,
        action: "DEACTIVATE_ADMIN",
        module: "admins",
        description: `Se desactivó el usuario administrativo ${admin.name}.`,
        targetId: admin._id,
        targetName: admin.name,
        circle: admin.circleScope?.join(", ") || "",
        metadata: {
          adminId: admin.adminId,
          role: admin.role,
          circleScope: admin.circleScope,
          active: false,
        },
      });

      res.json({
        message:
          "Administrador desactivado correctamente",
      });
    } catch (error) {
      console.error(
        "Error desactivando administrador:",
        error
      );

      res.status(500).json({
        message:
          "Error al desactivar el administrador",
      });
    }
  };

module.exports = {
  login,
  getCurrentAdmin,
  getAdmins,
  getAdminById,
  createAdmin,
  updateAdmin,
  deleteAdmin,
};