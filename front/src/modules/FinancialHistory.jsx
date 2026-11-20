import React, { useState, useEffect } from 'react';

const API = 'http://localhost:3000';

export default function FinancialHistory() {
  const user = JSON.parse(localStorage.getItem('user') || 'null');
  const [fines, setFines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [payId, setPayId] = useState(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('UPI');
  const [actionMsg, setActionMsg] = useState('');

  const fetchFines = async () => {
    if (!user) return;
    try {
      const res = await fetch(`${API}/api/users/${user.id || user.user_id}/fines`);
      if (res.ok) setFines(await res.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFines();
  }, []);

  const handlePay = async (transaction_id, fullAmount) => {
    setActionMsg('');
    const amount = payAmount || fullAmount;
    try {
      const res = await fetch(`${API}/api/fines/${transaction_id}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount_paid: amount, payment_method: payMethod }),
      });
      const data = await res.json();
      if (res.ok) {
        setActionMsg(`✓ Payment of ₹${amount} recorded via ${payMethod}. Receipt generated.`);
        setPayId(null);
        setPayAmount('');
        fetchFines();
      } else {
        setActionMsg(`✕ ${data.error || 'Payment failed'}`);
      }
    } catch (e) {
      setActionMsg('✕ Failed to process payment');
    }
  };

  const totalAssessed = fines.reduce((sum, f) => sum + parseFloat(f.amount_assessed || 0), 0);
  const totalPaid = fines.reduce((sum, f) => sum + parseFloat(f.amount_paid || 0), 0);
  const activeUnpaidFines = fines.filter((f) => f.status === 'unpaid');
  const pendingApprovalFines = fines.filter((f) => f.status === 'pending_approval');
  const balanceDue = activeUnpaidFines.reduce(
    (sum, f) => sum + (parseFloat(f.amount_assessed) - parseFloat(f.amount_paid || 0)),
    0
  );

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-8 py-10 font-sans">
      
      {/* Header */}
      <div className="max-w-2xl mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-stone-900 tracking-tight leading-tight">
          Financial Account Statement
        </h1>
        <p className="text-stone-800 font-medium text-sm mt-1.5">
          Itemized log of assessed late return fees, damage condition penalties, and payment receipts.
        </p>
      </div>

      {actionMsg && (
        <div className={`mb-6 p-4 rounded-xl text-xs font-medium flex items-center justify-between border ${
          actionMsg.startsWith('✓')
            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
            : 'bg-rose-50 text-rose-800 border-rose-200'
        }`}>
          <span>{actionMsg}</span>
          <button onClick={() => setActionMsg('')} className="text-stone-400 hover:text-stone-700 font-bold ml-4">✕</button>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8">
        
        <div className="bg-white rounded-xl border border-stone-200/90 p-5 shadow-2xs">
          <span className="text-xs font-semibold uppercase tracking-wider text-stone-600">Total Assessed</span>
          <div className="text-2xl font-serif font-bold text-stone-900 mt-1">₹{totalAssessed.toFixed(2)}</div>
          <p className="text-[11px] text-stone-500 mt-1">Lifetime penalties recorded</p>
        </div>

        <div className="bg-white rounded-xl border border-stone-200/90 p-5 shadow-2xs">
          <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Total Settled</span>
          <div className="text-2xl font-serif font-bold text-emerald-800 mt-1">₹{totalPaid.toFixed(2)}</div>
          <p className="text-[11px] text-stone-500 mt-1">Receipted & confirmed</p>
        </div>

        <div className="bg-white rounded-xl border border-stone-200/90 p-5 shadow-2xs">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#881337]">Active Balance Due</span>
          <div className={`text-2xl font-serif font-bold mt-1 ${balanceDue > 0 ? 'text-[#881337]' : 'text-stone-900'}`}>
            ₹{balanceDue.toFixed(2)}
          </div>
          <p className="text-[11px] text-stone-500 mt-1">
            {pendingApprovalFines.length > 0 ? `${pendingApprovalFines.length} penalty under admin review` : balanceDue > 0 ? 'Approved payment required' : 'No outstanding balances'}
          </p>
        </div>

      </div>

      {/* Receipts Table */}
      <div className="bg-white rounded-xl border border-stone-200/90 shadow-2xs overflow-hidden">
        <div className="p-5 border-b border-stone-100 flex items-center justify-between">
          <h2 className="font-serif text-lg font-bold text-stone-900">
            Transaction Ledger
          </h2>
          <span className="text-xs text-stone-500 font-medium">{fines.length} record{fines.length !== 1 ? 's' : ''}</span>
        </div>

        {loading ? (
          <div className="py-16 text-center">
            <div className="inline-block animate-spin w-8 h-8 border-2 border-[#881337] border-t-transparent rounded-full mb-3"></div>
            <p className="text-sm font-medium text-stone-700">Loading receipts...</p>
          </div>
        ) : fines.length === 0 ? (
          <div className="p-12 text-center text-xs text-stone-500">
            No fines or penalties recorded on your account.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#f8fafc] border-b border-stone-200 text-stone-700 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3.5 px-6 font-semibold">Title & Reason</th>
                  <th className="py-3.5 px-4 font-semibold">Return / Due</th>
                  <th className="py-3.5 px-4 font-semibold">Assessed</th>
                  <th className="py-3.5 px-4 font-semibold">Paid</th>
                  <th className="py-3.5 px-4 font-semibold">Status</th>
                  <th className="py-3.5 px-6 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {fines.map((f) => {
                  const isPending = f.status === 'pending_approval';
                  const isUnpaid = f.status === 'unpaid';
                  const isPaid = f.status === 'paid';
                  const isWaived = f.status === 'waived';

                  return (
                    <React.Fragment key={f.transaction_id}>
                      <tr className="hover:bg-stone-50/50 transition-colors">
                        <td className="py-4 px-6 max-w-sm">
                          <div className="font-medium text-stone-900">
                            {f.title || `Loan #${f.borrow_id || 'Direct'}`}
                          </div>
                          {f.fine_reason && (
                            <div className="text-[11px] text-stone-600 mt-0.5 leading-tight">
                              {f.fine_reason}
                            </div>
                          )}
                        </td>
                        <td className="py-4 px-4 text-stone-600 text-[11px]">
                          <div>Due: {f.due_date ? new Date(f.due_date).toLocaleDateString() : '—'}</div>
                          <div className="text-stone-500">Ret: {f.return_date ? new Date(f.return_date).toLocaleDateString() : 'Active'}</div>
                        </td>
                        <td className="py-4 px-4 font-bold text-stone-900">
                          ₹{parseFloat(f.amount_assessed).toFixed(2)}
                        </td>
                        <td className="py-4 px-4 font-semibold text-emerald-700">
                          ₹{parseFloat(f.amount_paid || 0).toFixed(2)}
                        </td>
                        <td className="py-4 px-4">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                              isPending
                                ? 'bg-amber-50 text-amber-900 border border-amber-200'
                                : isPaid
                                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                : isWaived
                                ? 'bg-stone-100 text-stone-700 border border-stone-200'
                                : 'bg-rose-50 text-rose-800 border border-rose-200'
                            }`}
                          >
                            {isPending ? 'Pending Admin Review' : isUnpaid ? 'Payment Due' : f.status}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-right">
                          {isPending ? (
                            <span className="text-[11px] text-amber-900 font-medium bg-amber-50 px-2 py-1 rounded border border-amber-200">
                              Awaiting Admin Review
                            </span>
                          ) : isUnpaid ? (
                            <button
                              onClick={() => {
                                setPayId(payId === f.transaction_id ? null : f.transaction_id);
                                setPayAmount(f.amount_assessed);
                              }}
                              className="bg-[#881337] hover:bg-[#700f2b] text-white text-[11px] font-semibold px-3 py-1.5 rounded-lg transition-all shadow-2xs"
                            >
                              Pay Now →
                            </button>
                          ) : (
                            <span className="text-[11px] text-stone-500 font-medium">Cleared</span>
                          )}
                        </td>
                      </tr>

                      {/* Payment Drawer */}
                      {payId === f.transaction_id && (
                        <tr className="bg-rose-50/30">
                          <td colSpan="6" className="py-4 px-6 border-t border-rose-100">
                            <div className="flex flex-wrap items-center gap-4 text-xs">
                              <span className="font-semibold text-stone-900">
                                Settle Fine #{f.transaction_id}:
                              </span>
                              <div className="flex items-center gap-2">
                                <label className="text-stone-700">Amount (₹):</label>
                                <input
                                  type="number"
                                  value={payAmount}
                                  onChange={(e) => setPayAmount(e.target.value)}
                                  className="w-24 bg-white border border-stone-300 rounded px-2 py-1 text-xs"
                                />
                              </div>
                              <div className="flex items-center gap-2">
                                <label className="text-stone-700">Method:</label>
                                <select
                                  value={payMethod}
                                  onChange={(e) => setPayMethod(e.target.value)}
                                  className="bg-white border border-stone-300 rounded px-2 py-1 text-xs"
                                >
                                  <option value="UPI">Instant UPI</option>
                                  <option value="Debit Card">Debit / ATM Card</option>
                                  <option value="NetBanking">Net Banking</option>
                                </select>
                              </div>
                              <button
                                onClick={() => handlePay(f.transaction_id, f.amount_assessed)}
                                className="bg-emerald-800 hover:bg-emerald-900 text-white font-semibold px-3.5 py-1 rounded text-xs transition-colors"
                              >
                                Settle Dues
                              </button>
                              <button
                                onClick={() => setPayId(null)}
                                className="text-stone-500 hover:text-stone-800 text-xs ml-auto"
                              >
                                Cancel
                              </button>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
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
