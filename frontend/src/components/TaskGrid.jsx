import { parseISO } from 'date-fns';
import TaskCard from './TaskCard';

// One row per hour, 00 through 23.
const HOURS = Array.from({ length: 24 }, (_, i) =>
  String(i).padStart(2, '0') + ':00'
);

// Pixels allocated to each hour row. TaskCard uses this same constant to
// compute its height so that 60 min = one full row, 30 min = half a row, etc.
export const HOUR_HEIGHT_PX = 64;

/**
 * Schedule grid — always shows all 24 hours.
 *
 * Layout:
 *   | Time  | Member 1 | Member 2 | … |
 *   | 07:00 |  task    |          |   |
 *   | 08:00 |          |  task    |   |
 *
 * Each row has a fixed height of HOUR_HEIGHT_PX. Task cards taller than one
 * row (duration > 60 min) visually overflow into the rows below — the cells
 * use overflow:visible so this works without breaking the grid structure.
 *
 * @param {{
 *   members: { id: string, name: string, color: string }[],
 *   tasks:   { id: string, member_id: string, scheduled_at: string }[],
 *   onRefresh: () => void,
 * }} props
 */
export default function TaskGrid({ members, tasks, onRefresh }) {
  // Build lookup:  hourKey ("HH:00") → memberId → task[]
  const slotMap = {};
  for (const task of tasks) {
    const dt = parseISO(task.scheduled_at);
    const key = String(dt.getHours()).padStart(2, '0') + ':00';
    if (!slotMap[key]) slotMap[key] = {};
    if (!slotMap[key][task.member_id]) slotMap[key][task.member_id] = [];
    slotMap[key][task.member_id].push(task);
  }

  // CSS grid: fixed 72 px time column + equal-width column per member
  const gridTemplate = `72px repeat(${Math.max(members.length, 1)}, minmax(0, 1fr))`;

  return (
    <div className="overflow-auto rounded-xl border border-slate-200 shadow-sm bg-white">

      {/* ── Header row ───────────────────────────────────────────────── */}
      <div
        className="grid sticky top-0 z-10 border-b border-slate-200 bg-slate-50"
        style={{ gridTemplateColumns: gridTemplate }}
      >
        <div className="px-3 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">
          Time
        </div>
        {members.length === 0 ? (
          <div className="px-3 py-3 text-sm text-slate-400 italic">
            No members yet
          </div>
        ) : (
          members.map((m) => (
            <div
              key={m.id}
              className="px-3 py-3 text-sm font-semibold text-white truncate border-l border-white/20"
              style={{ backgroundColor: m.color }}
            >
              {m.name}
            </div>
          ))
        )}
      </div>

      {/* ── Hour rows ─────────────────────────────────────────────────── */}
      {HOURS.map((hour) => {
        const hasAnyTask = members.some(
          (m) => (slotMap[hour]?.[m.id]?.length ?? 0) > 0
        );

        return (
          <div
            key={hour}
            className={[
              'grid border-b border-slate-100 last:border-0',
              hasAnyTask ? 'bg-white' : 'bg-slate-50/30',
            ].join(' ')}
            style={{
              gridTemplateColumns: gridTemplate,
              height: HOUR_HEIGHT_PX,   // fixed row height — cards overflow visually
              overflow: 'visible',
            }}
          >
            {/* Time label */}
            <div className="px-3 text-xs font-mono text-slate-400 self-start pt-2 border-r border-slate-100">
              {hour}
            </div>

            {/* One cell per member — overflow:visible lets tall cards bleed down */}
            {members.map((member) => {
              const cellTasks = slotMap[hour]?.[member.id] ?? [];
              return (
                <div
                  key={member.id}
                  className="px-2 pt-1 flex flex-col gap-1 border-l border-slate-100"
                  style={{ overflow: 'visible', position: 'relative' }}
                >
                  {cellTasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      color={member.color}
                      hourHeight={HOUR_HEIGHT_PX}
                      onDeleted={onRefresh}
                    />
                  ))}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
