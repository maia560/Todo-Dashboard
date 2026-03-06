import { useState, useRef, useEffect } from 'react';
import useStore from '../store';

export default function DueDatePicker({ task, onClose }) {
  const setDueDate = useStore((s) => s.setDueDate);
  const clearDueDate = useStore((s) => s.clearDueDate);

  const [includeTime, setIncludeTime] = useState(
    task.due_date ? task.due_date.includes('T') : false
  );
  const [dateVal, setDateVal] = useState(() => {
    if (!task.due_date) return '';
    return task.due_date.includes('T')
      ? task.due_date.split('T')[0]
      : task.due_date;
  });
  const [timeVal, setTimeVal] = useState(() => {
    if (!task.due_date || !task.due_date.includes('T')) return '12:00';
    return task.due_date.split('T')[1]?.slice(0, 5) || '12:00';
  });

  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const handleSave = () => {
    if (!dateVal) {
      clearDueDate(task.id);
    } else if (includeTime) {
      setDueDate(task.id, `${dateVal}T${timeVal}`);
    } else {
      setDueDate(task.id, dateVal);
    }
    onClose();
  };

  const handleClear = () => {
    clearDueDate(task.id);
    onClose();
  };

  return (
    <div
      ref={ref}
      className="absolute z-40 top-full right-0 mt-1 w-60 bg-card-bg border border-card-border rounded-lg shadow-xl p-3"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="space-y-3">
        <div>
          <label className="block text-xs text-text-muted mb-1">Date</label>
          <input
            type="date"
            value={dateVal}
            onChange={(e) => setDateVal(e.target.value)}
            className="w-full bg-input-bg border border-input-border rounded px-2 py-1.5 text-sm text-text-primary outline-none focus:border-accent-todo transition-colors"
          />
        </div>

        <label className="flex items-center gap-2 text-xs text-text-secondary cursor-pointer">
          <input
            type="checkbox"
            checked={includeTime}
            onChange={(e) => setIncludeTime(e.target.checked)}
            className="rounded"
          />
          Include time
        </label>

        {includeTime && (
          <div>
            <label className="block text-xs text-text-muted mb-1">Time</label>
            <input
              type="time"
              value={timeVal}
              onChange={(e) => setTimeVal(e.target.value)}
              className="w-full bg-input-bg border border-input-border rounded px-2 py-1.5 text-sm text-text-primary outline-none focus:border-accent-todo transition-colors"
            />
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <button
            onClick={handleSave}
            className="flex-1 px-2 py-1.5 text-xs font-medium rounded bg-accent-todo text-white hover:opacity-90 transition-opacity"
          >
            Save
          </button>
          {task.due_date && (
            <button
              onClick={handleClear}
              className="px-2 py-1.5 text-xs font-medium rounded border border-column-border text-text-secondary hover:text-danger hover:border-danger transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      </div>
    </div>
  );
}