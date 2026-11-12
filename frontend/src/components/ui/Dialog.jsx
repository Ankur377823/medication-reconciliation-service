import { useEffect, useRef } from 'react';

import Button from './Button.jsx';

/** Modal built on the native <dialog>, which handles focus trapping and Escape. */
export default function Dialog({ title, subtitle, onClose, footer, children }) {
  const ref = useRef(null);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => dialog?.close();
  }, []);

  return (
    <dialog
      ref={ref}
      className="dialog"
      aria-labelledby="dialog-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
    >
      <div className="dialog__header">
        <div>
          <h2 id="dialog-title">{title}</h2>
          {subtitle ? <p className="dialog__subtitle">{subtitle}</p> : null}
        </div>
        <Button variant="ghost" size="sm" icon="close" iconOnly onClick={onClose}>
          Close
        </Button>
      </div>
      {children}
      {footer ? <div className="dialog__footer">{footer}</div> : null}
    </dialog>
  );
}
