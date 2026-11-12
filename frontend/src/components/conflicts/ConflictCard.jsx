import Badge from '../ui/Badge.jsx';
import Button from '../ui/Button.jsx';
import ConflictComparison from './ConflictComparison.jsx';
import { capitalize, conflictTypeMeta, formatDateTime, sourceLabel } from '../../utils/format.js';

function conflictTitle(conflict) {
  if (conflict.type === 'class_conflict') {
    const { drug1, drug2 } = conflict.details || {};
    return `${capitalize(drug1)} and ${capitalize(drug2)}`;
  }
  return capitalize(conflict.drug);
}

function Resolution({ conflict }) {
  return (
    <div className="resolution">
      <div className="resolution__grid">
        <div>
          <div className="kv__label">Resolved by</div>
          <div className="kv__value">{conflict.resolved_by || 'Not recorded'}</div>
        </div>
        <div>
          <div className="kv__label">Source accepted</div>
          <div className="kv__value">
            {conflict.chosen_source ? sourceLabel(conflict.chosen_source) : 'Not recorded'}
          </div>
        </div>
        <div>
          <div className="kv__label">Resolved on</div>
          <div className="kv__value">{formatDateTime(conflict.resolved_at)}</div>
        </div>
      </div>
      {conflict.reason ? (
        <div className="resolution__reason">
          <div className="kv__label">Reason</div>
          <div className="kv__value">{conflict.reason}</div>
        </div>
      ) : null}
    </div>
  );
}

export default function ConflictCard({ conflict, onResolve }) {
  const meta = conflictTypeMeta(conflict.type);
  const resolved = conflict.status === 'resolved';

  return (
    <article className={`card conflict conflict--${resolved ? 'resolved' : meta.tone}`}>
      <div className="conflict__head">
        <div>
          <h3 className="conflict__title">{conflictTitle(conflict)}</h3>
          <div className="conflict__meta">
            <Badge tone={resolved ? 'neutral' : meta.tone} icon={resolved ? undefined : 'alert'}>
              {meta.label}
            </Badge>
            {resolved ? (
              <Badge tone="ok" icon="check">
                Resolved
              </Badge>
            ) : (
              <Badge>Needs review</Badge>
            )}
            <span>Detected {formatDateTime(conflict.created_at)}</span>
          </div>
        </div>
        {!resolved ? (
          <Button variant="primary" onClick={() => onResolve(conflict)}>
            Resolve
          </Button>
        ) : null}
      </div>

      <div className="conflict__body">
        {meta.summary ? <p className="conflict__summary">{meta.summary}</p> : null}
        <ConflictComparison conflict={conflict} />
        {resolved ? <Resolution conflict={conflict} /> : null}
      </div>
    </article>
  );
}
