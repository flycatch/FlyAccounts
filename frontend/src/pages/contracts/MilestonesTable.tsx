export type MilestoneDraft = {
  name: string;
  value: string;
  dueConditionOrDate: string;
};

type MilestonesTableProps = {
  milestones: MilestoneDraft[];
  canViewFinancials: boolean;
  error?: string;
  onChange: (rows: MilestoneDraft[]) => void;
  onBlurValidate?: () => void;
};

export function MilestonesTable({
  milestones,
  canViewFinancials,
  error,
  onChange,
  onBlurValidate,
}: MilestonesTableProps) {
  function updateRow(index: number, patch: Partial<MilestoneDraft>) {
    onChange(milestones.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  return (
    <div>
      <div className="contract-milestones-header">
        <h3>Milestones</h3>
        <button
          type="button"
          onClick={() =>
            onChange([...milestones, { name: "", value: "", dueConditionOrDate: "" }])
          }
        >
          + Add Milestone
        </button>
      </div>
      {error ? <span className="ui-field-error">{error}</span> : null}
      {milestones.length === 0 ? (
        <p className="contract-hint">No milestones yet. Add one for Time &amp; Material contracts.</p>
      ) : (
        <div className="contracts-table-wrap">
          <table className="contracts-table" data-testid="milestones-table">
            <thead>
              <tr>
                <th>Milestone</th>
                {canViewFinancials ? <th>Value</th> : null}
                <th>Due Conditions</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {milestones.map((row, index) => (
                <tr key={index}>
                  <td>
                    <input
                      className="ui-control"
                      value={row.name}
                      aria-label={`Milestone name ${index + 1}`}
                      onChange={(event) => updateRow(index, { name: event.target.value })}
                      onBlur={onBlurValidate}
                    />
                  </td>
                  {canViewFinancials ? (
                    <td>
                      <input
                        className="ui-control"
                        type="number"
                        value={row.value}
                        aria-label={`Milestone value ${index + 1}`}
                        onChange={(event) => updateRow(index, { value: event.target.value })}
                      />
                    </td>
                  ) : null}
                  <td>
                    <input
                      className="ui-control"
                      value={row.dueConditionOrDate}
                      aria-label={`Milestone due conditions ${index + 1}`}
                      onChange={(event) =>
                        updateRow(index, { dueConditionOrDate: event.target.value })
                      }
                    />
                  </td>
                  <td>
                    <button
                      type="button"
                      onClick={() => onChange(milestones.filter((_, i) => i !== index))}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
