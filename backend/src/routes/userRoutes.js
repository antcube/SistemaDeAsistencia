const express = require("express");

const {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
} = require("../controllers/userController");

const authMiddleware = require("../middleware/authMiddleware");

const {
  requireGlobalAdministrator,
} = require("../middleware/permissionMiddleware");

const router = express.Router();

// ============================================================
// MIEMBROS
// ============================================================

// Listar / buscar / filtrar
router.get(
  "/",
  authMiddleware,
  getUsers
);

// Obtener uno
router.get(
  "/:id",
  authMiddleware,
  getUserById
);

// Crear: Administrador o Gestor dentro de sus círculos
router.post(
  "/",
  authMiddleware,
  createUser
);

// Editar: Administrador o Gestor dentro de sus círculos
router.put(
  "/:id",
  authMiddleware,
  updateUser
);

// Eliminar: únicamente Administrador Principal
router.delete(
  "/:id",
  authMiddleware,
  requireGlobalAdministrator,
  deleteUser
);

module.exports = router;
