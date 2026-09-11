const express = require("express");
const multer = require("multer");

const {
  importUsers,
  previewUsers,
  downloadUsersTemplate,
} = require("../controllers/importController");

const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: 10 * 1024 * 1024,
  },

  fileFilter: (req, file, cb) => {
    const allowed = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
    ];

    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Solo se permiten archivos Excel."));
    }
  },
});

// Administrador y Gestor pueden descargar la plantilla.
router.get(
  "/users/template",
  authMiddleware,
  downloadUsersTemplate
);

router.post(
  "/users/preview",
  authMiddleware,
  upload.single("file"),
  previewUsers
);

// Administrador: todos los círculos.
// Gestor: únicamente sus círculos.
router.post(
  "/users",
  authMiddleware,
  upload.single("file"),
  importUsers
);

module.exports = router;
