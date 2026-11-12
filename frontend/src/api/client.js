// Thin wrapper around the FastAPI backend. Every page talks to the API
// through the functions exported at the bottom of this file.

function resolveBaseUrl() {
  let url = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:8000' : '');
  url = url.trim().replace(/\/+$/, '');
  if (url && !/^https?:\/\//i.test(url)) url = `https://${url}`;
  return url;
}

export const API_BASE = resolveBaseUrl();

export class ApiError extends Error {
  constructor(message, status = 0) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

function describeError(data, status) {
  const detail = data?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    // FastAPI validation errors: [{ loc: [...], msg: '...' }]
    return detail
      .map((item) => {
        const field = (item.loc || []).filter((part) => part !== 'body').join(' > ');
        return field ? `${field}: ${item.msg}` : item.msg;
      })
      .join('; ');
  }
  return `The request failed (HTTP ${status}).`;
}

async function request(path, { method = 'GET', body, signal } = {}) {
  if (!API_BASE) {
    throw new ApiError('The API address is not configured. Set VITE_API_URL and rebuild the site.');
  }

  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      signal,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new ApiError(
      'Could not reach the service. It may still be starting up; wait a moment and try again.',
    );
  }

  const data = await response.json().catch(() => null);
  if (!response.ok) throw new ApiError(describeError(data, response.status), response.status);
  return data;
}

const id = encodeURIComponent;

export const api = {
  health: (signal) => request('/', { signal }),
  listPatients: (signal) => request('/patients', { signal }),
  conflictStats: (signal) => request('/conflict-stats', { signal }),
  getConflicts: (patientId, signal) => request(`/conflicts/${id(patientId)}`, { signal }),
  getSnapshots: (patientId, signal) => request(`/snapshots/${id(patientId)}`, { signal }),
  ingest: (payload) => request('/ingest', { method: 'POST', body: payload }),
  resolveConflict: (payload) => request('/resolve', { method: 'POST', body: payload }),
};
