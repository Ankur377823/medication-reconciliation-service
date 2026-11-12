import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { api } from '../api/client.js';
import { useAsync } from '../hooks/useAsync.js';
import MedicationRows, { emptyMedication } from '../components/ingest/MedicationRows.jsx';
import Button from '../components/ui/Button.jsx';
import Card from '../components/ui/Card.jsx';
import Field from '../components/ui/Field.jsx';
import Icon from '../components/ui/Icon.jsx';
import PageHeader from '../components/ui/PageHeader.jsx';
import { InlineAlert } from '../components/ui/States.jsx';
import { KNOWN_SOURCES, sourceLabel } from '../utils/format.js';

function SubmissionResult({ result, patientId, onReset }) {
  return (
    <Card>
      <div className="success-line">
        <Icon name="check" size={18} strokeWidth={2.4} />
        Medication list saved for patient {patientId}
      </div>
      <div className="result-grid">
        <div className="kv">
          <div className="kv__label">Version</div>
          <div className="kv__value">{result.snapshot_version}</div>
        </div>
        <div className="kv">
          <div className="kv__label">Conflicts detected</div>
          <div className="kv__value">{result.conflicts_detected}</div>
        </div>
        <div className="kv">
          <div className="kv__label">New conflicts to review</div>
          <div className="kv__value">{result.new_conflicts_stored}</div>
        </div>
      </div>
      <div className="form-actions">
        <Button onClick={onReset}>Submit another list</Button>
        <Button variant="primary" to={`/patients/${encodeURIComponent(patientId)}`}>
          Open patient record
        </Button>
      </div>
    </Card>
  );
}

export default function IngestPage() {
  const [searchParams] = useSearchParams();
  const { data: patients } = useAsync((signal) => api.listPatients(signal).catch(() => []), []);

  const [patientId, setPatientId] = useState(searchParams.get('patient') || '');
  const [clinicId, setClinicId] = useState('');
  const [source, setSource] = useState(KNOWN_SOURCES[0]);
  const [medications, setMedications] = useState(() => [emptyMedication()]);
  const [showErrors, setShowErrors] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [result, setResult] = useState(null);

  const existing = useMemo(
    () => (patients || []).find((patient) => patient.patient_id === patientId.trim()),
    [patients, patientId],
  );
  const clinics = useMemo(
    () => [...new Set((patients || []).map((patient) => patient.clinic_id))].sort(),
    [patients],
  );

  async function handleSubmit(event) {
    event.preventDefault();
    setShowErrors(true);
    setSubmitError(null);

    const trimmedId = patientId.trim();
    if (!trimmedId || medications.some((med) => !med.name.trim())) return;

    setSubmitting(true);
    try {
      const response = await api.ingest({
        patient_id: trimmedId,
        clinic_id: existing ? null : clinicId.trim() || null,
        source,
        medications: medications.map((med) => ({
          name: med.name.trim(),
          dose: med.dose.trim(),
          status: med.status,
        })),
      });
      setResult({ ...response, patientId: trimmedId });
    } catch (error) {
      setSubmitError(error.message);
    } finally {
      setSubmitting(false);
    }
  }

  function reset() {
    setResult(null);
    setShowErrors(false);
    setMedications([emptyMedication()]);
  }

  const header = (
    <PageHeader
      title="Submit medication list"
      description="Record the medications a source reports for a patient. Each submission is saved as a new version and checked against earlier lists."
    />
  );

  if (result) {
    return (
      <>
        {header}
        <SubmissionResult result={result} patientId={result.patientId} onReset={reset} />
      </>
    );
  }

  return (
    <>
      {header}
      <form className="stack" onSubmit={handleSubmit} noValidate>
        <Card title="Patient and source">
          <div className="form-grid">
            <Field
              label="Patient ID"
              error={showErrors && !patientId.trim() ? 'Enter a patient ID.' : undefined}
              hint={
                existing
                  ? `Existing patient in ${existing.clinic_id}.`
                  : 'A new record is created if this ID is not on file.'
              }
            >
              {(props) => (
                <input
                  {...props}
                  className="input mono"
                  value={patientId}
                  onChange={(event) => setPatientId(event.target.value)}
                  placeholder="e.g. MRN-00123"
                  autoComplete="off"
                />
              )}
            </Field>

            <Field
              label="Clinic"
              optional={!existing}
              hint={existing ? 'Set when the patient was first recorded.' : 'Used only when creating a new patient.'}
            >
              {(props) => (
                <input
                  {...props}
                  className="input"
                  list="known-clinics"
                  value={existing ? existing.clinic_id : clinicId}
                  onChange={(event) => setClinicId(event.target.value)}
                  placeholder="e.g. clinic_1"
                  disabled={Boolean(existing)}
                  autoComplete="off"
                />
              )}
            </Field>

            <Field label="Source">
              {(props) => (
                <select {...props} className="input" value={source} onChange={(event) => setSource(event.target.value)}>
                  {KNOWN_SOURCES.map((item) => (
                    <option key={item} value={item}>
                      {sourceLabel(item)}
                    </option>
                  ))}
                </select>
              )}
            </Field>
          </div>
          <datalist id="known-clinics">
            {clinics.map((item) => (
              <option key={item} value={item} />
            ))}
          </datalist>
        </Card>

        <Card title="Medications" subtitle="List every medication this source reports, including stopped ones.">
          <MedicationRows rows={medications} onChange={setMedications} showErrors={showErrors} />
        </Card>

        {submitError ? <InlineAlert>{submitError}</InlineAlert> : null}

        <div className="form-actions">
          <Button to="/patients">Cancel</Button>
          <Button type="submit" variant="primary" disabled={submitting}>
            {submitting ? 'Saving' : 'Save medication list'}
          </Button>
        </div>
      </form>
    </>
  );
}
