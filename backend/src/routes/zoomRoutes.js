const express = require("express");
const multer = require("multer");

const authMiddleware = require("../middleware/authMiddleware");

const zoomController = require("../controllers/zoomController");

const router =
  express.Router();

const upload =
  multer({
    storage:
      multer.memoryStorage(),

    limits: {
      fileSize:
        10 * 1024 * 1024,
    },

    fileFilter: (
      req,
      file,
      cb
    ) => {
      const allowedMimeTypes = [
        "text/csv",

        "application/csv",

        "application/vnd.ms-excel",

        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ];

      const allowedExtensions =
        [
          ".csv",
          ".xls",
          ".xlsx",
        ];

      const originalName =
        String(
          file.originalname ||
            ""
        ).toLowerCase();

      const extension =
        allowedExtensions.find(
          (item) =>
            originalName.endsWith(
              item
            )
        );

      if (
        allowedMimeTypes.includes(
          file.mimetype
        ) ||
        extension
      ) {
        cb(null, true);
      } else {
        cb(
          new Error(
            "Solo se permiten archivos CSV o Excel de Zoom."
          )
        );
      }
    },
  });

router.get(
  "/info",
  authMiddleware,
  zoomController.getInfo
);

router.post(
  "/process",
  authMiddleware,
  upload.single("file"),
  zoomController.processReport
);

module.exports = router;