import { useState } from 'react';
import useStore from '../store';

export default function TagManager({ isOpen, onClose }) {
  const tags = useStore((s) => s.tags);
  const createTag = useStore((s) => s.createTag);
  const updateTag = useStore((s) => s.updateTag);
  const deleteTag = useStore((s) => s.deleteTag);

  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#6c8eef');
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');

  if (!isOpen) return null;

  const handleCreate = async () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    const tag = await createTag(trimmed, newColor);
    if (tag) {
      setNewName('');
      setNewColor('#6c8eef');
    }
  };

  const handleCreateKeyDown = (e) => {
    if (e.key === 'Enter') handleCreate();
    if (e.key === 'Escape') onClose();
  };

  const startEdit = (tag) => {
    setEditingId(tag.id);
    setEditName(tag.name);
    setEditColor(tag.color);
  };

  const handleSaveEdit = async () => {
    if (!editName.trim()) return;
    await updateTag(editingId, { name: editName.trim(), color: editColor });
    setEditingId(null);
  };

  const handleEditKeyDown = (e) => {
    if (e.key === 'Enter') handleSaveEdit();
    if (e.key === 'Escape') setEditingId(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-card-bg border border-card-border rounded-xl w-full max-w-md mx-4 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-column-border">
          <h2 className="text-base font-semibold text-text-primary">Manage Tags</h2>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-text-primary transition-colors p-1 rounded"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Create new tag */}
        <div className="px-5 py-4 border-b border-column-border">
          <div className="flex gap-2 items-center">
            <input
              type="color"
              value={newColor}
              onChange={(e) => setNewColor(e.target.value)}
              className="w-8 h-8 rounded cursor-pointer border border-input-border bg-transparent shrink-0"
              title="Pick color"
            />
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={handleCreateKeyDown}
              placeholder="New tag name..."
              className="flex-1 bg-input-bg border border-input-border rounded-lg px-3 py-1.5 text-sm text-text-primary placeholder-text-muted outline-none focus:border-accent-todo transition-colors"
            />
            <button
              onClick={handleCreate}
              disabled={!newName.trim()}
              className="px-3 py-1.5 text-sm font-medium rounded-lg bg-accent-todo text-white disabled:opacity-40 hover:opacity-90 transition-opacity shrink-0"
            >
              Add
            </button>
          </div>
        </div>

        {/* Tag list */}
        <div className="px-5 py-3 max-h-64 overflow-y-auto">
          {tags.length === 0 && (
            <p className="text-sm text-text-muted text-center py-4">No tags yet. Create one above.</p>
          )}
          {tags.map((tag) => (
            <div key={tag.id} className="flex items-center gap-2 py-2 group">
              {editingId === tag.id ? (
                <>
                  <input
                    type="color"
                    value={editColor}
                    onChange={(e) => setEditColor(e.target.value)}
                    className="w-8 h-8 rounded cursor-pointer border border-input-border bg-transparent shrink-0"
                  />
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={handleEditKeyDown}
                    onBlur={handleSaveEdit}
                    autoFocus
                    className="flex-1 bg-input-bg border border-input-border rounded px-2 py-1 text-sm text-text-primary outline-none focus:border-accent-todo transition-colors"
                  />
                  <button
                    onClick={handleSaveEdit}
                    className="text-accent-done hover:opacity-80 transition-opacity p-1"
                    title="Save"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
                      fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </button>
                </>
              ) : (
                <>
                  <span
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: tag.color }}
                  />
                  <span className="flex-1 text-sm text-text-primary">{tag.name}</span>
                  <button
                    onClick={() => startEdit(tag)}
                    className="opacity-0 group-hover:opacity-100 text-text-muted hover:text-text-primary transition-all p-1"
                    title="Edit"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24"
                      fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => deleteTag(tag.id)}
                    className="opacity-0 group-hover:opacity-100 text-text-muted hover:text-danger transition-all p-1"
                    title="Delete"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24"
                      fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}