import { api } from '../../api/client.js';
import { useAsync } from '../../hooks/useAsync.js';

/** Shows whether the backend is reachable. Useful while a hosted API wakes from sleep. */
export default function ApiStatus() {
  const { loading, error } = useAsync((signal) => api.health(signal), []);

  const state = loading ? 'checking' : error ? 'offline' : 'online';
  const label = { checking: 'Connecting to service', offline: 'Service unreachable', online: 'Service connected' }[
    state
  ];

  return (
    <div className={`api-status api-status--${state}`} role="status">
      <span className="api-status__dot" />
      {label}
    </div>
  );
}
