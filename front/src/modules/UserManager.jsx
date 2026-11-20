import React, { useState, useEffect } from 'react';

const API = 'http://localhost:3000';

export default function UserManager() {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionMsg, setActionMsg] = useState('');

  // Individual Limit Modal State
  const [editingUser, setEditingUser] = useState(null);
  const [limitInput, setLimitInput] = useState('');
  const [isSavingLimit, setIsSavingLimit] = useState(false);

  // New Member Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [newFirstName, setNewFirstName] = useState('');
  const [newLastName, setNewLastName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newRoleId, setNewRoleId] = useState(3); // 3 = Student, 2 = Teacher
  const [newCustomLimit, setNewCustomLimit] = useState('');
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [addError, setAddError] = useState('');

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setAddError('');
    setIsAddingUser(true);

    try {
      const res = await fetch(`${API}/api/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: newFirstName.trim(),
          last_name: newLastName.trim(),
          email: newEmail.trim(),
          phone: newPhone.trim(),
          role_id: Number(newRoleId),
          custom_max_books: newCustomLimit ? parseInt(newCustomLimit, 10) : null,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setActionMsg(`✓ Member registered successfully! [${data.first_name} ${data.last_name}] can now log in using email: ${data.email}`);
        setShowAddModal(false);
        setNewFirstName('');
        setNewLastName('');
        setNewEmail('');
        setNewPhone('');
        setNewRoleId(3);
        setNewCustomLimit('');
        loadData();
      } else {
        setAddError(data.error || 'Failed to register new member.');
      }
    } catch (err) {
      setAddError('Network error connecting to library backend.');
    } finally {
      setIsAddingUser(false);
    }
  };

  const loadData = async () => {
    try {
      const [uRes, rRes] = await Promise.all([
        fetch(`${API}/api/users`),
        fetch(`${API}/api/roles`),
      ]);
      if (uRes.ok) setUsers(await uRes.json());
      if (rRes.ok) setRoles(await rRes.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRoleChange = async (userId, newRoleId) => {
    setActionMsg('');
    try {
      const res = await fetch(`${API}/api/users/${userId}/role`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role_id: Number(newRoleId) }),
      });
      if (res.ok) {
        setActionMsg(`✓ Member #${userId} policy role successfully updated.`);
        loadData();
      } else {
        setActionMsg('✕ Failed to update member role');
      }
    } catch (e) {
      setActionMsg('✕ Network error updating role');
    }
  };

  const handleStatusToggle = async (userId, currentStatus) => {
    const nextStatus = currentStatus === 'active' ? 'suspended' : 'active';
    setActionMsg('');
    try {
      const res = await fetch(`${API}/api/users/${userId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account_status: nextStatus }),
      });
      if (res.ok) {
        setActionMsg(`✓ Member #${userId} account status set to [${nextStatus}].`);
        loadData();
      } else {
        setActionMsg('✕ Failed to update status');
      }
    } catch (e) {
      setActionMsg('✕ Network error updating status');
    }
  };

  const handleSaveCustomLimit = async (e) => {
    if (e) e.preventDefault();
    if (!editingUser) return;
    const parsed = parseInt(limitInput, 10);
    if (isNaN(parsed) || parsed < 1) {
      setActionMsg('✕ Please provide a valid positive number for the borrow limit.');
      return;
    }

    setIsSavingLimit(true);
    setActionMsg('');
    try {
      const res = await fetch(`${API}/api/users/${editingUser.user_id}/limit`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ max_books_allowed: parsed }),
      });
      if (res.ok) {
        setActionMsg(`✓ Custom borrow limit of ${parsed} books applied to ${editingUser.first_name} ${editingUser.last_name}.`);
        setEditingUser(null);
        loadData();
      } else {
        const data = await res.json();
        setActionMsg(`✕ ${data.error || 'Failed to update borrow limit.'}`);
      }
    } catch (err) {
      setActionMsg('✕ Network error updating borrow limit.');
    } finally {
      setIsSavingLimit(false);
    }
  };

  const handleResetLimit = async () => {
    if (!editingUser) return;
    setIsSavingLimit(true);
    setActionMsg('');
    try {
      const res = await fetch(`${API}/api/users/${editingUser.user_id}/limit`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ max_books_allowed: null }),
      });
      if (res.ok) {
        setActionMsg(`✓ Borrow limit for ${editingUser.first_name} ${editingUser.last_name} reset to role default (${editingUser.default_max_books} books).`);
        setEditingUser(null);
        loadData();
      } else {
        const data = await res.json();
        setActionMsg(`✕ ${data.error || 'Failed to reset limit.'}`);
      }
    } catch (err) {
      setActionMsg('✕ Network error resetting borrow limit.');
    } finally {
      setIsSavingLimit(false);
    }
  };

  const filteredUsers = users.filter((u) => {
    const full = `${u.first_name} ${u.last_name} ${u.email}`.toLowerCase();
    return full.includes(searchTerm.toLowerCase());
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-8 py-10 font-sans">
      
      {/* Header & Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 pb-6 border-b border-stone-200/80 gap-4">
        <div className="max-w-2xl">
          <div className="inline-block text-[10px] font-bold uppercase tracking-wider text-[#881337] bg-rose-50 border border-rose-200 px-2.5 py-0.5 rounded-full mb-1">
            Access Control & Patron Accounts
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-stone-900 tracking-tight leading-tight">
            Member Profiles & Borrow Limits
          </h1>
          <p className="text-stone-800 font-medium text-sm mt-1.5">
            Register students or teachers, manage roles, and customize individual borrow quotas.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="bg-[#881337] hover:bg-[#700f2b] active:scale-[0.99] text-white font-semibold text-xs py-2.5 px-5 rounded-xl shadow-xs hover:shadow transition-all flex items-center gap-2 shrink-0 self-start sm:self-auto"
        >
          <span>+ Register New Member</span>
        </button>
      </div>

      {actionMsg && (
        <div className={`mb-6 p-4 rounded-2xl text-xs font-medium flex items-center justify-between border ${
          actionMsg.startsWith('✓')
            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
            : 'bg-rose-50 text-rose-800 border-rose-200'
        }`}>
          <span>{actionMsg}</span>
          <button onClick={() => setActionMsg('')} className="text-stone-400 hover:text-stone-700 font-bold ml-4">✕</button>
        </div>
      )}

      {/* Search Bar */}
      <div className="mb-6 max-w-sm">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Filter by name, email, or user ID..."
          className="w-full bg-white border border-stone-200 rounded-full px-4 py-2.5 text-xs text-stone-900 focus:outline-none focus:border-[#881337] focus:ring-2 focus:ring-rose-500/10 placeholder:text-stone-400 shadow-2xs"
        />
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-3xl border border-stone-200/80 shadow-2xs overflow-hidden">
        <div className="p-6 border-b border-stone-100 flex items-center justify-between">
          <h2 className="font-serif text-lg font-bold text-stone-900">
            Registered Patrons & Staff
          </h2>
          <span className="text-xs text-stone-400">{filteredUsers.length} members</span>
        </div>

        {loading ? (
          <div className="py-16 text-center">
            <div className="inline-block animate-spin w-8 h-8 border-2 border-[#881337] border-t-transparent rounded-full mb-3"></div>
            <p className="text-sm font-medium text-stone-500">Loading directory...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-stone-50/70 border-b border-stone-100 text-stone-500 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3.5 px-6 font-semibold">User ID</th>
                  <th className="py-3.5 px-4 font-semibold">Name & Email</th>
                  <th className="py-3.5 px-4 font-semibold">Phone</th>
                  <th className="py-3.5 px-4 font-semibold">Assigned Policy Role</th>
                  <th className="py-3.5 px-4 font-semibold">Borrow Limit</th>
                  <th className="py-3.5 px-4 font-semibold">Account Status</th>
                  <th className="py-3.5 px-6 font-semibold text-right">Access Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filteredUsers.map((u) => {
                  const isActive = u.account_status === 'active';
                  const hasCustomLimit = u.custom_max_books !== null && u.custom_max_books !== undefined;
                  return (
                    <tr key={u.user_id} className="hover:bg-stone-50/50 transition-colors">
                      <td className="py-4 px-6 font-mono text-[11px] text-stone-500 font-semibold">
                        #{u.user_id}
                      </td>
                      <td className="py-4 px-4 font-medium text-stone-900">
                        <div className="font-semibold">{u.first_name} {u.last_name}</div>
                        <div className="text-[11px] text-stone-400 font-normal">{u.email}</div>
                      </td>
                      <td className="py-4 px-4 text-stone-500 font-mono text-[11px]">
                        {u.phone || '—'}
                      </td>
                      <td className="py-4 px-4">
                        <select
                          value={u.role_id}
                          onChange={(e) => handleRoleChange(u.user_id, e.target.value)}
                          className="bg-stone-50 border border-stone-200 rounded-xl px-2.5 py-1 text-xs font-medium text-stone-800 focus:outline-none focus:border-[#881337]"
                        >
                          {roles.filter(r => r.role_name !== 'librarian').map((r) => (
                            <option key={r.role_id} value={r.role_id}>
                              {r.role_name.charAt(0).toUpperCase() + r.role_name.slice(1)} ({r.max_books_allowed} books / {r.borrow_duration_days}d)
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2.5">
                          <div>
                            <div className="font-semibold text-stone-900">
                              {u.effective_max_books} books
                            </div>
                            {hasCustomLimit ? (
                              <span className="inline-block mt-0.5 text-[9px] uppercase tracking-wider font-bold text-rose-800 bg-rose-50 border border-rose-200/80 rounded px-1.5 py-0.5">
                                Custom Override
                              </span>
                            ) : (
                              <span className="inline-block mt-0.5 text-[9px] uppercase tracking-wider text-stone-400 font-medium">
                                Role Default ({u.default_max_books})
                              </span>
                            )}
                          </div>
                          <button
                            onClick={() => {
                              setEditingUser(u);
                              setLimitInput(hasCustomLimit ? String(u.custom_max_books) : String(u.effective_max_books));
                            }}
                            className="text-[11px] font-medium text-stone-600 hover:text-stone-900 bg-stone-50 hover:bg-stone-100 rounded-lg px-2.5 py-1 border border-stone-200 transition-colors"
                            title="Configure individual borrow limit"
                          >
                            Edit
                          </button>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            isActive
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                        >
                          {u.account_status}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <button
                          onClick={() => handleStatusToggle(u.user_id, u.account_status)}
                          className={`rounded-full text-[11px] font-medium px-3.5 py-1 border transition-all ${
                            isActive
                              ? 'border-stone-200 hover:border-rose-300 hover:bg-rose-50 text-stone-600 hover:text-rose-700'
                              : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                          }`}
                        >
                          {isActive ? 'Suspend' : 'Activate'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Borrow Limit Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 bg-stone-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full border border-stone-200 shadow-2xl p-6 sm:p-7 animate-in fade-in zoom-in duration-150">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="font-serif text-xl font-bold text-stone-900">
                  Configure Borrow Limit
                </h3>
              </div>
              <button
                onClick={() => setEditingUser(null)}
                className="text-stone-400 hover:text-stone-700 font-bold p-1"
              >
                ✕
              </button>
            </div>

            <div className="p-4 bg-stone-50 rounded-2xl border border-stone-100 mb-5 text-xs">
              <div className="font-semibold text-stone-900 text-sm">
                {editingUser.first_name} {editingUser.last_name}
              </div>
              <div className="text-stone-500 mt-0.5">{editingUser.email}</div>
              <div className="mt-2 pt-2 border-t border-stone-200/60 flex items-center justify-between text-stone-600">
                <span>Role: <strong className="text-stone-900 capitalize">{editingUser.role_name}</strong></span>
                <span>Role Default: <strong className="text-stone-900">{editingUser.default_max_books} books</strong></span>
              </div>
            </div>

            <form onSubmit={handleSaveCustomLimit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1.5">
                  Individual Maximum Books Allowed
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={limitInput}
                    onChange={(e) => setLimitInput(e.target.value)}
                    required
                    className="w-full bg-white border border-stone-300 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-stone-900 focus:outline-none focus:border-[#881337] focus:ring-2 focus:ring-rose-500/10 shadow-2xs"
                    placeholder="e.g. 5, 8, 15"
                  />
                  <span className="absolute right-3.5 top-2.5 text-xs text-stone-400 font-medium">books</span>
                </div>
                <p className="text-[11px] text-stone-400 mt-1.5 leading-relaxed">
                  Setting this overrides the standard {editingUser.role_name} policy limit ({editingUser.default_max_books} books) specifically for this member.
                </p>
              </div>

              <div className="pt-2 flex flex-col gap-2">
                <button
                  type="submit"
                  disabled={isSavingLimit}
                  className="w-full bg-[#881337] hover:bg-[#9f1239] text-white font-medium text-xs py-2.5 rounded-full transition-colors shadow-xs disabled:opacity-50"
                >
                  {isSavingLimit ? 'Saving...' : 'Save Custom Limit'}
                </button>

                {editingUser.custom_max_books !== null && editingUser.custom_max_books !== undefined && (
                  <button
                    type="button"
                    disabled={isSavingLimit}
                    onClick={handleResetLimit}
                    className="w-full bg-stone-100 hover:bg-stone-200 text-stone-700 font-medium text-xs py-2 rounded-full transition-colors disabled:opacity-50"
                  >
                    Reset to Role Default ({editingUser.default_max_books} books)
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="w-full text-stone-500 hover:text-stone-800 text-xs py-1.5 text-center font-medium"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Register New Member Modal (Admin) */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs font-sans animate-fade-in">
          <div className="bg-white w-full max-w-lg rounded-2xl border border-stone-200 shadow-2xl overflow-hidden flex flex-col">
            
            {/* Header */}
            <div className="px-6 py-4 bg-stone-50 border-b border-stone-200 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#881337] block">
                  Institutional Registration
                </span>
                <h3 className="text-base font-bold text-stone-900">
                  Register New Student or Teacher
                </h3>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="w-8 h-8 rounded-full border border-stone-300 text-stone-500 hover:text-stone-900 hover:bg-stone-200/60 flex items-center justify-center text-xs"
              >
                ✕
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleCreateUser} className="p-6 space-y-4">
              {addError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl font-semibold">
                  {addError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-stone-700 mb-1">
                    First Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={newFirstName}
                    onChange={(e) => setNewFirstName(e.target.value)}
                    placeholder="e.g. Dr. Rajesh or Aarav"
                    className="w-full bg-stone-50 border border-stone-300 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#881337]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-stone-700 mb-1">
                    Last Name
                  </label>
                  <input
                    type="text"
                    value={newLastName}
                    onChange={(e) => setNewLastName(e.target.value)}
                    placeholder="e.g. Sharma"
                    className="w-full bg-stone-50 border border-stone-300 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#881337]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-stone-700 mb-1">
                  Institutional Email (Passwordless Login Key) *
                </label>
                <input
                  type="email"
                  required
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="e.g. prof.rajesh@college.edu or student123@college.edu"
                  className="w-full bg-stone-50 border border-stone-300 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#881337]"
                />
                <p className="text-[11px] text-stone-500 mt-1">
                  The user can immediately log into the portal using only this email address.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-stone-700 mb-1">
                    Phone Contact
                  </label>
                  <input
                    type="tel"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    placeholder="e.g. 9876543210"
                    className="w-full bg-stone-50 border border-stone-300 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#881337]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-stone-700 mb-1">
                    Member Role *
                  </label>
                  <select
                    value={newRoleId}
                    onChange={(e) => setNewRoleId(Number(e.target.value))}
                    className="w-full bg-stone-50 border border-stone-300 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#881337] font-medium"
                  >
                    <option value={3}>Student (Quota: 3 books, 14 days)</option>
                    <option value={2}>Teacher / Faculty (Quota: 10 books, 30 days)</option>
                    <option value={1}>Administrator</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-stone-700 mb-1">
                  Custom Borrow Limit (Optional Override)
                </label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={newCustomLimit}
                  onChange={(e) => setNewCustomLimit(e.target.value)}
                  placeholder="Leave empty to use standard role default"
                  className="w-full bg-stone-50 border border-stone-300 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#881337]"
                />
              </div>

              <div className="pt-3 border-t border-stone-100 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-xs text-stone-600 hover:text-stone-900 font-semibold"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isAddingUser}
                  className="bg-[#881337] hover:bg-[#700f2b] text-white px-5 py-2.5 rounded-xl text-xs font-semibold shadow-xs hover:shadow transition-all disabled:opacity-50"
                >
                  {isAddingUser ? 'Registering...' : 'Register Member Account →'}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

    </div>
  );
}
