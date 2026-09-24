'use client';
import type { Job, Kit, KitRecord } from '@/core/contracts';
import { allocateSchedule, reconcileKit } from '@/core/deterministic';
import { exampleKit } from '@/core/example';
import {
  ArrowRight,
  ArrowUp,
  BookOpen,
  CalendarDays,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  FileText,
  Layers3,
  LoaderCircle,
  LogOut,
  Menu,
  Plus,
  ShieldCheck,
  Sparkles,
  X,
  Zap,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api';

import Auth from './Auth';
import Dashboard from './Dashboard';
import Flashcards from './Flashcards';
import NewKit from './NewKit';
import Overview from './Overview';
import { IconLogo, Loading } from './primitives';
import Questions from './Questions';
import Readiness from './Readiness';
import Sources from './Sources';
import StudyPlan from './StudyPlan';
import { nav, type Summary, type Tab, type User } from './ui-types';
export default function Studio({ demo = false }: { demo?: boolean }) {
  const [user, setUser] = useState<User | null>(
    demo ? { name: 'Alex Morgan', email: 'Sample workspace' } : null,
  );
  const [loading, setLoading] = useState(!demo);
  const [record, setRecord] = useState<KitRecord | null>(demo ? exampleKit() : null);
  const [tab, setTab] = useState<Tab>('overview');
  const [selectedQuestionId, setSelectedQuestionId] = useState<string>();
  const [summaries, setSummaries] = useState<Summary[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [creating, setCreating] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [saveState, setSaveState] = useState('All changes saved');
  const [regenerating, setRegenerating] = useState('');
  const [setup, setSetup] = useState<{
    generation_configured: boolean;
    research_configured: boolean;
    storage: string;
  } | null>(null);
  const current = useRef(record);
  current.current = record;
  const dirty = useRef(0);
  const saved = useRef(0);
  const saving = useRef<Promise<void> | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(async () => {
    if (demo) return;
    const [a, b] = await Promise.all([
      api<{ kits: Summary[] }>('/kits'),
      api<{ jobs: Job[] }>('/jobs'),
    ]);
    setSummaries(a.kits);
    setJobs(b.jobs);
  }, [demo]);
  useEffect(() => {
    if (demo) return;
    Promise.all([api<{ user: User }>('/auth/me'), api<typeof setup>('/health')])
      .then(([a, b]) => {
        setUser(a.user);
        setSetup(b);
        return refresh();
      })
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, [demo, refresh]);
  useEffect(() => {
    if (!user || demo) return;
    const id = setInterval(() => {
      void refresh().catch(() => undefined);
    }, 2500);
    return () => clearInterval(id);
  }, [user, demo, refresh]);
  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(''), 5000);
    return () => clearTimeout(id);
  }, [notice]);

  const flush = useCallback(async () => {
    if (saving.current) {
      await saving.current;
      if (saved.current < dirty.current) return false;
      return true;
    }
    const task = async () => {
      while (current.current && saved.current < dirty.current) {
        const version = dirty.current;
        const snapshot = structuredClone(current.current);
        setSaveState('Saving…');
        try {
          const result = demo
            ? { ...snapshot, revision: snapshot.revision + 1 }
            : await api<KitRecord>(`/kits/${snapshot.id}`, {
                method: 'PUT',
                body: JSON.stringify({ revision: snapshot.revision, kit: snapshot.kit }),
              });
          saved.current = version;
          if (current.current?.id === result.id) {
            const next =
              dirty.current === version
                ? result
                : { ...current.current, revision: result.revision };
            current.current = next;
            setRecord(next);
          }
          setSaveState(demo ? 'Changes saved for this visit' : 'All changes saved');
        } catch (e) {
          setSaveState('Not saved — retry');
          setError((e as Error).message);
          break;
        }
      }
    };
    saving.current = task();
    await saving.current;
    saving.current = null;
    return saved.current === dirty.current;
  }, [demo]);
  useEffect(() => {
    const unload = (e: BeforeUnloadEvent) => {
      if (saved.current < dirty.current) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', unload);
    return () => {
      window.removeEventListener('beforeunload', unload);
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);
  const update = (fn: (kit: Kit) => void) => {
    if (!current.current) return;
    const next = structuredClone(current.current);
    fn(next.kit);
    next.kit = reconcileKit(next.kit);
    current.current = next;
    setRecord(next);
    dirty.current++;
    setSaveState('Unsaved changes');
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void flush();
    }, 900);
  };
  const openKit = async (id: string) => {
    if (!(await flush())) return;
    try {
      const next = await api<KitRecord>(`/kits/${id}`);
      current.current = next;
      setRecord(next);
      setTab('overview');
      setError('');
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const recoverLatest = async () => {
    if (
      !current.current ||
      demo ||
      !confirm(
        'Reload the latest saved kit? Download your unsaved copy first if you want to keep these local edits.',
      )
    )
      return;
    try {
      const latest = await api<KitRecord>(`/kits/${current.current.id}`);
      saved.current = dirty.current;
      current.current = latest;
      setRecord(latest);
      setError('');
      setSaveState('All changes saved');
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const downloadDraft = () => {
    if (!current.current) return;
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(current.current.kit, null, 2)], { type: 'application/json' }),
    );
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'interview-kit-unsaved-copy.json';
    anchor.click();
    URL.revokeObjectURL(url);
  };
  const regenerate = async (section: string) => {
    if (!(await flush()) || !current.current) return;
    if (demo) {
      if (section === 'schedule')
        update((k) => {
          k.schedule = allocateSchedule(
            k.role.requirements,
            k.questions,
            k.schedule.days_available,
          );
        });
      else
        setNotice(
          'This is an illustrative kit. Create an account and configure generation to use AI regeneration.',
        );
      return;
    }
    setRegenerating(section);
    setError('');
    try {
      const next = await api<KitRecord>(`/kits/${current.current.id}/regenerate`, {
        method: 'POST',
        body: JSON.stringify({ section, revision: current.current.revision }),
      });
      if (current.current?.id === next.id) {
        current.current = next;
        setRecord(next);
        setNotice('Section regenerated. Your edited and pinned questions were preserved.');
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRegenerating('');
    }
  };
  const onAuth = async (u: User) => {
    setUser(u);
    await refresh();
    setSetup(await api('/health'));
  };
  const logout = async () => {
    if (!(await flush())) return;
    if (!demo) await api('/auth/logout', { method: 'POST' });
    window.location.href = '/';
  };

  if (loading)
    return (
      <div className="boot">
        <IconLogo />
        <Loading />
      </div>
    );
  if (!user) return <Auth onAuth={onAuth} />;
  const kit = record?.kit;
  const musts = kit?.role.requirements.filter((r) => r.priority === 'must') ?? [];
  const mustCovered = musts.filter(
    (r) => !kit!.coverage.uncovered_requirement_ids.includes(r.id),
  ).length;
  return (
    <div className="app-shell">
      {mobile && (
        <button
          className="nav-scrim"
          aria-label="Close navigation"
          onClick={() => setMobile(false)}
        />
      )}
      <aside className={`sidebar ${mobile ? 'open' : ''}`}>
        <a className="brand" href={demo ? '/demo' : '/'}>
          <IconLogo />
          <span>
            interview<span className="brand-light">studio</span>
            <small>MAKE YOUR NEXT MOVE</small>
          </span>
        </a>
        <button
          className="workspace-switch"
          onClick={async () => {
            if (await flush()) {
              setRecord(null);
              current.current = null;
              setMobile(false);
            }
          }}
        >
          <span className="workspace-avatar">{user.name[0].toUpperCase()}</span>
          <span>
            Personal workspace<small>Your preparation, together</small>
          </span>
          <ChevronDown size={16} />
        </button>
        <div className="nav-label">WORKSPACE</div>
        <button
          className={`nav-item ${!record ? 'active' : ''}`}
          onClick={async () => {
            if (await flush()) {
              setRecord(null);
              current.current = null;
              setMobile(false);
            }
          }}
        >
          <BookOpen size={18} />
          My prep kits<span className="nav-count">{demo ? 1 : summaries.length}</span>
        </button>
        <button
          className="nav-item"
          onClick={() => {
            setCreating(true);
            setMobile(false);
          }}
        >
          <Plus size={18} />
          Create a kit
        </button>
        {kit && (
          <>
            <div className="nav-label current-label">
              CURRENT KIT <span className="tiny-line" />
            </div>
            <div className="current-company">
              <span className="company-mark">{kit.source.company?.slice(0, 1) || 'K'}</span>
              <span>
                {kit.source.company || 'Your company'}
                <small>{kit.role.title || 'Interview preparation'}</small>
              </span>
            </div>
            <nav aria-label="Kit sections">
              {nav.map(({ id, title, icon: Icon }) => (
                <button
                  key={id}
                  className={`nav-item ${tab === id ? 'active' : ''}`}
                  onClick={() => {
                    setTab(id);
                    setMobile(false);
                  }}
                >
                  <Icon size={18} />
                  {title}
                  {id === 'questions' && <span className="nav-count">{kit.questions.length}</span>}
                  {id === 'readiness' && <span className="new-label">NEW</span>}
                </button>
              ))}
            </nav>
          </>
        )}
        <div className="sidebar-bottom">
          <div className="tip-card">
            <Sparkles size={18} />
            <strong>A little practice, every day.</strong>
            <p>Make progress one question at a time.</p>
            {kit && (
              <button onClick={() => setTab('flashcards')}>
                Start a practice session <ArrowRight size={15} />
              </button>
            )}
          </div>
          <div className="user-row">
            <span className="user-avatar">
              {user.name
                .split(' ')
                .map((s) => s[0])
                .slice(0, 2)
                .join('')}
            </span>
            <span>
              {user.name}
              <small>{demo ? 'Example workspace' : 'Personal account'}</small>
            </span>
            <button
              className="icon-button"
              title="Sign out"
              aria-label="Sign out"
              onClick={() => void logout()}
            >
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <button
            className="icon-button mobile-menu"
            aria-label="Open navigation"
            onClick={() => setMobile(true)}
          >
            <Menu size={21} />
          </button>
          <div className="breadcrumbs">
            <span>My prep kits</span>
            {kit && (
              <>
                <ChevronRight size={14} />
                <span>{kit.source.company || 'Your kit'}</span>
                <ChevronRight size={14} />
                <strong>{nav.find((n) => n.id === tab)?.title}</strong>
              </>
            )}
          </div>
          <div className="topbar-right">
            {demo ? (
              <a href="/" className="example-pill">
                Example kit <ArrowUp size={13} className="diagonal" />
              </a>
            ) : (
              <span className="workspace-note">
                <ShieldCheck size={14} />
                Private workspace
              </span>
            )}
            <span className="top-avatar">{user.name[0]}</span>
          </div>
        </header>
        {demo && (
          <div className="demo-banner">
            <span>
              <Sparkles size={14} />
              Explore a sample kit. Edits last for this visit; research and generation are not live.
            </span>
            <a href="/">
              Create your own <ArrowRight size={14} />
            </a>
          </div>
        )}
        <main className="main-content">
          {error && (
            <div className="alert error" role="alert">
              <span>{error}</span>
              <button
                className="icon-button"
                aria-label="Dismiss error"
                onClick={() => setError('')}
              >
                <X size={16} />
              </button>
            </div>
          )}
          {saveState.startsWith('Not saved') && record && (
            <div className="save-recovery">
              <button className="button secondary" onClick={downloadDraft}>
                Download unsaved copy
              </button>
              <button className="button secondary" onClick={() => void recoverLatest()}>
                Reload latest saved kit
              </button>
            </div>
          )}
          {!demo && setup && !setup.generation_configured && (
            <div className="alert setup">
              <ShieldCheck size={19} />
              <div>
                <strong>One setup step before your first kit</strong>
                <p>
                  Add your Gemini API key to the server environment. Your account and saved work are
                  ready.
                </p>
              </div>
            </div>
          )}
          {!kit ? (
            <Dashboard
              demo={demo}
              summaries={summaries}
              jobs={jobs}
              onCreate={() => setCreating(true)}
              onOpen={(id) =>
                demo
                  ? (setRecord(exampleKit()), (current.current = exampleKit()))
                  : void openKit(id)
              }
              onRetry={async (id) => {
                try {
                  await api(`/jobs/${id}/retry`, { method: 'POST' });
                  await refresh();
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            />
          ) : (
            <>
              <div className="kit-heading">
                <div className="eyebrow">
                  <span className="company-dot">{kit.source.company?.[0] || 'K'}</span>
                  {kit.source.company || 'Company not specified'}
                  <span className="dot-separator">·</span>
                  {kit.source.location || 'Location not specified'}
                </div>
                <div className="title-row">
                  <div>
                    <h1>{kit.role.title || 'Your interview preparation'}</h1>
                    <p className="subtitle">A focused plan for your next chapter.</p>
                  </div>
                  <button className="button primary" onClick={() => setTab('flashcards')}>
                    <Zap size={17} />
                    Start practising
                    <ArrowRight size={16} />
                  </button>
                </div>
                <div className="kit-meta">
                  <span>
                    <CalendarDays size={15} />
                    {kit.schedule.days_available}-day study plan
                  </span>
                  <span>
                    <FileText size={15} />
                    {kit.role.requirements.length} requirements
                  </span>
                  <span>
                    <ShieldCheck size={15} />
                    {mustCovered}/{musts.length} must-haves covered
                  </span>
                  <button
                    className={`save-indicator ${saveState.includes('Not saved') ? 'danger' : ''}`}
                    onClick={() => void flush()}
                  >
                    <CheckCheck size={15} />
                    {saveState}
                  </button>
                </div>
              </div>
              <fieldset className="editor-fieldset" disabled={Boolean(regenerating)}>
                {tab === 'overview' && (
                  <Overview
                    kit={kit}
                    practice={record!.practice}
                    update={update}
                    onTab={setTab}
                    regenerate={regenerate}
                  />
                )}
                {tab === 'questions' && (
                  <Questions
                    kit={kit}
                    update={update}
                    regenerate={regenerate}
                    initialQuestionId={selectedQuestionId}
                  />
                )}
                {tab === 'flashcards' && (
                  <Flashcards
                    record={record!}
                    update={update}
                    onRate={async (card_id, confidence) => {
                      if (!(await flush())) return false;
                      try {
                        const now = new Date().toISOString();
                        const next = demo
                          ? {
                              ...current.current!,
                              practice: {
                                ...current.current!.practice,
                                [card_id]: {
                                  confidence,
                                  reviewed_at: now,
                                  reviews: (current.current!.practice[card_id]?.reviews || 0) + 1,
                                },
                              },
                            }
                          : await api<KitRecord>(`/kits/${record!.id}/practice`, {
                              method: 'POST',
                              body: JSON.stringify({ card_id, confidence }),
                            });
                        if (current.current?.id === next.id) {
                          current.current = next;
                          setRecord(next);
                        }
                        return true;
                      } catch (e) {
                        setError((e as Error).message);
                        return false;
                      }
                    }}
                  />
                )}
                {tab === 'schedule' && (
                  <StudyPlan
                    kit={kit}
                    update={update}
                    regenerate={regenerate}
                    onQuestion={(id) => {
                      setSelectedQuestionId(id);
                      setTab('questions');
                    }}
                  />
                )}
                {tab === 'readiness' && (
                  <Readiness record={record!} onPractice={() => setTab('flashcards')} />
                )}
                {tab === 'sources' && <Sources kit={kit} />}
              </fieldset>
              {regenerating && (
                <div className="generation-overlay" role="status">
                  <LoaderCircle className="spin" size={20} />
                  <div>
                    <strong>Refreshing this section…</strong>
                    <span>Your edited and pinned questions will be kept.</span>
                  </div>
                </div>
              )}
            </>
          )}
          <footer className="page-footer">
            <span>
              <Layers3 size={14} />
              Prepared with intention.
            </span>
            <span>Interview Studio</span>
          </footer>
        </main>
      </div>
      {notice && (
        <div className="toast" role="status">
          <Check size={18} />
          {notice}
        </div>
      )}
      {creating && (
        <NewKit
          demo={demo}
          onClose={() => setCreating(false)}
          onCreated={async (id) => {
            setCreating(false);
            await refresh();
            if (!(await flush())) return;
            setRecord(null);
            current.current = null;
            setNotice('Your kit is queued. You can watch its progress below.');
          }}
        />
      )}
    </div>
  );
}
