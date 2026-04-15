import { format, parseISO } from 'date-fns';

function formatDuration(minutes) {
  if (!minutes || minutes <= 0) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/**
 * Centered modal popups — one per alarm, stacked vertically.
 * Each popup's header is tinted with the member's color.
 *
 * @param {{
 *   alarms: { task: object, memberName: string, memberColor: string }[],
 *   onDismiss: (taskId: string) => void,
 * }} props
 */
export default function AlarmBanner({ alarms, onDismiss }) {
  if (alarms.length === 0) return null;

  return (
    <>
      {/* Backdrop — dims the page, click anywhere to dismiss all */}
      <div
        className="fixed inset-0 bg-black/40 z-40"
        onClick={() => alarms.forEach((a) => onDismiss(a.task.id))}
      />

      {/* Stack of popup cards, centered on screen */}
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 pointer-events-none p-6">
        {alarms.map((alarm) => {
          const color = alarm.memberColor ?? '#6366f1';
          return (
            <div
              key={alarm.task.id}
              className="pointer-events-auto w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl ring-1 ring-black/10"
            >
              {/* Colored header */}
              <div
                className="px-5 py-4 flex items-center gap-3"
                style={{ backgroundColor: color }}
              >
                <span className="text-2xl animate-bounce">⏰</span>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-bold text-base leading-tight truncate">
                    {alarm.task.description}
                  </p>
                  <p className="text-white/80 text-xs mt-0.5">{alarm.memberName}</p>
                </div>
                <button
                  onClick={() => onDismiss(alarm.task.id)}
                  className="shrink-0 w-7 h-7 rounded-full bg-white/20 hover:bg-white/40 text-white flex items-center justify-center text-lg leading-none transition-colors"
                  title="Dismiss"
                >
                  ×
                </button>
              </div>

              {/* White body */}
              <div className="bg-white px-5 py-4 flex flex-col gap-1">
                <div className="flex items-center gap-2 text-sm text-slate-700">
                  <span style={{ color }}>🕐</span>
                  <span>
                    Scheduled at{' '}
                    <strong>{format(parseISO(alarm.task.scheduled_at), 'HH:mm')}</strong>
                  </span>
                </div>
                {formatDuration(alarm.task.duration_minutes) && (
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <span>⏱</span>
                    <span>Duration: {formatDuration(alarm.task.duration_minutes)}</span>
                  </div>
                )}
                <div className="mt-3 flex justify-end">
                  <button
                    onClick={() => onDismiss(alarm.task.id)}
                    className="px-4 py-1.5 rounded-lg text-sm font-medium text-white transition-opacity hover:opacity-90"
                    style={{ backgroundColor: color }}
                  >
                    Got it
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
