import { capitalize, displayDose, sourceLabel } from '../../utils/format.js';

function Side({ label, source, value, empty = false }) {
  return (
    <div className="compare__side">
      <div className="compare__label">
        {label}
        {source ? ` · ${sourceLabel(source)}` : ''}
      </div>
      <div className={`compare__value${empty ? ' compare__value--empty' : ''}`}>{value}</div>
    </div>
  );
}

/**
 * Puts the two disagreeing values next to each other so the reviewer can
 * compare them at a glance instead of reading them out of a sentence.
 */
export default function ConflictComparison({ conflict }) {
  const details = conflict.details || {};

  if (conflict.type === 'class_conflict') {
    return (
      <div className="compare">
        <Side label="Medication" value={capitalize(details.drug1)} />
        <span className="compare__divider">with</span>
        <Side label="Medication" value={capitalize(details.drug2)} />
      </div>
    );
  }

  if (conflict.type === 'status_conflict') {
    return (
      <div className="compare">
        <Side label="Latest submission" source={details.source1} value={capitalize(details.status1)} />
        <span className="compare__divider">vs</span>
        <Side label="Earlier record" source={details.source2} value={capitalize(details.status2)} />
      </div>
    );
  }

  return (
    <div className="compare">
      <Side
        label="Latest submission"
        source={details.source1}
        value={displayDose(details.dose1)}
        empty={!details.dose1}
      />
      <span className="compare__divider">vs</span>
      <Side
        label="Earlier record"
        source={details.source2}
        value={displayDose(details.dose2)}
        empty={!details.dose2}
      />
    </div>
  );
}
