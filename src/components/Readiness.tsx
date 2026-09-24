'use client';
import type { KitRecord } from '@/core/contracts';
import { Check, CircleHelp, ShieldCheck, Zap } from 'lucide-react';

export default function Readiness({
  record,
  onPractice,
}: {
  record: KitRecord;
  onPractice: () => void;
}) {
  return (
    <>
      <div className="section-heading">
        <div>
          <h2>Know where to focus next.</h2>
          <p className="section-description">
            Follow each requirement from the original description to your own practice.
          </p>
        </div>
        <button className="button primary" onClick={onPractice}>
          <Zap size={16} />
          Practise weak areas
        </button>
      </div>
      <div className="panel readiness-table">
        <div className="readiness-head">
          <span>REQUIREMENT & EVIDENCE</span>
          <span>QUESTIONS</span>
          <span>YOUR CONFIDENCE</span>
        </div>
        {record.kit.role.requirements.map((r) => {
          const cards = record.kit.flashcards.filter((f) => f.requirement_ids.includes(r.id));
          const ratings = cards.map((f) => record.practice[f.id]?.confidence).filter(Boolean);
          const average = ratings.length ? ratings.reduce((n, a) => n + a, 0) / ratings.length : 0;
          const linked = record.kit.questions.filter((q) =>
            q.requirement_ids.includes(r.id),
          ).length;
          return (
            <div className="readiness-row" key={r.id}>
              <div>
                <strong>{r.text}</strong>
                <span className={`priority-pill ${r.priority}`}>
                  {r.priority === 'must' ? 'Must-have' : 'Nice-to-have'}
                </span>
                {r.evidence && <blockquote>“{r.evidence}”</blockquote>}
              </div>
              <div>
                <span className={linked ? 'coverage-ok' : 'danger'}>
                  {linked ? <Check size={15} /> : <CircleHelp size={15} />}
                  {linked} linked
                </span>
              </div>
              <div>
                <span
                  className={`confidence-status ${average >= 2.5 ? 'high' : average ? 'medium' : ''}`}
                >
                  {!average
                    ? 'Not practised'
                    : average >= 2.5
                      ? 'Feeling confident'
                      : average >= 1.5
                        ? 'Getting there'
                        : 'Needs attention'}
                </span>
                <small>
                  {ratings.length}/{cards.length} cards reviewed
                </small>
              </div>
            </div>
          );
        })}
      </div>
      <div className="quiet-note">
        <ShieldCheck size={17} />
        <p>
          Question coverage means a topic has preparation material. Confidence reflects your
          ratings. Neither is a guarantee of readiness or selection.
        </p>
      </div>
    </>
  );
}
