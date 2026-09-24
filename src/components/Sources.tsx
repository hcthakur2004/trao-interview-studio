'use client';
import type { Kit } from '@/core/contracts';
import { Check, CircleHelp, ExternalLink, FileText, Search } from 'lucide-react';

export default function Sources({ kit }: { kit: Kit }) {
  return (
    <>
      <div className="section-heading">
        <div>
          <h2>See what shaped your kit.</h2>
          <p className="section-description">
            Sources, research gaps, and the steps behind your preparation.
          </p>
        </div>
        <span className="neutral-pill">
          {kit.coverage.passes} coverage {kit.coverage.passes === 1 ? 'pass' : 'passes'}
        </span>
      </div>
      {kit.warnings.length > 0 && (
        <section className="panel warnings-panel">
          <h3>
            <CircleHelp size={18} />
            What we could not establish
          </h3>
          <ul>
            {kit.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </section>
      )}
      <div className="sources-grid">
        <section className="panel">
          <h2>Company sources</h2>
          <p className="section-description">Pages retrieved directly from the company website.</p>
          {kit.source.pages_used.length ? (
            kit.source.pages_used.map((url) => (
              <a className="source-link" href={url} target="_blank" rel="noreferrer" key={url}>
                <FileText size={17} />
                <span>
                  {url}
                  {kit.research?.hiring_pages.includes(url) && (
                    <small>Hiring-process evidence</small>
                  )}
                </span>
                <ExternalLink size={15} />
              </a>
            ))
          ) : (
            <p className="helper">No company pages were retrieved.</p>
          )}
        </section>
        <section className="panel">
          <h2>Public discussion</h2>
          <p className="section-description">
            Third-party reports are anecdotal and may be outdated.
          </p>
          {kit.research?.discussion_sources.length ? (
            kit.research.discussion_sources.map((url) => (
              <a className="source-link" href={url} target="_blank" rel="noreferrer" key={url}>
                <Search size={17} />
                <span>{url}</span>
                <ExternalLink size={15} />
              </a>
            ))
          ) : (
            <p className="helper">No public discussion sources are available.</p>
          )}
        </section>
      </div>
      <section className="panel pipeline-panel">
        <h2>Generation trail</h2>
        <p className="section-description">The actual steps recorded while building this kit.</p>
        {kit.trace.length ? (
          <ol className="trace-list">
            {kit.trace.map((t, i) => (
              <li key={i}>
                <span className="trace-check">
                  <Check size={13} />
                </span>
                <div>
                  <strong>{t.stage}</strong>
                  <p>{t.message}</p>
                </div>
                <time>
                  {new Date(t.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </time>
              </li>
            ))}
          </ol>
        ) : (
          <p className="helper">This illustrative sample has no live generation history.</p>
        )}
      </section>
    </>
  );
}
