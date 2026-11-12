import { useState } from 'react';

import { api } from '../../api/client.js';
import Button from '../ui/Button.jsx';
import Dialog from '../ui/Dialog.jsx';
import Field from '../ui/Field.jsx';
import { InlineAlert } from '../ui/States.jsx';
import ConflictComparison from './ConflictComparison.jsx';
import { conflictTypeMeta, sourceLabel } from '../../utils/format.js';

const REVIEWER_KEY = 'medrec.reviewer';

function readReviewer() {
  try {
    return localStorage.getItem(REVIEWER_KEY) || '';
  } catch {
    return '';
  }
}

function rememberReviewer(name) {
  try {
    localStorage.setItem(REVIEWER_KEY, name);
  } catch {
    // Storage can be unavailable (private mode); the form still works.
  }
}

/**
 * Records who resolved a conflict, which source they accepted, and why.
 * `sources` is the list of sources that have reported for this patient.
 */
export default function ResolveDialog({ conflict, sources, onClose, onResolved }) {
  const [resolvedBy, setResolvedBy] = useState(readReviewer);
  const [chosenSource, setChosenSource] = useState('');
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const meta = conflictTypeMeta(conflict.type);

  async function handleSubmit(event) {
    event.preventDefault();

    const nextErrors = {};
    if (!resolvedBy.trim()) nextErrors.resolvedBy = 'Enter your name or staff ID.';
    if (!reason.trim()) nextErrors.reason = 'Explain the decision for the audit trail.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    setSubmitError(null);
    try {
      await api.resolveConflict({
        conflict_id: conflict.conflict_id,
        resolved_by: resolvedBy.trim(),
        reason: reason.trim(),
        chosen_source: chosenSource || null,
      });
      rememberReviewer(resolvedBy.trim());
      onResolved();
    } catch (error) {
      setSubmitError(error.message);
      setSubmitting(false);
    }
  }

  return (
    <Dialog title="Resolve conflict" subtitle={meta.label} onClose={onClose}>
      <form onSubmit={handleSubmit} noValidate>
        <div className="dialog__body">
          <ConflictComparison conflict={conflict} />

          <Field label="Resolved by" error={errors.resolvedBy}>
            {(props) => (
              <input
                {...props}
                className="input"
                value={resolvedBy}
                onChange={(event) => setResolvedBy(event.target.value)}
                placeholder="Name or staff ID"
                autoComplete="off"
              />
            )}
          </Field>

          <Field label="Source accepted" optional hint="The source whose record you are treating as correct.">
            {(props) => (
              <select
                {...props}
                className="input"
                value={chosenSource}
                onChange={(event) => setChosenSource(event.target.value)}
              >
                <option value="">No single source</option>
                {sources.map((source) => (
                  <option key={source} value={source}>
                    {sourceLabel(source)}
                  </option>
                ))}
              </select>
            )}
          </Field>

          <Field label="Reason" error={errors.reason}>
            {(props) => (
              <textarea
                {...props}
                className="input"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="What was decided and why"
              />
            )}
          </Field>

          {submitError ? <InlineAlert>{submitError}</InlineAlert> : null}
        </div>

        <div className="dialog__footer">
          <Button onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={submitting}>
            {submitting ? 'Saving' : 'Mark as resolved'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
