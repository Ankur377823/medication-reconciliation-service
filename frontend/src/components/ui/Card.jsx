export default function Card({ title, subtitle, actions, flush = false, className = '', children }) {
  return (
    <section className={`card ${className}`.trim()}>
      {title || actions ? (
        <header className="card__header">
          <div>
            {title ? <h2>{title}</h2> : null}
            {subtitle ? <p className="card__subtitle">{subtitle}</p> : null}
          </div>
          {actions}
        </header>
      ) : null}
      <div className={`card__body${flush ? ' card__body--flush' : ''}`}>{children}</div>
    </section>
  );
}
