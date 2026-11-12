import { Link } from 'react-router-dom';

import Icon from './Icon.jsx';

/**
 * Renders a router link when `to` is given, otherwise a button.
 * variant: primary | secondary | ghost
 */
export default function Button({
  variant = 'secondary',
  size,
  icon,
  iconOnly = false,
  to,
  className = '',
  children,
  type = 'button',
  ...rest
}) {
  const classes = [
    'btn',
    `btn--${variant}`,
    size === 'sm' ? 'btn--sm' : '',
    iconOnly ? 'btn--icon' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const content = (
    <>
      {icon ? <Icon name={icon} /> : null}
      {iconOnly ? <span className="visually-hidden">{children}</span> : children}
    </>
  );

  if (to) {
    return (
      <Link to={to} className={classes} {...rest}>
        {content}
      </Link>
    );
  }

  return (
    <button type={type} className={classes} {...rest}>
      {content}
    </button>
  );
}
