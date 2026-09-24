'use client';
import type { Category, Kit } from '@/core/contracts';
import { categories } from '@/core/contracts';
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  CircleHelp,
  Pin,
  Plus,
  RotateCcw,
  Search,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { useState } from 'react';

import { EditableText } from './primitives';
import { labels, uid } from './ui-types';
export default function Questions({
  kit,
  update,
  regenerate,
  initialQuestionId,
}: {
  kit: Kit;
  update: (fn: (k: Kit) => void) => void;
  regenerate: (s: string) => void;
  initialQuestionId?: string;
}) {
  const [category, setCategory] = useState<Category>(
    kit.questions.find((q) => q.id === initialQuestionId)?.category || 'technical',
  );
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<string | null>(
    initialQuestionId || kit.questions[0]?.id || null,
  );
  const questions = kit.questions.filter(
    (q) =>
      q.category === category &&
      `${q.prompt} ${q.answer_outline}`.toLowerCase().includes(query.toLowerCase()),
  );
  const move = (id: string, step: number) =>
    update((k) => {
      const peers = k.questions.filter((q) => q.category === category);
      const index = peers.findIndex((q) => q.id === id);
      if (index + step < 0 || index + step >= peers.length) return;
      const a = k.questions.findIndex((q) => q.id === id),
        b = k.questions.findIndex((q) => q.id === peers[index + step].id);
      [k.questions[a], k.questions[b]] = [k.questions[b], k.questions[a]];
    });
  return (
    <>
      <div className="section-heading">
        <div>
          <h2>Your question bank</h2>
          <p className="section-description">
            Practise what matters. Shape each question to fit the way you learn.
          </p>
        </div>
        <button
          className="button secondary"
          onClick={() =>
            update((k) => {
              const id = uid('q');
              k.questions.push({
                id,
                category,
                prompt: 'Your new question',
                answer_outline: 'Add the key points you want to cover.',
                requirement_ids: [],
                difficulty: 2,
                meta: { origin: 'manual', edited: true, pinned: false },
              });
              setExpanded(id);
            })
          }
        >
          <Plus size={16} />
          Add question
        </button>
      </div>
      <div className="question-toolbar">
        <div className="category-tabs" role="tablist" aria-label="Question categories">
          {categories.map((c) => (
            <button
              key={c}
              role="tab"
              aria-selected={category === c}
              onClick={() => setCategory(c)}
              className={category === c ? 'selected' : ''}
            >
              {labels[c]}
              <span>{kit.questions.filter((q) => q.category === c).length}</span>
            </button>
          ))}
        </div>
        <div className="filter-row">
          <label className="search-field">
            <Search size={16} />
            <input
              aria-label="Search questions"
              placeholder="Find a question…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <button className="text-button" onClick={() => regenerate(category)}>
            <RotateCcw size={15} />
            Regenerate category
          </button>
        </div>
      </div>
      <div className="question-list">
        {questions.map((q, i) => (
          <article
            className={`panel question-card ${expanded === q.id ? 'expanded' : ''}`}
            key={q.id}
          >
            <div className="question-top">
              <span className="question-index">{String(i + 1).padStart(2, '0')}</span>
              <div className="question-content">
                <div className="question-badges">
                  <span className="category-pill">{labels[q.category]}</span>
                  <span className="difficulty">
                    <i className={q.difficulty >= 1 ? 'filled' : ''} />
                    <i className={q.difficulty >= 2 ? 'filled' : ''} />
                    <i className={q.difficulty >= 3 ? 'filled' : ''} />
                    {['', 'Foundational', 'Applied', 'Advanced'][q.difficulty]}
                  </span>
                  {q.meta?.edited && <span className="edited-label">Edited by you</span>}
                  {q.meta?.pinned && <Pin size={13} />}
                </div>
                <h3>
                  <EditableText
                    label={`question ${i + 1}`}
                    value={q.prompt}
                    onChange={(v) =>
                      update((k) => {
                        const item = k.questions.find((x) => x.id === q.id)!;
                        item.prompt = v;
                        item.meta = {
                          origin: item.meta?.origin || 'generated',
                          edited: true,
                          pinned: Boolean(item.meta?.pinned),
                        };
                      })
                    }
                  />
                </h3>
                <div className="question-links">
                  {q.requirement_ids.map((id) => (
                    <span key={id} title={kit.role.requirements.find((r) => r.id === id)?.text}>
                      <Check size={12} />
                      {kit.role.requirements.find((r) => r.id === id)?.text}
                    </span>
                  ))}
                </div>
                <button
                  className="answer-toggle text-button"
                  aria-expanded={expanded === q.id}
                  onClick={() => setExpanded(expanded === q.id ? null : q.id)}
                >
                  {expanded === q.id ? 'Hide answer outline' : 'Show answer outline'}
                  <ChevronDown size={15} className={expanded === q.id ? 'rotate' : ''} />
                </button>
              </div>
              <div className="question-actions">
                <button
                  className={`icon-button ${q.meta?.pinned ? 'pinned' : ''}`}
                  aria-label={q.meta?.pinned ? 'Unpin question' : 'Pin question'}
                  title="Keep during regeneration"
                  onClick={() =>
                    update((k) => {
                      const item = k.questions.find((x) => x.id === q.id)!;
                      item.meta = {
                        origin: item.meta?.origin || 'generated',
                        edited: Boolean(item.meta?.edited),
                        pinned: !item.meta?.pinned,
                      };
                    })
                  }
                >
                  <Pin size={16} />
                </button>
                <button
                  className="icon-button"
                  aria-label="Move question up"
                  disabled={i === 0 || Boolean(query)}
                  onClick={() => move(q.id, -1)}
                >
                  <ArrowUp size={16} />
                </button>
                <button
                  className="icon-button"
                  aria-label="Move question down"
                  disabled={i === questions.length - 1 || Boolean(query)}
                  onClick={() => move(q.id, 1)}
                >
                  <ArrowDown size={16} />
                </button>
                <button
                  className="icon-button danger-hover"
                  aria-label="Delete question"
                  onClick={() => {
                    if (confirm('Delete this question? Its schedule references will be removed.'))
                      update((k) => {
                        k.deleted_prompts.push(q.prompt);
                        k.questions = k.questions.filter((x) => x.id !== q.id);
                      });
                  }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
            {expanded === q.id && (
              <div className="answer-panel">
                <h4>POINTS TO COVER</h4>
                <EditableText
                  label="answer outline"
                  value={q.answer_outline}
                  onChange={(v) =>
                    update((k) => {
                      const item = k.questions.find((x) => x.id === q.id)!;
                      item.answer_outline = v;
                      item.meta = {
                        origin: item.meta?.origin || 'generated',
                        edited: true,
                        pinned: Boolean(item.meta?.pinned),
                      };
                    })
                  }
                />
                <div className="question-settings">
                  <label>
                    Category
                    <select
                      value={q.category}
                      onChange={(e) =>
                        update((k) => {
                          const item = k.questions.find((x) => x.id === q.id)!;
                          item.category = e.target.value as Category;
                          item.meta = {
                            origin: item.meta?.origin || 'generated',
                            edited: true,
                            pinned: Boolean(item.meta?.pinned),
                          };
                        })
                      }
                    >
                      {categories.map((c) => (
                        <option key={c} value={c}>
                          {labels[c]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Difficulty
                    <select
                      value={q.difficulty}
                      onChange={(e) =>
                        update((k) => {
                          k.questions.find((x) => x.id === q.id)!.difficulty = Number(
                            e.target.value,
                          );
                        })
                      }
                    >
                      <option value={1}>Foundational</option>
                      <option value={2}>Applied</option>
                      <option value={3}>Advanced</option>
                    </select>
                  </label>
                </div>
                <details className="link-requirements">
                  <summary>Link requirements</summary>
                  {kit.role.requirements.map((r) => (
                    <label className="checkbox-label" key={r.id}>
                      <input
                        type="checkbox"
                        checked={q.requirement_ids.includes(r.id)}
                        onChange={(e) =>
                          update((k) => {
                            const item = k.questions.find((x) => x.id === q.id)!;
                            item.requirement_ids = e.target.checked
                              ? [...item.requirement_ids, r.id]
                              : item.requirement_ids.filter((id) => id !== r.id);
                          })
                        }
                      />
                      {r.text}
                    </label>
                  ))}
                </details>
              </div>
            )}
          </article>
        ))}
      </div>
      {!questions.length && (
        <div className="empty-state panel">
          <CircleHelp size={28} />
          <h3>No questions here yet</h3>
          <p>
            {query
              ? 'Try a different search.'
              : 'Add a question or generate this category from your requirements.'}
          </p>
        </div>
      )}
      <div className="quiet-note">
        <ShieldCheck size={16} />
        <p>
          Edited, manually added, and pinned questions are protected when you regenerate a category.
        </p>
      </div>
    </>
  );
}
