const express = require("express");

const {
  getMonthlyReport,
} = require("../controllers/reportController");

const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

router.get(
  "/monthly",
  authMiddleware,
  getMonthlyReport
);

module.exports = router;