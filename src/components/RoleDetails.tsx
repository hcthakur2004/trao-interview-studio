'use client';
import type { Kit } from '@/core/contracts';
import { Plus, Trash2 } from 'lucide-react';
import { EditableText } from './primitives';
import { uid } from './ui-types';

export default function RoleDetails({
  kit,
  update,
}: {
  kit: Kit;
  update: (fn: (kit: Kit) => void) => void;
}) {
  return (
    <details className="role-details">
      <summary>Edit role details and requirements</summary>
      <div className="form-grid">
        <label>
          Role title
          <input
            value={kit.role.title}
            onChange={(e) =>
              update((k) => {
                k.role.title = e.target.value;
                k.source.role = e.target.value;
              })
            }
          />
        </label>
        <label>
          Seniority
          <input
            value={kit.role.seniority}
            onChange={(e) =>
              update((k) => {
                k.role.seniority = e.target.value;
              })
            }
          />
        </label>
        <label>
          Company
          <input
            value={kit.source.company}
            onChange={(e) =>
              update((k) => {
                k.source.company = e.target.value;
              })
            }
          />
        </label>
        <label>
          Location
          <input
            value={kit.source.location}
            onChange={(e) =>
              update((k) => {
                k.source.location = e.target.value;
              })
            }
          />
        </label>
      </div>
      <h3 className="small-heading">RESPONSIBILITIES</h3>
      {kit.role.responsibilities.map((text, i) => (
        <div className="role-edit-row" key={i}>
          <EditableText
            label={`Responsibility ${i + 1}`}
            value={text}
            onChange={(value) =>
              update((k) => {
                k.role.responsibilities[i] = value;
              })
            }
          />
          <button
            className="icon-button"
            aria-label={`Delete responsibility ${i + 1}`}
            onClick={() =>
              update((k) => {
                k.role.responsibilities.splice(i, 1);
              })
            }
          >
            <Trash2 size={15} />
          </button>
        </div>
      ))}
      <button
        className="text-button"
        onClick={() =>
          update((k) => {
            k.role.responsibilities.push('Add a responsibility');
          })
        }
      >
        <Plus size={14} />
        Add responsibility
      </button>
      <h3 className="small-heading">REQUIREMENT SETTINGS</h3>
      {kit.role.requirements.map((r, i) => (
        <div className="requirement-settings" key={r.id}>
          <strong>{r.text}</strong>
          <div className="question-settings">
            <label>
              Priority
              <select
                aria-label={`Requirement ${i + 1} priority`}
                value={r.priority}
                onChange={(e) =>
                  update((k) => {
                    k.role.requirements[i].priority = e.target.value as 'must' | 'nice';
                  })
                }
              >
                <option value="must">Must-have</option>
                <option value="nice">Nice-to-have</option>
              </select>
            </label>
            <label>
              Kind
              <select
                aria-label={`Requirement ${i + 1} kind`}
                value={r.kind}
                onChange={(e) =>
                  update((k) => {
                    k.role.requirements[i].kind = e.target.value as typeof r.kind;
                  })
                }
              >
                <option value="technical">Technical</option>
                <option value="behavioural">Behavioural</option>
                <option value="domain">Domain</option>
              </select>
            </label>
            <button
              className="icon-button danger-hover"
              aria-label={`Delete requirement ${i + 1}`}
              onClick={() => {
                if (confirm('Remove this requirement and its question/flashcard links?'))
                  update((k) => {
                    k.role.requirements = k.role.requirements.filter((x) => x.id !== r.id);
                    for (const q of [...k.questions, ...k.flashcards])
                      q.requirement_ids = q.requirement_ids.filter((id) => id !== r.id);
                  });
              }}
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>
      ))}
      <button
        className="text-button"
        onClick={() =>
          update((k) => {
            k.role.requirements.push({
              id: uid('r'),
              text: 'Your added requirement',
              kind: 'technical',
              priority: 'must',
            });
          })
        }
      >
        <Plus size={14} />
        Add requirement
      </button>
      <p className="helper">
        Manually added requirements may create coverage gaps. Link questions to them in the question
        bank.
      </p>
    </details>
  );
}
