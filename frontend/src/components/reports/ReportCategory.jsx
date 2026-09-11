const ReportCategory = ({
  category,
  data = {},
}) => {
  return (
    <article className="report-category-card">
      <div className="report-category-header">
        <div>
          <h3>{category}</h3>
          <span>
            {data.sessions || 0}{" "}
            {data.sessions === 1
              ? "sesión"
              : "sesiones"}
          </span>
        </div>
      </div>

      <div className="report-category-metrics">
        <div>
          <span>Asistieron</span>
          <strong>{data.attended || 0}</strong>
        </div>

        <div>
          <span>No asistieron</span>
          <strong>{data.absent || 0}</strong>
        </div>

        <div>
          <span>Justificados</span>
          <strong>{data.justified || 0}</strong>
        </div>

        <div>
          <span>Pendientes</span>
          <strong>{data.pending || 0}</strong>
        </div>
      </div>
    </article>
  );
};

export default ReportCategory;