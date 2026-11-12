import Badge from './Badge.jsx';

/** tabs: [{ value, label, count?, tone? }] */
export default function Tabs({ tabs, value, onChange }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.value}
          type="button"
          role="tab"
          className="tabs__tab"
          aria-selected={tab.value === value}
          onClick={() => onChange(tab.value)}
        >
          {tab.label}
          {tab.count !== undefined ? <Badge tone={tab.tone}>{tab.count}</Badge> : null}
        </button>
      ))}
    </div>
  );
}
