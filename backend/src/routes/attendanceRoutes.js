const express = require("express");

const {
  setAttendance,
  getMeetingAttendance,
  getMonthAttendance,
  getUserMonthlyAttendance,
  getUserMonthlyAttendanceByDni,
  registerAttendanceByQr,
  deleteAttendance,
  countMonthlyJustifications,
  getJustificationLimit,
} = require("../controllers/attendanceController");

const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

/*
|--------------------------------------------------------------------------
| RUTAS PÚBLICAS
|--------------------------------------------------------------------------
*/

router.post(
  "/qr",
  registerAttendanceByQr
);

router.get(
  "/monthly-by-dni",
  getUserMonthlyAttendanceByDni
);

/*
|--------------------------------------------------------------------------
| RUTAS ADMINISTRATIVAS
|--------------------------------------------------------------------------
*/

router.use(
  authMiddleware
);

router.get(
  "/month",
  getMonthAttendance
);

router.get(
  "/meeting/:meetingId",
  getMeetingAttendance
);

router.get(
  "/monthly",
  getUserMonthlyAttendance
);

router.post(
  "/",
  setAttendance
);

router.delete(
  "/:id",
  deleteAttendance
);

router.get(
  "/justifications/count",
  countMonthlyJustifications
);

router.get(
  "/justifications/limit",
  getJustificationLimit
);

module.exports = router;