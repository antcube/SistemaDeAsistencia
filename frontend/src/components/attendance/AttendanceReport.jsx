const normalizeStatus = (
  status
) => {
  if (status === "Faltó") {
    return "No asistió";
  }

  return status || "No asistió";
};

const AttendanceReport = ({
  rows = [],
  meetings = [],
}) => {
  const getCount = (
    row,
    status
  ) => {
    return meetings.reduce(
      (
        total,
        meeting
      ) => {
        const record =
          row.attendance?.[
            meeting._id
          ];

        const recordStatus =
          normalizeStatus(
            record?.status
          );

        if (
          status === "Asistió"
        ) {
          const isAttended =
            recordStatus ===
              "Asistió" ||
            recordStatus ===
              "Clase Presencial";

          return (
            total +
            (isAttended ? 1 : 0)
          );
        }

        return (
          total +
          (recordStatus ===
          status
            ? 1
            : 0)
        );
      },
      0
    );
  };

  const getValidJustifications =
    (row) => {
      return meetings.reduce(
        (
          total,
          meeting
        ) => {
          const record =
            row.attendance?.[
              meeting._id
            ];

          if (
            normalizeStatus(
              record?.status
            ) !== "Justificado"
          ) {
            return total;
          }

          /*
           * El backend ya controla
           * el límite de J.
           *
           * Si el registro no tiene
           * la bandera, se considera
           * válido para mantener
           * compatibilidad.
           */
          if (
            record?.justificationValid ===
            false
          ) {
            return total;
          }

          return total + 1;
        },
        0
      );
    };

  if (!rows.length) {
    return null;
  }

  return (
    <section className="attendance-report">
      <div className="attendance-report-header">
        <div>
          <span className="attendance-kicker">
            RESUMEN
          </span>

          <h2>
            Resumen mensual
          </h2>
        </div>

        <span>
          {rows.length} miembros
        </span>
      </div>

      <div className="attendance-report-grid">
        {rows.map(
          (row) => {
            const attended =
              getCount(
                row,
                "Asistió"
              );

            const justified =
              getValidJustifications(
                row
              );

            const absent =
              getCount(
                row,
                "No asistió"
              );

            return (
              <article
                className="attendance-report-card"
                key={
                  row.user?._id ||
                  row.doc
                }
              >
                <div>
                  <strong>
                    {row.name}
                  </strong>

                  <span>
                    {row.doc} ·{" "}
                    {row.circle}
                  </span>
                </div>

                <div className="attendance-report-stats">
                  <span>
                    <b>
                      {attended}
                    </b>
                    Asistió
                  </span>

                  <span>
                    <b>
                      {justified}
                    </b>
                    J válidas
                  </span>

                  <span>
                    <b>
                      {absent}
                    </b>
                    No asistió
                  </span>
                </div>
              </article>
            );
          }
        )}
      </div>
    </section>
  );
};

export default AttendanceReport;