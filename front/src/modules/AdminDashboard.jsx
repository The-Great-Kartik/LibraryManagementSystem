import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

const API = 'http://localhost:3000';

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [simulatedDate, setSimulatedDate] = useState('');
  const [offsetDays, setOffsetDays] = useState(0);
  const [customDaysInput, setCustomDaysInput] = useState('');
  const [dateMsg, setDateMsg] = useState('');
  const [isUpdatingDate, setIsUpdatingDate] = useState(false);

  const fetchStats = () => {
    fetch(`${API}/api/admin/stats`)
      .then((r) => r.json())
      .then((d) => {
        setStats(d);
        if (d.simulated_date) setSimulatedDate(d.simulated_date);
        if (d.offset_days !== undefined) setOffsetDays(d.offset_days);
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const handleUpdateOffset = async (newOffset) => {
    setIsUpdatingDate(true);
    setDateMsg('');
    try {
      const res = await fetch(`${API}/api/admin/system-date`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ offset_days: newOffset }),
      });
      const data = await res.json();
      if (res.ok) {
        setDateMsg(`✓ System date set to ${data.simulated_date} (${data.offset_days >= 0 ? `+${data.offset_days}` : data.offset_days} days)`);
        setSimulatedDate(data.simulated_date);
        setOffsetDays(data.offset_days);
        fetchStats();
      } else {
        setDateMsg('✕ Failed to update date');
      }
    } catch (err) {
      setDateMsg('✕ Network error');
    } finally {
      setIsUpdatingDate(false);
    }
  };

  const navCards = [
    {
      title: "Circulation Desk",
      desc: "Fast barcode checkout, returns, and automatic waitlist triggers.",
      link: "/admin/circulation",
      number: "01",
    },
    {
      title: "Inventory & Shelves",
      desc: "Catalog new titles and register physical barcode copies with floor & rack.",
      link: "/admin/inventory",
      number: "02",
    },
    {
      title: "Member Profiles",
      desc: "Adjust member limits, promote roles (Teacher vs Student), and manage access.",
      link: "/admin/users",
      number: "03",
    },
    {
      title: "Book Approvals",
      desc: "Community purchase requests prioritized by student & faculty upvotes.",
      link: "/admin/acquisitions",
      number: "04",
    },
    {
      title: "Fines & Overrides",
      desc: "Audit fee receipts, record desk cash payments, and grant administrative waivers.",
      link: "/admin/fines",
      number: "05",
    },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-8 py-10 font-sans">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
        <div className="max-w-2xl">
          <h1 className="text-2xl sm:text-3xl font-bold text-stone-900 tracking-tight leading-tight">
            Library Management & Circulation Overview
          </h1>
          <p className="text-stone-800 font-medium text-sm mt-1.5">
            Real-time institutional indicators for book inventories, circulation turnover, and fee balances.
          </p>
        </div>

        {/* Date Simulation Quick Widget */}
        <div className="bg-stone-50 border border-stone-200/90 rounded-2xl p-3 sm:px-4 text-xs shadow-2xs min-w-[280px]">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-[10px] uppercase font-bold tracking-wider text-stone-500">
              System Time Simulation
            </span>
            <span className="font-mono font-bold text-[#881337] bg-white border border-rose-200 px-2 py-0.5 rounded-md text-[11px]">
              {simulatedDate || 'Current'}
            </span>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => handleUpdateOffset(offsetDays + 7)}
              disabled={isUpdatingDate}
              className="bg-white hover:bg-stone-100 border border-stone-200 text-stone-700 px-2 py-1 rounded-lg text-[11px] font-medium transition-colors"
              title="Fast forward 7 days"
            >
              +7 Days
            </button>
            <button
              onClick={() => handleUpdateOffset(offsetDays + 15)}
              disabled={isUpdatingDate}
              className="bg-white hover:bg-stone-100 border border-stone-200 text-stone-700 px-2 py-1 rounded-lg text-[11px] font-medium transition-colors"
              title="Fast forward 15 days"
            >
              +15 Days
            </button>
            <button
              onClick={() => handleUpdateOffset(offsetDays + 30)}
              disabled={isUpdatingDate}
              className="bg-white hover:bg-stone-100 border border-stone-200 text-[#881337] font-semibold px-2 py-1 rounded-lg text-[11px] transition-colors"
              title="Fast forward 30 days to trigger overdue fines"
            >
              +30 Days
            </button>
            {offsetDays !== 0 && (
              <button
                onClick={() => handleUpdateOffset(0)}
                disabled={isUpdatingDate}
                className="bg-stone-200 hover:bg-stone-300 text-stone-700 px-2 py-1 rounded-lg text-[11px] font-medium transition-colors ml-auto"
                title="Reset to today's real date"
              >
                Reset (Today)
              </button>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (customDaysInput !== '') {
                handleUpdateOffset(parseInt(customDaysInput, 10) || 0);
                setCustomDaysInput('');
              }
            }}
            className="flex items-center gap-1.5 mt-2"
          >
            <input
              type="number"
              placeholder="Custom days ahead..."
              value={customDaysInput}
              onChange={(e) => setCustomDaysInput(e.target.value)}
              className="w-full bg-white border border-stone-200 px-2.5 py-1 text-[11px] rounded-lg focus:outline-none focus:border-[#881337]"
            />
            <button
              type="submit"
              disabled={isUpdatingDate}
              className="bg-[#881337] hover:bg-[#9f1239] text-white font-medium text-[11px] px-2.5 py-1 rounded-lg transition-colors shrink-0"
            >
              Apply
            </button>
          </form>

          {dateMsg && (
            <div className={`mt-2 text-[10px] font-medium ${dateMsg.startsWith('✓') ? 'text-emerald-700' : 'text-rose-700'}`}>
              {dateMsg}
            </div>
          )}
        </div>
      </div>

      {/* KPI Stats Grid */}
      {loading ? (
        <div className="py-16 text-center">
          <div className="inline-block animate-spin w-8 h-8 border-2 border-[#881337] border-t-transparent rounded-full mb-3"></div>
          <p className="text-sm font-medium text-stone-500">Aggregating database statistics...</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3.5 mb-10">
          
          <div className="bg-white rounded-2xl border border-stone-200/80 p-4 shadow-2xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Total Titles</span>
            <div className="text-2xl font-serif font-bold text-stone-900 mt-1">{stats?.total_books ?? '—'}</div>
            <span className="text-[10px] text-stone-400">In catalog</span>
          </div>

          <div className="bg-white rounded-2xl border border-stone-200/80 p-4 shadow-2xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Active Members</span>
            <div className="text-2xl font-serif font-bold text-stone-900 mt-1">{stats?.total_users ?? '—'}</div>
            <span className="text-[10px] text-stone-400">Enrolled accounts</span>
          </div>

          <div className="bg-white rounded-2xl border border-stone-200/80 p-4 shadow-2xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Active Checkouts</span>
            <div className="text-2xl font-serif font-bold text-[#881337] mt-1">{stats?.active_borrows ?? '—'}</div>
            <span className="text-[10px] text-stone-400">Copies on loan</span>
          </div>

          <Link
            to="/admin/circulation"
            className="bg-white rounded-2xl border border-stone-200/80 p-4 shadow-2xs hover:border-[#881337]/50 transition-all block"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-rose-800">Waitlist Queue</span>
              <span className="text-[9px] text-[#881337] font-semibold">Open →</span>
            </div>
            <div className={`text-2xl font-serif font-bold mt-1 ${stats?.waitlist_count > 0 ? 'text-[#881337]' : 'text-stone-900'}`}>
              {stats?.waitlist_count ?? 0}
            </div>
            <span className="text-[10px] text-stone-400">Reserved / Held</span>
          </Link>

          <div className="bg-white rounded-2xl border border-stone-200/80 p-4 shadow-2xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600">Overdue Items</span>
            <div className="text-2xl font-serif font-bold text-rose-700 mt-1">{stats?.overdue_borrows ?? '—'}</div>
            <span className="text-[10px] text-rose-500 font-medium">Pending return</span>
          </div>

          <Link
            to="/admin/fines"
            className="bg-white rounded-2xl border border-stone-200/80 p-4 shadow-2xs hover:border-[#881337]/50 transition-all block"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-stone-700">Fines Ledger</span>
              <span className="text-[9px] text-[#881337] font-semibold">Audit →</span>
            </div>
            <div className="text-2xl font-serif font-bold text-stone-900 mt-1">
              ₹{parseFloat(stats?.pending_fines_total || 0).toFixed(0)}
            </div>
            <span className="text-[10px] text-stone-500">
              {stats?.pending_approval_fines > 0 ? (
                <strong className="text-amber-800">{stats.pending_approval_fines} pending review</strong>
              ) : (
                'Approved outstanding'
              )}
            </span>
          </Link>

          <div className="bg-white rounded-2xl border border-stone-200/80 p-4 shadow-2xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Book Requests</span>
            <div className="text-2xl font-serif font-bold text-stone-900 mt-1">{stats?.pending_requests ?? '—'}</div>
            <span className="text-[10px] text-stone-400">Patron proposals</span>
          </div>

        </div>
      )}

      {/* Institutional Navigation Modules */}
      <div>
        <h2 className="font-serif text-lg font-bold text-stone-900 mb-4">
          Circulation Modules
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {navCards.map((c) => (
            <Link
              key={c.number}
              to={c.link}
              className="group bg-white rounded-3xl border border-stone-200/80 p-6 shadow-2xs hover:shadow-xs hover:border-[#881337]/30 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="font-mono text-xs font-bold text-stone-300 group-hover:text-[#881337] transition-colors">
                    {c.number}
                  </span>
                  <span className="text-xs font-medium text-stone-400 group-hover:text-stone-700 transition-colors">
                    Access →
                  </span>
                </div>
                <h3 className="font-serif text-base font-bold text-stone-900 group-hover:text-[#881337] transition-colors mb-2">
                  {c.title}
                </h3>
                <p className="text-xs text-stone-500 leading-relaxed font-normal">
                  {c.desc}
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-stone-100 flex items-center justify-between text-[11px] font-medium text-stone-400 group-hover:text-[#881337]">
                <span>Manage Subsystem</span>
                <span>Open Module</span>
              </div>
            </Link>
          ))}
        </div>
      </div>

    </div>
  );
}
