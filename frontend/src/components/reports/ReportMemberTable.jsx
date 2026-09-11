const ReportMemberTable = ({
  members = [],
}) => {
  if (!members.length) {
    return (
      <div className="report-empty">
        No hay miembros para mostrar.
      </div>
    );
  }

  return (
    <div className="report-member-table-wrapper">
      <table className="report-member-table">
        <thead>
          <tr>
            <th>DNI</th>
            <th>Miembro</th>
            <th>Círculo</th>
            <th>Sesiones</th>
            <th>Asistió</th>
            <th>No asistió</th>
            <th>Justificado</th>
            <th>Pendiente</th>
          </tr>
        </thead>

        <tbody>
          {members.map((member) => (
            <tr
              key={
                member.doc ||
                member.id ||
                member._id
              }
            >
              <td>{member.doc || "—"}</td>

              <td>
                <strong>
                  {member.name || "Sin nombre"}
                </strong>
              </td>

              <td>{member.circle || "—"}</td>

              <td>
                {member.sessions ?? 0}
              </td>

              <td className="report-positive">
                {member.attended ?? 0}
              </td>

              <td>
                {member.absent ?? 0}
              </td>

              <td className="report-justified">
                {member.justified ?? 0}
              </td>

              <td>
                {member.pending ?? 0}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ReportMemberTable;