import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import { api } from '../api/client.js';
import { useAsync } from '../hooks/useAsync.js';
import Badge from '../components/ui/Badge.jsx';
import Button from '../components/ui/Button.jsx';
import Card from '../components/ui/Card.jsx';
import DataTable from '../components/ui/DataTable.jsx';
import Icon from '../components/ui/Icon.jsx';
import PageHeader from '../components/ui/PageHeader.jsx';
import { EmptyState, ErrorState, LoadingState } from '../components/ui/States.jsx';
import { plural } from '../utils/format.js';

export default function PatientsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { data: patients, error, loading, reload } = useAsync((signal) => api.listPatients(signal), []);

  const [query, setQuery] = useState('');
  const [clinic, setClinic] = useState('all');
  const [reviewOnly, setReviewOnly] = useState(searchParams.get('review') === '1');

  const clinics = useMemo(
    () => [...new Set((patients || []).map((patient) => patient.clinic_id))].sort(),
    [patients],
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (patients || []).filter((patient) => {
      if (needle && !patient.patient_id.toLowerCase().includes(needle)) return false;
      if (clinic !== 'all' && patient.clinic_id !== clinic) return false;
      if (reviewOnly && patient.unresolved_count === 0) return false;
      return true;
    });
  }, [patients, query, clinic, reviewOnly]);

  const columns = [
    {
      key: 'patient_id',
      header: 'Patient ID',
      sortValue: (row) => row.patient_id,
      render: (row) => (
        <Link
          className="cell-id"
          to={`/patients/${encodeURIComponent(row.patient_id)}`}
          onClick={(event) => event.stopPropagation()}
        >
          {row.patient_id}
        </Link>
      ),
    },
    { key: 'clinic_id', header: 'Clinic', sortValue: (row) => row.clinic_id },
    {
      key: 'status',
      header: 'Status',
      sortValue: (row) => (row.unresolved_count > 0 ? 0 : 1),
      render: (row) =>
        row.unresolved_count > 0 ? (
          <Badge tone="warn" icon="alert">
            Needs review
          </Badge>
        ) : (
          <Badge>No open conflicts</Badge>
        ),
    },
    {
      key: 'unresolved_count',
      header: 'Unresolved',
      align: 'right',
      sortValue: (row) => row.unresolved_count,
      render: (row) => <span className="num">{row.unresolved_count}</span>,
    },
    {
      key: 'total_conflicts',
      header: 'Total conflicts',
      align: 'right',
      sortValue: (row) => row.total_conflicts,
      render: (row) => <span className="num muted">{row.total_conflicts}</span>,
    },
  ];

  let body;
  if (loading && !patients) {
    body = <LoadingState label="Loading patients" />;
  } else if (error) {
    body = <ErrorState error={error} onRetry={reload} />;
  } else if (patients.length === 0) {
    body = (
      <EmptyState
        title="No patients yet"
        description="A patient record is created the first time a medication list is submitted for them."
        action={
          <Button variant="primary" to="/ingest">
            Submit medication list
          </Button>
        }
      />
    );
  } else if (filtered.length === 0) {
    body = (
      <EmptyState
        icon="search"
        title="No matching patients"
        description="Try a different patient ID or clear the filters."
        action={
          <Button
            onClick={() => {
              setQuery('');
              setClinic('all');
              setReviewOnly(false);
            }}
          >
            Clear filters
          </Button>
        }
      />
    );
  } else {
    body = (
      <DataTable
        caption="Patients"
        columns={columns}
        rows={filtered}
        rowKey={(row) => row.patient_id}
        defaultSort={{ key: 'unresolved_count', direction: 'desc' }}
        onRowClick={(row) => navigate(`/patients/${encodeURIComponent(row.patient_id)}`)}
      />
    );
  }

  return (
    <>
      <PageHeader
        title="Patients"
        description="Find a patient to review their conflicts and medication history."
        actions={
          <Button variant="primary" icon="plus" to="/ingest">
            Submit medication list
          </Button>
        }
      />

      <Card
        flush
        title={
          <span className="toolbar">
            <span className="search">
              <Icon name="search" />
              <input
                className="input"
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by patient ID"
                aria-label="Search by patient ID"
              />
            </span>
            <select
              className="input"
              style={{ width: 'auto' }}
              value={clinic}
              onChange={(event) => setClinic(event.target.value)}
              aria-label="Filter by clinic"
            >
              <option value="all">All clinics</option>
              {clinics.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={reviewOnly}
                onChange={(event) => setReviewOnly(event.target.checked)}
              />
              Needs review only
            </label>
          </span>
        }
        actions={
          patients ? <span className="muted num">{plural(filtered.length, 'patient')}</span> : null
        }
      >
        {body}
      </Card>
    </>
  );
}
