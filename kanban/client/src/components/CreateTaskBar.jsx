import { useState, useRef } from 'react';
import useStore from '../store';

export default function CreateTaskBar() {
  const tags = useStore((s) => s.tags);

  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [includeTime, setIncludeTime] = useState(false);
  const [dueTime, setDueTime] = useState('12:00');
  const [selectedTagIds, setSelectedTagIds] = useState([]);
  const [showTagDropdown, setShowTagDropdown] = useState(false);

  const titleRef = useRef(null);
  const tagDropdownRef = useRef(null);

  const resetForm = () => {
    setTitle('');
    setDueDate('');
    setIncludeTime(false);
    setDueTime('12:00');
    setSelectedTagIds([]);
    setShowTagDropdown(false);
  };

  const handleSubmit = async () => {
    const trimmed = title.trim();
    if (!trimmed) return;

    let due = null;
    if (dueDate) {
      due = includeTime ? `${dueDate}T${dueTime}` : dueDate;
    }

    const task = await useStore.getState().addTask(trimmed, 'todo', due);

    // Assign tags after task creation
    if (task && selectedTagIds.length > 0) {
      for (const tagId of selectedTagIds) {
        await useStore.getState().addTagToTask(task.id, tagId);
      }
    }

    resetForm();
    titleRef.current?.focus();
  };

  const handleTitleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  };

  const toggleTag = (tagId) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  };

  return (
    <div className="border-b border-column-border bg-column-bg/50 px-6 py-3">
      <div className="flex items-center gap-3">
        <input
          ref={titleRef}
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={handleTitleKeyDown}
          placeholder="New task title..."
          className="flex-1 min-w-0 bg-input-bg border border-input-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-muted outline-none focus:border-accent-todo transition-colors"
        />

        <div className="flex items-center gap-1.5 shrink-0">
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="bg-input-bg border border-input-border rounded-lg px-2 py-2 text-xs text-text-primary outline-none focus:border-accent-todo transition-colors w-32"
          />
          {dueDate && (
            <>
              <label className="flex items-center gap-1 text-[10px] text-text-muted cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={includeTime}
                  onChange={(e) => setIncludeTime(e.target.checked)}
                  className="rounded"
                />
                Time
              </label>
              {includeTime && (
                <input
                  type="time"
                  value={dueTime}
                  onChange={(e) => setDueTime(e.target.value)}
                  className="bg-input-bg border border-input-border rounded-lg px-2 py-2 text-xs text-text-primary outline-none focus:border-accent-todo transition-colors w-24"
                />
              )}
            </>
          )}
        </div>

        <div className="relative shrink-0" ref={tagDropdownRef}>
          <button
            onClick={() => setShowTagDropdown(!showTagDropdown)}
            className={`inline-flex items-center gap-1.5 px-2.5 py-2 text-xs border rounded-lg transition-colors ${
              selectedTagIds.length > 0
                ? 'border-accent-todo text-accent-todo'
                : 'border-input-border text-text-muted hover:text-text-secondary'
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
              <line x1="7" y1="7" x2="7.01" y2="7" />
            </svg>
            {selectedTagIds.length > 0 ? `${selectedTagIds.length} tag${selectedTagIds.length > 1 ? 's' : ''}` : 'Tags'}
          </button>

          {showTagDropdown && (
            <div className="absolute z-40 top-full right-0 mt-1 w-48 bg-card-bg border border-card-border rounded-lg shadow-xl overflow-hidden">
              {tags.length === 0 ? (
                <div className="px-3 py-2 text-xs text-text-muted">No tags created yet</div>
              ) : (
                <div className="max-h-40 overflow-y-auto py-1">
                  {tags.map((tag) => (
                    <button
                      key={tag.id}
                      onClick={() => toggleTag(tag.id)}
                      className="flex items-center gap-2 w-full px-3 py-1.5 text-xs hover:bg-column-bg transition-colors"
                    >
                      <span
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: tag.color }}
                      />
                      <span className="flex-1 text-left text-text-primary">{tag.name}</span>
                      {selectedTagIds.includes(tag.id) && (
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24"
                          fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                          className="text-accent-done">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <button
          onClick={handleSubmit}
          disabled={!title.trim()}
          className="px-4 py-2 text-sm font-medium rounded-lg bg-accent-todo text-white disabled:opacity-40 hover:opacity-90 transition-opacity shrink-0"
        >
          Add
        </button>
      </div>

      {selectedTagIds.length > 0 && (
        <div className="flex items-center gap-1 flex-wrap mt-2">
          {selectedTagIds.map((tagId) => {
            const tag = tags.find((t) => t.id === tagId);
            if (!tag) return null;
            return (
              <button
                key={tag.id}
                onClick={() => toggleTag(tag.id)}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium text-white hover:opacity-80 transition-opacity"
                style={{ backgroundColor: tag.color }}
                title="Click to remove"
              >
                {tag.name}
                <svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 24 24"
                  fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
