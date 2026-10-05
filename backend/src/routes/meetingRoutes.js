const express = require("express");

const {
  getMeetings,
  getMeetingById,
  createMeeting,
  updateMeeting,
  deleteMeeting,
  restoreMeeting,
  moveMeeting,
  getPublicQrMeeting,
  activateQr,
  deactivateQr,
  deleteAllCorporateAnnouncements,
} = require("../controllers/meetingController");

const authMiddleware = require("../middleware/authMiddleware");

const {
  requireGlobalAdministrator,
} = require("../middleware/permissionMiddleware");

const router = express.Router();

router.get(
  "/qr/:id",
  getPublicQrMeeting
);

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

router.patch(
  "/:id/move",
  authMiddleware,
  requireGlobalAdministrator,
  moveMeeting
);

router.delete(
  "/anuncios-corporativos",
  authMiddleware,
  requireGlobalAdministrator,
  deleteAllCorporateAnnouncements
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
