import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useToast } from './ToastContext';
import ReturnReviewModal from './ReturnReviewModal';

const API = 'http://localhost:3000';

export default function StudentDashboard() {
  const user = JSON.parse(localStorage.getItem('user') || 'null');
  const { showToast } = useToast();
  const [borrows, setBorrows] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [fines, setFines] = useState([]);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionMsg, setActionMsg] = useState('');
  const [returnedBorrowForReview, setReturnedBorrowForReview] = useState(null);

  const fetchData = async () => {
    if (!user) return;
    try {
      const [borrowsRes, resRes, finesRes, profileRes] = await Promise.all([
        fetch(`${API}/api/users/${user.id || user.user_id}/borrows`),
        fetch(`${API}/api/users/${user.id || user.user_id}/reservations`),
        fetch(`${API}/api/users/${user.id || user.user_id}/fines`),
        fetch(`${API}/api/users/${user.id || user.user_id}`),
      ]);

      if (borrowsRes.ok) setBorrows(await borrowsRes.json());
      if (resRes.ok) setReservations(await resRes.json());
      if (finesRes.ok) setFines(await finesRes.json());
      if (profileRes.ok) setProfile(await profileRes.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleReturn = async (borrow_id) => {
    setActionMsg('');
    try {
      const res = await fetch(`${API}/api/returns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ borrow_id }),
      });
      const data = await res.json();
      if (res.ok) {
        setActionMsg(`✓ Return requested for "${data.title || 'book'}". Physical copy submitted and awaiting admin verification.`);
        fetchData();
        // Prompt patron to write a rating and review for campus discussions
        const targetBorrow = borrows.find((b) => b.borrow_id === borrow_id);
        if (targetBorrow) {
          setReturnedBorrowForReview(targetBorrow);
        }
      } else {
        setActionMsg(`✕ ${data.error || 'Return request failed'}`);
      }
    } catch (err) {
      setActionMsg('✕ Failed to process return request');
    }
  };

  const pendingFines = fines.filter((f) => f.status === 'unpaid');
  const totalDue = pendingFines.reduce(
    (sum, f) => sum + (parseFloat(f.amount_assessed) - parseFloat(f.amount_paid || 0)),
    0
  );

  const effectiveLimit = profile?.max_books_allowed ?? (user?.role_id === 2 ? 10 : 3);
  const hasCustomLimit = profile?.custom_max_books !== null && profile?.custom_max_books !== undefined;

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-16 text-center">
        <div className="inline-block animate-spin w-8 h-8 border-2 border-[#881337] border-t-transparent rounded-full mb-3"></div>
        <p className="text-sm font-medium text-stone-500">Loading your library dashboard...</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 font-sans">
      
      {/* Editorial Welcome Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 pb-6 border-b border-stone-200/80 gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-stone-900 tracking-tight leading-tight">
            Welcome, {user?.name || user?.first_name || 'Member'}
          </h1>
          <p className="text-stone-800 font-medium text-sm mt-1.5">
            Track your active borrowed physical copies, waitlist queue holds, and return deadlines.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/catalog"
            className="bg-[#881337] hover:bg-[#700f2b] text-white rounded-full px-5 py-2 text-xs font-medium shadow-sm hover:shadow transition-all inline-flex items-center gap-1.5"
          >
            <span>Explore Catalog</span>
            <span>→</span>
          </Link>
          <Link
            to="/courses"
            className="bg-white hover:bg-stone-50 text-stone-700 border border-stone-200 rounded-full px-4 py-2 text-xs font-medium shadow-2xs transition-all"
          >
            Syllabus Books
          </Link>
        </div>
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

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        
        {/* Card 1: Active Borrows */}
        <div className="bg-white rounded-xl border border-stone-200/90 p-5 shadow-2xs hover:shadow-xs transition-all">
          <div className="flex items-center justify-between text-stone-600 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Active Checkouts</span>
            <span className="text-xs font-mono font-bold text-stone-400">01</span>
          </div>
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-3xl font-bold text-stone-900">{borrows.length}</span>
            <span className="text-xs text-stone-600">
              of {effectiveLimit} allowed
            </span>
            {hasCustomLimit && (
              <span className="text-[10px] font-semibold text-rose-800 bg-rose-50 border border-rose-200/80 px-1.5 py-0.5 rounded">
                Custom Limit
              </span>
            )}
          </div>
          <div className="mt-3 text-xs text-stone-600">
            {borrows.filter((b) => b.is_overdue).length > 0 ? (
              <span className="text-rose-600 font-medium">{borrows.filter((b) => b.is_overdue).length} copy overdue</span>
            ) : (
              <span className="text-emerald-700 font-medium">All returns on schedule</span>
            )}
          </div>
        </div>

        {/* Card 2: Queue Position */}
        <div className="bg-white rounded-xl border border-stone-200/90 p-5 shadow-2xs hover:shadow-xs transition-all">
          <div className="flex items-center justify-between text-stone-600 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Waitlist Holds</span>
            <span className="text-xs font-mono font-bold text-stone-400">02</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-stone-900">{reservations.length}</span>
            <span className="text-xs text-stone-600">active requests</span>
          </div>
          <div className="mt-3 text-xs text-stone-600">
            {reservations.some((r) => r.status === 'held') ? (
              <span className="text-[#881337] font-semibold">Book waiting at desk (48h hold)</span>
            ) : (
              <span>Automated 48h hold on return</span>
            )}
          </div>
        </div>

        {/* Card 3: 7-Star Merit Standing */}
        <div className="bg-white rounded-xl border border-stone-200/90 p-5 shadow-2xs hover:shadow-xs transition-all">
          <div className="flex items-center justify-between text-stone-600 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Merit Rating</span>
            <span className="text-xs font-mono font-bold text-stone-400">03</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-amber-600">
              {profile?.merit_stars ?? 7}
            </span>
            <span className="text-xs text-stone-600">of 7 Stars</span>
          </div>
          <div className="mt-3 text-xs">
            <Link to="/profile" className="text-[#881337] hover:underline font-medium inline-flex items-center gap-1">
              Inspection history & rules →
            </Link>
          </div>
        </div>

        {/* Card 4: Pending Dues */}
        <div className="bg-white rounded-xl border border-stone-200/90 p-5 shadow-2xs hover:shadow-xs transition-all">
          <div className="flex items-center justify-between text-stone-600 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Outstanding Dues</span>
            <span className="text-xs font-mono font-bold text-stone-400">04</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className={`text-3xl font-bold ${totalDue > 0 ? 'text-[#881337]' : 'text-stone-900'}`}>
              ₹{totalDue.toFixed(2)}
            </span>
            <span className="text-xs text-stone-600">
              {pendingFines.length} pending
            </span>
          </div>
          <div className="mt-3 text-xs">
            {totalDue > 0 ? (
              <Link to="/fines" className="text-[#881337] hover:underline font-medium inline-flex items-center gap-1">
                View receipts & pay online →
              </Link>
            ) : (
              <span className="text-emerald-700 font-medium">Clean financial record</span>
            )}
          </div>
        </div>

      </div>

      {/* Main Grid: Active Checkouts + Reservations */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Active Checkouts (2 Columns) */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-serif text-xl font-bold text-stone-900">
              Current Checkouts
            </h2>
            <span className="text-xs text-stone-400">
              {borrows.length} {borrows.length === 1 ? 'book' : 'books'} in possession
            </span>
          </div>

          {borrows.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-stone-200 p-10 text-center">
              <h3 className="text-sm font-semibold text-stone-700">No active book loans</h3>
              <p className="text-xs text-stone-400 mt-1 max-w-sm mx-auto">
                You haven't borrowed any physical copies. Browse our catalog to check out books mapped to your courses.
              </p>
              <Link
                to="/catalog"
                className="mt-4 inline-block bg-stone-900 hover:bg-stone-800 text-white text-xs font-medium px-4 py-2 rounded-full transition-all"
              >
                Browse Catalog
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {borrows.map((b) => {
                const dueDate = new Date(b.due_date);
                const isOverdue = b.is_overdue || dueDate < new Date();
                return (
                  <div
                    key={b.borrow_id}
                    className="bg-white rounded-2xl border border-stone-200/80 p-5 shadow-2xs hover:shadow-xs transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-14 bg-stone-100 rounded-xl border border-stone-200/80 flex items-center justify-center font-mono text-[11px] font-bold text-stone-400 shrink-0">
                        ITEM
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono text-[11px] font-semibold uppercase text-stone-400 bg-stone-50 px-2 py-0.5 rounded border border-stone-200/60">
                            {b.barcode_id}
                          </span>
                          {b.return_status === 'pending_verification' ? (
                            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                              Awaiting Admin Verification
                            </span>
                          ) : isOverdue ? (
                            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                              Overdue
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-stone-100 text-stone-600 border border-stone-200">
                              On Loan
                            </span>
                          )}
                        </div>
                        <h4 className="font-serif text-base font-bold text-stone-900 leading-snug">
                          {b.title}
                        </h4>
                        <p className="text-xs text-stone-500 mt-0.5">
                          Issued: {new Date(b.issue_date).toLocaleDateString()} • Due:{' '}
                          <span className={isOverdue ? 'text-rose-600 font-semibold' : 'text-stone-700 font-medium'}>
                            {dueDate.toLocaleDateString()}
                          </span>
                        </p>
                      </div>
                    </div>

                    <div className="shrink-0 flex sm:flex-col items-center sm:items-end justify-between gap-2 border-t sm:border-t-0 pt-3 sm:pt-0 border-stone-100">
                      {b.return_status === 'pending_verification' ? (
                        <div className="text-right">
                          <span className="inline-block bg-amber-50 text-amber-800 text-[11px] font-medium px-3 py-1 rounded-full border border-amber-200/80">
                            Drop-off Received
                          </span>
                          <p className="text-[10px] text-stone-400 mt-0.5">
                            Pending librarian desk check-in
                          </p>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleReturn(b.borrow_id)}
                          className="rounded-full bg-stone-100 hover:bg-[#881337] hover:text-white text-stone-700 text-xs font-medium px-4 py-1.5 transition-all shadow-2xs"
                        >
                          Return Copy
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Reservations & Holds Column */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-serif text-xl font-bold text-stone-900">
              Active Waitlists
            </h2>
            <span className="text-xs text-stone-400">{reservations.length} queued</span>
          </div>

          {reservations.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-stone-200 p-8 text-center">
              <h3 className="text-xs font-semibold text-stone-700">No active queue holds</h3>
              <p className="text-[11px] text-stone-400 mt-1">
                When popular books are checked out, join their waitlist to get an automatic 48-hour hold.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {reservations.map((r) => {
                const isHeld = r.status === 'held';
                return (
                  <div
                    key={r.reservation_id}
                    className={`rounded-2xl border p-4 transition-all ${
                      isHeld
                        ? 'bg-rose-50/50 border-[#881337]/30 shadow-xs'
                        : 'bg-white border-stone-200/80'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                        isHeld
                          ? 'bg-[#881337] text-white'
                          : 'bg-stone-100 text-stone-600 border border-stone-200'
                      }`}>
                        {isHeld ? 'Held for Pick up' : `Queue Position #${r.queue_position}`}
                      </span>
                      <span className="text-[10px] text-stone-400">
                        {new Date(r.reservation_date).toLocaleDateString()}
                      </span>
                    </div>

                    <h4 className="text-sm font-bold text-stone-900 leading-snug">
                      {r.title}
                    </h4>

                    {isHeld ? (
                      <p className="text-[11px] text-[#881337] font-medium mt-2">
                        Notice: This copy is held for you at the circulation desk for the next 48 hours.
                      </p>
                    ) : (
                      <p className="text-[11px] text-stone-400 mt-1.5">
                        You will be notified immediately when a copy is checked back in.
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>

      {/* Post-Return Book Rating & Review Modal */}
      {returnedBorrowForReview && (
        <ReturnReviewModal
          borrow={returnedBorrowForReview}
          onClose={() => setReturnedBorrowForReview(null)}
          onSubmitSuccess={(data) => {
            setActionMsg(`✓ Review posted to campus discussions! Thank you for your feedback.`);
          }}
        />
      )}

    </div>
  );
}
