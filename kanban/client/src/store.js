import { create } from 'zustand';
import { supabase } from './supabase';

const useStore = create((set, get) => ({
  tasks: [],
  tags: [],
  filterTagIds: [],
  toast: null,
  searchQuery: '',
  searchResults: [],
  searchOpen: false,
  selectedTaskId: null,

  // --- Helpers ---
  getColumnTasks: (status) => {
    const { tasks, filterTagIds } = get();
    let filtered = tasks.filter((t) => t.status === status);

    if (filterTagIds.length > 0) {
      filtered = filtered.filter((t) =>
        filterTagIds.every((fid) => t.tags?.some((tag) => tag.id === fid))
      );
    }

    return filtered.sort((a, b) => a.position - b.position);
  },

  toggleTagFilter: (tagId) => {
    set((s) => {
      const exists = s.filterTagIds.includes(tagId);
      return {
        filterTagIds: exists
          ? s.filterTagIds.filter((id) => id !== tagId)
          : [...s.filterTagIds, tagId],
      };
    });
  },

  clearTagFilters: () => set({ filterTagIds: [] }),

  setSelectedTask: (id) => set({ selectedTaskId: id }),

  showToast: (message) => {
    set({ toast: message });
    setTimeout(() => set({ toast: null }), 3000);
  },

  // --- Search ---
  setSearchOpen: (open) =>
    set({
      searchOpen: open,
      searchQuery: open ? get().searchQuery : '',
      searchResults: open ? get().searchResults : [],
    }),

  search: async (query) => {
    set({ searchQuery: query });
    if (!query.trim()) {
      set({ searchResults: [] });
      return;
    }

    const term = `%${query.trim().toLowerCase()}%`;
    const results = [];
    const seenTaskIds = new Set();

    // Search by task title
    const { data: titleMatches } = await supabase
      .from('tasks')
      .select('*')
      .ilike('title', term)
      .order('status')
      .order('position');

    for (const task of titleMatches || []) {
      if (!seenTaskIds.has(task.id)) {
        seenTaskIds.add(task.id);
        const full = await get()._getTaskFull(task.id);
        if (full) results.push({ task: full, matchType: 'title', matchText: task.title });
      }
    }

    // Search by tag name
    const { data: tagMatches } = await supabase
      .from('task_tags')
      .select('task_id, tags!inner(name)')
      .ilike('tags.name', term);

    for (const row of tagMatches || []) {
      if (!seenTaskIds.has(row.task_id)) {
        seenTaskIds.add(row.task_id);
        const full = await get()._getTaskFull(row.task_id);
        if (full) results.push({ task: full, matchType: 'tag', matchText: row.tags.name });
      }
    }

    // Search by subtask title
    const { data: subtaskMatches } = await supabase
      .from('subtasks')
      .select('task_id, title')
      .ilike('title', term);

    for (const row of subtaskMatches || []) {
      if (!seenTaskIds.has(row.task_id)) {
        seenTaskIds.add(row.task_id);
        const full = await get()._getTaskFull(row.task_id);
        if (full) results.push({ task: full, matchType: 'subtask', matchText: row.title });
      }
    }

    set({ searchResults: results });
  },

  // --- Internal helper to fetch a full task with tags + subtasks ---
  _getTaskFull: async (taskId) => {
    const { data: task } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', taskId)
      .single();

    if (!task) return null;

    const { data: taskTags } = await supabase
      .from('task_tags')
      .select('tag_id, tags(*)')
      .eq('task_id', taskId);

    task.tags = (taskTags || []).map((tt) => tt.tags);

    const { data: subtasks } = await supabase
      .from('subtasks')
      .select('*')
      .eq('task_id', taskId)
      .order('position');

    task.subtasks = subtasks || [];
    return task;
  },

  // --- Data fetching ---
  fetchTasks: async () => {
    try {
      const { data: tasks, error } = await supabase
        .from('tasks')
        .select('*')
        .order('status')
        .order('position');

      if (error) throw error;

      // Fetch all tags and subtasks in bulk
      const taskIds = tasks.map((t) => t.id);

      const { data: allTaskTags } = await supabase
        .from('task_tags')
        .select('task_id, tags(*)')
        .in('task_id', taskIds.length ? taskIds : [-1]);

      const { data: allSubtasks } = await supabase
        .from('subtasks')
        .select('*')
        .in('task_id', taskIds.length ? taskIds : [-1])
        .order('position');

      // Group by task_id
      const tagsByTask = {};
      for (const tt of allTaskTags || []) {
        if (!tagsByTask[tt.task_id]) tagsByTask[tt.task_id] = [];
        tagsByTask[tt.task_id].push(tt.tags);
      }

      const subtasksByTask = {};
      for (const st of allSubtasks || []) {
        if (!subtasksByTask[st.task_id]) subtasksByTask[st.task_id] = [];
        subtasksByTask[st.task_id].push(st);
      }

      const enriched = tasks.map((t) => ({
        ...t,
        tags: tagsByTask[t.id] || [],
        subtasks: subtasksByTask[t.id] || [],
      }));

      set({ tasks: enriched });
    } catch {
      get().showToast('Failed to load tasks');
    }
  },

  fetchTags: async () => {
    try {
      const { data: tags, error } = await supabase
        .from('tags')
        .select('*')
        .order('name');

      if (error) throw error;
      set({ tags });
    } catch {
      get().showToast('Failed to load tags');
    }
  },

  // --- Task CRUD ---
  addTask: async (title, status, dueDate = null) => {
    const columnTasks = get().getColumnTasks(status);
    const position =
      columnTasks.length > 0
        ? Math.max(...columnTasks.map((t) => t.position)) + 1
        : 1;
    const tempId = -Date.now();
    const optimistic = {
      id: tempId,
      title,
      status,
      position,
      tags: [],
      subtasks: [],
      due_date: dueDate,
      created_at: new Date().toISOString(),
    };

    set((s) => ({ tasks: [...s.tasks, optimistic] }));

    try {
      const { data, error } = await supabase
        .from('tasks')
        .insert({ title: title.trim(), status, position, due_date: dueDate })
        .select()
        .single();

      if (error) throw error;

      const task = { ...data, tags: [], subtasks: [] };
      set((s) => ({ tasks: s.tasks.map((t) => (t.id === tempId ? task : t)) }));
      return task;
    } catch {
      set((s) => ({ tasks: s.tasks.filter((t) => t.id !== tempId) }));
      get().showToast('Failed to create task');
      return null;
    }
  },

  updateTask: async (id, updates) => {
    const prev = get().tasks.find((t) => t.id === id);
    if (!prev) return;

    set((s) => ({
      tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...updates } : t)),
    }));

    try {
      const { error } = await supabase
        .from('tasks')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
    } catch {
      set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? prev : t)) }));
      get().showToast('Failed to update task');
    }
  },

  moveTask: async (id, status, position) => {
    const prev = get().tasks.find((t) => t.id === id);
    if (!prev) return;

    set((s) => ({
      tasks: s.tasks.map((t) =>
        t.id === id ? { ...t, status, position } : t
      ),
    }));

    try {
      const { error } = await supabase
        .from('tasks')
        .update({ status, position })
        .eq('id', id);

      if (error) throw error;
    } catch {
      set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? prev : t)) }));
      get().showToast('Failed to move task');
    }
  },

  deleteTask: async (id) => {
    const prev = get().tasks.find((t) => t.id === id);
    if (!prev) return;

    set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) }));

    try {
      const { error } = await supabase.from('tasks').delete().eq('id', id);
      if (error) throw error;
    } catch {
      set((s) => ({ tasks: [...s.tasks, prev] }));
      get().showToast('Failed to delete task');
    }
  },

  // --- Due date ---
  setDueDate: async (taskId, dueDate) => {
    return get().updateTask(taskId, { due_date: dueDate });
  },

  clearDueDate: async (taskId) => {
    return get().updateTask(taskId, { due_date: null });
  },

  // --- Subtask CRUD ---
  addSubtask: async (taskId, title) => {
    try {
      // Get max position
      const { data: existing } = await supabase
        .from('subtasks')
        .select('position')
        .eq('task_id', taskId)
        .order('position', { ascending: false })
        .limit(1);

      const position = existing?.length ? existing[0].position + 1 : 1;

      const { data: subtask, error } = await supabase
        .from('subtasks')
        .insert({ task_id: taskId, title: title.trim(), position })
        .select()
        .single();

      if (error) throw error;

      set((s) => ({
        tasks: s.tasks.map((task) => {
          if (task.id !== taskId) return task;
          const already = (task.subtasks || []).find((st) => st.id === subtask.id);
          if (already) return task;
          return { ...task, subtasks: [...(task.subtasks || []), subtask] };
        }),
      }));
      return subtask;
    } catch {
      get().showToast('Failed to create subtask');
      return null;
    }
  },

  updateSubtask: async (subtaskId, updates) => {
    let prevTask = null;
    set((s) => ({
      tasks: s.tasks.map((task) => {
        const st = (task.subtasks || []).find((st) => st.id === subtaskId);
        if (!st) return task;
        prevTask = { ...task, subtasks: [...task.subtasks] };
        return {
          ...task,
          subtasks: task.subtasks.map((st) =>
            st.id === subtaskId ? { ...st, ...updates } : st
          ),
        };
      }),
    }));

    try {
      const { data: subtask, error } = await supabase
        .from('subtasks')
        .update(updates)
        .eq('id', subtaskId)
        .select()
        .single();

      if (error) throw error;

      set((s) => ({
        tasks: s.tasks.map((task) => {
          if (task.id !== subtask.task_id) return task;
          return {
            ...task,
            subtasks: (task.subtasks || []).map((st) =>
              st.id === subtask.id ? subtask : st
            ),
          };
        }),
      }));
      return subtask;
    } catch {
      if (prevTask) {
        set((s) => ({
          tasks: s.tasks.map((t) => (t.id === prevTask.id ? prevTask : t)),
        }));
      }
      get().showToast('Failed to update subtask');
      return null;
    }
  },

  moveSubtask: async (subtaskId, position) => {
    let prevTask = null;
    set((s) => ({
      tasks: s.tasks.map((task) => {
        const st = (task.subtasks || []).find((st) => st.id === subtaskId);
        if (!st) return task;
        prevTask = { ...task, subtasks: [...task.subtasks] };
        return {
          ...task,
          subtasks: task.subtasks.map((st) =>
            st.id === subtaskId ? { ...st, position } : st
          ),
        };
      }),
    }));

    try {
      const { error } = await supabase
        .from('subtasks')
        .update({ position })
        .eq('id', subtaskId);

      if (error) throw error;
    } catch {
      if (prevTask) {
        set((s) => ({
          tasks: s.tasks.map((t) => (t.id === prevTask.id ? prevTask : t)),
        }));
      }
      get().showToast('Failed to reorder subtask');
    }
  },

  deleteSubtask: async (subtaskId) => {
    let prevTask = null;
    set((s) => ({
      tasks: s.tasks.map((task) => {
        const st = (task.subtasks || []).find((st) => st.id === subtaskId);
        if (!st) return task;
        prevTask = { ...task, subtasks: [...task.subtasks] };
        return {
          ...task,
          subtasks: task.subtasks.filter((st) => st.id !== subtaskId),
        };
      }),
    }));

    try {
      const { error } = await supabase
        .from('subtasks')
        .delete()
        .eq('id', subtaskId);

      if (error) throw error;
    } catch {
      if (prevTask) {
        set((s) => ({
          tasks: s.tasks.map((t) => (t.id === prevTask.id ? prevTask : t)),
        }));
      }
      get().showToast('Failed to delete subtask');
    }
  },

  // --- Tag CRUD ---
  createTag: async (name, color) => {
    try {
      const { data: tag, error } = await supabase
        .from('tags')
        .insert({ name: name.trim(), color })
        .select()
        .single();

      if (error) {
        get().showToast(error.message || 'Failed to create tag');
        return null;
      }
      return tag;
    } catch {
      get().showToast('Failed to create tag');
      return null;
    }
  },

  updateTag: async (id, updates) => {
    try {
      const { data: tag, error } = await supabase
        .from('tags')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        get().showToast(error.message || 'Failed to update tag');
        return null;
      }
      return tag;
    } catch {
      get().showToast('Failed to update tag');
      return null;
    }
  },

  deleteTag: async (id) => {
    try {
      const { error } = await supabase.from('tags').delete().eq('id', id);
      if (error) throw error;
    } catch {
      get().showToast('Failed to delete tag');
    }
  },

  addTagToTask: async (taskId, tagId) => {
    try {
      const { error } = await supabase
        .from('task_tags')
        .upsert({ task_id: taskId, tag_id: tagId });

      if (error) throw error;

      // Update local state immediately
      const tag = get().tags.find((t) => t.id === tagId);
      if (tag) {
        set((s) => ({
          tasks: s.tasks.map((task) => {
            if (task.id !== taskId) return task;
            const already = (task.tags || []).find((t) => t.id === tagId);
            if (already) return task;
            return { ...task, tags: [...(task.tags || []), tag] };
          }),
        }));
      }
    } catch {
      get().showToast('Failed to assign tag');
    }
  },

  removeTagFromTask: async (taskId, tagId) => {
    try {
      const { error } = await supabase
        .from('task_tags')
        .delete()
        .eq('task_id', taskId)
        .eq('tag_id', tagId);

      if (error) throw error;

      set((s) => ({
        tasks: s.tasks.map((task) => {
          if (task.id !== taskId) return task;
          return { ...task, tags: (task.tags || []).filter((t) => t.id !== tagId) };
        }),
      }));
    } catch {
      get().showToast('Failed to remove tag');
    }
  },

  // --- Realtime handlers (called from App.jsx subscriptions) ---
  handleRealtimeTask: (payload) => {
    const { eventType, new: newRow, old: oldRow } = payload;

    if (eventType === 'INSERT') {
      set((s) => {
        const exists = s.tasks.find((t) => t.id === newRow.id);
        if (exists) return { tasks: s.tasks.map((t) => (t.id === newRow.id ? { ...t, ...newRow } : t)) };
        // Replace optimistic placeholder
        const optimistic = s.tasks.find(
          (t) => t.id < 0 && t.title === newRow.title && t.status === newRow.status
        );
        if (optimistic) {
          return {
            tasks: s.tasks.map((t) =>
              t.id === optimistic.id ? { ...newRow, tags: [], subtasks: [] } : t
            ),
          };
        }
        return { tasks: [...s.tasks, { ...newRow, tags: [], subtasks: [] }] };
      });
    } else if (eventType === 'UPDATE') {
      set((s) => ({
        tasks: s.tasks.map((t) =>
          t.id === newRow.id ? { ...t, ...newRow } : t
        ),
      }));
    } else if (eventType === 'DELETE') {
      set((s) => ({
        tasks: s.tasks.filter((t) => t.id !== oldRow.id),
        selectedTaskId: s.selectedTaskId === oldRow.id ? null : s.selectedTaskId,
      }));
    }
  },

  handleRealtimeTag: (payload) => {
    const { eventType, new: newRow, old: oldRow } = payload;

    if (eventType === 'INSERT') {
      set((s) => {
        const exists = s.tags.find((t) => t.id === newRow.id);
        if (exists) return s;
        return { tags: [...s.tags, newRow] };
      });
    } else if (eventType === 'UPDATE') {
      set((s) => ({
        tags: s.tags.map((t) => (t.id === newRow.id ? newRow : t)),
        tasks: s.tasks.map((task) => ({
          ...task,
          tags: (task.tags || []).map((t) => (t.id === newRow.id ? newRow : t)),
        })),
      }));
    } else if (eventType === 'DELETE') {
      set((s) => ({
        tags: s.tags.filter((t) => t.id !== oldRow.id),
        filterTagIds: s.filterTagIds.filter((fid) => fid !== oldRow.id),
        tasks: s.tasks.map((task) => ({
          ...task,
          tags: (task.tags || []).filter((t) => t.id !== oldRow.id),
        })),
      }));
    }
  },

  handleRealtimeTaskTag: (payload) => {
    const { eventType, new: newRow, old: oldRow } = payload;

    if (eventType === 'INSERT') {
      const tag = get().tags.find((t) => t.id === newRow.tag_id);
      if (tag) {
        set((s) => ({
          tasks: s.tasks.map((task) => {
            if (task.id !== newRow.task_id) return task;
            const already = (task.tags || []).find((t) => t.id === tag.id);
            if (already) return task;
            return { ...task, tags: [...(task.tags || []), tag] };
          }),
        }));
      }
    } else if (eventType === 'DELETE') {
      set((s) => ({
        tasks: s.tasks.map((task) => {
          if (task.id !== oldRow.task_id) return task;
          return {
            ...task,
            tags: (task.tags || []).filter((t) => t.id !== oldRow.tag_id),
          };
        }),
      }));
    }
  },

  handleRealtimeSubtask: (payload) => {
    const { eventType, new: newRow, old: oldRow } = payload;

    if (eventType === 'INSERT') {
      set((s) => ({
        tasks: s.tasks.map((task) => {
          if (task.id !== newRow.task_id) return task;
          const already = (task.subtasks || []).find((st) => st.id === newRow.id);
          if (already) return task;
          return { ...task, subtasks: [...(task.subtasks || []), newRow] };
        }),
      }));
    } else if (eventType === 'UPDATE') {
      set((s) => ({
        tasks: s.tasks.map((task) => {
          if (task.id !== newRow.task_id) return task;
          return {
            ...task,
            subtasks: (task.subtasks || []).map((st) =>
              st.id === newRow.id ? newRow : st
            ),
          };
        }),
      }));
    } else if (eventType === 'DELETE') {
      set((s) => ({
        tasks: s.tasks.map((task) => {
          if (task.id !== oldRow.task_id) return task;
          return {
            ...task,
            subtasks: (task.subtasks || []).filter((st) => st.id !== oldRow.id),
          };
        }),
      }));
    }
  },
}));

export default useStore;
