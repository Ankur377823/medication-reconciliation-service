import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';

import { api } from '../api/client.js';
import { useAsync } from '../hooks/useAsync.js';
import ConflictCard from '../components/conflicts/ConflictCard.jsx';
import ResolveDialog from '../components/conflicts/ResolveDialog.jsx';
import SnapshotTimeline from '../components/snapshots/SnapshotTimeline.jsx';
import Badge from '../components/ui/Badge.jsx';
import Button from '../components/ui/Button.jsx';
import Card from '../components/ui/Card.jsx';
import PageHeader from '../components/ui/PageHeader.jsx';
import SegmentedControl from '../components/ui/SegmentedControl.jsx';
import Tabs from '../components/ui/Tabs.jsx';
import { EmptyState, ErrorState, LoadingState } from '../components/ui/States.jsx';
import { KNOWN_SOURCES, parseDate, plural } from '../utils/format.js';

// Interactions first, then the most recently detected.
function byPriority(a, b) {
  const rank = (conflict) => (conflict.type === 'class_conflict' ? 0 : 1);
  if (rank(a) !== rank(b)) return rank(a) - rank(b);
  return (parseDate(b.created_at)?.getTime() || 0) - (parseDate(a.created_at)?.getTime() || 0);
}

export default function PatientDetailPage() {
  const { patientId } = useParams();
  const [tab, setTab] = useState('conflicts');
  const [filter, setFilter] = useState('unresolved');
  const [resolving, setResolving] = useState(null);

  const { data, error, loading, reload } = useAsync(
    async (signal) => {
      const [conflicts, snapshots, patients] = await Promise.all([
        api.getConflicts(patientId, signal),
        api.getSnapshots(patientId, signal),
        api.listPatients(signal),
      ]);
      const record = patients.find((patient) => patient.patient_id === patientId);
      return { conflicts, snapshots, clinicId: record?.clinic_id };
    },
    [patientId],
  );

  const view = useMemo(() => {
    if (!data) return null;
    const unresolved = data.conflicts.filter((conflict) => conflict.status !== 'resolved').sort(byPriority);
    const resolved = data.conflicts.filter((conflict) => conflict.status === 'resolved').sort(byPriority);
    const reported = data.snapshots.map((snapshot) => snapshot.source);
    return {
      unresolved,
      resolved,
      sources: [...new Set([...reported, ...KNOWN_SOURCES])],
    };
  }, [data]);

  const breadcrumb = [{ label: 'Patients', to: '/patients' }, { label: patientId }];

  if (loading && !data) {
    return (
      <>
        <PageHeader title={`Patient ${patientId}`} breadcrumb={breadcrumb} />
        <Card>
          <LoadingState label="Loading patient record" />
        </Card>
      </>
    );
  }

  if (error) {
    return (
      <>
        <PageHeader title={`Patient ${patientId}`} breadcrumb={breadcrumb} />
        <Card>
          {error.status === 404 ? (
            <EmptyState
              icon="search"
              title="Patient not found"
              description={`There is no record for patient ${patientId}.`}
              action={<Button to="/patients">Back to patients</Button>}
            />
          ) : (
            <ErrorState error={error} onRetry={reload} />
          )}
        </Card>
      </>
    );
  }

  const visible =
    filter === 'unresolved' ? view.unresolved : filter === 'resolved' ? view.resolved : [...view.unresolved, ...view.resolved];

  return (
    <>
      <PageHeader
        title={
          <>
            Patient <span className="mono" style={{ fontSize: 'inherit' }}>{patientId}</span>
          </>
        }
        breadcrumb={breadcrumb}
        description={
          <span className="toolbar" style={{ gap: 8 }}>
            {data.clinicId ? <Badge>Clinic {data.clinicId}</Badge> : null}
            {view.unresolved.length > 0 ? (
              <Badge tone="warn" icon="alert">
                {plural(view.unresolved.length, 'unresolved conflict')}
              </Badge>
            ) : (
              <Badge tone="ok" icon="check">
                No open conflicts
              </Badge>
            )}
            <span>{plural(data.snapshots.length, 'medication list')} on record</span>
          </span>
        }
        actions={
          <Button variant="primary" icon="plus" to={`/ingest?patient=${encodeURIComponent(patientId)}`}>
            Add medication list
          </Button>
        }
      />

      <div className="stack">
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            {
              value: 'conflicts',
              label: 'Conflicts',
              count: view.unresolved.length,
              tone: view.unresolved.length > 0 ? 'warn' : 'neutral',
            },
            { value: 'history', label: 'Medication history', count: data.snapshots.length },
          ]}
        />

        {tab === 'conflicts' ? (
          <>
            <SegmentedControl
              label="Filter conflicts"
              value={filter}
              onChange={setFilter}
              options={[
                { value: 'unresolved', label: 'Needs review', count: view.unresolved.length },
                { value: 'resolved', label: 'Resolved', count: view.resolved.length },
                { value: 'all', label: 'All', count: data.conflicts.length },
              ]}
            />

            {visible.length === 0 ? (
              <Card>
                <EmptyState
                  icon="check"
                  title={filter === 'resolved' ? 'No resolved conflicts' : 'No conflicts to review'}
                  description={
                    filter === 'resolved'
                      ? 'Conflicts appear here once a reviewer has resolved them.'
                      : 'The sources on record agree, or every conflict has already been resolved.'
                  }
                />
              </Card>
            ) : (
              visible.map((conflict) => (
                <ConflictCard key={conflict.conflict_id} conflict={conflict} onResolve={setResolving} />
              ))
            )}
          </>
        ) : data.snapshots.length === 0 ? (
          <Card>
            <EmptyState title="No medication lists" description="Nothing has been submitted for this patient yet." />
          </Card>
        ) : (
          <SnapshotTimeline snapshots={data.snapshots} />
        )}
      </div>

      {resolving ? (
        <ResolveDialog
          conflict={resolving}
          sources={view.sources}
          onClose={() => setResolving(null)}
          onResolved={() => {
            setResolving(null);
            reload();
          }}
        />
      ) : null}
    </>
  );
}
