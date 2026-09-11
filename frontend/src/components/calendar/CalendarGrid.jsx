import CalendarDay from "./CalendarDay";
import { WEEKDAYS } from "../../constants/meetings";

import {
  buildCalendarDays,
  formatDateLocal,
  groupMeetingsByDate,
  isTodayDate,
} from "../../utils/calendarUtils";

const CalendarGrid = ({
  year,
  month,
  meetings = [],
  loading = false,
  onMeetingClick,
  onCreateMeeting,
}) => {
  const days = buildCalendarDays(
    year,
    month
  );

  const meetingsByDate =
    groupMeetingsByDate(meetings);

  if (loading) {
    return (
      <section className="calendar-main-card">
        <div className="calendar-loading">
          Cargando calendario...
        </div>
      </section>
    );
  }

  return (
    <section className="calendar-main-card">
      <div className="calendar-grid-wrapper">
        <div className="calendar-week-header">
          {WEEKDAYS.map((weekday) => (
            <div
              key={weekday.value}
              className="calendar-weekday"
            >
              {weekday.label}
            </div>
          ))}
        </div>

        <div className="calendar-grid">
          {days.map((day) => {
            const dateKey =
              formatDateLocal(
                day.date
              );

            return (
              <CalendarDay
                key={dateKey}
                date={dateKey}
                dayNumber={
                  day.date.getDate()
                }
                isCurrentMonth={
                  day.isCurrentMonth
                }
                isToday={isTodayDate(
                  day.date
                )}
                meetings={
                  meetingsByDate[
                    dateKey
                  ] || []
                }
                onMeetingClick={
                  onMeetingClick
                }
                onCreateMeeting={
                  onCreateMeeting
                }
              />
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default CalendarGrid;