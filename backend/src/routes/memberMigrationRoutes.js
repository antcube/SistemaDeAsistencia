const express = require("express");

const {
  previewMemberMigration,
  migrateMember,
} = require("../controllers/memberMigrationController");

const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

router.post(
  "/preview",
  authMiddleware,
  previewMemberMigration
);

router.post(
  "/",
  authMiddleware,
  migrateMember
);

module.exports = router;