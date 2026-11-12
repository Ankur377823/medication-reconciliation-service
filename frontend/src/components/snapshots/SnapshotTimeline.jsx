import Badge from '../ui/Badge.jsx';
import { capitalize, displayDose, formatDateTime, sourceLabel } from '../../utils/format.js';

function MedicationTable({ medications }) {
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th scope="col">Medication</th>
            <th scope="col">Dose</th>
            <th scope="col">Status</th>
          </tr>
        </thead>
        <tbody>
          {medications.map((med, index) => (
            <tr key={`${med.name}-${index}`}>
              <td style={{ fontWeight: 550 }}>{capitalize(med.name)}</td>
              <td className={med.dose ? 'num' : 'muted'}>{displayDose(med.dose)}</td>
              <td>
                {med.status === 'active' ? (
                  <Badge tone="accent">Active</Badge>
                ) : (
                  <Badge>{capitalize(med.status)}</Badge>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Every submitted medication list for a patient, newest first. */
export default function SnapshotTimeline({ snapshots }) {
  const ordered = [...snapshots].sort((a, b) => b.version - a.version);
  const latestVersion = ordered[0]?.version;

  return (
    <ol className="timeline" style={{ listStyle: 'none', margin: 0 }}>
      {ordered.map((snapshot) => {
        const latest = snapshot.version === latestVersion;
        return (
          <li key={snapshot.version} className={`timeline__item${latest ? ' timeline__item--latest' : ''}`}>
            <span className="timeline__dot" />
            <div className="card">
              <div className="snapshot__head">
                <span className="snapshot__version">Version {snapshot.version}</span>
                <Badge>{sourceLabel(snapshot.source)}</Badge>
                {latest ? <Badge tone="accent">Latest</Badge> : null}
                <span className="snapshot__date">{formatDateTime(snapshot.created_at)}</span>
              </div>
              <MedicationTable medications={snapshot.medications || []} />
            </div>
          </li>
        );
      })}
    </ol>
  );
}
