'use client';
import { CircleHelp, Layers3, LoaderCircle } from 'lucide-react';
import { useState } from 'react';

export function IconLogo() {
  return (
    <span className="brand-icon">
      <Layers3 size={22} strokeWidth={2.2} />
    </span>
  );
}
export function Loading({ text = 'Loading your workspace…' }: { text?: string }) {
  return (
    <div className="loading">
      <LoaderCircle className="spin" size={22} />
      {text}
    </div>
  );
}

export function Stat({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: typeof CircleHelp;
  label: string;
  value: string | number;
  detail: string;
}) {
  return (
    <div className="stat-card panel">
      <div className="stat-label">
        {label}
        <Icon size={17} />
      </div>
      <strong className="stat-value">{value}</strong>
      <span className="stat-detail">{detail}</span>
    </div>
  );
}
export function EditableText({
  label,
  value,
  onChange,
  multiline = true,
}: {
  label: string;
  value: string;
  onChange: (s: string) => void;
  multiline?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  return editing ? (
    <textarea
      className="inline-input"
      aria-label={label}
      value={value}
      rows={multiline ? Math.max(2, Math.ceil(value.length / 90)) : 2}
      autoFocus
      onChange={(e) => onChange(e.target.value)}
      onBlur={() => setEditing(false)}
      onKeyDown={(e) => {
        if (e.key === 'Escape' || (e.key === 'Enter' && (e.metaKey || e.ctrlKey)))
          setEditing(false);
      }}
    />
  ) : (
    <button
      type="button"
      className="editable-text"
      title={`Edit ${label.toLowerCase()}`}
      aria-label={`Edit ${label.toLowerCase()}: ${value || 'empty'}`}
      onClick={() => setEditing(true)}
    >
      {value || 'Click to add text'}
      <span className="edit-hint">Edit</span>
    </button>
  );
}
