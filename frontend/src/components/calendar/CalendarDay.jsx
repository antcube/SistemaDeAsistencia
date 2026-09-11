import MeetingCard from "./MeetingCard";

const CalendarDay = ({
  date,
  dayNumber,
  isCurrentMonth = true,
  isToday = false,
  meetings = [],
  onMeetingClick,
  onCreateMeeting,
}) => {
  return (
    <div
      className={[
        "calendar-day",
        !isCurrentMonth
          ? "calendar-day-muted"
          : "",
        isToday
          ? "calendar-day-today"
          : "",
      ]
        .filter(Boolean)
        .join(" ")}
      data-date={date}
      onDoubleClick={() =>
        onCreateMeeting?.(date)
      }
    >
      <div className="calendar-day-number">
        {dayNumber}
      </div>

      <div className="calendar-day-meetings">
        {(() => {
          const seenMasterclasses = new Set();

          const visibleMeetings = meetings.filter((meeting) => {
            const type = String(meeting?.type || "")
              .trim()
              .toUpperCase();

            // Masterclass: una sola tarjeta por fecha + círculo.
            // Si por datos antiguos existen duplicadas, la vista no las repite.
            if (type === "MASTERCLASS") {
              const key = `${String(meeting?.date || date).slice(0, 10)}|${String(meeting?.circle || "").trim().toUpperCase()}`;
              if (seenMasterclasses.has(key)) return false;
              seenMasterclasses.add(key);
            }

            return true;
          });

          return visibleMeetings.map((meeting) => (
            <MeetingCard
              key={
                meeting._id ||
                meeting.id ||
                `${meeting.date}-${meeting.time}-${meeting.circle}-${meeting.type}`
              }
              meeting={meeting}
              onEdit={onMeetingClick}
            />
          ));
        })()}
      </div>
    </div>
  );
};

export default CalendarDay;