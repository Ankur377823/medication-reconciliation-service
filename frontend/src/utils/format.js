// The API returns UTC timestamps without a timezone suffix, so add one
// before parsing or the browser would treat them as local time.
export function parseDate(value) {
  if (!value) return null;
  const text = String(value);
  const hasZone = /(Z|[+-]\d{2}:?\d{2})$/i.test(text);
  const date = new Date(hasZone ? text : `${text}Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

const dateTimeFormat = new Intl.DateTimeFormat(undefined, {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

export function formatDateTime(value) {
  const date = parseDate(value);
  return date ? dateTimeFormat.format(date) : 'Unknown date';
}

const SOURCE_LABELS = {
  clinic_emr: 'Clinic EMR',
  hospital_discharge: 'Hospital discharge',
  patient_reported: 'Patient reported',
};

export const KNOWN_SOURCES = Object.keys(SOURCE_LABELS);

export function sourceLabel(source) {
  if (!source) return 'Unknown source';
  return SOURCE_LABELS[source] || source;
}

const CONFLICT_TYPES = {
  class_conflict: {
    label: 'Drug interaction',
    tone: 'danger',
    summary: 'These medications should not be taken together.',
  },
  dose_mismatch: {
    label: 'Dose mismatch',
    tone: 'warn',
    summary: 'Sources report different doses for this medication.',
  },
  status_conflict: {
    label: 'Status conflict',
    tone: 'warn',
    summary: 'Sources disagree on whether this medication is being taken.',
  },
};

export function conflictTypeMeta(type) {
  return CONFLICT_TYPES[type] || { label: type || 'Conflict', tone: 'warn', summary: '' };
}

export function capitalize(text) {
  if (!text) return '';
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function displayDose(dose) {
  return dose ? dose : 'Not specified';
}

export function plural(count, singular, pluralForm = `${singular}s`) {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}
