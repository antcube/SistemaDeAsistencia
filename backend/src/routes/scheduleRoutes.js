const express = require("express");

const {
  createSchedule,
  getSchedules,
  getScheduleById,
  generateScheduleMonth,
  migrateSchedule,
  terminateScheduleFromDate,
  deleteSchedule,
  restoreSchedule,
  updateSchedule,
} = require("../controllers/scheduleController");

const authMiddleware = require("../middleware/authMiddleware");

const {
  requireGlobalAdministrator,
} = require("../middleware/permissionMiddleware");

const router = express.Router();

// ============================================================
// CONSULTAS
// ============================================================

// Administrador: todas las programaciones.
// Gestor: solamente las que correspondan a sus círculos.
router.get(
  "/",
  authMiddleware,
  getSchedules
);

router.get(
  "/:id",
  authMiddleware,
  getScheduleById
);

// ============================================================
// ADMINISTRACIÓN DE PROGRAMACIONES
// ============================================================
// Solamente Administrador Principal.

router.post(
  "/",
  authMiddleware,
  requireGlobalAdministrator,
  createSchedule
);

router.put(
  "/:id",
  authMiddleware,
  requireGlobalAdministrator,
  updateSchedule
);

router.post(
  "/:id/generate-month",
  authMiddleware,
  requireGlobalAdministrator,
  generateScheduleMonth
);

router.post(
  "/:id/migrate",
  authMiddleware,
  requireGlobalAdministrator,
  migrateSchedule
);

router.post(
  "/:id/terminate-from-date",
  authMiddleware,
  requireGlobalAdministrator,
  terminateScheduleFromDate
);

router.delete(
  "/:id",
  authMiddleware,
  requireGlobalAdministrator,
  deleteSchedule
);

router.post(
  "/:id/restore",
  authMiddleware,
  requireGlobalAdministrator,
  restoreSchedule
);

module.exports = router;
