import React, { useState, useEffect } from 'react';

const API = 'http://localhost:3000';

export default function FinesManager() {
  const [fines, setFines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pending'); // 'pending', 'unpaid', 'cleared', 'all'
  const [payId, setPayId] = useState(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('Cash');
  const [actionMsg, setActionMsg] = useState('');

  const fetchFines = async () => {
    try {
      const res = await fetch(`${API}/api/fines`);
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

  const handleApproveFine = async (transactionId) => {
    setActionMsg('');
    try {
      const res = await fetch(`${API}/api/admin/fines/${transactionId}/approve`, {
        method: 'POST',
      });
      const data = await res.json();
      if (res.ok) {
        setActionMsg(`✓ Fine #${transactionId} approved by admin. It is now active and due for collection.`);
        fetchFines();
      } else {
        setActionMsg(`✕ ${data.error || 'Approval failed'}`);
      }
    } catch (e) {
      setActionMsg('✕ Failed to approve fine');
    }
  };

  const handleRecordPayment = async (transactionId, fullAmount) => {
    setActionMsg('');
    const amount = payAmount || fullAmount;
    try {
      const res = await fetch(`${API}/api/fines/${transactionId}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount_paid: amount, payment_method: payMethod }),
      });
      const data = await res.json();
      if (res.ok) {
        setActionMsg(`✓ Desk payment of ₹${amount} recorded via [${payMethod}].`);
        setPayId(null);
        setPayAmount('');
        fetchFines();
      } else {
        setActionMsg(`✕ ${data.error || 'Payment record failed'}`);
      }
    } catch (e) {
      setActionMsg('✕ Failed to record payment');
    }
  };

  const handleWaive = async (transactionId) => {
    if (!window.confirm('Are you sure you want to dismiss / waive this fine?')) return;
    setActionMsg('');
    try {
      const res = await fetch(`${API}/api/fines/${transactionId}/waive`, {
        method: 'POST',
      });
      const data = await res.json();
      if (res.ok) {
        setActionMsg(`✓ Fine #${transactionId} administratively waived / dismissed.`);
        fetchFines();
      } else {
        setActionMsg(`✕ ${data.error || 'Waiver failed'}`);
      }
    } catch (e) {
      setActionMsg('✕ Failed to waive fine');
    }
  };

  const pendingApprovalFines = fines.filter((f) => f.status === 'pending_approval');
  const unpaidFines = fines.filter((f) => f.status === 'unpaid');
  const clearedFines = fines.filter((f) => f.status === 'paid' || f.status === 'waived');

  const displayedFines =
    activeTab === 'pending'
      ? pendingApprovalFines
      : activeTab === 'unpaid'
      ? unpaidFines
      : activeTab === 'cleared'
      ? clearedFines
      : fines;

  const totalAssessed = fines.reduce((sum, f) => sum + parseFloat(f.amount_assessed || 0), 0);
  const totalCollected = fines.reduce((sum, f) => sum + parseFloat(f.amount_paid || 0), 0);
  const totalApprovedOutstanding = unpaidFines.reduce(
    (sum, f) => sum + (parseFloat(f.amount_assessed) - parseFloat(f.amount_paid || 0)),
    0
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-8 py-10 font-sans">
      
      {/* Header */}
      <div className="max-w-2xl mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-stone-900 tracking-tight leading-tight">
          Fines & Revenue Ledger
        </h1>
        <p className="text-stone-800 font-medium text-sm mt-1.5">
          Review and approve pending overdue or damage penalties, record desk collections, and grant administrative waivers.
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

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-8">
        
        <div className="bg-white rounded-xl border border-stone-200/90 p-5 shadow-2xs">
          <span className="text-xs font-semibold uppercase tracking-wider text-amber-800">Pending Admin Sign-Off</span>
          <div className="text-3xl font-serif font-bold text-amber-900 mt-1">
            {pendingApprovalFines.length}
          </div>
          <p className="text-[11px] text-stone-500 mt-1">Awaiting admin approval</p>
        </div>

        <div className="bg-white rounded-xl border border-stone-200/90 p-5 shadow-2xs">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#881337]">Approved Active Dues</span>
          <div className={`text-3xl font-serif font-bold mt-1 ${totalApprovedOutstanding > 0 ? 'text-[#881337]' : 'text-stone-900'}`}>
            ₹{totalApprovedOutstanding.toFixed(2)}
          </div>
          <p className="text-[11px] text-stone-500 mt-1">Approved patron debt</p>
        </div>

        <div className="bg-white rounded-xl border border-stone-200/90 p-5 shadow-2xs">
          <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Collected Revenue</span>
          <div className="text-3xl font-serif font-bold text-emerald-800 mt-1">
            ₹{totalCollected.toFixed(2)}
          </div>
          <p className="text-[11px] text-stone-500 mt-1">Paid receipts settled</p>
        </div>

        <div className="bg-white rounded-xl border border-stone-200/90 p-5 shadow-2xs">
          <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">Total Assessed</span>
          <div className="text-3xl font-serif font-bold text-stone-900 mt-1">
            ₹{totalAssessed.toFixed(2)}
          </div>
          <p className="text-[11px] text-stone-500 mt-1">System lifetime fines</p>
        </div>

      </div>

      {/* Navigation Filter Tabs */}
      <div className="flex gap-2 p-1 bg-stone-100/90 border border-stone-200 rounded-xl max-w-xl mb-6">
        <button
          onClick={() => setActiveTab('pending')}
          className={`flex-1 py-2 px-3 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'pending'
              ? 'bg-[#881337] text-white shadow-xs'
              : 'text-stone-700 hover:text-stone-900'
          }`}
        >
          <span>Pending Approval</span>
          {pendingApprovalFines.length > 0 && (
            <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
              activeTab === 'pending' ? 'bg-white text-[#881337]' : 'bg-amber-200 text-amber-900'
            }`}>
              {pendingApprovalFines.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('unpaid')}
          className={`flex-1 py-2 px-3 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'unpaid'
              ? 'bg-[#881337] text-white shadow-xs'
              : 'text-stone-700 hover:text-stone-900'
          }`}
        >
          <span>Active Dues</span>
          {unpaidFines.length > 0 && (
            <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
              activeTab === 'unpaid' ? 'bg-white text-[#881337]' : 'bg-rose-100 text-[#881337]'
            }`}>
              {unpaidFines.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('cleared')}
          className={`flex-1 py-2 px-3 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'cleared'
              ? 'bg-[#881337] text-white shadow-xs'
              : 'text-stone-700 hover:text-stone-900'
          }`}
        >
          <span>Cleared / Waived</span>
        </button>

        <button
          onClick={() => setActiveTab('all')}
          className={`flex-1 py-2 px-3 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'all'
              ? 'bg-[#881337] text-white shadow-xs'
              : 'text-stone-700 hover:text-stone-900'
          }`}
        >
          <span>All ({fines.length})</span>
        </button>
      </div>

      {/* Fines Table */}
      <div className="bg-white rounded-xl border border-stone-200/90 shadow-2xs overflow-hidden">
        <div className="p-5 border-b border-stone-100 flex items-center justify-between">
          <h2 className="font-serif text-lg font-bold text-stone-900">
            {activeTab === 'pending'
              ? 'Fines Awaiting Admin Approval'
              : activeTab === 'unpaid'
              ? 'Active Unpaid Fines'
              : activeTab === 'cleared'
              ? 'Settled & Waived Transactions'
              : 'Full Ledger Records'}
          </h2>
          <span className="text-xs text-stone-500 font-medium">
            {displayedFines.length} record{displayedFines.length !== 1 ? 's' : ''}
          </span>
        </div>

        {loading ? (
          <div className="py-16 text-center">
            <div className="inline-block animate-spin w-8 h-8 border-2 border-[#881337] border-t-transparent rounded-full mb-3"></div>
            <p className="text-sm font-medium text-stone-700">Loading audit records...</p>
          </div>
        ) : displayedFines.length === 0 ? (
          <div className="p-12 text-center text-xs text-stone-500">
            {activeTab === 'pending'
              ? 'No fines currently pending admin approval. All assessments are processed.'
              : 'No records found in this category.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#f8fafc] border-b border-stone-200 text-stone-700 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3.5 px-6 font-semibold">Tx ID</th>
                  <th className="py-3.5 px-4 font-semibold">Member</th>
                  <th className="py-3.5 px-4 font-semibold">Book & Reason</th>
                  <th className="py-3.5 px-4 font-semibold">Assessed</th>
                  <th className="py-3.5 px-4 font-semibold">Paid</th>
                  <th className="py-3.5 px-4 font-semibold">Status</th>
                  <th className="py-3.5 px-6 font-semibold text-right">Desk Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {displayedFines.map((f) => {
                  const isPending = f.status === 'pending_approval';
                  const isUnpaid = f.status === 'unpaid';
                  const isPaid = f.status === 'paid';
                  const isWaived = f.status === 'waived';

                  return (
                    <React.Fragment key={f.transaction_id}>
                      <tr className="hover:bg-stone-50/50 transition-colors">
                        <td className="py-4 px-6 font-mono text-[11px] text-stone-500 font-semibold">
                          #{f.transaction_id}
                        </td>
                        <td className="py-4 px-4 font-medium text-stone-900">
                          <div>{f.user_name || `User #${f.user_id}`}</div>
                          {f.user_email && <div className="text-[10px] text-stone-500 font-normal">{f.user_email}</div>}
                        </td>
                        <td className="py-4 px-4 max-w-sm">
                          <div className="font-semibold text-stone-900">
                            {f.book_title || `Loan #${f.borrow_id || 'Direct'}`}
                          </div>
                          {f.fine_reason && (
                            <div className="text-[11px] text-stone-600 mt-0.5 leading-tight">
                              {f.fine_reason}
                            </div>
                          )}
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
                            {isPending ? 'Pending Approval' : f.status}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-right space-x-2">
                          {isPending ? (
                            <>
                              <button
                                onClick={() => handleApproveFine(f.transaction_id)}
                                className="bg-emerald-800 hover:bg-emerald-900 text-white text-[11px] font-semibold px-3 py-1.5 rounded-lg transition-all shadow-2xs"
                              >
                                Approve Fine ✓
                              </button>
                              <button
                                onClick={() => handleWaive(f.transaction_id)}
                                className="border border-stone-300 hover:bg-stone-100 text-stone-700 text-[11px] font-medium px-2.5 py-1.5 rounded-lg transition-all"
                              >
                                Waive / Dismiss
                              </button>
                            </>
                          ) : isUnpaid ? (
                            <>
                              <button
                                onClick={() => {
                                  setPayId(payId === f.transaction_id ? null : f.transaction_id);
                                  setPayAmount(f.amount_assessed);
                                }}
                                className="bg-[#881337] hover:bg-[#700f2b] text-white text-[11px] font-semibold px-3 py-1.5 rounded-lg transition-all shadow-2xs"
                              >
                                Record Pay
                              </button>
                              <button
                                onClick={() => handleWaive(f.transaction_id)}
                                className="border border-stone-300 hover:bg-stone-100 text-stone-700 text-[11px] font-medium px-2.5 py-1.5 rounded-lg transition-all"
                              >
                                Waive
                              </button>
                            </>
                          ) : (
                            <span className="text-[11px] text-stone-500 font-medium">Cleared</span>
                          )}
                        </td>
                      </tr>

                      {/* Desk Payment Drawer */}
                      {payId === f.transaction_id && (
                        <tr className="bg-rose-50/30">
                          <td colSpan="7" className="py-4 px-6 border-t border-rose-100">
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
                                  <option value="Cash">Cash at Desk</option>
                                  <option value="Online">UPI / Card</option>
                                  <option value="Waiver">Administrative Waiver</option>
                                </select>
                              </div>
                              <button
                                onClick={() => handleRecordPayment(f.transaction_id, f.amount_assessed)}
                                className="bg-emerald-800 hover:bg-emerald-900 text-white font-semibold px-3.5 py-1 rounded text-xs transition-colors"
                              >
                                Confirm Payment
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
