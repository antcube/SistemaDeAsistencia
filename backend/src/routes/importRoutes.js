    const express = require("express");
    const multer = require("multer");

    const {
      importUsers,
      previewUsers,
      commitUsers,
      downloadUsersTemplate,
    } = require("../controllers/importController");

    const authMiddleware = require("../middleware/authMiddleware");
    const router = express.Router();

    const upload = multer({
      storage: multer.memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (req, file, cb) => {
        const allowed = [
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "application/vnd.ms-excel",
          "application/octet-stream",
        ];

        const extension = String(file.originalname || "").toLowerCase();
        const isExcelExtension = extension.endsWith(".xlsx") || extension.endsWith(".xls");

        if (allowed.includes(file.mimetype) || isExcelExtension) cb(null, true);
        else cb(new Error("Solo se permiten archivos Excel (.xlsx o .xls)."));
      },
    });

    router.get("/users/template", authMiddleware, downloadUsersTemplate);
    router.post("/users/preview", authMiddleware, upload.single("file"), previewUsers);
    router.post("/users/commit", authMiddleware, express.json({ limit: "2mb" }), commitUsers);
    router.post("/users", authMiddleware, upload.single("file"), importUsers);

    module.exports = router;
