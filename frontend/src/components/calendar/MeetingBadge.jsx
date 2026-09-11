const getTypeShortName = (type = "") => {
  const map = {
    "CIRCULO DE LIDERAZGO":
      "LIDERAZGO",
    "CIRCULO DE LIDERAZGO":
      "LIDERAZGO",
    HEALTH: "HEALTH",
    MENTORIA: "MENTORÍA",
    MASTERCLASS: "MASTERCLASS",
    "ANUNCIOS CORPORATIVOS":
      "ANUNCIOS",
    ORDINARIA: "ORDINARIA",
  };

  return map[type] || type;
};

const MeetingBadge = ({
  meeting,
  onClick,
}) => {
  const handleClick = () => {
    if (onClick) {
      onClick(meeting);
    }
  };

  return (
    <button
      type="button"
      className="meeting-badge"
      onClick={handleClick}
      title={`${meeting.type || ""} - ${
        meeting.title || "Reunión"
      }`}
    >
      <div className="meeting-badge-top">
        <span className="meeting-badge-time">
          {meeting.time || "--:--"}
        </span>

        <span className="meeting-badge-type">
          {getTypeShortName(meeting.type)}
        </span>
      </div>

      <span className="meeting-badge-title">
        {meeting.title || "Sin título"}
      </span>

      <span className="meeting-badge-circle">
        {meeting.circle || "Sin círculo"}
      </span>
    </button>
  );
};

export default MeetingBadge;