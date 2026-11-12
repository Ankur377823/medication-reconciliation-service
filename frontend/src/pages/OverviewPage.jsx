import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { api } from '../api/client.js';
import { useAsync } from '../hooks/useAsync.js';
import Button from '../components/ui/Button.jsx';
import Card from '../components/ui/Card.jsx';
import DataTable from '../components/ui/DataTable.jsx';
import Meter from '../components/ui/Meter.jsx';
import PageHeader from '../components/ui/PageHeader.jsx';
import StatTile from '../components/ui/StatTile.jsx';
import { EmptyState, ErrorState, LoadingState } from '../components/ui/States.jsx';

const REVIEW_QUEUE_SIZE = 8;

function summariseClinics(patients, stats) {
  const repeatByClinic = new Map(stats.map((row) => [row.clinic_id, row.patients_with_2_plus_conflicts]));
  const clinics = new Map();

  for (const patient of patients) {
    const key = patient.clinic_id || 'unknown';
    const entry = clinics.get(key) || { clinic_id: key, patients: 0, needingReview: 0, unresolved: 0 };
    entry.patients += 1;
    entry.unresolved += patient.unresolved_count;
    if (patient.unresolved_count > 0) entry.needingReview += 1;
    clinics.set(key, entry);
  }

  return [...clinics.values()].map((entry) => ({
    ...entry,
    repeatPatients: repeatByClinic.get(entry.clinic_id) || 0,
  }));
}

export default function OverviewPage() {
  const navigate = useNavigate();
  const { data, error, loading, reload } = useAsync(
    async (signal) => {
      const [patients, stats] = await Promise.all([api.listPatients(signal), api.conflictStats(signal)]);
      return { patients, stats };
    },
    [],
  );

  const summary = useMemo(() => {
    if (!data) return null;
    const clinics = summariseClinics(data.patients, data.stats);
    const needingReview = data.patients.filter((patient) => patient.unresolved_count > 0);
    return {
      clinics,
      needingReview,
      totalPatients: data.patients.length,
      unresolved: needingReview.reduce((sum, patient) => sum + patient.unresolved_count, 0),
      maxClinicUnresolved: Math.max(0, ...clinics.map((clinic) => clinic.unresolved)),
    };
  }, [data]);

  const header = (
    <PageHeader
      title="Overview"
      description="Medication discrepancies across all clinics, with the patients who most need review."
      actions={
        <Button variant="primary" icon="plus" to="/ingest">
          Submit medication list
        </Button>
      }
    />
  );

  if (loading && !data) {
    return (
      <>
        {header}
        <Card>
          <LoadingState label="Loading overview" />
        </Card>
      </>
    );
  }

  if (error) {
    return (
      <>
        {header}
        <Card>
          <ErrorState error={error} onRetry={reload} />
        </Card>
      </>
    );
  }

  if (summary.totalPatients === 0) {
    return (
      <>
        {header}
        <Card>
          <EmptyState
            title="No patients yet"
            description="Submit a medication list to create the first patient record. Conflicts appear once a second source reports for the same patient."
            action={
              <Button variant="primary" to="/ingest">
                Submit medication list
              </Button>
            }
          />
        </Card>
      </>
    );
  }

  const clinicColumns = [
    {
      key: 'clinic_id',
      header: 'Clinic',
      sortValue: (row) => row.clinic_id,
      render: (row) => <span className="cell-id">{row.clinic_id}</span>,
    },
    { key: 'patients', header: 'Patients', align: 'right', sortValue: (row) => row.patients },
    { key: 'needingReview', header: 'Need review', align: 'right', sortValue: (row) => row.needingReview },
    {
      key: 'repeatPatients',
      header: '2+ conflicts, 30 days',
      align: 'right',
      sortValue: (row) => row.repeatPatients,
    },
    {
      key: 'unresolved',
      header: 'Unresolved conflicts',
      sortValue: (row) => row.unresolved,
      render: (row) => <Meter value={row.unresolved} max={summary.maxClinicUnresolved} />,
    },
  ];

  const queueColumns = [
    {
      key: 'patient_id',
      header: 'Patient',
      render: (row) => (
        <Link className="cell-id" to={`/patients/${encodeURIComponent(row.patient_id)}`}>
          {row.patient_id}
        </Link>
      ),
    },
    { key: 'clinic_id', header: 'Clinic' },
    {
      key: 'unresolved_count',
      header: 'Unresolved',
      align: 'right',
      render: (row) => <strong className="num">{row.unresolved_count}</strong>,
    },
  ];

  return (
    <>
      {header}
      <div className="stack">
        <div className="grid-tiles">
          <StatTile label="Patients" value={summary.totalPatients} hint="With at least one medication list" />
          <StatTile
            label="Patients needing review"
            value={summary.needingReview.length}
            hint="Have one or more unresolved conflicts"
            tone={summary.needingReview.length > 0 ? 'warn' : undefined}
          />
          <StatTile label="Unresolved conflicts" value={summary.unresolved} hint="Across all patients" />
          <StatTile label="Clinics" value={summary.clinics.length} hint="Reporting to this service" />
        </div>

        <div className="grid-two">
          <Card title="Clinics" subtitle="Workload by clinic" flush>
            <DataTable
              caption="Conflict workload by clinic"
              columns={clinicColumns}
              rows={summary.clinics}
              rowKey={(row) => row.clinic_id}
              defaultSort={{ key: 'unresolved', direction: 'desc' }}
            />
          </Card>

          <Card
            title="Review queue"
            subtitle="Most unresolved conflicts first"
            flush
            actions={
              <Button size="sm" to="/patients?review=1">
                View all
              </Button>
            }
          >
            {summary.needingReview.length === 0 ? (
              <EmptyState icon="check" title="Nothing to review" description="Every detected conflict has been resolved." />
            ) : (
              <DataTable
                caption="Patients with unresolved conflicts"
                columns={queueColumns}
                rows={summary.needingReview.slice(0, REVIEW_QUEUE_SIZE)}
                rowKey={(row) => row.patient_id}
                onRowClick={(row) => navigate(`/patients/${encodeURIComponent(row.patient_id)}`)}
              />
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
