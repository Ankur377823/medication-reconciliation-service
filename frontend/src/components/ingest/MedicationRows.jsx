import Button from '../ui/Button.jsx';

const COMMON_DRUGS = ['Aspirin', 'Diclofenac', 'Ibuprofen', 'Metformin', 'Paracetamol', 'Warfarin'];

export function emptyMedication() {
  return { key: crypto.randomUUID(), name: '', dose: '', status: 'active' };
}

/** Editable list of medication rows for the submission form. */
export default function MedicationRows({ rows, onChange, showErrors }) {
  function update(key, patch) {
    onChange(rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  function remove(key) {
    onChange(rows.filter((row) => row.key !== key));
  }

  return (
    <div className="med-rows">
      <div className="med-row med-row--head" aria-hidden="true">
        <span className="med-row__head">Medication</span>
        <span className="med-row__head">Dose</span>
        <span className="med-row__head">Status</span>
        <span />
      </div>

      {rows.map((row, index) => {
        const missingName = showErrors && !row.name.trim();
        return (
          <div className="med-row" key={row.key}>
            <div className="field">
              <input
                className="input"
                list="common-drugs"
                value={row.name}
                onChange={(event) => update(row.key, { name: event.target.value })}
                placeholder="Generic name"
                aria-label={`Medication ${index + 1} name`}
                aria-invalid={missingName || undefined}
                autoComplete="off"
              />
              {missingName ? <span className="field__error">Enter a medication name.</span> : null}
            </div>
            <input
              className="input"
              value={row.dose}
              onChange={(event) => update(row.key, { dose: event.target.value })}
              placeholder="e.g. 500mg"
              aria-label={`Medication ${index + 1} dose`}
              autoComplete="off"
            />
            <select
              className="input"
              value={row.status}
              onChange={(event) => update(row.key, { status: event.target.value })}
              aria-label={`Medication ${index + 1} status`}
            >
              <option value="active">Active</option>
              <option value="stopped">Stopped</option>
            </select>
            <Button
              variant="ghost"
              icon="trash"
              iconOnly
              onClick={() => remove(row.key)}
              disabled={rows.length === 1}
            >
              Remove medication {index + 1}
            </Button>
          </div>
        );
      })}

      <datalist id="common-drugs">
        {COMMON_DRUGS.map((drug) => (
          <option key={drug} value={drug} />
        ))}
      </datalist>

      <div>
        <Button icon="plus" size="sm" onClick={() => onChange([...rows, emptyMedication()])}>
          Add medication
        </Button>
      </div>
    </div>
  );
}
