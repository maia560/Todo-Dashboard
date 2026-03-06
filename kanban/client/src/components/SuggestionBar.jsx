import { useState } from 'react';
import useStore from '../store';

const PRIORITY_STYLES = {
  high: 'bg-red-500/15 text-red-400 border-red-500/30',
  medium: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  low: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
};

export default function SuggestionBar() {
  const suggestions = useStore((s) => s.emailSuggestions);
  const addTask = useStore((s) => s.addTask);
  const dismissSuggestion = useStore((s) => s.dismissSuggestion);
  const clearSuggestions = useStore((s) => s.clearSuggestions);

  const [accepting, setAccepting] = useState(null);

  if (!suggestions || suggestions.length === 0) return null;

  const handleAccept = async (suggestion, index) => {
    setAccepting(index);
    try {
      await addTask(suggestion.title, 'todo', null);
      dismissSuggestion(index);
    } finally {
      setAccepting(null);
    }
  };

  return (
    <div className="border-b border-column-border bg-column-bg/30 px-6 py-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-accent-todo"
          >
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
            <polyline points="22,6 12,13 2,6" />
          </svg>
          <span className="text-xs font-medium text-text-secondary">
            Suggested from your emails
          </span>
          <span className="text-[10px] text-text-muted">
            ({suggestions.length})
          </span>
        </div>
        <button
          onClick={clearSuggestions}
          className="text-[10px] text-text-muted hover:text-text-secondary transition-colors"
        >
          Dismiss all
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {suggestions.map((s, i) => (
          <div
            key={i}
            className="flex-shrink-0 w-72 bg-card-bg border border-card-border rounded-lg p-3 flex flex-col gap-2"
          >
            <div className="flex items-start justify-between gap-2">
              <span className="text-sm text-text-primary leading-tight">
                {s.title}
              </span>
              {s.priority && (
                <span
                  className={`text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded border shrink-0 ${
                    PRIORITY_STYLES[s.priority] || PRIORITY_STYLES.low
                  }`}
                >
                  {s.priority}
                </span>
              )}
            </div>
            {s.reason && (
              <p className="text-[11px] text-text-muted leading-snug">
                {s.reason}
              </p>
            )}
            <div className="flex items-center gap-2 mt-auto pt-1">
              <button
                onClick={() => handleAccept(s, i)}
                disabled={accepting === i}
                className="flex-1 px-2 py-1 text-[11px] font-medium rounded bg-accent-todo text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {accepting === i ? 'Adding...' : 'Accept'}
              </button>
              <button
                onClick={() => dismissSuggestion(i)}
                className="flex-1 px-2 py-1 text-[11px] font-medium rounded border border-column-border text-text-muted hover:text-text-secondary hover:border-text-muted transition-colors"
              >
                Dismiss
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
