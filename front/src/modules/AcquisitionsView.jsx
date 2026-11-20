import React, { useState, useEffect } from 'react';

const API = 'http://localhost:3000';

export default function AcquisitionsView() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionMsg, setActionMsg] = useState('');
  const [activeTab, setActiveTab] = useState('pending'); // 'pending' | 'approved' | 'rejected'

  const fetchRequests = async () => {
    try {
      const res = await fetch(`${API}/api/book-requests`);
      if (res.ok) setRequests(await res.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const handleUpdateStatus = async (requestId, newStatus) => {
    setActionMsg('');
    try {
      const res = await fetch(`${API}/api/book-requests/${requestId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        setActionMsg(`✓ Request #${requestId} updated to [${newStatus}].`);
        fetchRequests();
      } else {
        setActionMsg('✕ Failed to update request status');
      }
    } catch (e) {
      setActionMsg('✕ Network error updating status');
    }
  };

  const pendingRequests = requests.filter((r) => r.status === 'pending');
  const approvedRequests = requests.filter((r) => r.status === 'approved');
  const rejectedRequests = requests.filter((r) => r.status === 'rejected');

  const displayedRequests =
    activeTab === 'pending'
      ? pendingRequests
      : activeTab === 'approved'
      ? approvedRequests
      : rejectedRequests;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-8 py-10 font-sans">
      
      {/* Header */}
      <div className="max-w-2xl mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-stone-900 tracking-tight leading-tight">
          Book Approvals
        </h1>
        <p className="text-stone-800 font-medium text-sm mt-1.5">
          Review member purchase proposals ranked by community upvotes, manage procurement status, and track historical decisions.
        </p>
      </div>

      {actionMsg && (
        <div className={`mb-6 p-4 rounded-xl text-xs font-medium flex items-center justify-between border ${
          actionMsg.startsWith('✓')
            ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
            : 'bg-rose-50 text-rose-900 border-rose-200'
        }`}>
          <span>{actionMsg}</span>
          <button onClick={() => setActionMsg('')} className="text-stone-400 hover:text-stone-700 font-bold ml-4">✕</button>
        </div>
      )}

      {/* Status Section Tabs */}
      <div className="flex gap-2 p-1 bg-stone-100/90 border border-stone-200 rounded-xl max-w-md mb-8">
        <button
          onClick={() => setActiveTab('pending')}
          className={`flex-1 py-2 px-3 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'pending'
              ? 'bg-[#881337] text-white shadow-xs'
              : 'text-stone-700 hover:text-stone-900'
          }`}
        >
          <span>Pending Approvals</span>
          <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${activeTab === 'pending' ? 'bg-white text-[#881337]' : 'bg-stone-200 text-stone-700'}`}>
            {pendingRequests.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('approved')}
          className={`flex-1 py-2 px-3 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'approved'
              ? 'bg-[#881337] text-white shadow-xs'
              : 'text-stone-700 hover:text-stone-900'
          }`}
        >
          <span>Approved</span>
          <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${activeTab === 'approved' ? 'bg-white text-[#881337]' : 'bg-stone-200 text-stone-700'}`}>
            {approvedRequests.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('rejected')}
          className={`flex-1 py-2 px-3 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'rejected'
              ? 'bg-[#881337] text-white shadow-xs'
              : 'text-stone-700 hover:text-stone-900'
          }`}
        >
          <span>Declined</span>
          <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${activeTab === 'rejected' ? 'bg-white text-[#881337]' : 'bg-stone-200 text-stone-700'}`}>
            {rejectedRequests.length}
          </span>
        </button>
      </div>

      {loading ? (
        <div className="py-20 text-center">
          <div className="inline-block animate-spin w-8 h-8 border-2 border-[#881337] border-t-transparent rounded-full mb-3"></div>
          <p className="text-sm font-medium text-stone-700">Loading book requests...</p>
        </div>
      ) : displayedRequests.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-stone-200 p-12 text-center">
          <p className="text-xs text-stone-600">
            {activeTab === 'pending'
              ? 'No book proposals currently awaiting administrative review.'
              : activeTab === 'approved'
              ? 'No books in the approved procurement list.'
              : 'No declined proposals.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {displayedRequests.map((r) => {
            const isApproved = r.status === 'approved';
            const isRejected = r.status === 'rejected';
            return (
              <div
                key={r.request_id}
                className="bg-white rounded-xl border border-stone-200/90 p-6 shadow-2xs hover:shadow-xs transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-6"
              >
                <div className="flex items-start gap-5">
                  {/* Upvote score badge */}
                  <div className="flex flex-col items-center justify-center min-w-[60px] py-2 px-3 rounded-lg bg-stone-50 border border-stone-200">
                    <span className="text-[10px] text-stone-500 font-semibold uppercase">Votes</span>
                    <span className="text-xl font-bold font-serif text-[#881337]">
                      {r.upvote_count || 0}
                    </span>
                  </div>

                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                          isApproved
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : isRejected
                            ? 'bg-rose-50 text-rose-800 border border-rose-200'
                            : 'bg-amber-50 text-amber-900 border border-amber-200'
                        }`}
                      >
                        {r.status}
                      </span>
                      {r.isbn && (
                        <span className="font-mono text-[10px] text-stone-500">
                          ISBN: {r.isbn}
                        </span>
                      )}
                    </div>

                    <h3 className="font-serif text-lg font-bold text-stone-900 leading-snug">
                      {r.book_title}
                    </h3>

                    <p className="text-xs text-stone-700 mt-1">
                      {r.author_name ? `Author: ${r.author_name} • ` : ''}Requested by{' '}
                      <span className="text-stone-900 font-semibold">{r.requester_name || 'Member'}</span> •{' '}
                      <span className="text-stone-500">{new Date(r.created_at).toLocaleDateString()}</span>
                    </p>
                  </div>
                </div>

                {/* Actions: Approve / Decline / Revert */}
                <div className="flex items-center gap-2 shrink-0 border-t sm:border-t-0 pt-3 sm:pt-0 border-stone-100">
                  {r.status === 'pending' ? (
                    <>
                      <button
                        onClick={() => handleUpdateStatus(r.request_id, 'approved')}
                        className="rounded-lg px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs transition-colors"
                      >
                        Approve Book
                      </button>
                      <button
                        onClick={() => handleUpdateStatus(r.request_id, 'rejected')}
                        className="rounded-lg px-4 py-2 text-xs font-semibold border border-stone-300 hover:bg-stone-50 text-stone-700 transition-colors"
                      >
                        Decline
                      </button>
                    </>
                  ) : (
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-stone-600 font-medium">
                        {isApproved ? 'Status: Approved' : 'Status: Declined'}
                      </span>
                      <button
                        onClick={() => handleUpdateStatus(r.request_id, 'pending')}
                        className="rounded-lg px-3 py-1.5 text-xs font-medium border border-stone-300 hover:bg-stone-100 text-stone-800 transition-colors"
                        title="Revert back to Pending review"
                      >
                        Revert Choice ↺
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}
