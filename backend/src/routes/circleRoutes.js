const express = require("express");

const {
  getCircles,
  getCircleById,
  createCircle,
  updateCircle,
  deleteCircle,
} = require("../controllers/circleController");

const authMiddleware = require("../middleware/authMiddleware");

const {
  requireGlobalAdministrator,
} = require("../middleware/permissionMiddleware");

const router =
  express.Router();

/**
 * ============================================================
 * CONSULTAS
 * ============================================================
 */

router.get(
  "/",
  authMiddleware,
  getCircles
);

router.get(
  "/:id",
  authMiddleware,
  getCircleById
);

/**
 * ============================================================
 * ADMINISTRACIÓN DE CÍRCULOS
 * ============================================================
 *
 * Solamente Administrador General.
 */

router.post(
  "/",
  authMiddleware,
  requireGlobalAdministrator,
  createCircle
);

router.put(
  "/:id",
  authMiddleware,
  requireGlobalAdministrator,
  updateCircle
);

router.delete(
  "/:id",
  authMiddleware,
  requireGlobalAdministrator,
  deleteCircle
);

module.exports = router;