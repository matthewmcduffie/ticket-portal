import React from 'react';
import './Tooltip.css';

export default function Tooltip({ text, children, position = 'top', maxWidth }) {
  if (!text) return children;
  return (
    <span
      className={`tt tt--${position}`}
      data-tip={text}
      style={maxWidth ? { '--tt-max-width': maxWidth } : undefined}
    >
      {children}
    </span>
  );
}
