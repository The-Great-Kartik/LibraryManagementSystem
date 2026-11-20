import React, { useState, useEffect } from 'react';

const API = 'http://localhost:3000';

export default function BookRequests() {
  const user = JSON.parse(localStorage.getItem('user') || 'null');
  const [requests, setRequests] = useState([]);
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [isbn, setIsbn] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState('');

  const currentUserId = user?.id || user?.user_id || 0;

  const fetchRequests = async () => {
    try {
      const res = await fetch(`${API}/api/book-requests?user_id=${currentUserId}`);
      if (res.ok) setRequests(await res.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, [currentUserId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !user) return;
    setSubmitting(true);
    setMsg('');

    try {
      const res = await fetch(`${API}/api/book-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: currentUserId,
          book_title: title,
          author_name: author,
          isbn,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setMsg('✓ Book request submitted! Fellow members can now upvote your suggestion.');
        setTitle('');
        setAuthor('');
        setIsbn('');
        fetchRequests();
      } else {
        setMsg(`✕ ${data.error || 'Submission failed'}`);
      }
    } catch (e) {
      setMsg('✕ Server error submitting request');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleUpvote = async (requestId) => {
    if (!user) return;
    try {
      const res = await fetch(`${API}/api/book-requests/${requestId}/upvote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: currentUserId }),
      });
      const data = await res.json();
      if (res.ok) {
        fetchRequests();
      } else {
        alert(data.error || 'Could not process upvote.');
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-8 py-10 font-sans">
      
      {/* Header */}
      <div className="max-w-2xl mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-stone-900 tracking-tight leading-tight">
          Book Procurement Requests
        </h1>
        <p className="text-stone-800 font-medium text-sm mt-1.5">
          Submit missing titles for library procurement and upvote recommendations to influence acquisition priorities.
        </p>
      </div>

      {msg && (
        <div className={`mb-6 p-4 rounded-xl text-xs font-medium flex items-center justify-between border ${
          msg.startsWith('✓')
            ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
            : 'bg-rose-50 text-rose-900 border-rose-200'
        }`}>
          <span>{msg}</span>
          <button onClick={() => setMsg('')} className="text-stone-400 hover:text-stone-700 font-bold ml-4">✕</button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Suggestion Form */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl border border-stone-200/90 p-6 shadow-2xs">
            <h2 className="font-serif text-lg font-bold text-stone-900 mb-1">
              Suggest a Title
            </h2>
            <p className="text-xs text-stone-600 mb-5">
              Can't find a textbook needed for your studies? Submit its details for collective consideration.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-stone-700 mb-1.5">
                  Book Title *
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Modern Operating Systems"
                  className="w-full bg-[#f8fafc] border border-stone-300 rounded-lg px-3.5 py-2 text-xs focus:outline-none focus:border-[#881337]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-stone-700 mb-1.5">
                  Author Name
                </label>
                <input
                  type="text"
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                  placeholder="e.g. Andrew Tanenbaum"
                  className="w-full bg-[#f8fafc] border border-stone-300 rounded-lg px-3.5 py-2 text-xs focus:outline-none focus:border-[#881337]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-stone-700 mb-1.5">
                  ISBN (Optional)
                </label>
                <input
                  type="text"
                  value={isbn}
                  onChange={(e) => setIsbn(e.target.value)}
                  placeholder="e.g. 9780133591620"
                  className="w-full bg-[#f8fafc] border border-stone-300 rounded-lg px-3.5 py-2 text-xs font-mono focus:outline-none focus:border-[#881337]"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-[#881337] hover:bg-[#9f1239] text-white text-xs font-semibold py-2.5 rounded-lg shadow-2xs transition-colors disabled:opacity-50"
              >
                {submitting ? 'Submitting...' : 'Submit Suggestion →'}
              </button>
            </form>
          </div>
        </div>

        {/* Requests List */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-serif text-xl font-bold text-stone-900">
              Community Leaderboard
            </h2>
            <span className="text-xs text-stone-600 font-medium">Sorted by upvotes</span>
          </div>

          {loading ? (
            <div className="py-16 text-center">
              <div className="inline-block animate-spin w-8 h-8 border-2 border-[#881337] border-t-transparent rounded-full mb-3"></div>
              <p className="text-sm font-medium text-stone-700">Loading suggestions...</p>
            </div>
          ) : requests.length === 0 ? (
            <div className="bg-white rounded-xl border border-dashed border-stone-200 p-12 text-center">
              <p className="text-xs text-stone-500">No suggestions submitted yet. Be the first to recommend a book!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {requests.map((r) => {
                const isApproved = r.status === 'approved';
                const isRejected = r.status === 'rejected';
                const userHasUpvoted = r.has_upvoted === 1 || r.has_upvoted === true;

                return (
                  <div
                    key={r.request_id}
                    className="bg-white rounded-xl border border-stone-200/90 p-5 shadow-2xs hover:shadow-xs transition-all flex items-center justify-between gap-4"
                  >
                    <div className="flex items-start gap-4 flex-1">
                      {/* Upvote / Revert Button */}
                      <button
                        type="button"
                        onClick={() => handleToggleUpvote(r.request_id)}
                        className="flex flex-col items-center justify-center min-w-[56px] py-2 px-2.5 rounded-lg border transition-all cursor-pointer"
                        style={{
                          backgroundColor: userHasUpvoted ? '#881337' : '#f8fafc',
                          borderColor: userHasUpvoted ? '#881337' : '#cbd5e1',
                          color: userHasUpvoted ? '#ffffff' : '#1c1917',
                          boxShadow: userHasUpvoted ? '0 1px 3px rgba(136, 19, 55, 0.25)' : 'none',
                        }}
                        title={userHasUpvoted ? 'Click to revert / remove your upvote' : 'Click to upvote this title'}
                      >
                        <span
                          className="text-xs leading-none"
                          style={{ color: userHasUpvoted ? '#ffffff' : '#57534e' }}
                        >
                          ▲
                        </span>
                        <span
                          className="text-xs font-bold font-sans mt-0.5 leading-none"
                          style={{ color: userHasUpvoted ? '#ffffff' : '#1c1917' }}
                        >
                          {r.upvote_count || 0}
                        </span>
                        <span
                          className="text-[9px] font-medium tracking-tight mt-1 leading-none"
                          style={{ color: userHasUpvoted ? '#ffe4e6' : '#78716c' }}
                        >
                          {userHasUpvoted ? 'Upvoted' : 'Vote'}
                        </span>
                      </button>

                      <div className="flex-1">
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
                          {userHasUpvoted && (
                            <span className="text-[10px] font-semibold text-rose-800 bg-rose-50 border border-rose-200 px-1.5 py-0.2 rounded">
                              Your Upvote Recorded (Click vote box to revert)
                            </span>
                          )}
                        </div>

                        <h3 className="font-serif text-base font-bold text-stone-900 leading-snug">
                          {r.book_title}
                        </h3>

                        <p className="text-xs text-stone-700 mt-1">
                          {r.author_name ? `By ${r.author_name} • ` : ''}Requested by{' '}
                          <span className="text-stone-900 font-semibold">{r.requester_name || 'Member'}</span>
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
