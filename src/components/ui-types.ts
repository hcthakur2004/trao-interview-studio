import type { Category } from '@/core/contracts';
import { CalendarDays, CircleHelp, Layers3, LayoutDashboard, Search, Target } from 'lucide-react';
export type Tab = 'overview' | 'questions' | 'flashcards' | 'schedule' | 'readiness' | 'sources';
export type User = { name: string; email: string };
export type Summary = {
  id: string;
  title: string;
  company: string;
  questions: number;
  days: number;
  reviewed: number;
  cards: number;
  updated_at: string;
};
export const labels: Record<Category, string> = {
  technical: 'Technical',
  behavioural: 'Behavioural',
  'system-design': 'System design',
  'company-fit': 'Company fit',
};
export const nav = [
  { id: 'overview', title: 'Overview', icon: LayoutDashboard },
  { id: 'questions', title: 'Question bank', icon: CircleHelp },
  { id: 'flashcards', title: 'Flashcards', icon: Layers3 },
  { id: 'schedule', title: 'Study plan', icon: CalendarDays },
  { id: 'readiness', title: 'Your readiness', icon: Target },
  { id: 'sources', title: 'Research & sources', icon: Search },
] as const;
export const uid = (prefix: string) => `${prefix}_${crypto.randomUUID()}`;
