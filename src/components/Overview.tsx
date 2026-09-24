'use client';
import type { Kit, KitRecord } from '@/core/contracts';
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  CircleHelp,
  Layers3,
  Pin,
  RotateCcw,
  ShieldCheck,
  Target,
  Zap,
} from 'lucide-react';

import { EditableText, Stat } from './primitives';
import RoleDetails from './RoleDetails';
import { type Tab } from './ui-types';
export default function Overview({
  kit,
  practice,
  update,
  onTab,
  regenerate,
}: {
  kit: Kit;
  practice: KitRecord['practice'];
  update: (fn: (k: Kit) => void) => void;
  onTab: (tab: Tab) => void;
  regenerate: (s: string) => void;
}) {
  const reviewed = kit.flashcards.filter((f) => practice[f.id]).length;
  const all = kit.role.requirements.length;
  const covered = all - kit.coverage.uncovered_requirement_ids.length;
  return (
    <>
      <div className="stat-grid">
        <Stat
          icon={CircleHelp}
          label="Questions to explore"
          value={kit.questions.length}
          detail="Built around your role"
        />
        <Stat
          icon={Layers3}
          label="Flashcards ready"
          value={kit.flashcards.length}
          detail={`${reviewed} reviewed so far`}
        />
        <Stat
          icon={CalendarDays}
          label="Days in your plan"
          value={kit.schedule.days_available}
          detail={`${kit.schedule.days.reduce((n, d) => n + d.minutes, 0)} minutes of preparation`}
        />
        <Stat
          icon={ShieldCheck}
          label="Requirement coverage"
          value={`${all ? Math.round((covered / all) * 100) : 0}%`}
          detail={`${covered} of ${all} requirements covered`}
        />
      </div>
      <div className="overview-grid">
        <div className="overview-main">
          <section className="panel brief-panel">
            <div className="panel-heading">
              <div className="section-title">
                <span className="icon-tint">
                  <BookOpen size={19} />
                </span>
                <h2>Get to know the company</h2>
              </div>
              <button
                className="icon-button"
                aria-label="Regenerate company brief"
                title="Regenerate company brief"
                onClick={() => regenerate('company_brief')}
              >
                <RotateCcw size={16} />
              </button>
            </div>
            <EditableText
              label="Company summary"
              value={kit.company_brief.summary}
              onChange={(v) =>
                update((k) => {
                  k.company_brief.summary = v;
                })
              }
            />
            <h3 className="small-heading">WHAT THEY DO</h3>
            <EditableText
              label="What the company does"
              value={kit.company_brief.what_they_do}
              onChange={(v) =>
                update((k) => {
                  k.company_brief.what_they_do = v;
                })
              }
            />
            <div className="panel-foot">
              <span>
                <ShieldCheck size={14} />
                {kit.company_brief.sources.length
                  ? `${kit.company_brief.sources.length} supporting sources`
                  : 'No verified company sources'}
              </span>
              <button className="text-button" onClick={() => onTab('sources')}>
                View research
                <ArrowRight size={14} />
              </button>
            </div>
          </section>
          <section className="panel role-panel">
            <div className="panel-heading">
              <div className="section-title">
                <span className="icon-tint blue">
                  <Target size={19} />
                </span>
                <h2>What this role needs</h2>
              </div>
              <span className="neutral-pill">{kit.role.seniority || 'Seniority unspecified'}</span>
            </div>
            <p className="section-description">The requirements that shape your preparation.</p>
            <div className="requirements-list">
              {kit.role.requirements.map((r, i) => (
                <div key={r.id} className="requirement-row">
                  <span className="requirement-number">{String(i + 1).padStart(2, '0')}</span>
                  <div>
                    <EditableText
                      label={`Requirement ${i + 1}`}
                      value={r.text}
                      onChange={(v) =>
                        update((k) => {
                          k.role.requirements[i].text = v;
                        })
                      }
                    />
                    <small>
                      {r.kind} <span>·</span>{' '}
                      {kit.questions.filter((q) => q.requirement_ids.includes(r.id)).length} linked
                      questions
                    </small>
                  </div>
                  <span className={`priority-pill ${r.priority}`}>
                    {r.priority === 'must' ? 'Must-have' : 'Nice-to-have'}
                  </span>
                </div>
              ))}
            </div>
            {!kit.role.requirements.length && (
              <p className="helper">
                No explicit requirements could be extracted. A more detailed description will
                produce a more useful kit.
              </p>
            )}
            <RoleDetails kit={kit} update={update} />
          </section>
        </div>
        <div className="overview-aside">
          <section className="practice-callout">
            <div className="callout-top">
              <span className="icon-tint">
                <Zap size={20} />
              </span>
              <span className="neutral-pill">YOUR NEXT STEP</span>
            </div>
            <h2>
              Turn knowing
              <br />
              into confidence.
            </h2>
            <p>
              A short practice session goes a long way. Start with a question, then reveal the
              answer.
            </p>
            <div className="practice-progress">
              <span>Cards reviewed</span>
              <strong>
                {reviewed}/{kit.flashcards.length}
              </strong>
            </div>
            <div className="progress-track">
              <span
                style={{
                  width: `${kit.flashcards.length ? (reviewed / kit.flashcards.length) * 100 : 0}%`,
                }}
              />
            </div>
            <button className="button dark full" onClick={() => onTab('flashcards')}>
              Practise flashcards
              <ArrowRight size={16} />
            </button>
          </section>
          <section className="panel plan-preview">
            <div className="panel-heading">
              <h2>Your study plan</h2>
              <CalendarDays size={18} />
            </div>
            {kit.schedule.days.slice(0, 3).map((d) => (
              <div className="preview-day" key={d.day}>
                <span className="day-box">
                  DAY<strong>{d.day}</strong>
                </span>
                <div>
                  <strong>{d.focus}</strong>
                  <small>
                    {d.question_ids.length} questions <span>·</span> {d.minutes} min
                  </small>
                </div>
              </div>
            ))}
            <button className="text-button full" onClick={() => onTab('schedule')}>
              See the full {kit.schedule.days_available}-day plan
              <ArrowRight size={15} />
            </button>
          </section>
          <div className="quiet-note">
            <Pin size={16} />
            <p>Make this kit yours. Edit any text, and pin the questions you want to keep.</p>
          </div>
        </div>
      </div>
    </>
  );
}
