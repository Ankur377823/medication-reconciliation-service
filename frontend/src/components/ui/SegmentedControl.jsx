/** options: [{ value, label, count? }] */
export default function SegmentedControl({ options, value, onChange, label }) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className="segmented__item"
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
          {option.count !== undefined ? <span className="segmented__count">{option.count}</span> : null}
        </button>
      ))}
    </div>
  );
}
