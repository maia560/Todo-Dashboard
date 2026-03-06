import useStore from '../store';

export default function TagFilter() {
  const tags = useStore((s) => s.tags);
  const filterTagIds = useStore((s) => s.filterTagIds);
  const toggleTagFilter = useStore((s) => s.toggleTagFilter);
  const clearTagFilters = useStore((s) => s.clearTagFilters);

  if (tags.length === 0) return null;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {tags.map((tag) => {
        const active = filterTagIds.includes(tag.id);
        return (
          <button
            key={tag.id}
            onClick={() => toggleTagFilter(tag.id)}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all border ${
              active
                ? 'border-transparent text-white'
                : 'border-column-border text-text-secondary hover:border-text-muted'
            }`}
            style={active ? { backgroundColor: tag.color } : {}}
          >
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: tag.color }}
            />
            {tag.name}
          </button>
        );
      })}
      {filterTagIds.length > 0 && (
        <button
          onClick={clearTagFilters}
          className="text-xs text-text-muted hover:text-text-secondary transition-colors px-1"
        >
          Clear
        </button>
      )}
    </div>
  );
}
