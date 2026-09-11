import { useCallback, useEffect, useMemo, useState } from "react";

import AttendanceFilters from "../components/attendance/AttendanceFilters";
import AttendanceTable from "../components/attendance/AttendanceTable";
import AttendanceReport from "../components/attendance/AttendanceReport";
import NavigationArrow from "../components/common/NavigationArrow";
import attendanceService from "../services/attendanceService";
import circleService from "../services/circleService";

import "../styles/attendance.css";

const getCurrentMonth = () => {
  const now = new Date();

  return {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
  };
};

const Attendance = () => {
  const current = getCurrentMonth();

  const [year, setYear] = useState(current.year);
  const [month, setMonth] = useState(current.month);

  const [circles, setCircles] = useState([]);

  const [doc, setDoc] = useState("");
  const [circle, setCircle] = useState("");

  const [meetings, setMeetings] = useState([]);
  const [attendance, setAttendance] = useState([]);

  const [loading, setLoading] = useState(false);
  const [loadingCircles, setLoadingCircles] = useState(true);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadCircles = useCallback(async () => {
    try {
      setLoadingCircles(true);

      const response = await circleService.getCircles();

      if (Array.isArray(response)) {
        setCircles(response);
      } else if (Array.isArray(response?.circles)) {
        setCircles(response.circles);
      } else {
        setCircles([]);
      }
    } catch (err) {
      console.error("Error cargando círculos:", err);

      setCircles([]);
    } finally {
      setLoadingCircles(false);
    }
  }, []);

  const loadAttendance = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      setSuccess("");

      const response =
        await attendanceService.getMonthAttendance(
          year,
          month,
          {
            doc,
            circle,
          }
        );

      const responseMeetings = Array.isArray(
        response?.meetings
      )
        ? response.meetings
        : [];

      const responseAttendance = Array.isArray(
        response?.attendance
      )
        ? response.attendance
        : [];

      setMeetings(responseMeetings);
      setAttendance(responseAttendance);
    } catch (err) {
      console.error(
        "Error cargando asistencia:",
        err
      );

      setError(
        err?.message ||
          "No se pudo cargar la asistencia."
      );

      setMeetings([]);
      setAttendance([]);
    } finally {
      setLoading(false);
    }
  }, [year, month, doc, circle]);

  useEffect(() => {
    loadCircles();
  }, [loadCircles]);

  useEffect(() => {
    loadAttendance();
  }, [loadAttendance]);

  const rows = useMemo(() => {
    const map = new Map();

    attendance.forEach((record) => {
      const user = record.user;

      if (!user) {
        return;
      }

      const key = String(user._id);

      if (!map.has(key)) {
        map.set(key, {
          user,
          doc: user.doc || record.doc,
          name: user.name || record.name,
          circle: user.circle || record.circle,
          job: user.job || "",
          attendance: {},
        });
      }

      const row = map.get(key);

      const meeting = record.meeting;

      if (meeting?._id) {
        row.attendance[meeting._id] = record;
      }
    });

    return Array.from(map.values()).sort((a, b) =>
      a.name.localeCompare(b.name, "es")
    );
  }, [attendance]);

  const moveMonth = (amount) => {
    const date = new Date(
      year,
      month - 1 + amount,
      1
    );

    setYear(date.getFullYear());
    setMonth(date.getMonth() + 1);
  };

 const handleStatusChange = async (
  row,
  meeting,
  newStatus
) => {
  try {
    setError("");
    setSuccess("");

    let justificationReason = "";

    if (newStatus === "Justificado") {
      justificationReason =
        window.prompt(
          "Motivo de la justificación:"
        ) || "";

      if (!justificationReason.trim()) {
        return;
      }
    }

    await attendanceService.registerAttendance({
    meetingId: meeting._id,
    doc: row.doc,
    status: newStatus,
    justificationReason,
    source: "ADMIN",
    attendanceMode:
    newStatus ===
    "Clase Presencial"
      ? "PRESENCIAL"
      : "MANUAL",
  });

    setSuccess(
      `Estado de ${row.name} actualizado correctamente.`
    );

    await loadAttendance();
  } catch (err) {
    console.error(
      "Error cambiando estado:",
      err
    );

    setError(
      err?.message ||
        "No se pudo actualizar el estado."
    );
  }
};

  const clearFilters = () => {
    setDoc("");
    setCircle("");
  };

  const monthLabel = new Date(
    year,
    month - 1,
    1
  ).toLocaleDateString("es-PE", {
    month: "long",
    year: "numeric",
  });

  return (
    <main className="attendance-page">
      <header className="attendance-page-header">
        <div>
          <span className="attendance-kicker">
            CONTROL DE ASISTENCIA
          </span>

          <h1>Asistencia</h1>

          <p>
            Gestiona los estados de
            asistencia del mes.
          </p>
        </div>

        <button
          type="button"
          className="attendance-refresh-button"
          onClick={loadAttendance}
          disabled={loading}
        >
          🔄 Actualizar
        </button>
      </header>

      {error && (
        <div className="attendance-message error">
          {error}
        </div>
      )}

      {success && (
        <div className="attendance-message success">
          {success}
        </div>
      )}

      <section className="attendance-toolbar">
        <div className="attendance-month-navigation">
          <NavigationArrow
            direction="left"
            onClick={() => moveMonth(-1)}
            label="Mes anterior"
          />

          <strong>
            {monthLabel.charAt(0).toUpperCase() +
              monthLabel.slice(1)}
          </strong>

          <NavigationArrow
            direction="right"
            onClick={() => moveMonth(1)}
            label="Mes siguiente"
          />
        </div>

        <AttendanceFilters
          circles={circles}
          doc={doc}
          circle={circle}
          onDocChange={setDoc}
          onCircleChange={setCircle}
          onSearch={loadAttendance}
          onClear={clearFilters}
        />
      </section>

      <section className="attendance-main-card">
        <AttendanceTable
          rows={rows}
          meetings={meetings}
          loading={loading}
          onStatusChange={handleStatusChange}
        />
      </section>

      <AttendanceReport
        rows={rows}
        meetings={meetings}
      />
    </main>
  );
};

export default Attendance;