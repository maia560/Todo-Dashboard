import { useEffect, useRef } from 'react';
import useStore from '../store';
import DueDateBadge from './DueDateBadge';

const MATCH_LABELS = {
  title: { text: 'Title', color: 'text-accent-todo' },
  tag: { text: 'Tag', color: 'text-accent-progress' },
  subtask: { text: 'Subtask', color: 'text-accent-done' },
};

export default function SearchOverlay() {
  const searchOpen = useStore((s) => s.searchOpen);
  const searchQuery = useStore((s) => s.searchQuery);
  const searchResults = useStore((s) => s.searchResults);
  const search = useStore((s) => s.search);
  const setSearchOpen = useStore((s) => s.setSearchOpen);
  const setSelectedTask = useStore((s) => s.setSelectedTask);
  const inputRef = useRef(null);

  useEffect(() => {
    if (searchOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [searchOpen]);

  if (!searchOpen) return null;

  const handleSelect = (taskId) => {
    setSelectedTask(taskId);
    setSearchOpen(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={() => setSearchOpen(false)} />

      {/* Search box */}
      <div className="relative w-full max-w-lg mx-4 bg-card-bg border border-card-border rounded-xl shadow-2xl overflow-hidden">
        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-column-border">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            className="text-text-muted shrink-0">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => search(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setSearchOpen(false);
            }}
            placeholder="Search tasks, tags, subtasks..."
            className="flex-1 bg-transparent text-sm text-text-primary placeholder-text-muted outline-none"
          />
          <kbd className="text-[10px] text-text-muted border border-column-border rounded px-1.5 py-0.5">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto">
          {searchQuery.trim() && searchResults.length === 0 && (
            <div className="px-4 py-6 text-sm text-text-muted text-center">
              No results found
            </div>
          )}
          {searchResults.map(({ task, matchType, matchText }) => {
            const label = MATCH_LABELS[matchType];
            return (
              <button
                key={task.id}
                onClick={() => handleSelect(task.id)}
                className="w-full flex items-start gap-3 px-4 py-3 hover:bg-column-bg transition-colors text-left border-b border-column-border/50 last:border-b-0"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-text-primary truncate">{task.title}</span>
                    <DueDateBadge dueDate={task.due_date} />
                  </div>
                  {/* Tags */}
                  {task.tags?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {task.tags.map((tag) => (
                        <span
                          key={tag.id}
                          className="px-1.5 py-0.5 rounded text-[10px] font-medium text-white"
                          style={{ backgroundColor: tag.color }}
                        >
                          {tag.name}
                        </span>
                      ))}
                    </div>
                  )}
                  {/* Subtask progress */}
                  {task.subtasks?.length > 0 && (
                    <span className="text-[10px] text-text-muted mt-1 block">
                      {task.subtasks.filter((s) => s.completed).length}/{task.subtasks.length} subtasks
                    </span>
                  )}
                </div>
                {/* Match indicator */}
                <span className={`text-[10px] font-medium shrink-0 ${label.color}`}>
                  {label.text}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}