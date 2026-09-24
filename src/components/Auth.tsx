'use client';
import {
  ArrowRight,
  CalendarDays,
  FileText,
  LoaderCircle,
  Search,
  ShieldCheck,
} from 'lucide-react';
import { useState } from 'react';
import { api } from './api';

import { IconLogo } from './primitives';
import { type User } from './ui-types';
export default function Auth({ onAuth }: { onAuth: (u: User) => Promise<void> }) {
  const [register, setRegister] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const data = Object.fromEntries(new FormData(e.currentTarget));
    try {
      const result = await api<{ user: User }>(`/auth/${register ? 'register' : 'login'}`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
      await onAuth(result.user);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-page">
      <div className="auth-story">
        <a className="brand" href="/">
          <IconLogo />
          <span>
            interview<span className="brand-light">studio</span>
          </span>
        </a>
        <div className="auth-story-content">
          <span className="eyebrow light">YOUR NEXT CHAPTER STARTS HERE</span>
          <h1>
            Less guessing.
            <br />
            More <em>ready.</em>
          </h1>
          <p>Turn the job you want into a preparation plan you can actually use.</p>
          <div className="auth-features">
            <span>
              <Search size={19} />
              Company research, with sources
            </span>
            <span>
              <FileText size={19} />
              Questions grounded in the role
            </span>
            <span>
              <CalendarDays size={19} />A plan that fits your timeline
            </span>
          </div>
          <a className="example-link" href="/demo">
            Explore an example kit <ArrowRight size={18} />
          </a>
        </div>
        <div className="auth-footer">Thoughtful preparation. Your own way.</div>
      </div>
      <div className="auth-form-side">
        <div className="auth-form-wrap">
          <div className="eyebrow">YOUR PERSONAL WORKSPACE</div>
          <h2>{register ? 'Make your next move.' : 'Welcome back.'}</h2>
          <p>
            {register
              ? 'Create an account to build your first preparation kit.'
              : 'Pick up where you left off.'}
          </p>
          <form onSubmit={submit}>
            {register && (
              <label>
                Your name
                <input
                  name="name"
                  placeholder="Alex Morgan"
                  autoComplete="name"
                  required
                  maxLength={80}
                />
              </label>
            )}
            <label>
              Email address
              <input
                name="email"
                type="email"
                placeholder="you@example.com"
                autoComplete="email"
                required
              />
            </label>
            <label>
              Password
              <input
                name="password"
                type="password"
                placeholder="At least 10 characters"
                minLength={10}
                maxLength={128}
                autoComplete={register ? 'new-password' : 'current-password'}
                required
              />
            </label>
            {error && (
              <div className="alert error" role="alert">
                {error}
              </div>
            )}
            <button className="button primary full" disabled={busy}>
              {busy ? (
                <LoaderCircle className="spin" size={18} />
              ) : (
                <>
                  {register ? 'Create your workspace' : 'Sign in'}
                  <ArrowRight size={17} />
                </>
              )}
            </button>
          </form>
          <p className="auth-switch">
            {register ? 'Already have an account?' : 'New to Interview Studio?'}{' '}
            <button
              onClick={() => {
                setRegister(!register);
                setError('');
              }}
            >
              {register ? 'Sign in' : 'Create an account'}
            </button>
          </p>
          <div className="auth-private">
            <ShieldCheck size={15} />
            Your kits are private to your account.
          </div>
        </div>
      </div>
    </div>
  );
}
