const MasterclassButton = ({
  onClick,
  loading = false,
  disabled = false,
}) => {
  return (
    <button
      type="button"
      className="calendar-button masterclass-button"
      onClick={onClick}
      disabled={disabled || loading}
    >
      <span className="masterclass-button-icon">
        🎓
      </span>

      <span>
        {loading
          ? "Creando Masterclass..."
          : "Crear Masterclass del mes"}
      </span>
    </button>
  );
};

export default MasterclassButton;