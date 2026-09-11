const express = require("express");

const {
  getAuditLogs,
} = require("../controllers/auditController");

const authMiddleware = require("../middleware/authMiddleware");

const router =
  express.Router();

router.get(
  "/",
  authMiddleware,
  getAuditLogs
);

module.exports = router;