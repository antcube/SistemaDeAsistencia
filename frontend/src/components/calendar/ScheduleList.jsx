import ScheduleActions from "./ScheduleActions";

const ScheduleList = ({
  schedules = [],
  loading = false,
  onEdit,
  onMigrate,
  onTerminate,
}) => {
  if (loading) {
    return (
      <div className="calendar-empty-state">
        Cargando programaciones...
      </div>
    );
  }

  if (!schedules.length) {
    return (
      <div className="calendar-empty-state">
        No hay programaciones recurrentes.
      </div>
    );
  }

  return (
    <section className="schedule-list">
      {schedules.map((schedule) => (
        <article
          key={
            schedule._id ||
            schedule.id
          }
          className="schedule-card"
        >
          <div className="schedule-card-content">
            <div>
              <span className="meeting-type">
                {schedule.type}
              </span>

              <h3>
                {schedule.name}
              </h3>

              <p>
                {schedule.title}
              </p>
            </div>

            <div className="schedule-card-info">
              <span>
                <strong>Círculos:</strong>{" "}
                {Array.isArray(schedule.circles)
                  ? schedule.circles.join(", ")
                  : ""}
              </span>

              <span>
                <strong>Días:</strong>{" "}
                {Array.isArray(schedule.weekdays)
                  ? schedule.weekdays.join(", ")
                  : ""}
              </span>

              <span>
                <strong>Horario:</strong>{" "}
                {schedule.time || "--:--"}
                {" - "}
                {schedule.endTime || "--:--"}
              </span>

              <span>
                <strong>Desde:</strong>{" "}
                {schedule.startDate}
              </span>

              {schedule.endDate && (
                <span>
                  <strong>Hasta:</strong>{" "}
                  {schedule.endDate}
                </span>
              )}
            </div>
          </div>

          <div className="schedule-card-actions">
            {onEdit && (
              <button
                type="button"
                onClick={() =>
                  onEdit(schedule)
                }
              >
                Editar
              </button>
            )}

            <ScheduleActions
              schedule={schedule}
              onMigrate={onMigrate}
              onTerminate={onTerminate}
            />
          </div>
        </article>
      ))}
    </section>
  );
};

export default ScheduleList;