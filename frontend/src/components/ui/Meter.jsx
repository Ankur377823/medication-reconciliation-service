/** A count shown next to a bar scaled against the largest value in the set. */
export default function Meter({ value, max }) {
  const percent = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="meter">
      <div className="meter__track">
        <span className="meter__fill" style={{ width: `${percent}%` }} />
      </div>
      <span className="meter__value">{value}</span>
    </div>
  );
}
