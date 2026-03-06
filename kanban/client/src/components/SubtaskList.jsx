import { useState, useRef } from 'react';
import {
  DndContext,
  closestCenter,
  useSensor,
  useSensors,
  PointerSensor,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import useStore from '../store';

function SortableSubtask({ subtask }) {
  const updateSubtask = useStore((s) => s.updateSubtask);
  const deleteSubtask = useStore((s) => s.deleteSubtask);
  const [isEditing, setIsEditing] = useState(false);
  const [editVal, setEditVal] = useState(subtask.title);
  const inputRef = useRef(null);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `subtask-${subtask.id}` });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleToggle = (e) => {
    e.stopPropagation();
    updateSubtask(subtask.id, { completed: !subtask.completed });
  };

  const handleSave = () => {
    const trimmed = editVal.trim();
    if (trimmed && trimmed !== subtask.title) {
      updateSubtask(subtask.id, { title: trimmed });
    } else {
      setEditVal(subtask.title);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') {
      setEditVal(subtask.title);
      setIsEditing(false);
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      className="flex items-center gap-1.5 py-1 group/sub"
    >
      <span
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-text-muted opacity-0 group-hover/sub:opacity-100 transition-opacity"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24"
          fill="currentColor">
          <circle cx="9" cy="6" r="2"/><circle cx="15" cy="6" r="2"/>
          <circle cx="9" cy="12" r="2"/><circle cx="15" cy="12" r="2"/>
          <circle cx="9" cy="18" r="2"/><circle cx="15" cy="18" r="2"/>
        </svg>
      </span>

      <button
        onClick={handleToggle}
        className={`w-3.5 h-3.5 rounded-sm border shrink-0 flex items-center justify-center transition-colors ${
          subtask.completed === 1 || subtask.completed === true
            ? 'bg-accent-done border-accent-done'
            : 'border-text-muted hover:border-text-secondary'
        }`}
      >
        {(subtask.completed === 1 || subtask.completed === true) && (
          <svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 24 24"
            fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </button>

      {isEditing ? (
        <input
          ref={inputRef}
          type="text"
          value={editVal}
          onChange={(e) => setEditVal(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          autoFocus
          className="flex-1 bg-input-bg border border-input-border rounded px-1.5 py-0.5 text-xs text-text-primary outline-none focus:border-accent-todo transition-colors"
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <span
          onClick={(e) => {
            e.stopPropagation();
            setEditVal(subtask.title);
            setIsEditing(true);
          }}
          className={`flex-1 text-xs cursor-text ${
            subtask.completed ? 'line-through text-text-muted' : 'text-text-primary'
          }`}
        >
          {subtask.title}
        </span>
      )}

      <button
        onClick={(e) => {
          e.stopPropagation();
          deleteSubtask(subtask.id);
        }}
        className="opacity-0 group-hover/sub:opacity-100 text-text-muted hover:text-danger transition-all p-0.5"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24"
          fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}

export default function SubtaskList({ task }) {
  const addSubtask = useStore((s) => s.addSubtask);
  const moveSubtask = useStore((s) => s.moveSubtask);
  const [isAdding, setIsAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const addRef = useRef(null);

  const subtasks = [...(task.subtasks || [])].sort((a, b) => a.position - b.position);
  const completed = subtasks.filter((s) => s.completed).length;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 3 } })
  );

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeId = Number(String(active.id).replace('subtask-', ''));
    const overId = Number(String(over.id).replace('subtask-', ''));

    const others = subtasks.filter((s) => s.id !== activeId);
    const overIndex = others.findIndex((s) => s.id === overId);

    let newPosition;
    if (overIndex === 0) {
      newPosition = others[0].position / 2;
    } else if (overIndex === -1) {
      newPosition = others.length > 0
        ? others[others.length - 1].position + 1
        : 1;
    } else {
      const before = others[overIndex - 1].position;
      const at = others[overIndex].position;
      newPosition = (before + at) / 2;
    }

    moveSubtask(activeId, newPosition);
  };

  const doAdd = () => {
    const trimmed = newTitle.trim();
    if (!trimmed) return;
    setNewTitle('');
    // Fire and forget — don't await so the input stays responsive
    addSubtask(task.id, trimmed);
  };

  const handleAddKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      doAdd();
    }
    if (e.key === 'Escape') {
      setNewTitle('');
      setIsAdding(false);
    }
  };

  const handleAddBlur = () => {
    const trimmed = newTitle.trim();
    if (trimmed) {
      doAdd();
    }
    // Always close on blur — user clicked away
    setIsAdding(false);
  };

  return (
    <div className="mt-2 pt-2 border-t border-column-border/50" onClick={(e) => e.stopPropagation()}>
      {subtasks.length > 0 && (
        <div className="flex items-center gap-2 mb-1.5">
          <div className="flex-1 h-1 bg-column-border rounded-full overflow-hidden">
            <div
              className="h-full bg-accent-done rounded-full transition-all duration-300"
              style={{ width: `${(completed / subtasks.length) * 100}%` }}
            />
          </div>
          <span className="text-[10px] text-text-muted shrink-0">
            {completed}/{subtasks.length}
          </span>
        </div>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={subtasks.map((s) => `subtask-${s.id}`)}
          strategy={verticalListSortingStrategy}
        >
          {subtasks.map((subtask) => (
            <SortableSubtask key={subtask.id} subtask={subtask} />
          ))}
        </SortableContext>
      </DndContext>

      {isAdding ? (
        <div className="flex items-center gap-1.5 py-1">
          <input
            ref={addRef}
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onBlur={handleAddBlur}
            onKeyDown={handleAddKeyDown}
            placeholder="Subtask title..."
            autoFocus
            className="flex-1 bg-input-bg border border-input-border rounded px-1.5 py-0.5 text-xs text-text-primary placeholder-text-muted outline-none focus:border-accent-todo transition-colors"
          />
        </div>
      ) : (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsAdding(true);
          }}
          className="text-[10px] text-text-muted hover:text-text-secondary transition-colors mt-1"
        >
          + Add subtask
        </button>
      )}
    </div>
  );
}
