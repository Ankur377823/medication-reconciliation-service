import { Link } from 'react-router-dom';

import Icon from './Icon.jsx';

/** breadcrumb: [{ label, to? }] */
export default function PageHeader({ title, description, actions, breadcrumb }) {
  return (
    <div>
      {breadcrumb ? (
        <nav className="breadcrumb" aria-label="Breadcrumb">
          {breadcrumb.map((item, index) => (
            <span key={item.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              {index > 0 ? <Icon name="chevronRight" size={12} /> : null}
              {item.to ? <Link to={item.to}>{item.label}</Link> : <span>{item.label}</span>}
            </span>
          ))}
        </nav>
      ) : null}
      <header className="page-header">
        <div>
          <h1>{title}</h1>
          {description ? <p className="page-header__description">{description}</p> : null}
        </div>
        {actions ? <div className="page-header__actions">{actions}</div> : null}
      </header>
    </div>
  );
}
