import Button from './Button.jsx';
import Icon from './Icon.jsx';

export function LoadingState({ label = 'Loading' }) {
  return (
    <div className="state" role="status">
      <div className="spinner" />
      <p className="muted">{label}</p>
    </div>
  );
}

export function ErrorState({ error, onRetry }) {
  return (
    <div className="state state--error" role="alert">
      <div className="state__icon">
        <Icon name="alert" size={20} />
      </div>
      <h3>Something went wrong</h3>
      <p className="state__description">{error?.message || 'The request could not be completed.'}</p>
      {onRetry ? (
        <div className="state__action">
          <Button icon="refresh" onClick={onRetry}>
            Try again
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export function EmptyState({ icon = 'inbox', title, description, action }) {
  return (
    <div className="state">
      <div className="state__icon">
        <Icon name={icon} size={20} />
      </div>
      <h3>{title}</h3>
      {description ? <p className="state__description">{description}</p> : null}
      {action ? <div className="state__action">{action}</div> : null}
    </div>
  );
}

export function InlineAlert({ children }) {
  return (
    <div className="alert" role="alert">
      <Icon name="alert" />
      <span>{children}</span>
    </div>
  );
}
