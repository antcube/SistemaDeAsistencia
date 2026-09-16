const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const { requireGlobalAdministrator } = require("../middleware/permissionMiddleware");
const dashboardController = require("../controllers/dashboardController");

const router = express.Router();

router.get(
  "/",
  authMiddleware,
  requireGlobalAdministrator,
  dashboardController.getDashboard
);

module.exports = router;
