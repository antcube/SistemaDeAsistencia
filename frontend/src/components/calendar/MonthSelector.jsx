const MONTH_NAMES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

const MonthSelector = ({
  year,
  month,
  onPrevious,
  onNext,
  onToday,
}) => {
  const monthIndex =
    Math.min(
      12,
      Math.max(1, Number(month))
    ) - 1;

  const formatted =
    `${MONTH_NAMES[monthIndex]} ${year}`;

  return (
    <div className="month-selector">

      <button
        type="button"
        className="calendar-nav-button"
        onClick={onPrevious}
        aria-label="Mes anterior"
      >
        ‹
      </button>

      <strong className="calendar-month-title">
        {formatted}
      </strong>

      <button
        type="button"
        className="calendar-nav-button"
        onClick={onNext}
        aria-label="Mes siguiente"
      >
        ›
      </button>

      <button
        type="button"
        className="calendar-today-button"
        onClick={onToday}
      >
        Hoy
      </button>

    </div>
  );
};

export default MonthSelector;