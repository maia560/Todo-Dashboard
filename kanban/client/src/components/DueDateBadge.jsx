export default function DueDateBadge({ dueDate }) {
  if (!dueDate) return null;

  const now = new Date();
  const hasTime = dueDate.includes('T');
  const due = hasTime ? new Date(dueDate) : new Date(dueDate + 'T23:59:59');

  const diffMs = due - now;
  const diffHours = diffMs / (1000 * 60 * 60);

  let colorClass = 'text-text-muted';  // default — due later
  let bgClass = '';
  let glowStyle = {};

  if (diffMs < 0) {
    // Overdue
    colorClass = 'text-danger';
    bgClass = 'bg-danger/10';
    glowStyle = { boxShadow: '0 0 8px 2px rgba(239, 108, 108, 0.4)' };
  } else if (diffHours <= 48) {
    // Due within 48h
    colorClass = 'text-danger';
    bgClass = 'bg-danger/10';
    glowStyle = { boxShadow: '0 0 8px 2px rgba(239, 108, 108, 0.35)' };
  }

  // Format display
  const dueObj = hasTime ? new Date(dueDate) : new Date(dueDate + 'T00:00:00');
  const isToday = dueObj.toDateString() === now.toDateString();
  const isTomorrow = dueObj.toDateString() === new Date(now.getTime() + 86400000).toDateString();

  let label;
  if (diffMs < 0) {
    label = 'Overdue';
  } else if (isToday) {
    label = hasTime
      ? `Today ${dueObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
      : 'Today';
  } else if (isTomorrow) {
    label = hasTime
      ? `Tomorrow ${dueObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
      : 'Tomorrow';
  } else {
    label = dueObj.toLocaleDateString([], { month: 'short', day: 'numeric' });
    if (hasTime) {
      label += ` ${dueObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
  }

  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${colorClass} ${bgClass}`} style={glowStyle}>
      <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24"
        fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
      {label}
    </span>
  );
}