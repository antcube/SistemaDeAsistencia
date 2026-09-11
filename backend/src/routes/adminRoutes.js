const express = require("express");

const {
  login,
  getCurrentAdmin,
  getAdmins,
  getAdminById,
  createAdmin,
  updateAdmin,
  deleteAdmin,
} = require("../controllers/adminController");

const authMiddleware = require("../middleware/authMiddleware");

const {
  requireGlobalAdministrator,
} = require("../middleware/permissionMiddleware");

const router =
  express.Router();

// ============================================
// LOGIN
// ============================================

router.post(
  "/login",
  login
);

// ============================================
// SESIÓN ACTUAL
// ============================================

router.get(
  "/me",
  authMiddleware,
  getCurrentAdmin
);

// ============================================
// ADMINISTRADORES
// SOLO ADMINISTRADOR GENERAL
// ============================================

router.get(
  "/",
  authMiddleware,
  requireGlobalAdministrator,
  getAdmins
);

router.get(
  "/:id",
  authMiddleware,
  requireGlobalAdministrator,
  getAdminById
);

router.post(
  "/",
  authMiddleware,
  requireGlobalAdministrator,
  createAdmin
);

router.put(
  "/:id",
  authMiddleware,
  requireGlobalAdministrator,
  updateAdmin
);

router.delete(
  "/:id",
  authMiddleware,
  requireGlobalAdministrator,
  deleteAdmin
);

module.exports = router;