'use client';
import type { Job } from '@/core/contracts';
import { ArrowRight, ArrowUp, BookOpen, Check, CircleHelp, LoaderCircle, Plus } from 'lucide-react';

import { type Summary } from './ui-types';
export default function Dashboard({
  demo,
  summaries,
  jobs,
  onCreate,
  onOpen,
  onRetry,
}: {
  demo: boolean;
  summaries: Summary[];
  jobs: Job[];
  onCreate: () => void;
  onOpen: (id: string) => void;
  onRetry: (id: string) => void;
}) {
  const list = demo
    ? [
        {
          id: 'example',
          title: 'Senior Frontend Engineer',
          company: 'Northstar',
          questions: 6,
          days: 7,
          reviewed: 0,
          cards: 6,
          updated_at: '',
        },
      ]
    : summaries;
  return (
    <>
      <div className="section-heading dashboard-heading">
        <div>
          <div className="eyebrow">A LITTLE MORE READY, EVERY DAY</div>
          <h1>Your preparation, in one place.</h1>
          <p className="subtitle">Choose a role. Make a plan. Build your confidence.</p>
        </div>
        <button className="button primary" onClick={onCreate}>
          <Plus size={18} />
          New prep kit
        </button>
      </div>
      {jobs
        .filter((j) => j.status !== 'completed')
        .map((job) => (
          <div className="job-card panel" key={job.id}>
            <div className="job-heading">
              {job.status === 'failed' ? (
                <CircleHelp size={20} />
              ) : (
                <LoaderCircle className="spin" size={20} />
              )}
              <div>
                <strong>
                  {job.status === 'failed'
                    ? 'This kit needs another try'
                    : 'Building your preparation kit'}
                </strong>
                <p>{job.status === 'failed' ? job.error?.message : job.stage}</p>
              </div>
              {job.status === 'failed' && (
                <button className="button secondary" onClick={() => onRetry(job.id)}>
                  Retry
                </button>
              )}
            </div>
            <details>
              <summary>View generation steps</summary>
              <ol className="trace-list">
                {job.trace.map((entry, i) => (
                  <li key={i}>
                    <Check size={14} />
                    <span>{entry.message}</span>
                  </li>
                ))}
              </ol>
            </details>
          </div>
        ))}
      <div className="section-heading">
        <h2>
          My prep kits <span className="count-badge">{list.length}</span>
        </h2>
      </div>
      {list.length ? (
        <div className="kits-grid">
          {list.map((s) => (
            <button key={s.id} className="kit-card panel" onClick={() => onOpen(s.id)}>
              <div className="kit-card-top">
                <span className="company-tile">{s.company?.[0] || 'K'}</span>
                <ArrowUp size={20} className="diagonal" />
              </div>
              <p>{s.company || 'Your company'}</p>
              <h3>{s.title || 'Interview preparation'}</h3>
              <div className="kit-card-details">
                <span>{s.questions} questions</span>
                <span>{s.days} days</span>
              </div>
              <div className="progress-track">
                <span style={{ width: `${s.cards ? (s.reviewed / s.cards) * 100 : 0}%` }} />
              </div>
              <small>
                {s.reviewed} of {s.cards} cards reviewed
              </small>
            </button>
          ))}
        </div>
      ) : (
        <div className="empty-state panel">
          <span className="empty-icon">
            <BookOpen size={30} />
          </span>
          <h2>Your next opportunity deserves a plan.</h2>
          <p>
            Paste a job description and a company website.
            <br />
            We’ll turn them into a kit you can make your own.
          </p>
          <button className="button primary" onClick={onCreate}>
            <Plus size={17} />
            Create your first kit
          </button>
          <a href="/demo">
            Or explore an example <ArrowRight size={14} />
          </a>
        </div>
      )}
    </>
  );
}
