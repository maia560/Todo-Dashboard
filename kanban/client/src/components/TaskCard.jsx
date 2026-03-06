import { useState, useRef, useEffect } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import useStore from '../store';
import TagPicker from './TagPicker';
import DueDatePicker from './DueDatePicker';
import DueDateBadge from './DueDateBadge';
import SubtaskList from './SubtaskList';

export default function TaskCard({ task }) {
  const updateTask = useStore((s) => s.updateTask);
  const deleteTask = useStore((s) => s.deleteTask);
  const setSelectedTask = useStore((s) => s.setSelectedTask);
  const selectedTaskId = useStore((s) => s.selectedTaskId);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(task.title);
  const [showTagPicker, setShowTagPicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const inputRef = useRef(null);

  const isSelected = selectedTaskId === task.id;

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSave = () => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== task.title) {
      updateTask(task.id, { title: trimmed });
    } else {
      setEditValue(task.title);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') {
      setEditValue(task.title);
      setIsEditing(false);
    }
  };

  const handleCardClick = () => {
    setSelectedTask(task.id);
  };

  if (isDragging) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className="h-12 mb-2 rounded-lg border-2 border-dashed border-column-border bg-column-bg/50"
      />
    );
  }

  const taskTags = task.tags || [];
  const subtasks = task.subtasks || [];
  const completedSubtasks = subtasks.filter((s) => s.completed).length;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      data-task-id={task.id}
      onClick={handleCardClick}
      className={`group relative bg-card-bg hover:bg-card-hover border rounded-lg p-3 mb-2 cursor-grab active:cursor-grabbing transition-colors duration-100 ${
        isSelected ? 'border-accent-todo ring-1 ring-accent-todo/30' : 'border-card-border'
      }`}
    >
      {/* Title row */}
      <div className="flex items-start justify-between gap-2">
        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleSave}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-input-bg border border-input-border rounded px-2 py-1 text-sm text-text-primary outline-none focus:border-accent-todo transition-colors"
          />
        ) : (
          <span
            data-task-title
            onClick={(e) => {
              e.stopPropagation();
              setEditValue(task.title);
              setIsEditing(true);
            }}
            className="flex-1 text-sm text-text-primary cursor-text leading-relaxed"
          >
            {task.title}
          </span>
        )}

        {!isEditing && (
          <div className="flex items-center gap-0.5 shrink-0">
            {/* Due date button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowDatePicker(!showDatePicker);
              }}
              className="opacity-0 group-hover:opacity-100 text-text-muted hover:text-accent-progress transition-all duration-150 p-0.5 rounded"
              title="Set due date"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
                fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            </button>
            {/* Subtask toggle */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setExpanded(!expanded);
              }}
              className={`text-text-muted hover:text-text-primary transition-all duration-150 p-0.5 rounded ${
                subtasks.length > 0 ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
              }`}
              title="Subtasks"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
                fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" />
                <line x1="8" y1="18" x2="21" y2="18" />
                <line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" />
                <line x1="3" y1="18" x2="3.01" y2="18" />
              </svg>
            </button>
            {/* Tag button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowTagPicker(!showTagPicker);
              }}
              className="opacity-0 group-hover:opacity-100 text-text-muted hover:text-accent-todo transition-all duration-150 p-0.5 rounded"
              title="Manage tags"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
                fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
                <line x1="7" y1="7" x2="7.01" y2="7" />
              </svg>
            </button>
            {/* Delete button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                deleteTask(task.id);
              }}
              className="opacity-0 group-hover:opacity-100 text-text-muted hover:text-danger transition-all duration-150 p-0.5 rounded"
              title="Delete task"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
                fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* Metadata row: due date badge + subtask count (when collapsed) */}
      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
        <DueDateBadge dueDate={task.due_date} />
        {subtasks.length > 0 && !expanded && (
          <span className="text-[10px] text-text-muted">
            {completedSubtasks}/{subtasks.length} subtasks
          </span>
        )}
      </div>

      {/* Tag chips */}
      {taskTags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {taskTags.map((tag) => (
            <span
              key={tag.id}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium text-white"
              style={{ backgroundColor: tag.color }}
            >
              {tag.name}
            </span>
          ))}
        </div>
      )}

      {/* Expanded subtask list */}
      {expanded && <SubtaskList task={task} />}

      {/* Dropdowns */}
      {showTagPicker && (
        <TagPicker taskId={task.id} taskTags={taskTags} onClose={() => setShowTagPicker(false)} />
      )}
      {showDatePicker && (
        <DueDatePicker task={task} onClose={() => setShowDatePicker(false)} />
      )}
    </div>
  );
}