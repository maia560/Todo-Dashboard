import { useDroppable } from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import TaskCard from './TaskCard';
import useStore from '../store';

export default function Column({ column }) {
  const getColumnTasks = useStore((s) => s.getColumnTasks);
  const columnTasks = getColumnTasks(column.id);

  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  const accentColors = {
    'accent-todo': 'bg-accent-todo',
    'accent-progress': 'bg-accent-progress',
    'accent-done': 'bg-accent-done',
  };

  const accentText = {
    'accent-todo': 'text-accent-todo border-accent-todo/30',
    'accent-progress': 'text-accent-progress border-accent-progress/30',
    'accent-done': 'text-accent-done border-accent-done/30',
  };

  return (
    <div className="flex flex-col flex-1 min-w-[280px] max-w-[400px] bg-column-bg border border-column-border rounded-2xl">
      {/* Column header */}
      <div className="flex items-center gap-2 px-4 py-3">
        <div className={`w-2 h-2 rounded-full ${accentColors[column.accent]}`} />
        <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">
          {column.label}
        </h2>
        <span className={`ml-auto text-xs font-medium bg-board-bg border rounded-full px-2 py-0.5 ${accentText[column.accent]}`}>
          {columnTasks.length}
        </span>
      </div>

      {/* Task list */}
      <div
        ref={setNodeRef}
        className={`flex-1 overflow-y-auto px-3 pb-3 transition-colors duration-150 ${
          isOver ? 'bg-column-bg/80' : ''
        }`}
      >
        <SortableContext
          items={columnTasks.map((t) => t.id)}
          strategy={verticalListSortingStrategy}
        >
          {columnTasks.length === 0 && !isOver && (
            <div className="flex items-center justify-center h-24 text-sm text-text-muted">
              No tasks yet
            </div>
          )}
          {columnTasks.map((task) => (
            <TaskCard key={task.id} task={task} />
          ))}
        </SortableContext>
      </div>
    </div>
  );
}