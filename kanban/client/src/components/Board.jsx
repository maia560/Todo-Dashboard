import {
  DndContext,
  DragOverlay,
  pointerWithin,
  useSensor,
  useSensors,
  PointerSensor,
} from '@dnd-kit/core';
import { useState, useCallback } from 'react';
import Column from './Column';
import CalendarPanel from './CalendarPanel';
import useStore from '../store';

const COLUMNS = [
  { id: 'todo', label: 'Todo', accent: 'accent-todo' },
  { id: 'in-progress', label: 'In Progress', accent: 'accent-progress' },
  { id: 'done', label: 'Completed', accent: 'accent-done' },
];

export default function Board({ calendarOpen }) {
  const tasks = useStore((s) => s.tasks);
  const moveTask = useStore((s) => s.moveTask);
  const [activeId, setActiveId] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const activeTask = activeId ? tasks.find((t) => t.id === activeId) : null;

  const handleDragStart = useCallback((event) => {
    setActiveId(event.active.id);
  }, []);

  const handleDragEnd = useCallback(
    (event) => {
      const { active, over } = event;
      setActiveId(null);

      if (!over) return;

      const taskId = active.id;
      const task = tasks.find((t) => t.id === taskId);
      if (!task) return;

      // Determine target column
      let targetStatus;
      let overId = over.id;

      if (COLUMNS.some((c) => c.id === overId)) {
        targetStatus = overId;
      } else {
        const overTask = tasks.find((t) => t.id === overId);
        if (!overTask) return;
        targetStatus = overTask.status;
      }

      // Calculate new position
      const columnTasks = tasks
        .filter((t) => t.status === targetStatus && t.id !== taskId)
        .sort((a, b) => a.position - b.position);

      let newPosition;

      if (COLUMNS.some((c) => c.id === overId)) {
        // Dropped on column itself — append to end
        newPosition = columnTasks.length > 0
          ? columnTasks[columnTasks.length - 1].position + 1
          : 1;
      } else {
        // Dropped on a specific task
        const overIndex = columnTasks.findIndex((t) => t.id === overId);

        if (overIndex === 0) {
          newPosition = columnTasks[0].position / 2;
        } else if (overIndex === -1) {
          newPosition = columnTasks.length > 0
            ? columnTasks[columnTasks.length - 1].position + 1
            : 1;
        } else {
          const before = columnTasks[overIndex - 1].position;
          const at = columnTasks[overIndex].position;
          newPosition = (before + at) / 2;
        }
      }

      if (task.status === targetStatus && task.position === newPosition) return;

      moveTask(taskId, targetStatus, newPosition);
    },
    [tasks, moveTask]
  );

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex h-full gap-4 p-4 overflow-x-auto">
        {COLUMNS.map((col) => (
          <Column key={col.id} column={col} />
        ))}
        <CalendarPanel isOpen={calendarOpen} />
      </div>

      <DragOverlay>
        {activeTask ? (
          <div className="bg-card-drag border border-card-border rounded-lg p-3 shadow-xl opacity-90 w-72">
            <span className="text-sm text-text-primary">{activeTask.title}</span>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}