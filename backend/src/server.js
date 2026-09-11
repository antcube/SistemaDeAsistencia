const express = require("express");
const cors = require("cors");

require("dotenv").config();

const connectDatabase =
  require("./config/database");

const adminRoutes =
  require("./routes/adminRoutes");

const meetingRoutes =
  require("./routes/meetingRoutes");

const userRoutes =
  require("./routes/userRoutes");

const circleRoutes =
  require("./routes/circleRoutes");

const scheduleRoutes =
  require("./routes/scheduleRoutes");

const reportRoutes =
  require("./routes/reportRoutes");

const attendanceRoutes =
  require("./routes/attendanceRoutes");

const auditRoutes =
  require("./routes/auditRoutes");

const importRoutes =
  require("./routes/importRoutes");

const dashboardRoutes =
  require("./routes/dashboardRoutes");

const zoomRoutes =
  require("./routes/zoomRoutes");

const app =
  express();

app.use(
  cors()
);

app.use(
  express.json()
);

// ============================================================
// RUTAS PRINCIPALES
// ============================================================

app.use(
  "/api/users",
  userRoutes
);

app.use(
  "/api/meetings",
  meetingRoutes
);

app.use(
  "/api/circles",
  circleRoutes
);

app.use(
  "/api/attendance",
  attendanceRoutes
);

app.use(
  "/api/schedules",
  scheduleRoutes
);

app.use(
  "/api/reports",
  reportRoutes
);

app.use(
  "/api/admins",
  adminRoutes
);

app.use(
  "/api/audit",
  auditRoutes
);

app.use(
  "/api/import",
  importRoutes
);

app.use(
  "/api/dashboard",
  dashboardRoutes
);

// ============================================================
// ZOOM
// ============================================================

app.use(
  "/api/zoom",
  zoomRoutes
);

// ============================================================
// HEALTH CHECK
// ============================================================

app.get(
  "/",
  (req, res) => {
    res.json({
      message:
        "API del Sistema de Asistencia funcionando",
    });
  }
);

// ============================================================
// SERVIDOR
// ============================================================

const PORT =
  process.env.PORT || 5000;

const startServer =
  async () => {
    try {
      await connectDatabase();

      app.listen(
        PORT,
        () => {
          console.log(
            `Servidor ejecutándose en http://localhost:${PORT}`
          );
        }
      );
    } catch (error) {
      console.error(
        "No se pudo iniciar el servidor:",
        error.message
      );

      process.exit(1);
    }
  };

startServer();