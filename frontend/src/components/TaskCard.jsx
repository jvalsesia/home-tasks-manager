import { format, parseISO } from 'date-fns';
import { deleteTask } from '../api';

function formatDuration(minutes) {
  if (!minutes || minutes <= 0) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/**
 * A compact card rendered inside a grid cell.
 *
 * Height is proportional to duration:
 *   cardHeight = (duration_minutes / 60) * hourHeight
 * Minimum 36 px so very short tasks remain readable.
 * For tasks longer than 60 min the card overflows into the rows below —
 * the parent cell must have overflow:visible for this to work.
 *
 * @param {{
 *   task: object,
 *   color: string,
 *   hourHeight: number,
 *   onDeleted: () => void,
 * }} props
 */
export default function TaskCard({ task, color = '#6366f1', hourHeight = 64, onDeleted }) {
  const cardHeight = Math.max(36, ((task.duration_minutes ?? 30) / 60) * hourHeight);

  async function handleDelete() {
    if (!confirm(`Delete "${task.description}"?`)) return;
    await deleteTask(task.id);
    onDeleted();
  }

  return (
    <div
      className="group relative rounded-lg px-3 py-1.5 shadow-sm hover:shadow-md transition-shadow text-left border-l-4 overflow-hidden"
      style={{
        height: cardHeight,
        backgroundColor: `${color}1a`,
        borderColor: color,
        borderTopColor:    'transparent',
        borderRightColor:  'transparent',
        borderBottomColor: 'transparent',
      }}
    >
      <p className="text-sm font-medium text-slate-800 leading-snug pr-5 truncate">
        {task.description}
      </p>
      {cardHeight >= 48 && (
        <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1.5 flex-wrap">
          <span>{format(parseISO(task.scheduled_at), 'HH:mm')}</span>
          {formatDuration(task.duration_minutes) && (
            <span className="text-slate-500">⏱ {formatDuration(task.duration_minutes)}</span>
          )}
          {task.alarm_minutes > 0 && (
            <span className="text-amber-500">⏰ {task.alarm_minutes}m</span>
          )}
        </p>
      )}
      <button
        onClick={handleDelete}
        title="Delete task"
        className="absolute top-1 right-1 hidden group-hover:flex items-center justify-center w-5 h-5 rounded-full bg-red-100 text-red-500 hover:bg-red-200 text-xs leading-none"
      >
        ×
      </button>
    </div>
  );
}
