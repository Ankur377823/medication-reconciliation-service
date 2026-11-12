import { Link, NavLink } from 'react-router-dom';

import Icon from '../ui/Icon.jsx';
import ApiStatus from './ApiStatus.jsx';

const NAV_ITEMS = [
  { to: '/', label: 'Overview', icon: 'overview', end: true },
  { to: '/patients', label: 'Patients', icon: 'patients' },
  { to: '/ingest', label: 'Submit medication list', icon: 'submit' },
];

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <Link to="/" className="brand">
        <span className="brand__mark">
          <Icon name="cross" size={18} strokeWidth={2.6} />
        </span>
        <span>
          <span className="brand__name">MedRec</span>
          <span className="brand__tag">Medication Reconciliation</span>
        </span>
      </Link>

      <nav className="nav" aria-label="Main">
        <div className="nav__label">Workspace</div>
        {NAV_ITEMS.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end} className="nav__link">
            <Icon name={item.icon} size={17} />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar__footer">
        <ApiStatus />
      </div>
    </aside>
  );
}
