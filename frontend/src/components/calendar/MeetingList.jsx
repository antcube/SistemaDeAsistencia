import MeetingCard from "./MeetingCard";

const MeetingList = ({
  meetings = [],
  loading = false,
  onEdit,
  onDelete,
  onQr,
}) => {
  if (loading) {
    return (
      <div className="calendar-empty-state">
        <div className="calendar-loading-spinner" />
        <span>
          Cargando reuniones...
        </span>
      </div>
    );
  }

  if (!meetings.length) {
    return (
      <div className="calendar-empty-state">
        <strong>
          No hay reuniones programadas
        </strong>

        <span>
          No existen reuniones para este mes.
        </span>
      </div>
    );
  }

  return (
    <div className="meeting-list">
      {meetings.map((meeting) => (
        <MeetingCard
          key={
            meeting._id ||
            meeting.id
          }
          meeting={meeting}
          onEdit={onEdit}
          onDelete={onDelete}
          onQr={onQr}
        />
      ))}
    </div>
  );
};

export default MeetingList;