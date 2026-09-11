const STATUS_OPTIONS = [
  "No asistió",
  "Asistió",
  "Justificado",
  "Clase Presencial",
];

const normalizeStatus = (status) => {
  if (status === "Faltó") {
    return "No asistió";
  }

  return status || "No asistió";
};

const AttendanceStatus = ({
  value,
  status,
  onChange,
  disabled = false,
}) => {
  const currentStatus = normalizeStatus(
    value ?? status
  );

  const normalized =
    String(currentStatus)
      .trim()
      .toLowerCase();

  let className =
    "attendance-status";

  if (
    normalized === "asistió" ||
    normalized === "asistio"
  ) {
    className +=
      " attendance-status-asistio";
  } else if (
    normalized === "clase presencial"
  ) {
    className +=
      " attendance-status-clase-presencial";
  } else if (
    normalized === "justificado"
  ) {
    className +=
      " attendance-status-justificado";
  } else {
    className +=
      " attendance-status-no-asistio";
  }

  return (
    <select
      className={className}
      value={currentStatus}
      onChange={(event) => {
        if (onChange) {
          onChange(event.target.value);
        }
      }}
      disabled={disabled}
      aria-label="Estado de asistencia"
    >
      {STATUS_OPTIONS.map((option) => (
        <option
          key={option}
          value={option}
        >
          {option}
        </option>
      ))}
    </select>
  );
};

export default AttendanceStatus;