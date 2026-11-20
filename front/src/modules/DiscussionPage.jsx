import React, { useState, useEffect } from 'react';

const API = 'http://localhost:3000';

export default function DiscussionPage() {
  const [reviews, setReviews] = useState([]);
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedBookFilter, setSelectedBookFilter] = useState('all');
  
  // Post review form state
  const [selectedBookId, setSelectedBookId] = useState('');
  const [rating, setRating] = useState(5);
  const [reviewText, setReviewText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  const currentUser = JSON.parse(localStorage.getItem('user') || 'null');

  const loadDiscussions = async (bookId = 'all') => {
    setLoading(true);
    try {
      let url = `${API}/api/reviews`;
      if (bookId !== 'all') {
        url += `?book_id=${bookId}`;
      }
      const res = await fetch(url);
      if (res.ok) {
        setReviews(await res.json());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const loadBooks = async () => {
    try {
      const res = await fetch(`${API}/api/books`);
      if (res.ok) {
        const data = await res.json();
        setBooks(data);
        if (data.length > 0 && !selectedBookId) {
          setSelectedBookId(data[0].book_id);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadBooks();
    loadDiscussions('all');
  }, []);

  const handleFilterChange = (bookId) => {
    setSelectedBookFilter(bookId);
    loadDiscussions(bookId);
  };

  const handleSubmitReview = async (e) => {
    e.preventDefault();
    if (!currentUser) return;
    if (!reviewText.trim()) {
      setStatusMsg('Please enter your review comments before posting.');
      return;
    }

    setSubmitting(true);
    setStatusMsg('');

    try {
      const res = await fetch(`${API}/api/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          book_id: parseInt(selectedBookId, 10),
          user_id: currentUser.id || currentUser.user_id,
          rating,
          review_text: reviewText.trim(),
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setStatusMsg('✓ Review successfully published to campus discussions!');
        setReviewText('');
        loadDiscussions(selectedBookFilter);
      } else {
        setStatusMsg(`✕ ${data.error || 'Failed to post review'}`);
      }
    } catch (e) {
      setStatusMsg('✕ Error communicating with library server.');
    } finally {
      setSubmitting(false);
    }
  };

  const renderStars = (count) => {
    return Array.from({ length: 5 }, (_, i) => (
      <span key={i} className={i < count ? 'text-amber-500' : 'text-stone-300'}>
        ★
      </span>
    ));
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-8 py-10 font-sans">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 pb-6 border-b border-stone-200/80 gap-4">
        <div>
          <div className="inline-block text-[11px] font-bold uppercase tracking-wider text-[#881337] bg-rose-50 border border-rose-200/70 px-2.5 py-0.5 rounded-full mb-2">
            Academic Community Forum
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-stone-900 tracking-tight leading-tight">
            Book Reviews & Campus Discussions
          </h1>
          <p className="text-stone-700 font-medium text-sm mt-1.5">
            Read peer feedback, syllabus book ratings, and recommendations from students and faculty.
          </p>
        </div>

        <div className="text-xs text-stone-600 bg-stone-100 border border-stone-200 px-3.5 py-2 rounded-xl">
          Total Published Reviews: <strong className="text-stone-900">{reviews.length}</strong>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Post a Review Form */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-xs sticky top-24">
            <h3 className="text-base font-bold text-stone-900 mb-1">
              Share Your Book Review
            </h3>
            <p className="text-xs text-stone-600 mb-5">
              Posting as <strong className="text-stone-800">{currentUser?.name || currentUser?.first_name || 'Member'}</strong> ({currentUser?.role_name || (currentUser?.role_id === 2 ? 'Teacher' : 'Student')})
            </p>

            {statusMsg && (
              <div className={`mb-4 p-3 rounded-xl text-xs font-semibold ${
                statusMsg.startsWith('✓') ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
              }`}>
                {statusMsg}
              </div>
            )}

            <form onSubmit={handleSubmitReview} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-stone-700 mb-1.5">
                  Select Book Title
                </label>
                <select
                  value={selectedBookId}
                  onChange={(e) => setSelectedBookId(e.target.value)}
                  className="w-full bg-stone-50 border border-stone-300 rounded-xl px-3 py-2 text-xs text-stone-900 focus:outline-none focus:border-[#881337]"
                  required
                >
                  {books.map((b) => (
                    <option key={b.book_id} value={b.book_id}>
                      {b.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-stone-700 mb-1.5">
                  Star Rating (1 to 5)
                </label>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      className="text-2xl transition-transform hover:scale-110 focus:outline-none"
                    >
                      <span className={star <= rating ? 'text-amber-500' : 'text-stone-300'}>
                        ★
                      </span>
                    </button>
                  ))}
                  <span className="text-xs font-bold text-stone-700 ml-2 font-mono">
                    {rating} / 5 Stars
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-stone-700 mb-1.5">
                  Review & Discussion Notes
                </label>
                <textarea
                  rows={4}
                  value={reviewText}
                  onChange={(e) => setReviewText(e.target.value)}
                  placeholder="Share insights on content depth, clarity, course relevance, and recommendation..."
                  className="w-full bg-stone-50 border border-stone-300 rounded-xl p-3 text-xs text-stone-900 focus:outline-none focus:border-[#881337] placeholder:text-stone-400"
                  required
                ></textarea>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-[#881337] hover:bg-[#700f2b] active:scale-[0.99] text-white py-2.5 px-4 rounded-xl text-xs font-semibold shadow-xs hover:shadow transition-all disabled:opacity-50"
              >
                {submitting ? 'Publishing...' : 'Post to Discussion Board →'}
              </button>
            </form>
          </div>
        </div>

        {/* Right Column: Discussion Feed & Filters */}
        <div className="lg:col-span-2 space-y-5">
          
          {/* Filter Bar */}
          <div className="bg-white rounded-2xl border border-stone-200 p-4 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-stone-700">Filter By Book:</span>
              <select
                value={selectedBookFilter}
                onChange={(e) => handleFilterChange(e.target.value)}
                className="bg-stone-50 border border-stone-300 rounded-lg px-3 py-1.5 text-xs text-stone-800 focus:outline-none focus:border-[#881337] max-w-xs"
              >
                <option value="all">All Books ({reviews.length})</option>
                {books.map((b) => (
                  <option key={b.book_id} value={b.book_id}>
                    {b.title}
                  </option>
                ))}
              </select>
            </div>

            {selectedBookFilter !== 'all' && (
              <button
                onClick={() => handleFilterChange('all')}
                className="text-xs text-[#881337] hover:underline font-semibold"
              >
                Clear Filter ✕
              </button>
            )}
          </div>

          {/* Reviews List */}
          {loading ? (
            <div className="py-20 text-center">
              <div className="inline-block animate-spin w-8 h-8 border-2 border-[#881337] border-t-transparent rounded-full mb-3"></div>
              <p className="text-xs font-medium text-stone-600">Loading campus discussions...</p>
            </div>
          ) : reviews.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-stone-200 p-12 text-center">
              <p className="text-sm font-semibold text-stone-800">No discussions yet for this title</p>
              <p className="text-xs text-stone-500 mt-1">Be the first to return or submit a review!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {reviews.map((rev) => (
                <div
                  key={rev.review_id}
                  className="bg-white rounded-2xl border border-stone-200 p-5 shadow-2xs hover:shadow-xs transition-all"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-stone-900">{rev.user_name}</span>
                      <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${
                        rev.role_name === 'teacher'
                          ? 'bg-purple-50 text-purple-800 border-purple-200'
                          : 'bg-rose-50 text-[#881337] border-rose-200'
                      }`}>
                        {rev.role_name === 'teacher' ? 'Faculty' : 'Student'}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 text-sm">
                      {renderStars(rev.rating)}
                    </div>
                  </div>

                  <div className="mb-2">
                    <span className="text-xs font-semibold text-[#881337] bg-rose-50/70 border border-rose-200/50 px-2 py-0.5 rounded">
                      Book: {rev.book_title}
                    </span>
                  </div>

                  <p className="text-xs text-stone-700 leading-relaxed whitespace-pre-line mt-2">
                    {rev.review_text}
                  </p>

                  <div className="mt-3 pt-2.5 border-t border-stone-100 flex items-center justify-between text-[11px] text-stone-500">
                    <span>ISBN: {rev.isbn}</span>
                    <span>{new Date(rev.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

        </div>

      </div>

    </div>
  );
}
