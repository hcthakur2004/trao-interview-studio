'use client';
import { LoaderCircle, Sparkles, Upload, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { api } from './api';

export default function NewKit({
  demo,
  onClose,
  onCreated,
}: {
  demo: boolean;
  onClose: () => void;
  onCreated: (id: string) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [rows, setRows] = useState<unknown[] | null>(null);
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (demo) {
      setError(
        'Create an account to generate a real kit. This example does not send data to an AI provider.',
      );
      return;
    }
    setBusy(true);
    setError('');
    const data = Object.fromEntries(new FormData(e.currentTarget));
    const cases = rows || [{ jd: data.jd, company_url: data.company_url, days: Number(data.days) }];
    const errors: string[] = [];
    let last = '';
    for (const [i, item] of cases.entries()) {
      try {
        const result = await api<{ id: string }>('/jobs', {
          method: 'POST',
          body: JSON.stringify(item),
        });
        last = result.id;
      } catch (e) {
        errors.push(`Row ${i + 1}: ${(e as Error).message}`);
      }
    }
    if (errors.length) {
      setError(`${last ? 'Some kits were queued. ' : ''}${errors.join(' ')}`);
    } else if (last) await onCreated(last);
    setBusy(false);
  };
  return (
    <dialog
      ref={ref}
      className="modal"
      onCancel={(e) => {
        if (busy) e.preventDefault();
        else onClose();
      }}
    >
      <div className="modal-heading">
        <div>
          <span className="eyebrow">A NEW OPPORTUNITY</span>
          <h2>Build your prep kit</h2>
        </div>
        <button
          className="icon-button"
          onClick={onClose}
          disabled={busy}
          aria-label="Close new kit"
        >
          <X size={21} />
        </button>
      </div>
      <p className="modal-intro">
        Start with the role. We’ll research the company and organize what to practise.
      </p>
      <form onSubmit={submit}>
        <label>
          Job description
          <textarea
            name="jd"
            rows={7}
            placeholder="Paste the complete job description here…"
            required={!rows}
            minLength={5}
            maxLength={30000}
            disabled={Boolean(rows) || busy}
          />
        </label>
        <div className="form-grid">
          <label>
            Company website
            <input
              name="company_url"
              type="url"
              placeholder="https://company.com"
              required={!rows}
              disabled={Boolean(rows) || busy}
            />
          </label>
          <label>
            Days to prepare
            <input
              name="days"
              type="number"
              min={1}
              max={60}
              defaultValue={7}
              required={!rows}
              disabled={Boolean(rows) || busy}
            />
          </label>
        </div>
        <div className="upload-row">
          <Upload size={18} />
          <label className="upload-label">
            {rows
              ? `${rows.length} cases ready to import`
              : 'Preparing for multiple roles? Import a JSON file.'}
            <input
              aria-label="Import JSON cases"
              type="file"
              accept=".json,application/json"
              disabled={busy}
              onChange={async (e) => {
                try {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (file.size > 1000000) throw new Error('File must be under 1 MB.');
                  const value = JSON.parse(await file.text());
                  if (!Array.isArray(value) || !value.length || value.length > 10)
                    throw new Error(
                      'Provide an array of 1–10 cases with jd, company_url, and days.',
                    );
                  setRows(value);
                  setError('');
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            />
          </label>
          {rows && (
            <button type="button" className="text-button" onClick={() => setRows(null)}>
              Clear
            </button>
          )}
        </div>
        <p className="helper">
          Your job description and retrieved company text are sent to the configured AI provider.
          Avoid including confidential information.
        </p>
        {error && (
          <div role="alert" className="alert error">
            {error}
          </div>
        )}
        <div className="modal-actions">
          <button type="button" className="button secondary" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button className="button primary" disabled={busy}>
            {busy ? <LoaderCircle className="spin" size={17} /> : <Sparkles size={17} />}Build{' '}
            {rows ? `${rows.length} kits` : 'my kit'}
          </button>
        </div>
      </form>
    </dialog>
  );
}
