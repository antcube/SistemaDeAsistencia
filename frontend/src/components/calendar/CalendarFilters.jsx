import { MEETING_TYPES } from "../../constants/meetings";

const CalendarFilters = ({
  circles = [],
  circle = "",
  type = "",
  onCircleChange,
  onTypeChange,
  onClear,
}) => {
  return (
    <div className="calendar-filters">
      <div className="calendar-filter-group">
        <label htmlFor="calendar-circle-filter">
          CÍRCULO
        </label>

        <select
          id="calendar-circle-filter"
          value={circle}
          onChange={(event) =>
            onCircleChange(
              event.target.value
            )
          }
        >
          <option value="">
            Todos los círculos
          </option>

          {circles.map((item) => (
            <option
              key={
                item._id || item.name
              }
              value={item.name}
            >
              {item.name}
            </option>
          ))}
        </select>
      </div>

      <div className="calendar-filter-group">
        <label htmlFor="calendar-type-filter">
          TIPO DE REUNIÓN
        </label>

        <select
          id="calendar-type-filter"
          value={type}
          onChange={(event) =>
            onTypeChange(
              event.target.value
            )
          }
        >
          <option value="">
            Todos los tipos
          </option>

          {MEETING_TYPES.map(
            (meetingType) => (
              <option
                key={meetingType}
                value={meetingType}
              >
                {meetingType}
              </option>
            )
          )}
        </select>
      </div>

      <button
        type="button"
        className="calendar-clear-filters"
        onClick={onClear}
      >
        ↺ Limpiar filtros
      </button>
    </div>
  );
};

export default CalendarFilters;