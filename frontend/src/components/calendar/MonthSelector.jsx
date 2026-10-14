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
      <div className="calendar-month-navigation">
        <button
          type="button"
          className="calendar-nav-button"
          onClick={onPrevious}
          aria-label="Mes anterior"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3.1"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
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
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3.1"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M9 6l6 6-6 6" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default MonthSelector;
