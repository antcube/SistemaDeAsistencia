const express = require("express");

const {
  getMeetings,
  getMeetingById,
  createMeeting,
  updateMeeting,
  deleteMeeting,
  restoreMeeting,
  getPublicQrMeeting,
  activateQr,
  deactivateQr,
} = require("../controllers/meetingController");

const authMiddleware = require("../middleware/authMiddleware");

const {
  requireGlobalAdministrator,
} = require("../middleware/permissionMiddleware");

const router = express.Router();

// Consulta pública utilizada por los QR de asistencia.
// Debe declararse antes del middleware de autenticación.
router.get(
  "/qr/:id",
  getPublicQrMeeting
);

// ============================================================
// CONSULTAS
// ============================================================

// Administrador: todas las reuniones.
// Gestor: solamente las reuniones de sus círculos.
router.get(
  "/",
  authMiddleware,
  getMeetings
);

router.get(
  "/:id",
  authMiddleware,
  getMeetingById
);

// ============================================================
// ADMINISTRACIÓN DE REUNIONES
// ============================================================
// Solamente Administrador Principal.
// El Gestor puede ver/compartir sesiones, pero no modificarlas.

router.post(
  "/",
  authMiddleware,
  requireGlobalAdministrator,
  createMeeting
);

router.put(
  "/:id",
  authMiddleware,
  requireGlobalAdministrator,
  updateMeeting
);

router.delete(
  "/:id",
  authMiddleware,
  requireGlobalAdministrator,
  deleteMeeting
);

router.post(
  "/:id/restore",
  authMiddleware,
  requireGlobalAdministrator,
  restoreMeeting
);

// El QR puede ser activado/desactivado por el Administrador Principal
// o por un Gestor de Círculo que tenga acceso al círculo de la reunión.
// El controlador valida el alcance del círculo.
router.post(
  "/:id/qr/activate",
  authMiddleware,
  activateQr
);

router.post(
  "/:id/qr/deactivate",
  authMiddleware,
  deactivateQr
);

module.exports = router;
