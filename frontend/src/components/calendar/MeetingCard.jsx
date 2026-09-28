const typeClass = (type) => {
  const value = String(type || "")
    .trim()
    .toUpperCase();

  switch (value) {
    case "HEALTH":
      return "meeting-health";

    case "MENTORIA":
      return "meeting-mentoria";

    case "MASTERCLASS":
      return "meeting-masterclass";

    case "ANUNCIOS CORPORATIVOS":
      return "meeting-announcements";

    case "CIRCULO DE LIDERAZGO":
    default:
      return "meeting-leadership";
  }
};

// Convierte una hora de 24 horas a formato de 12 horas
// sin modificar el valor original almacenado en MongoDB.
const formatMeetingTime = (value) => {
  if (!value) {
    return "--:--";
  }

  const raw = String(value)
    .trim()
    .toUpperCase();

  // Si ya viene en formato AM/PM, solamente
  // normalizamos su presentación.
  const amPmMatch = raw.match(
    /^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)$/
  );

  if (amPmMatch) {
    const hour = Number(amPmMatch[1]);
    const minutes = amPmMatch[2];
    const period = amPmMatch[3];

    if (hour >= 1 && hour <= 12) {
      return `${hour}:${minutes} ${period}`;
    }

    return raw;
  }

  // Si viene en formato 24 horas, lo convertimos.
  const timeMatch = raw.match(
    /^(\d{1,2}):(\d{2})(?::\d{2})?$/
  );

  if (timeMatch) {
    const hour24 = Number(timeMatch[1]);
    const minutes = timeMatch[2];

    if (
      hour24 >= 0 &&
      hour24 <= 23
    ) {
      const period =
        hour24 >= 12
          ? "PM"
          : "AM";

      const hour12 =
        hour24 % 12 || 12;

      return `${hour12}:${minutes} ${period}`;
    }
  }

  // Si el valor no coincide con ningún formato
  // conocido, conservamos el valor original.
  return raw;
};

const MeetingCard = ({
  meeting,
  onEdit,
  onDelete,
  onQr,
}) => {
  if (!meeting) {
    return null;
  }

  const handleOpen = () => {
    onEdit?.(meeting);
  };

  const handleDelete = (event) => {
    event.stopPropagation();
    onDelete?.(meeting);
  };

  const handleQr = (event) => {
    event.stopPropagation();
    onQr?.(meeting);
  };

  return (
    <article
      className={`meeting-card ${typeClass(
        meeting.type
      )}`}
      onClick={handleOpen}
    >
      <div className="meeting-card-main">
        <strong>
          {meeting.title ||
            meeting.type ||
            "Reunión"}
        </strong>

        <span>
          {formatMeetingTime(
            meeting.time
          )}

          {meeting.endTime
            ? ` - ${formatMeetingTime(
                meeting.endTime
              )}`
            : ""}
        </span>
      </div>

      {(onDelete || onQr) && (
        <div
          className="meeting-card-actions"
          onClick={(event) =>
            event.stopPropagation()
          }
        >
          {onQr && (
            <button
              type="button"
              onClick={handleQr}
              title="Activar QR"
            >
              QR
            </button>
          )}

          {onDelete && (
            <button
              type="button"
              onClick={handleDelete}
              title="Eliminar"
            >
              ×
            </button>
          )}
        </div>
      )}
    </article>
  );
};

export default MeetingCard;