import React, { useState, useEffect } from 'react';
import { useToast } from './ToastContext';

const API = 'http://localhost:3000';

export default function CirculationDesk() {
  const user = JSON.parse(localStorage.getItem('user') || 'null');
  const { showToast } = useToast();
  const [tab, setTab] = useState('pending'); // 'pending' | 'waitlist' | 'return' | 'issue'
  
  // Pending Returns queue state
  const [pendingReturns, setPendingReturns] = useState([]);
  const [loadingPending, setLoadingPending] = useState(false);
  const [inspectingItem, setInspectingItem] = useState(null); // borrow record currently being inspected

  // Waitlist Queue state (for Admin waitlist management)
  const [waitlistQueue, setWaitlistQueue] = useState([]);
  const [loadingWaitlist, setLoadingWaitlist] = useState(false);
  const [fulfillingReservation, setFulfillingReservation] = useState(null);
  const [waitlistBarcode, setWaitlistBarcode] = useState('');
  const [waitlistCondition, setWaitlistCondition] = useState('Pristine');

  // Issue state
  const [issueUserId, setIssueUserId] = useState('');
  const [issueBarcode, setIssueBarcode] = useState('');
  const [issueLoading, setIssueLoading] = useState(false);
  const [issueResult, setIssueResult] = useState(null);

  // Return state
  const [returnBarcode, setReturnBarcode] = useState('');
  const [returnCondition, setReturnCondition] = useState('Pristine');
  const [returnLoading, setReturnLoading] = useState(false);
  const [returnResult, setReturnResult] = useState(null);

  const fetchPendingReturns = async () => {
    setLoadingPending(true);
    try {
      const res = await fetch(`${API}/api/admin/pending-returns`);
      if (res.ok) setPendingReturns(await res.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingPending(false);
    }
  };

  const fetchWaitlistQueue = async () => {
    setLoadingWaitlist(true);
    try {
      const res = await fetch(`${API}/api/admin/reservations`);
      if (res.ok) setWaitlistQueue(await res.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingWaitlist(false);
    }
  };

  useEffect(() => {
    fetchPendingReturns();
    fetchWaitlistQueue();
  }, []);

  const handleIssue = async (e) => {
    e.preventDefault();
    setIssueLoading(true);
    setIssueResult(null);

    try {
      const res = await fetch(`${API}/api/admin/issue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: issueUserId,
          barcode_id: issueBarcode,
          librarian_id: user?.id || user?.user_id,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setIssueResult({ success: true, message: `✓ Loan approved! Barcode [${issueBarcode}] successfully checked out to User #${issueUserId}.` });
        setIssueBarcode('');
      } else {
        setIssueResult({ success: false, message: `✕ ${data.error || 'Failed to issue book'}` });
      }
    } catch (err) {
      setIssueResult({ success: false, message: '✕ Network error while issuing book' });
    } finally {
      setIssueLoading(false);
    }
  };

  const handleProcessReturn = async (barcodeToProcess, conditionToUse) => {
    setReturnLoading(true);
    setReturnResult(null);

    try {
      const res = await fetch(`${API}/api/admin/return`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          barcode_id: barcodeToProcess,
          condition: conditionToUse,
          librarian_id: user?.id || user?.user_id,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        const fineAmt = parseFloat(data.fine_amount || 0);
        setReturnResult({
          success: true,
          barcode: barcodeToProcess,
          fine: fineAmt,
          daysOverdue: data.days_overdue || 0,
          condition: data.return_condition,
          fineReasons: data.fine_reasons || [],
          heldForNext: data.held_for_reservation || false,
        });

        if (fineAmt > 0) {
          showToast({
            title: `Fine Assessed: ₹${fineAmt.toFixed(2)}`,
            message: `Barcode [${barcodeToProcess}] returned by Member #${data.user_id}. ${data.fine_reasons?.join('; ') || ''}`,
            type: 'fine',
          });
        }

        setReturnBarcode('');
        setReturnCondition('Pristine');
        setInspectingItem(null);
        fetchPendingReturns();
        fetchWaitlistQueue();
      } else {
        setReturnResult({ success: false, message: `✕ ${data.error || 'Failed to return book'}` });
      }
    } catch (err) {
      setReturnResult({ success: false, message: '✕ Network error while processing return' });
    } finally {
      setReturnLoading(false);
    }
  };

  const handleFulfillWaitlist = async (e) => {
    e.preventDefault();
    if (!fulfillingReservation) return;

    setReturnLoading(true);
    try {
      const res = await fetch(`${API}/api/admin/reservations/${fulfillingReservation.reservation_id}/fulfill`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          barcode_id: waitlistBarcode || fulfillingReservation.available_barcode,
          condition: waitlistCondition,
          librarian_id: user?.id || user?.user_id,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setReturnResult({
          success: true,
          barcode: data.barcode_id,
          fine: 0,
          daysOverdue: 0,
          condition: data.condition,
          fineReasons: [`Transferred directly to waitlisted patron #${data.user_id}`],
          heldForNext: false,
        });
        setFulfillingReservation(null);
        setWaitlistBarcode('');
        setWaitlistCondition('Pristine');
        fetchWaitlistQueue();
      } else {
        alert(data.error || 'Failed to hand off book to waitlisted member');
      }
    } catch (err) {
      alert('Network error while processing waitlist handoff');
    } finally {
      setReturnLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-8 py-10 font-sans">
      
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-stone-900 tracking-tight leading-tight">
          Circulation Desk
        </h1>
        <p className="text-stone-800 font-medium text-sm mt-1.5">
          Review patron return drop-offs, manage waitlist handoffs, inspect copy conditions, and process barcode check-ins.
        </p>
      </div>

      {/* Switcher Tabs */}
      <div className="flex gap-2 p-1 bg-stone-100/90 border border-stone-200 rounded-xl max-w-lg mb-8">
        <button
          onClick={() => { setTab('pending'); fetchPendingReturns(); }}
          className={`flex-1 py-2 px-3 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
            tab === 'pending'
              ? 'bg-[#881337] text-white shadow-xs'
              : 'text-stone-700 hover:text-stone-900'
          }`}
        >
          <span>Pending Drop-offs</span>
          {pendingReturns.length > 0 && (
            <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${tab === 'pending' ? 'bg-white text-[#881337]' : 'bg-rose-100 text-[#881337]'}`}>
              {pendingReturns.length}
            </span>
          )}
        </button>

        <button
          onClick={() => { setTab('waitlist'); fetchWaitlistQueue(); }}
          className={`flex-1 py-2 px-3 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
            tab === 'waitlist'
              ? 'bg-[#881337] text-white shadow-xs'
              : 'text-stone-700 hover:text-stone-900'
          }`}
        >
          <span>Waitlist Queue</span>
          {waitlistQueue.length > 0 && (
            <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${tab === 'waitlist' ? 'bg-white text-[#881337]' : 'bg-stone-200 text-stone-700'}`}>
              {waitlistQueue.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setTab('return')}
          className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
            tab === 'return'
              ? 'bg-[#881337] text-white shadow-xs'
              : 'text-stone-700 hover:text-stone-900'
          }`}
        >
          Return by Barcode
        </button>

        <button
          onClick={() => setTab('issue')}
          className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
            tab === 'issue'
              ? 'bg-[#881337] text-white shadow-xs'
              : 'text-stone-700 hover:text-stone-900'
          }`}
        >
          Issue Copy
        </button>
      </div>

      {/* TAB 1: PENDING RETURNS QUEUE */}
      {tab === 'pending' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-stone-200/90 p-6 sm:p-8 shadow-2xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-serif text-xl font-bold text-stone-900">
                  Patron Returns Awaiting Admin Verification
                </h2>
                <p className="text-xs text-stone-600 mt-0.5">
                  Books dropped off by students remain in a waiting state until an admin verifies physical condition and processes final check-in.
                </p>
              </div>
              <button
                onClick={fetchPendingReturns}
                className="text-xs text-stone-600 hover:text-stone-900 font-medium px-3 py-1.5 rounded-lg border border-stone-300 hover:bg-stone-50 transition-colors"
              >
                Refresh List
              </button>
            </div>

            {returnResult && (
              <div className="mb-6">
                {returnResult.success ? (
                  <div className="p-5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs">
                    <div className="font-bold text-emerald-900 text-sm mb-1 flex items-center gap-2">
                      Copy [{returnResult.barcode}] Verified & Returned Successfully
                    </div>
                    <div className="text-stone-700 space-y-1 mt-2">
                      <div>
                        Inspected Condition: <strong>{returnResult.condition}</strong>
                      </div>
                      {returnResult.fine > 0 ? (
                        <div className="text-rose-800 font-semibold mt-1">
                          Total Penalty Assessed: ₹{parseFloat(returnResult.fine).toFixed(2)}
                          {returnResult.fineReasons?.length > 0 && (
                            <ul className="list-disc list-inside mt-1 font-normal text-rose-900">
                              {returnResult.fineReasons.map((r, i) => (
                                <li key={i}>{r}</li>
                              ))}
                            </ul>
                          )}
                        </div>
                      ) : (
                        <div className="text-emerald-900 font-medium">
                          Zero fines assessed. Copy returned to shelf or held for waitlist.
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-900 font-medium">
                    {returnResult.message}
                  </div>
                )}
              </div>
            )}

            {loadingPending ? (
              <div className="py-12 text-center text-xs text-stone-500">
                <div className="inline-block animate-spin w-6 h-6 border-2 border-[#881337] border-t-transparent rounded-full mb-2"></div>
                <p>Loading pending returns...</p>
              </div>
            ) : pendingReturns.length === 0 ? (
              <div className="py-12 text-center rounded-xl border border-dashed border-stone-200 text-xs text-stone-500">
                No returned books awaiting verification. All drop-offs have been processed.
              </div>
            ) : (
              <div className="divide-y divide-stone-100 overflow-hidden">
                {pendingReturns.map((item) => (
                  <div key={item.borrow_id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-[11px] font-bold text-stone-700 bg-stone-100 px-2 py-0.5 rounded">
                          {item.barcode_id}
                        </span>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-amber-900 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                          Pending Verification
                        </span>
                        {item.is_overdue === 1 && (
                          <span className="text-[10px] font-bold uppercase tracking-wider text-rose-800 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded">
                            Overdue ({item.days_overdue}d)
                          </span>
                        )}
                      </div>
                      <h4 className="font-serif text-base font-bold text-stone-900 leading-snug">
                        {item.title}
                      </h4>
                      <p className="text-xs text-stone-600 mt-0.5">
                        Borrower: <strong className="text-stone-900">{item.user_name}</strong> (User #{item.user_id} • {item.role_name}) • Due: {new Date(item.due_date).toLocaleDateString()}
                      </p>
                    </div>

                    <button
                      onClick={() => {
                        setInspectingItem(item);
                        setReturnCondition('Pristine');
                      }}
                      className="bg-[#881337] hover:bg-[#700f2b] text-white text-xs font-semibold px-4 py-2 rounded-lg transition-all shrink-0 shadow-2xs"
                    >
                      Inspect & Accept Return →
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: WAITLIST QUEUE & DIRECT HANDOFF */}
      {tab === 'waitlist' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-stone-200/90 p-6 sm:p-8 shadow-2xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-serif text-xl font-bold text-stone-900">
                  Waitlist Reservations & Desk Handoffs
                </h2>
                <p className="text-xs text-stone-600 mt-0.5">
                  Inspect the physical condition of returned books and hand them off directly to the next waiting member.
                </p>
              </div>
              <button
                onClick={fetchWaitlistQueue}
                className="text-xs text-stone-600 hover:text-stone-900 font-medium px-3 py-1.5 rounded-lg border border-stone-300 hover:bg-stone-50 transition-colors"
              >
                Refresh Queue
              </button>
            </div>

            {loadingWaitlist ? (
              <div className="py-12 text-center text-xs text-stone-500">
                <div className="inline-block animate-spin w-6 h-6 border-2 border-[#881337] border-t-transparent rounded-full mb-2"></div>
                <p>Loading waitlist queue...</p>
              </div>
            ) : waitlistQueue.length === 0 ? (
              <div className="py-12 text-center rounded-xl border border-dashed border-stone-200 text-xs text-stone-500">
                No active waitlist reservations. All book demands are fulfilled.
              </div>
            ) : (
              <div className="divide-y divide-stone-100">
                {waitlistQueue.map((rv) => {
                  const isHeld = rv.status === 'held';
                  return (
                    <div key={rv.reservation_id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                            isHeld
                              ? 'bg-rose-50 text-rose-800 border border-rose-200 font-semibold'
                              : 'bg-stone-100 text-stone-700 border border-stone-300'
                          }`}>
                            {isHeld ? 'Held for Pick Up (48h)' : `Queue Position #${rv.queue_position}`}
                          </span>
                          <span className="font-mono text-[10px] text-stone-500">
                            Book ID: #{rv.book_id}
                          </span>
                        </div>

                        <h4 className="font-serif text-base font-bold text-stone-900 leading-snug">
                          {rv.title}
                        </h4>

                        <p className="text-xs text-stone-600 mt-0.5">
                          Reserved for: <strong className="text-stone-900">{rv.user_name}</strong> (User #{rv.user_id} • {rv.role_name}) • {rv.user_email}
                        </p>
                      </div>

                      <button
                        onClick={() => {
                          setFulfillingReservation(rv);
                          setWaitlistBarcode(rv.available_barcode || '');
                          setWaitlistCondition('Pristine');
                        }}
                        className="bg-[#881337] hover:bg-[#700f2b] text-white text-xs font-semibold px-4 py-2 rounded-lg transition-all shrink-0 shadow-2xs"
                      >
                        Inspect & Continue to Next User →
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: RETURN BY BARCODE */}
      {tab === 'return' && (
        <div className="bg-white rounded-xl border border-stone-200/90 p-8 shadow-2xs">
          <h2 className="font-serif text-xl font-bold text-stone-900 mb-1">
            Return by Barcode
          </h2>
          <p className="text-xs text-stone-600 mb-6">
            Enter or scan any physical copy's barcode ID directly to inspect its condition and process return immediately.
          </p>

          <form onSubmit={(e) => { e.preventDefault(); handleProcessReturn(returnBarcode, returnCondition); }} className="space-y-6 max-w-lg">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-stone-700 mb-1.5">
                Physical Copy Barcode ID *
              </label>
              <input
                type="text"
                value={returnBarcode}
                onChange={(e) => setReturnBarcode(e.target.value)}
                placeholder="e.g. BC-001, BC-004, BC-010"
                className="w-full bg-[#f8fafc] border border-stone-300 rounded-lg px-4 py-2.5 text-sm font-mono focus:outline-none focus:border-[#881337] uppercase"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-stone-700 mb-1.5">
                Physical Inspection Rating *
              </label>
              <div className="grid grid-cols-3 gap-2.5">
                <button
                  type="button"
                  onClick={() => setReturnCondition('Pristine')}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    returnCondition === 'Pristine'
                      ? 'border-[#881337] bg-white ring-1 ring-[#881337]'
                      : 'border-stone-200 bg-[#f8fafc] text-stone-700'
                  }`}
                >
                  <div className="font-semibold text-xs text-stone-900">Pristine</div>
                  <div className="text-[10px] text-stone-500 mt-0.5">0 stars deducted</div>
                </button>

                <button
                  type="button"
                  onClick={() => setReturnCondition('Minor Damage')}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    returnCondition === 'Minor Damage'
                      ? 'border-[#881337] bg-white ring-1 ring-[#881337]'
                      : 'border-stone-200 bg-[#f8fafc] text-stone-700'
                  }`}
                >
                  <div className="font-semibold text-xs text-stone-900">Minor Damage</div>
                  <div className="text-[10px] text-stone-500 mt-0.5">Bad (-1 star)</div>
                </button>

                <button
                  type="button"
                  onClick={() => setReturnCondition('Severe Damage')}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    returnCondition === 'Severe Damage'
                      ? 'border-[#881337] bg-white ring-1 ring-[#881337]'
                      : 'border-stone-200 bg-[#f8fafc] text-stone-700'
                  }`}
                >
                  <div className="font-semibold text-xs text-stone-900">Severe Damage</div>
                  <div className="text-[10px] text-stone-500 mt-0.5">Worse (-2 stars)</div>
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={returnLoading}
              className="bg-[#881337] hover:bg-[#700f2b] text-white text-xs font-semibold py-3 px-8 rounded-lg shadow-2xs hover:shadow transition-all disabled:opacity-50"
            >
              {returnLoading ? 'Processing return...' : 'Check In Book →'}
            </button>
          </form>
        </div>
      )}

      {/* TAB 4: ISSUE DESK */}
      {tab === 'issue' && (
        <div className="bg-white rounded-xl border border-stone-200/90 p-8 shadow-2xs">
          <h2 className="font-serif text-xl font-bold text-stone-900 mb-1">
            Book Checkout Scanner
          </h2>
          <p className="text-xs text-stone-600 mb-6">
            Input the patron's registered User ID and the barcode on the physical book.
          </p>

          {issueResult && (
            <div className={`mb-6 p-4 rounded-xl text-xs font-medium border ${
              issueResult.success
                ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                : 'bg-rose-50 text-rose-900 border-rose-200'
            }`}>
              {issueResult.message}
            </div>
          )}

          <form onSubmit={handleIssue} className="space-y-5 max-w-lg">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-stone-700 mb-1.5">
                Borrower User ID *
              </label>
              <input
                type="number"
                value={issueUserId}
                onChange={(e) => setIssueUserId(e.target.value)}
                placeholder="e.g. 1 (Student), 2 (Teacher)"
                className="w-full bg-[#f8fafc] border border-stone-300 rounded-lg px-4 py-2.5 text-sm font-mono focus:outline-none focus:border-[#881337]"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-stone-700 mb-1.5">
                Physical Copy Barcode ID *
              </label>
              <input
                type="text"
                value={issueBarcode}
                onChange={(e) => setIssueBarcode(e.target.value)}
                placeholder="e.g. BC-001, BC-004, BC-010"
                className="w-full bg-[#f8fafc] border border-stone-300 rounded-lg px-4 py-2.5 text-sm font-mono focus:outline-none focus:border-[#881337] uppercase"
                required
              />
            </div>

            <button
              type="submit"
              disabled={issueLoading}
              className="bg-[#881337] hover:bg-[#700f2b] text-white text-xs font-semibold py-3 px-8 rounded-lg shadow-2xs hover:shadow transition-all disabled:opacity-50"
            >
              {issueLoading ? 'Authorizing checkout...' : 'Issue Book →'}
            </button>
          </form>
        </div>
      )}

      {/* INSPECTION MODAL: Pending Returns */}
      {inspectingItem && (
        <div className="fixed inset-0 z-50 bg-stone-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full border border-stone-200 shadow-2xl p-6 sm:p-7 animate-in fade-in zoom-in duration-150">
            <div className="flex items-start justify-between mb-4">
              <h3 className="font-serif text-xl font-bold text-stone-900">
                Physical Condition Inspection
              </h3>
              <button
                onClick={() => setInspectingItem(null)}
                className="text-stone-400 hover:text-stone-700 font-bold p-1"
              >
                ✕
              </button>
            </div>

            <div className="p-4 bg-[#f8fafc] rounded-lg border border-stone-200 mb-5 text-xs">
              <div className="font-semibold text-stone-900 text-sm">
                {inspectingItem.title}
              </div>
              <div className="text-stone-600 mt-1 flex items-center gap-2">
                <span className="font-mono text-[11px] font-bold text-stone-700 bg-white border border-stone-300 px-1.5 py-0.5 rounded">
                  {inspectingItem.barcode_id}
                </span>
                <span>Borrower: {inspectingItem.user_name} (#{inspectingItem.user_id})</span>
              </div>
              {inspectingItem.is_overdue === 1 && (
                <div className="mt-2 text-rose-800 font-semibold text-[11px]">
                  Book is {inspectingItem.days_overdue} days overdue. Daily late fee will be calculated automatically.
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-stone-700 mb-2">
                  Assign Condition Rating
                </label>
                <div className="grid grid-cols-3 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setReturnCondition('Pristine')}
                    className={`p-3 rounded-lg border text-left transition-all ${
                      returnCondition === 'Pristine'
                        ? 'border-[#881337] bg-white ring-1 ring-[#881337]'
                        : 'border-stone-200 bg-[#f8fafc] text-stone-700'
                    }`}
                  >
                    <div className="font-semibold text-xs text-stone-900">Pristine</div>
                    <div className="text-[10px] text-stone-500 mt-0.5">0 stars deducted</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setReturnCondition('Minor Damage')}
                    className={`p-3 rounded-lg border text-left transition-all ${
                      returnCondition === 'Minor Damage'
                        ? 'border-[#881337] bg-white ring-1 ring-[#881337]'
                        : 'border-stone-200 bg-[#f8fafc] text-stone-700'
                    }`}
                  >
                    <div className="font-semibold text-xs text-stone-900">Minor Damage</div>
                    <div className="text-[10px] text-stone-500 mt-0.5">Bad (-1 star)</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setReturnCondition('Severe Damage')}
                    className={`p-3 rounded-lg border text-left transition-all ${
                      returnCondition === 'Severe Damage'
                        ? 'border-[#881337] bg-white ring-1 ring-[#881337]'
                        : 'border-stone-200 bg-[#f8fafc] text-stone-700'
                    }`}
                  >
                    <div className="font-semibold text-xs text-stone-900">Severe Damage</div>
                    <div className="text-[10px] text-stone-500 mt-0.5">Worse (-2 stars)</div>
                  </button>
                </div>
              </div>

              <div className="pt-2 flex flex-col gap-2">
                <button
                  type="button"
                  disabled={returnLoading}
                  onClick={() => handleProcessReturn(inspectingItem.barcode_id, returnCondition)}
                  className="w-full bg-[#881337] hover:bg-[#9f1239] text-white font-medium text-xs py-3 rounded-lg transition-colors shadow-xs disabled:opacity-50"
                >
                  {returnLoading ? 'Processing...' : 'Confirm Inspection & Accept Return'}
                </button>
                <button
                  type="button"
                  onClick={() => setInspectingItem(null)}
                  className="w-full text-stone-600 hover:text-stone-900 text-xs py-1.5 text-center font-medium"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* WAITLIST HANDOFF MODAL: Condition Inspection & Continue to Next User */}
      {fulfillingReservation && (
        <div className="fixed inset-0 z-50 bg-stone-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full border border-stone-200 shadow-2xl p-6 sm:p-7 animate-in fade-in zoom-in duration-150">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="font-serif text-xl font-bold text-stone-900">
                  Inspect & Handoff to Waitlist Patron
                </h3>
                <p className="text-xs text-stone-600 mt-0.5">
                  Confirm the physical copy condition before continuing the loan to the next member in queue.
                </p>
              </div>
              <button
                onClick={() => setFulfillingReservation(null)}
                className="text-stone-400 hover:text-stone-700 font-bold p-1"
              >
                ✕
              </button>
            </div>

            <div className="p-4 bg-[#f8fafc] rounded-lg border border-stone-200 mb-5 text-xs">
              <div className="font-semibold text-stone-900 text-sm">
                {fulfillingReservation.title}
              </div>
              <div className="text-stone-700 mt-1.5 space-y-1">
                <div>Recipient: <strong className="text-stone-900">{fulfillingReservation.user_name}</strong> (User #{fulfillingReservation.user_id} • {fulfillingReservation.role_name})</div>
                <div>Queue Priority: <strong className="text-[#881337]">{fulfillingReservation.status === 'held' ? 'Priority 48-Hour Hold' : `Position #${fulfillingReservation.queue_position}`}</strong></div>
              </div>
            </div>

            <form onSubmit={handleFulfillWaitlist} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-stone-700 mb-1.5">
                  Physical Copy Barcode
                </label>
                <input
                  type="text"
                  value={waitlistBarcode}
                  onChange={(e) => setWaitlistBarcode(e.target.value)}
                  placeholder="e.g. BC-001"
                  className="w-full bg-white border border-stone-300 rounded-lg px-3.5 py-2 text-xs font-mono uppercase focus:outline-none focus:border-[#881337]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-stone-700 mb-1.5">
                  Condition Rating Before Handing Off *
                </label>
                <div className="grid grid-cols-3 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setWaitlistCondition('Pristine')}
                    className={`p-3 rounded-lg border text-left transition-all ${
                      waitlistCondition === 'Pristine'
                        ? 'border-[#881337] bg-white ring-1 ring-[#881337]'
                        : 'border-stone-200 bg-[#f8fafc] text-stone-700'
                    }`}
                  >
                    <div className="font-semibold text-xs text-stone-900">Pristine</div>
                    <div className="text-[10px] text-stone-500 mt-0.5">Clean & intact</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setWaitlistCondition('Minor Damage')}
                    className={`p-3 rounded-lg border text-left transition-all ${
                      waitlistCondition === 'Minor Damage'
                        ? 'border-[#881337] bg-white ring-1 ring-[#881337]'
                        : 'border-stone-200 bg-[#f8fafc] text-stone-700'
                    }`}
                  >
                    <div className="font-semibold text-xs text-stone-900">Minor Damage</div>
                    <div className="text-[10px] text-stone-500 mt-0.5">Worn</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setWaitlistCondition('Severe Damage')}
                    className={`p-3 rounded-lg border text-left transition-all ${
                      waitlistCondition === 'Severe Damage'
                        ? 'border-[#881337] bg-white ring-1 ring-[#881337]'
                        : 'border-stone-200 bg-[#f8fafc] text-stone-700'
                    }`}
                  >
                    <div className="font-semibold text-xs text-stone-900">Severe Damage</div>
                    <div className="text-[10px] text-stone-500 mt-0.5">Torn / Marked</div>
                  </button>
                </div>
              </div>

              <div className="pt-2 flex flex-col gap-2">
                <button
                  type="submit"
                  disabled={returnLoading}
                  className="w-full bg-[#881337] hover:bg-[#9f1239] text-white font-medium text-xs py-3 rounded-lg transition-colors shadow-xs disabled:opacity-50"
                >
                  {returnLoading ? 'Issuing to recipient...' : 'Confirm Condition & Continue to User'}
                </button>
                <button
                  type="button"
                  onClick={() => setFulfillingReservation(null)}
                  className="w-full text-stone-600 hover:text-stone-900 text-xs py-1.5 text-center font-medium"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
