'use client';
import type { Kit, KitRecord } from '@/core/contracts';
import { practiceOrder } from '@/core/deterministic';
import { ArrowRight, CheckCheck, ChevronDown, Layers3, Plus, Target, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { EditableText } from './primitives';
import { uid } from './ui-types';
export default function Flashcards({
  record,
  update,
  onRate,
}: {
  record: KitRecord;
  update: (fn: (k: Kit) => void) => void;
  onRate: (id: string, confidence: number) => Promise<boolean>;
}) {
  const [mode, setMode] = useState<'practice' | 'edit'>('practice');
  const [queue, setQueue] = useState(() =>
    practiceOrder(record.kit.flashcards, record.practice).map((f) => f.id),
  );
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [rating, setRating] = useState(false);
  const card = record.kit.flashcards.find((f) => f.id === queue[index]);
  const restart = () => {
    setQueue(practiceOrder(record.kit.flashcards, record.practice).map((f) => f.id));
    setIndex(0);
    setRevealed(false);
  };
  return (
    <>
      <div className="section-heading">
        <div>
          <h2>A little practice. A lot more clarity.</h2>
          <p className="section-description">
            Unseen and less-confident cards come first. Take a moment before revealing the answer.
          </p>
        </div>
        <div className="segmented">
          <button
            className={mode === 'practice' ? 'selected' : ''}
            onClick={() => {
              setMode('practice');
              restart();
            }}
          >
            Practise
          </button>
          <button className={mode === 'edit' ? 'selected' : ''} onClick={() => setMode('edit')}>
            Edit cards
          </button>
        </div>
      </div>
      {mode === 'edit' ? (
        <>
          <button
            className="button secondary"
            onClick={() =>
              update((k) => {
                k.flashcards.push({
                  id: uid('f'),
                  front: 'Your question',
                  back: 'Your answer',
                  requirement_ids: [],
                  meta: { origin: 'manual', edited: true, pinned: false },
                });
              })
            }
          >
            <Plus size={16} />
            Add flashcard
          </button>
          <div className="flashcard-grid">
            {record.kit.flashcards.map((f, i) => (
              <div className="panel flashcard-edit" key={f.id}>
                <div className="panel-heading">
                  <span className="eyebrow">CARD {String(i + 1).padStart(2, '0')}</span>
                  <button
                    className="icon-button danger-hover"
                    aria-label="Delete flashcard"
                    onClick={() => {
                      if (confirm('Delete this flashcard?'))
                        update((k) => {
                          k.flashcards = k.flashcards.filter((x) => x.id !== f.id);
                        });
                    }}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
                <h3>
                  <EditableText
                    label="flashcard question"
                    value={f.front}
                    onChange={(v) =>
                      update((k) => {
                        k.flashcards.find((x) => x.id === f.id)!.front = v;
                      })
                    }
                  />
                </h3>
                <hr />
                <EditableText
                  label="flashcard answer"
                  value={f.back}
                  onChange={(v) =>
                    update((k) => {
                      k.flashcards.find((x) => x.id === f.id)!.back = v;
                    })
                  }
                />
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="practice-area">
          <div className="practice-session-heading">
            <span>
              <Layers3 size={16} />
              FOCUSED PRACTICE
            </span>
            <strong>
              {Math.min(index + 1, queue.length)} / {queue.length}
            </strong>
          </div>
          <div className="progress-track">
            <span style={{ width: `${queue.length ? (index / queue.length) * 100 : 0}%` }} />
          </div>
          {card ? (
            <>
              <div className={`practice-card panel ${revealed ? 'revealed' : ''}`}>
                <span className="neutral-pill">
                  {record.practice[card.id]
                    ? ['', 'Needs work', 'Getting there', 'Confident'][
                        record.practice[card.id].confidence
                      ]
                    : 'Not reviewed yet'}
                </span>
                <h2>{card.front}</h2>
                {revealed ? (
                  <div className="revealed-answer">
                    <span className="eyebrow">POINTS TO REMEMBER</span>
                    <p>{card.back}</p>
                  </div>
                ) : (
                  <button className="button secondary" onClick={() => setRevealed(true)}>
                    Reveal answer
                    <ChevronDown size={16} />
                  </button>
                )}
              </div>
              {revealed && (
                <div className="confidence-panel">
                  <p>How confident did you feel?</p>
                  <div className="confidence-buttons">
                    {['Needs work', 'Getting there', 'Confident'].map((label, i) => (
                      <button
                        className={`confidence-button confidence-${i}`}
                        key={label}
                        disabled={rating}
                        onClick={async () => {
                          setRating(true);
                          if (await onRate(card.id, i + 1)) {
                            setIndex(index + 1);
                            setRevealed(false);
                          }
                          setRating(false);
                        }}
                      >
                        <span>{i + 1}</span>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="empty-state panel">
              <span className="empty-icon">
                <CheckCheck size={30} />
              </span>
              <h2>{queue.length ? 'A little more ready.' : 'No flashcards yet.'}</h2>
              <p>
                {queue.length
                  ? 'Your confidence ratings are saved. Start again to focus on the areas that need more attention.'
                  : 'Add a card to start practising.'}
              </p>
              <button
                className="button primary"
                onClick={queue.length ? restart : () => setMode('edit')}
              >
                {queue.length ? 'Start another session' : 'Add flashcards'}
                <ArrowRight size={16} />
              </button>
            </div>
          )}
          <div className="quiet-note">
            <Target size={16} />
            <p>
              Confidence is self-reported. Use it to guide your practice, not to predict an
              interview outcome.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
