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
          {meeting.time || "--:--"}
          {meeting.endTime
            ? ` - ${meeting.endTime}`
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