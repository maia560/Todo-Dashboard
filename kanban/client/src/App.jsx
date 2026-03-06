import { useEffect, useState } from 'react';
import Board from './components/Board';
import CreateTaskBar from './components/CreateTaskBar';
import TagManager from './components/TagManager';
import TagFilter from './components/TagFilter';
import SearchOverlay from './components/SearchOverlay';
import useStore from './store';
import { supabase } from './supabase';

const FALLBACK_FACTS = [
  'Honey never spoils. Ever.',
  'Octopuses have three hearts.',
  'Bananas are berries.',
  'Sharks are older than trees.',
  'Venus spins backwards.',
];

export default function App() {
  const fetchTasks = useStore((s) => s.fetchTasks);
  const fetchTags = useStore((s) => s.fetchTags);
  const setSearchOpen = useStore((s) => s.setSearchOpen);
  const toast = useStore((s) => s.toast);

  const [tagManagerOpen, setTagManagerOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [dailyFact, setDailyFact] = useState('');

  useEffect(() => {
    fetch('https://uselessfacts.jsph.pl/api/v2/today?language=en')
      .then((r) => r.json())
      .then((data) => {
        const text = data.text?.replace(/`/g, "'") || '';
        setDailyFact(text.length > 60 ? text.slice(0, 57) + '...' : text);
      })
      .catch(() => {
        const i = Math.floor(Date.now() / 86400000) % FALLBACK_FACTS.length;
        setDailyFact(FALLBACK_FACTS[i]);
      });
  }, []);

  useEffect(() => {
    fetchTasks();
    fetchTags();

    const s = useStore.getState;

    // Subscribe to Supabase Realtime changes on all 4 tables
    const channel = supabase
      .channel('kanban-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks' },
        (payload) => s().handleRealtimeTask(payload)
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tags' },
        (payload) => s().handleRealtimeTag(payload)
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'task_tags' },
        (payload) => s().handleRealtimeTaskTag(payload)
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'subtasks' },
        (payload) => s().handleRealtimeSubtask(payload)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-column-border">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-text-primary">
            My Tasks
          </h1>
          <p className="text-[11px] text-text-muted mt-0.5 italic">
            {dailyFact}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <TagFilter />
          {/* Search button */}
          <button
            onClick={() => setSearchOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-text-muted border border-column-border rounded-lg hover:bg-column-bg hover:text-text-primary transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <kbd className="text-[10px] text-text-muted">/</kbd>
          </button>
          {/* Calendar button */}
          <button
            onClick={() => setCalendarOpen(!calendarOpen)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium border rounded-lg transition-colors ${
              calendarOpen
                ? 'border-accent-todo text-accent-todo bg-accent-todo/10'
                : 'text-text-secondary border-column-border hover:bg-column-bg hover:text-text-primary'
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            Calendar
          </button>
          {/* Tags button */}
          <button
            onClick={() => setTagManagerOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-text-secondary border border-column-border rounded-lg hover:bg-column-bg hover:text-text-primary transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
              <line x1="7" y1="7" x2="7.01" y2="7" />
            </svg>
            Tags
          </button>
        </div>
      </header>

      {/* Task Creation Bar */}
      <CreateTaskBar />

      {/* Board */}
      <main className="flex-1 overflow-hidden">
        <Board calendarOpen={calendarOpen} />
      </main>

      {/* Modals & Overlays */}
      <TagManager isOpen={tagManagerOpen} onClose={() => setTagManagerOpen(false)} />
      <SearchOverlay />

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-toast-bg border border-toast-border text-danger px-4 py-2 rounded-lg text-sm font-medium shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
