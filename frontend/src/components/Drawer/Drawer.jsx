import React, { useEffect, useState } from 'react';
import './Drawer.css';

export default function Drawer({ open, onClose, title, children }) {
  const [mounted, setMounted] = useState(false);

  // Mount children on first open; keep mounted to preserve state
  useEffect(() => { if (open) setMounted(true); }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function onKey(e) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <div className={`drawer-overlay${open ? ' drawer-overlay--open' : ''}`} aria-hidden={!open}>
      <div className="drawer-backdrop" onClick={onClose} />
      <div className="drawer" role="dialog" aria-modal="true">
        <div className="drawer__header">
          <h2 className="drawer__title">{title}</h2>
          <button className="drawer__close" onClick={onClose} aria-label="Close drawer">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div className="drawer__body">
          {mounted && children}
        </div>
      </div>
    </div>
  );
}
