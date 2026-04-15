import { useState } from 'react';
import { createMember, deleteMember } from '../api';

const PRESET_COLORS = [
  '#6366f1', '#ec4899', '#10b981', '#f59e0b',
  '#3b82f6', '#ef4444', '#8b5cf6', '#14b8a6',
];

/**
 * Side-panel / modal to add and remove family members.
 *
 * @param {{
 *   members: { id: string, name: string, color: string }[],
 *   onClose: () => void,
 *   onChanged: () => void,
 * }} props
 */
export default function ManageMembers({ members, onClose, onChanged }) {
  const [name, setName] = useState('');
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleAdd(e) {
    e.preventDefault();
    if (!name.trim()) { setError('Name is required'); return; }
    setSaving(true);
    setError('');
    try {
      await createMember({ name: name.trim(), color });
      setName('');
      onChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id, memberName) {
    if (!confirm(`Remove ${memberName}? Their tasks will also be deleted.`)) return;
    await deleteMember(id);
    onChanged();
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-800">Family Members</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">×</button>
        </div>

        <div className="px-6 py-5 flex flex-col gap-5">
          {/* Existing members */}
          <ul className="divide-y divide-slate-100">
            {members.length === 0 && (
              <li className="py-4 text-center text-slate-400 text-sm">No members yet</li>
            )}
            {members.map((m) => (
              <li key={m.id} className="flex items-center gap-3 py-2.5">
                <span
                  className="w-5 h-5 rounded-full shrink-0"
                  style={{ backgroundColor: m.color }}
                />
                <span className="flex-1 text-sm font-medium text-slate-700">{m.name}</span>
                <button
                  onClick={() => handleDelete(m.id, m.name)}
                  className="text-xs text-red-400 hover:text-red-600"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>

          {/* Add new member */}
          <form onSubmit={handleAdd} className="border-t border-slate-100 pt-4 flex flex-col gap-3">
            <h3 className="text-sm font-semibold text-slate-600">Add member</h3>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name"
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
            <div>
              <p className="text-xs text-slate-500 mb-1.5">Column colour</p>
              <div className="flex gap-2 flex-wrap">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className="w-7 h-7 rounded-full border-2 transition-transform hover:scale-110"
                    style={{
                      backgroundColor: c,
                      borderColor: color === c ? '#1e293b' : 'transparent',
                    }}
                  />
                ))}
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-7 h-7 rounded-full cursor-pointer border border-slate-200"
                  title="Custom colour"
                />
              </div>
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 self-end"
            >
              {saving ? 'Adding…' : 'Add Member'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
