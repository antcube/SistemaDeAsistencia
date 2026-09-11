const NavigationArrow = ({
  direction = "left",
  onClick,
  disabled = false,
  label,
}) => {
  const isLeft = direction === "left";

  return (
    <button
      type="button"
      className={`nav-arrow-btn ${
        isLeft ? "nav-arrow-left" : "nav-arrow-right"
      }`}
      onClick={onClick}
      disabled={disabled}
      aria-label={
        label || (isLeft ? "Anterior" : "Siguiente")
      }
    >
      <span className="nav-arrow-icon" />
    </button>
  );
};

export default NavigationArrow;