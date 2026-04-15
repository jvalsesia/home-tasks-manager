import { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';

import { fetchMembers, fetchTasks } from './api';
import { useSSE } from './hooks/useSSE';

import TaskGrid from './components/TaskGrid';
import AddTaskModal from './components/AddTaskModal';
import ManageMembers from './components/ManageMembers';
import AlarmBanner from './components/AlarmBanner';

/**
 * @typedef {{ task: object, memberName: string }} AlarmEvent
 */

export default function App() {
  const [members, setMembers] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [alarms, setAlarms] = useState(/** @type {AlarmEvent[]} */ ([]));
  const [showAddTask, setShowAddTask] = useState(false);
  const [showManageMembers, setShowManageMembers] = useState(false);

  // ── Data loading ───────────────────────────────────────────────────────────

  const loadMembers = useCallback(async () => {
    try {
      const data = await fetchMembers();
      setMembers(data);
    } catch (e) {
      console.error(e);
    }
  }, []);

  const loadTasks = useCallback(async () => {
    try {
      const data = await fetchTasks({ date: selectedDate });
      setTasks(data);
    } catch (e) {
      console.error(e);
    }
  }, [selectedDate]);

  useEffect(() => { loadMembers(); }, [loadMembers]);
  useEffect(() => { loadTasks(); }, [loadTasks]);

  // ── SSE ────────────────────────────────────────────────────────────────────

  const handleSSE = useCallback((event) => {
    if (event.type === 'tasks_changed') {
      loadMembers();
      loadTasks();
    } else if (event.type === 'alarm') {
      const member = members.find((m) => m.id === event.task.member_id);
      setAlarms((prev) => [
        ...prev.filter((a) => a.task.id !== event.task.id), // dedupe
        {
          task: event.task,
          memberName: member?.name ?? '',
          memberColor: member?.color ?? '#6366f1',
        },
      ]);
    }
  }, [loadMembers, loadTasks, members]);

  useSSE(handleSSE);

  // ── Handlers ───────────────────────────────────────────────────────────────

  function dismissAlarm(taskId) {
    setAlarms((prev) => prev.filter((a) => a.task.id !== taskId));
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top bar */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center gap-4 shadow-sm">
        <div className="flex items-center gap-2 mr-auto">
          <span className="text-2xl">🏠</span>
          <h1 className="text-xl font-bold text-slate-800">Family Tasks</h1>
        </div>

        {/* Date picker */}
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />

        {/* Actions */}
        <button
          onClick={() => setShowManageMembers(true)}
          className="px-3 py-1.5 text-sm rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700"
        >
          👨‍👩‍👧 Members
        </button>
        <button
          onClick={() => {
            if (members.length === 0) {
              alert('Add at least one family member first.');
              return;
            }
            setShowAddTask(true);
          }}
          className="px-3 py-1.5 text-sm rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 font-medium"
        >
          + Add Task
        </button>
      </header>

      {/* Grid */}
      <main className="flex-1 p-6 overflow-auto">
        <TaskGrid
          members={members}
          tasks={tasks}
          onRefresh={loadTasks}
        />
      </main>

      {/* Modals */}
      {showAddTask && (
        <AddTaskModal
          members={members}
          selectedDate={selectedDate}
          onClose={() => setShowAddTask(false)}
          onCreated={loadTasks}
        />
      )}
      {showManageMembers && (
        <ManageMembers
          members={members}
          onClose={() => setShowManageMembers(false)}
          onChanged={() => { loadMembers(); loadTasks(); }}
        />
      )}

      {/* Alarm banners */}
      <AlarmBanner alarms={alarms} onDismiss={dismissAlarm} />
    </div>
  );
}
