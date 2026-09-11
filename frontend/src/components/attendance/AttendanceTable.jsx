import AttendanceStatus from "./AttendanceStatus";

const normalizeStatus = (
  status
) => {
  if (status === "Faltó") {
    return "No asistió";
  }

  return status || "No asistió";
};

const AttendanceTable = ({
  rows = [],
  meetings = [],
  onStatusChange,
  loading = false,
}) => {
  if (loading) {
    return (
      <div className="attendance-table-loading">
        <div className="attendance-loading-spinner" />
        <span>
          Cargando registros de asistencia...
        </span>
      </div>
    );
  }

  if (!rows.length) {
    return (
      <div className="attendance-empty">
        <div className="attendance-empty-icon">
          📝
        </div>

        <strong>
          No hay miembros para mostrar
        </strong>

        <span>
          Prueba cambiando el mes,
          círculo o DNI.
        </span>
      </div>
    );
  }

  if (!meetings.length) {
    return (
      <div className="attendance-empty">
        <div className="attendance-empty-icon">
          📅
        </div>

        <strong>
          No hay reuniones este mes
        </strong>

        <span>
          El calendario no tiene
          reuniones activas para
          este período.
        </span>
      </div>
    );
  }

  return (
    <div className="attendance-table-wrapper">
      <table className="attendance-table">
        <thead>
          <tr>
            <th className="attendance-sticky-column member">
              Miembro
            </th>

            <th className="attendance-sticky-column dni">
              DNI
            </th>

            <th className="attendance-sticky-column circle">
              Círculo
            </th>

            {meetings.map(
              (meeting) => (
                <th
                  key={meeting._id}
                  className="attendance-meeting-column"
                  title={`${meeting.title || "Reunión"} - ${meeting.date}`}
                >
                  <div className="attendance-meeting-header">
                    <span>
                      {meeting.date}
                    </span>

                    <strong>
                      {meeting.title ||
                        "Reunión"}
                    </strong>

                    <small>
                      {meeting.time ||
                        "--:--"}
                      {meeting.endTime
                        ? ` - ${meeting.endTime}`
                        : ""}
                    </small>

                    <em>
                      {meeting.circle}
                    </em>
                  </div>
                </th>
              )
            )}
          </tr>
        </thead>

        <tbody>
          {rows.map(
            (row) => (
              <tr
                key={
                  row.user?._id ||
                  row.doc
                }
              >
                <td className="attendance-member-cell attendance-sticky-column member">
                  <div className="attendance-member-name">
                    {row.name}
                  </div>

                  {row.job && (
                    <small>
                      {row.job}
                    </small>
                  )}
                </td>

                <td className="attendance-sticky-column dni">
                  <span className="attendance-dni">
                    {row.doc}
                  </span>
                </td>

                <td className="attendance-sticky-column circle">
                  <span className="attendance-circle">
                    {row.circle}
                  </span>
                </td>

                {meetings.map(
                  (meeting) => {
                    const record =
                      row.attendance?.[
                        meeting._id
                      ];

                    const status =
                      normalizeStatus(
                        record?.status
                      );

                    return (
                      <td
                        key={
                          meeting._id
                        }
                        className="attendance-cell"
                      >
                        <AttendanceStatus
                        value={status}
                        onChange={(newStatus) =>
                        onStatusChange(
                        row,
                      meeting,
                      newStatus,
                      record
                      )
                     }
                      />
                      </td>
                    );
                  }
                )}
              </tr>
            )
          )}
        </tbody>
      </table>
    </div>
  );
};

export default AttendanceTable;