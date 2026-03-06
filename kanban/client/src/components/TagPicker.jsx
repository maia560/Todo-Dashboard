import { useState, useRef, useEffect } from 'react';
import useStore from '../store';

export default function TagPicker({ taskId, taskTags = [], onClose }) {
  const tags = useStore((s) => s.tags);
  const createTag = useStore((s) => s.createTag);
  const addTagToTask = useStore((s) => s.addTagToTask);
  const removeTagFromTask = useStore((s) => s.removeTagFromTask);

  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newColor, setNewColor] = useState('#6c8eef');
  const ref = useRef(null);

  // Close on click outside
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const assignedIds = new Set(taskTags.map((t) => t.id));

  const filtered = tags.filter((t) =>
    t.name.toLowerCase().includes(search.toLowerCase())
  );

  const exactMatch = tags.some(
    (t) => t.name.toLowerCase() === search.trim().toLowerCase()
  );

  const handleToggle = (tag) => {
    if (assignedIds.has(tag.id)) {
      removeTagFromTask(taskId, tag.id);
    } else {
      addTagToTask(taskId, tag.id);
    }
  };

  const handleCreateInline = async () => {
    const trimmed = search.trim();
    if (!trimmed) return;
    const tag = await createTag(trimmed, newColor);
    if (tag) {
      addTagToTask(taskId, tag.id);
      setSearch('');
      setShowCreate(false);
      setNewColor('#6c8eef');
    }
  };

  return (
    <div
      ref={ref}
      className="absolute z-40 top-full left-0 mt-1 w-56 bg-card-bg border border-card-border rounded-lg shadow-xl"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="p-2">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search or create..."
          autoFocus
          className="w-full bg-input-bg border border-input-border rounded px-2 py-1.5 text-sm text-text-primary placeholder-text-muted outline-none focus:border-accent-todo transition-colors"
        />
      </div>

      <div className="max-h-40 overflow-y-auto px-1">
        {filtered.map((tag) => (
          <button
            key={tag.id}
            onClick={() => handleToggle(tag)}
            className="flex items-center gap-2 w-full px-2 py-1.5 text-sm rounded hover:bg-column-bg transition-colors"
          >
            <span
              className="w-3 h-3 rounded-full shrink-0"
              style={{ backgroundColor: tag.color }}
            />
            <span className="flex-1 text-left text-text-primary">{tag.name}</span>
            {assignedIds.has(tag.id) && (
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
                fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                className="text-accent-done">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
          </button>
        ))}
      </div>

      {/* Inline create — shown when search doesn't match existing */}
      {search.trim() && !exactMatch && (
        <div className="border-t border-column-border p-2">
          {!showCreate ? (
            <button
              onClick={() => setShowCreate(true)}
              className="w-full text-left text-sm text-accent-todo hover:opacity-80 px-2 py-1"
            >
              + Create "{search.trim()}"
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={newColor}
                onChange={(e) => setNewColor(e.target.value)}
                className="w-7 h-7 rounded cursor-pointer border border-input-border bg-transparent shrink-0"
              />
              <span className="flex-1 text-sm text-text-primary truncate">{search.trim()}</span>
              <button
                onClick={handleCreateInline}
                className="px-2 py-1 text-xs font-medium rounded bg-accent-todo text-white hover:opacity-90 transition-opacity"
              >
                Create
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}