// Empty string = relative URLs (nginx reverse proxy in Docker).
// Set VITE_API_BASE=http://localhost:3000 in .env.local for local dev.
const BASE = import.meta.env.VITE_API_BASE ?? '';

// ── Members ──────────────────────────────────────────────────────────────────

export async function fetchMembers() {
  const res = await fetch(`${BASE}/api/members`);
  if (!res.ok) throw new Error('Failed to fetch members');
  return res.json();
}

export async function createMember({ name, color }) {
  const res = await fetch(`${BASE}/api/members`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, color }),
  });
  if (!res.ok) throw new Error('Failed to create member');
  return res.json();
}

export async function deleteMember(id) {
  const res = await fetch(`${BASE}/api/members/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete member');
}

// ── Tasks ─────────────────────────────────────────────────────────────────────

/**
 * @param {{ date?: string, member_id?: string }} filters
 * date format: "YYYY-MM-DD"
 */
export async function fetchTasks(filters = {}) {
  const params = new URLSearchParams();
  if (filters.date) params.set('date', filters.date);
  if (filters.member_id) params.set('member_id', filters.member_id);
  const qs = params.toString() ? `?${params}` : '';
  const res = await fetch(`${BASE}/api/tasks${qs}`);
  if (!res.ok) throw new Error('Failed to fetch tasks');
  return res.json();
}

/**
 * @param {{ member_id: string, description: string, scheduled_at: string, alarm_minutes?: number }} task
 * scheduled_at format: "YYYY-MM-DDTHH:MM:SS"
 */
export async function createTask(task) {
  const res = await fetch(`${BASE}/api/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(task),
  });
  if (!res.ok) {
    const msg = await res.text();
    throw new Error(msg || 'Failed to create task');
  }
  return res.json();
}

export async function deleteTask(id) {
  const res = await fetch(`${BASE}/api/tasks/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete task');
}
