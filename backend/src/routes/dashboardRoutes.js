const express = require("express");

const authMiddleware = require("../middleware/authMiddleware");
const dashboardController = require("../controllers/dashboardController");

const router = express.Router();

router.get(
  "/",
  authMiddleware,
  dashboardController.getDashboard
);

module.exports = router;