const express = require("express");

const {
  getAuditLogs,
  undoAuditLog,
} = require("../controllers/auditController");

const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/", authMiddleware, getAuditLogs);
router.post("/:id/undo", authMiddleware, undoAuditLog);

module.exports = router;
