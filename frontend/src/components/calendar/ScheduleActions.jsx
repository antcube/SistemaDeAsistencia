const ScheduleActions = ({
  schedule,
  onMigrate,
  onTerminate,
}) => {
  if (!schedule) {
    return null;
  }

  return (
    <div className="schedule-actions">
      {onMigrate && (
        <button
          type="button"
          onClick={() =>
            onMigrate(schedule)
          }
        >
          Migrar desde este mes
        </button>
      )}

      {onTerminate && (
        <button
          type="button"
          className="danger"
          onClick={() =>
            onTerminate(schedule)
          }
        >
          Eliminar desde este mes
        </button>
      )}
    </div>
  );
};

export default ScheduleActions;