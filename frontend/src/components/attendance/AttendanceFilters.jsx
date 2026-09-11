const AttendanceFilters = ({
  circles = [],
  doc = "",
  circle = "",
  onDocChange,
  onCircleChange,
  onSearch,
  onClear,
}) => {
  const handleSubmit = (
    event
  ) => {
    event.preventDefault();

    if (onSearch) {
      onSearch();
    }
  };

  return (
    <form
      className="attendance-filters"
      onSubmit={handleSubmit}
    >
      <div className="attendance-filter-field dni">
        <label htmlFor="attendance-doc">
          DNI
        </label>

        <input
          id="attendance-doc"
          type="search"
          inputMode="numeric"
          value={doc}
          onChange={(event) =>
            onDocChange(
              event.target.value
            )
          }
          placeholder="Buscar por DNI..."
        />
      </div>

      <div className="attendance-filter-field circle">
        <label htmlFor="attendance-circle">
          CÍRCULO
        </label>

        <select
          id="attendance-circle"
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

          {circles.map(
            (item) => (
              <option
                key={
                  item._id ||
                  item.name
                }
                value={item.name}
              >
                {item.name}
              </option>
            )
          )}
        </select>
      </div>

      <button
        type="submit"
        className="attendance-filter-button primary"
      >
        🔎 Buscar
      </button>

      <button
        type="button"
        className="attendance-filter-button"
        onClick={onClear}
      >
        ↺ Limpiar
      </button>
    </form>
  );
};

export default AttendanceFilters;