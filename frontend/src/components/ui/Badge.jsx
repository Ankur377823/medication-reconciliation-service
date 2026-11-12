import Icon from './Icon.jsx';

/** tone: neutral | warn | danger | ok | accent */
export default function Badge({ tone = 'neutral', icon, children }) {
  return (
    <span className={`badge${tone === 'neutral' ? '' : ` badge--${tone}`}`}>
      {icon ? <Icon name={icon} size={12} strokeWidth={2.2} /> : null}
      {children}
    </span>
  );
}
