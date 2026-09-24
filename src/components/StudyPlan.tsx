'use client';
import type { Kit } from '@/core/contracts';
import { allocateSchedule } from '@/core/deterministic';
import { ArrowUp, CalendarDays, CircleHelp, Clock3, RotateCcw } from 'lucide-react';

import { EditableText } from './primitives';
export default function StudyPlan({
  kit,
  update,
  regenerate,
  onQuestion,
}: {
  kit: Kit;
  update: (fn: (k: Kit) => void) => void;
  regenerate: (s: string) => void;
  onQuestion: (id: string) => void;
}) {
  return (
    <>
      <div className="section-heading">
        <div>
          <h2>A plan you can follow.</h2>
          <p className="section-description">
            Higher-priority, harder topics come first. Longer plans leave room to revisit them.
          </p>
        </div>
        <button className="button secondary" onClick={() => regenerate('schedule')}>
          <RotateCcw size={16} />
          Rebuild plan
        </button>
      </div>
      <div className="schedule-summary panel">
        <CalendarDays size={22} />
        <span>
          <strong>{kit.schedule.days_available} days</strong> to build your confidence
        </span>
        <span className="summary-divider" />
        <Clock3 size={18} />
        <span>
          <strong>{kit.schedule.days.reduce((n, d) => n + d.minutes, 0)} minutes</strong> planned in
          total
        </span>
      </div>
      <label className="plan-days-input">
        Days available
        <input
          aria-label="Days available"
          type="number"
          min={1}
          max={60}
          defaultValue={kit.schedule.days_available}
          onBlur={(e) => {
            const days = Number(e.target.value);
            if (
              Number.isInteger(days) &&
              days >= 1 &&
              days <= 60 &&
              days !== kit.schedule.days_available
            )
              update((k) => {
                k.schedule = allocateSchedule(k.role.requirements, k.questions, days);
              });
            else e.target.value = String(kit.schedule.days_available);
          }}
        />
        <span>Changing this rebuilds the allocation across exactly that many days.</span>
      </label>
      <div className="schedule-list">
        {kit.schedule.days.map((day, i) => (
          <section key={day.day} className="schedule-day panel">
            <div className="schedule-day-number">
              <span>DAY</span>
              <strong>{String(day.day).padStart(2, '0')}</strong>
            </div>
            <div className="schedule-day-content">
              <div className="section-heading">
                <h3>
                  <EditableText
                    label={`day ${day.day} focus`}
                    value={day.focus}
                    onChange={(v) =>
                      update((k) => {
                        k.schedule.days[i].focus = v;
                      })
                    }
                  />
                </h3>
                <label className="duration-input">
                  <Clock3 size={14} />
                  <input
                    aria-label={`Day ${day.day} duration in minutes`}
                    type="number"
                    min={0}
                    step={1}
                    value={day.minutes}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      if (Number.isInteger(v) && v >= 0)
                        update((k) => {
                          k.schedule.days[i].minutes = v;
                        });
                    }}
                  />
                  min
                </label>
              </div>
              {day.question_ids.map((id) => (
                <button className="scheduled-question" onClick={() => onQuestion(id)} key={id}>
                  <CircleHelp size={15} />
                  <span>{kit.questions.find((q) => q.id === id)?.prompt}</span>
                  <ArrowUp size={14} className="diagonal" />
                </button>
              ))}
              {!day.question_ids.length && (
                <p className="helper">
                  No linked questions. Clarify the role and review your notes.
                </p>
              )}
              <details className="link-requirements">
                <summary>Edit scheduled questions</summary>
                {kit.questions.map((q) => (
                  <label className="checkbox-label" key={q.id}>
                    <input
                      type="checkbox"
                      checked={day.question_ids.includes(q.id)}
                      onChange={(e) =>
                        update((k) => {
                          k.schedule.days[i].question_ids = e.target.checked
                            ? [...k.schedule.days[i].question_ids, q.id]
                            : k.schedule.days[i].question_ids.filter((x) => x !== q.id);
                        })
                      }
                    />
                    {q.prompt}
                  </label>
                ))}
              </details>
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
