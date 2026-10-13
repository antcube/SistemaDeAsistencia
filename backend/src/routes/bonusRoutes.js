const express = require("express");
const multer = require("multer");

const authMiddleware = require("../middleware/authMiddleware");
const {
  requireGlobalAdministrator,
} = require("../middleware/permissionMiddleware");
const {
  previewBonuses,
  processBonuses,
} = require("../controllers/bonusController");

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const name = String(file.originalname || "").toLowerCase();
    if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
      cb(null, true);
      return;
    }

    cb(new Error("Solo se permiten archivos Excel (.xlsx o .xls)."));
  },
});

router.post(
  "/preview",
  authMiddleware,
  requireGlobalAdministrator,
  upload.single("file"),
  previewBonuses
);

router.post(
  "/process",
  authMiddleware,
  requireGlobalAdministrator,
  upload.single("file"),
  processBonuses
);

module.exports = router;
