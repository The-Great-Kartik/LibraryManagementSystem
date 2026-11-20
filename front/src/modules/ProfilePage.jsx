import React, { useState, useEffect } from 'react';

const API = 'http://localhost:3000';

export default function ProfilePage() {
  const localUser = JSON.parse(localStorage.getItem('user') || 'null');
  const userId = localUser?.id || localUser?.user_id;

  const [profile, setProfile] = useState(null);
  const [stats, setStats] = useState({ borrows: 0, reservations: 0, unpaidFines: 0, pendingFines: 0 });
  const [conditionHistory, setConditionHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;

    const fetchProfileData = async () => {
      try {
        const [profileRes, borrowsRes, resRes, finesRes, historyRes] = await Promise.all([
          fetch(`${API}/api/users/${userId}`),
          fetch(`${API}/api/users/${userId}/borrows`),
          fetch(`${API}/api/users/${userId}/reservations`),
          fetch(`${API}/api/users/${userId}/fines`),
          fetch(`${API}/api/users/${userId}/condition-history`),
        ]);

        if (profileRes.ok) setProfile(await profileRes.json());
        
        let borrowsCount = 0;
        let reservationsCount = 0;
        let unpaidFinesTotal = 0;
        let pendingFinesCount = 0;

        if (borrowsRes.ok) {
          const borrows = await borrowsRes.json();
          borrowsCount = borrows.length;
        }
        if (resRes.ok) {
          const reservations = await resRes.json();
          reservationsCount = reservations.length;
        }
        if (finesRes.ok) {
          const fines = await finesRes.json();
          unpaidFinesTotal = fines
            .filter((f) => f.status === 'unpaid')
            .reduce((sum, f) => sum + (parseFloat(f.amount_assessed) - parseFloat(f.amount_paid || 0)), 0);
          pendingFinesCount = fines.filter((f) => f.status === 'pending_approval').length;
        }
        if (historyRes.ok) {
          setConditionHistory(await historyRes.json());
        }

        setStats({
          borrows: borrowsCount,
          reservations: reservationsCount,
          unpaidFines: unpaidFinesTotal,
          pendingFines: pendingFinesCount,
        });
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchProfileData();
  }, [userId]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <div className="inline-block animate-spin w-8 h-8 border-2 border-[#881337] border-t-transparent rounded-full mb-3"></div>
        <p className="text-sm font-medium text-stone-700">Loading user profile...</p>
      </div>
    );
  }

  const u = profile || localUser;
  const isCustomLimit = u?.custom_max_books !== null && u?.custom_max_books !== undefined;
  const meritStars = u?.merit_stars ?? 7;

  // Merit rating standing status
  const getMeritBadge = (stars) => {
    if (stars >= 7) {
      return { label: 'Pristine Standing (7/7)', class: 'bg-emerald-50 text-emerald-800 border-emerald-200' };
    }
    if (stars >= 5) {
      return { label: `Good Standing (${stars}/7)`, class: 'bg-blue-50 text-blue-800 border-blue-200' };
    }
    if (stars >= 3) {
      return { label: `Caution (${stars}/7 Stars)`, class: 'bg-amber-50 text-amber-800 border-amber-200' };
    }
    return { label: `Critical (${stars}/7 Stars Left)`, class: 'bg-rose-50 text-rose-800 border-rose-200' };
  };

  const meritBadge = getMeritBadge(meritStars);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-8 py-10 font-sans">
      
      {/* Page Title */}
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-stone-900 tracking-tight leading-tight">
          Member Profile
        </h1>
        <p className="text-stone-800 font-medium text-sm mt-1.5">
          Comprehensive registration credentials, 7-star merit standing, condition history, and active library quotas.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        
        {/* Left Column: ID Badge Card & Merit Stars */}
        <div className="md:col-span-1 space-y-6">
          
          {/* Identity Card */}
          <div className="bg-white rounded-xl border border-stone-200/90 p-6 shadow-2xs text-center">
            
            {/* Patron Avatar Circle */}
            <div className="w-20 h-20 mx-auto rounded-full bg-stone-100 border border-stone-300 flex items-center justify-center font-serif text-2xl font-bold text-[#881337] mb-4">
              {u?.first_name ? u.first_name.charAt(0) : 'U'}
              {u?.last_name ? u.last_name.charAt(0) : ''}
            </div>

            <h2 className="text-lg font-bold text-stone-900 leading-snug">
              {u?.first_name} {u?.last_name}
            </h2>
            <div className="text-xs text-stone-600 mt-0.5">{u?.email}</div>

            <div className="mt-4 pt-4 border-t border-stone-100 flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-stone-600">Patron User ID</span>
                <span className="font-mono font-bold text-stone-900 bg-stone-100 px-2 py-0.5 rounded">
                  #{u?.user_id || userId}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-stone-600">Account Role</span>
                <span className="font-semibold text-stone-900 capitalize">
                  {u?.role_name || (u?.role_id === 1 ? 'Admin' : u?.role_id === 2 ? 'Teacher' : 'Student')}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-stone-600">Role ID Index</span>
                <span className="font-mono font-bold text-stone-900">
                  {u?.role_id || (u?.role_name === 'admin' ? 1 : u?.role_name === 'teacher' ? 2 : 3)}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-stone-600">Account Status</span>
                <span className={`font-bold uppercase tracking-wider text-[10px] px-2 py-0.5 rounded ${
                  u?.account_status === 'active'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-rose-50 text-rose-800 border border-rose-200'
                }`}>
                  {u?.account_status || 'active'}
                </span>
              </div>
            </div>

          </div>

          {/* 7-Star Merit Rating System Card */}
          <div className="bg-white rounded-xl border border-stone-200/90 p-5 shadow-2xs">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-stone-700">
                Merit Rating
              </h3>
              <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${meritBadge.class}`}>
                {meritBadge.label}
              </span>
            </div>

            {/* Visual 7-Star Meter */}
            <div className="my-3 flex items-center justify-center gap-1.5 p-3 bg-[#f8fafc] border border-stone-200 rounded-lg">
              {[1, 2, 3, 4, 5, 6, 7].map((starIdx) => (
                <span
                  key={starIdx}
                  className={`text-xl transition-all ${
                    starIdx <= meritStars
                      ? 'text-amber-500 scale-105'
                      : 'text-stone-300'
                  }`}
                  title={starIdx <= meritStars ? `Star #${starIdx} Active` : `Star #${starIdx} Deducted`}
                >
                  ★
                </span>
              ))}
            </div>

            <div className="flex items-center justify-between text-xs mb-3 font-medium">
              <span className="text-stone-600">Current Standing:</span>
              <span className="font-bold text-stone-900">{meritStars} of 7 Stars</span>
            </div>

            <div className="text-[11px] text-stone-600 leading-relaxed bg-stone-50 p-2.5 rounded-lg border border-stone-200/70">
              <p className="font-semibold text-stone-800 mb-1">Merit Rules:</p>
              <ul className="list-disc pl-4 space-y-0.5 text-stone-600">
                <li><strong className="text-stone-800">Minor Damage (Bad):</strong> Deducts 1 star</li>
                <li><strong className="text-stone-800">Severe Damage (Worse):</strong> Deducts 2 stars</li>
                <li><strong className="text-stone-800">Merit Depletion:</strong> When 0 stars reached, a ₹200 fine is levied and stars restart to 7.</li>
              </ul>
            </div>
          </div>

        </div>

        {/* Right Column: Detailed Specifications, Borrow Limits & Activity */}
        <div className="md:col-span-2 space-y-6">
          
          {/* Section 1: Circulation Standing & Policy Limits */}
          <div className="bg-white rounded-xl border border-stone-200/90 p-6 shadow-2xs">
            <h3 className="text-sm font-bold uppercase tracking-wider text-stone-900 mb-4 pb-2 border-b border-stone-100">
              Circulation Rules & Policy Limits
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div className="p-3.5 bg-[#f8fafc] rounded-lg border border-stone-200">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-stone-600">
                  Borrow Allowance
                </div>
                <div className="text-xl font-bold text-[#881337] mt-1">
                  {u?.max_books_allowed || (u?.role_id === 2 ? 10 : 3)} Books
                </div>
                <div className="text-[10px] text-stone-600 mt-1">
                  {isCustomLimit ? (
                    <span className="font-semibold text-rose-800 bg-rose-50 border border-rose-200 px-1 py-0.2 rounded">
                      Custom Override
                    </span>
                  ) : (
                    'Standard Policy'
                  )}
                </div>
              </div>

              <div className="p-3.5 bg-[#f8fafc] rounded-lg border border-stone-200">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-stone-600">
                  Loan Duration
                </div>
                <div className="text-xl font-bold text-stone-900 mt-1">
                  {u?.borrow_duration_days || (u?.role_id === 2 ? 30 : 14)} Days
                </div>
                <div className="text-[10px] text-stone-600 mt-1">
                  Per checked-out title
                </div>
              </div>

              <div className="p-3.5 bg-[#f8fafc] rounded-lg border border-stone-200">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-stone-600">
                  Late Fine Rate
                </div>
                <div className="text-xl font-bold text-stone-900 mt-1">
                  ₹{u?.fine_rate_per_day || (u?.role_id === 2 ? '0.00' : '5.00')} / day
                </div>
                <div className="text-[10px] text-stone-600 mt-1">
                  Overdue penalty
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Contact Information */}
          <div className="bg-white rounded-xl border border-stone-200/90 p-6 shadow-2xs">
            <h3 className="text-sm font-bold uppercase tracking-wider text-stone-900 mb-4 pb-2 border-b border-stone-100">
              Contact & Authentication Details
            </h3>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between py-1.5 border-b border-stone-100">
                <span className="text-stone-600 font-medium">Full Name</span>
                <span className="font-semibold text-stone-900">{u?.first_name} {u?.last_name}</span>
              </div>

              <div className="flex items-center justify-between py-1.5 border-b border-stone-100">
                <span className="text-stone-600 font-medium">Institutional Email</span>
                <span className="font-mono text-stone-800">{u?.email}</span>
              </div>

              <div className="flex items-center justify-between py-1.5 border-b border-stone-100">
                <span className="text-stone-600 font-medium">Contact Phone</span>
                <span className="font-mono text-stone-800">{u?.phone || 'Not Registered'}</span>
              </div>

              <div className="flex items-center justify-between py-1.5">
                <span className="text-stone-600 font-medium">System Role Identifier</span>
                <span className="font-mono text-stone-800">ROLE_ID: {u?.role_id}</span>
              </div>
            </div>
          </div>

          {/* Section 3: Live Activity Summary */}
          <div className="bg-white rounded-xl border border-stone-200/90 p-6 shadow-2xs">
            <h3 className="text-sm font-bold uppercase tracking-wider text-stone-900 mb-4 pb-2 border-b border-stone-100">
              Current Activity Summary
            </h3>

            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="p-3 bg-stone-50 rounded-lg border border-stone-200">
                <span className="text-[10px] font-semibold uppercase text-stone-600">Active Loans</span>
                <div className="text-lg font-bold text-stone-900 mt-0.5">{stats.borrows}</div>
              </div>

              <div className="p-3 bg-stone-50 rounded-lg border border-stone-200">
                <span className="text-[10px] font-semibold uppercase text-stone-600">Waitlist Holds</span>
                <div className="text-lg font-bold text-stone-900 mt-0.5">{stats.reservations}</div>
              </div>

              <div className="p-3 bg-stone-50 rounded-lg border border-stone-200">
                <span className="text-[10px] font-semibold uppercase text-stone-600">Due Fines</span>
                <div className={`text-lg font-bold mt-0.5 ${stats.unpaidFines > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                  ₹{stats.unpaidFines.toFixed(0)}
                </div>
                {stats.pendingFines > 0 && (
                  <div className="text-[9px] text-amber-800 font-semibold mt-0.5">
                    {stats.pendingFines} pending review
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>

      </div>

      {/* Full-width Section: Past Book Return Condition & Merit History */}
      <div className="bg-white rounded-xl border border-stone-200/90 shadow-2xs overflow-hidden">
        <div className="p-5 border-b border-stone-100 flex items-center justify-between">
          <div>
            <h3 className="font-serif text-lg font-bold text-stone-900">
              Book Return Condition & Merit History
            </h3>
            <p className="text-xs text-stone-600 mt-0.5">
              Historical ledger of physical condition evaluations and merit star deductions for returned books.
            </p>
          </div>
          <span className="text-xs font-medium text-stone-500">
            {conditionHistory.length} Past Return{conditionHistory.length !== 1 ? 's' : ''}
          </span>
        </div>

        {conditionHistory.length === 0 ? (
          <div className="p-12 text-center text-xs text-stone-500">
            No completed returns recorded for this patron yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#f8fafc] border-b border-stone-200 text-stone-700 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-5 font-semibold">Book Title</th>
                  <th className="py-3 px-4 font-semibold">Barcode</th>
                  <th className="py-3 px-4 font-semibold">Return Date</th>
                  <th className="py-3 px-4 font-semibold">Evaluated Condition</th>
                  <th className="py-3 px-4 font-semibold">Merit Impact</th>
                  <th className="py-3 px-5 font-semibold text-right">Inspection Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {conditionHistory.map((item) => {
                  const cond = item.return_condition || 'Pristine';
                  const isSevere = cond === 'Severe Damage';
                  const isMinor = cond === 'Minor Damage';
                  const isPristine = cond === 'Pristine';

                  return (
                    <tr key={item.borrow_id} className="hover:bg-stone-50/50 transition-colors">
                      <td className="py-3.5 px-5 font-medium text-stone-900 max-w-xs truncate">
                        {item.title}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-[11px] text-stone-600">
                        {item.barcode_id}
                      </td>
                      <td className="py-3.5 px-4 text-stone-600">
                        {item.return_date ? new Date(item.return_date).toLocaleDateString() : '—'}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          isPristine
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : isMinor
                            ? 'bg-amber-50 text-amber-900 border border-amber-200'
                            : 'bg-rose-50 text-rose-800 border border-rose-200'
                        }`}>
                          {cond === 'Minor Damage' ? 'Minor Damage (Bad)' : cond === 'Severe Damage' ? 'Severe Damage (Worse)' : 'Pristine'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-semibold">
                        {isSevere ? (
                          <span className="text-rose-700 font-mono">-2 Stars ★</span>
                        ) : isMinor ? (
                          <span className="text-amber-800 font-mono">-1 Star ★</span>
                        ) : (
                          <span className="text-emerald-700 font-mono">0 (Preserved)</span>
                        )}
                      </td>
                      <td className="py-3.5 px-5 text-right">
                        <span className="text-[11px] font-semibold text-stone-600 bg-stone-100 px-2 py-0.5 rounded">
                          Admin Verified ✓
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
