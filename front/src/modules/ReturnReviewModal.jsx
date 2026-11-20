import React, { useState } from 'react';

const API = 'http://localhost:3000';

export default function ReturnReviewModal({ borrow, onClose, onSubmitSuccess }) {
  const [rating, setRating] = useState(5);
  const [reviewText, setReviewText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const currentUser = JSON.parse(localStorage.getItem('user') || 'null');

  if (!borrow) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!currentUser) return;

    setSubmitting(true);
    setErrorMsg('');

    try {
      const res = await fetch(`${API}/api/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          book_id: borrow.book_id || null,
          barcode_id: borrow.barcode_id || null,
          user_id: currentUser.id || currentUser.user_id,
          rating,
          review_text: reviewText.trim() || 'Returned by patron with positive reading experience.',
        }),
      });

      const data = await res.json();
      if (res.ok) {
        if (onSubmitSuccess) onSubmitSuccess(data);
        onClose();
      } else {
        setErrorMsg(data.error || 'Failed to submit review.');
      }
    } catch (err) {
      setErrorMsg('Error connecting to library server.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs font-sans animate-fade-in">
      <div className="bg-white w-full max-w-lg rounded-2xl border border-stone-300 shadow-2xl overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="px-6 py-4 bg-stone-50 border-b border-stone-200 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block">
              Return Submitted &bull; Share Experience
            </span>
            <h3 className="text-base font-bold text-stone-900 truncate max-w-sm">
              Review: {borrow.title}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full border border-stone-300 text-stone-500 hover:text-stone-900 hover:bg-stone-200/60 flex items-center justify-center text-xs"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <p className="text-xs text-stone-600">
            You just submitted physical copy <strong className="font-mono text-stone-900">{borrow.barcode_id}</strong> for return. Help fellow students and faculty by rating and reviewing this title on the campus discussion board!
          </p>

          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl font-semibold">
              {errorMsg}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-stone-700 mb-1.5">
              Rating
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
              Your Review / Reading Feedback
            </label>
            <textarea
              rows={3}
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
              placeholder="What did you learn? Was it helpful for your coursework or exams? How was the content clarity?"
              className="w-full bg-stone-50 border border-stone-300 rounded-xl p-3 text-xs text-stone-900 focus:outline-none focus:border-[#881337] placeholder:text-stone-400"
            ></textarea>
          </div>

          <div className="pt-2 flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-stone-600 hover:text-stone-900 text-xs font-semibold"
            >
              Skip for Now
            </button>

            <button
              type="submit"
              disabled={submitting}
              className="bg-[#881337] hover:bg-[#700f2b] text-white px-5 py-2.5 rounded-xl text-xs font-semibold shadow-xs hover:shadow transition-all disabled:opacity-50"
            >
              {submitting ? 'Publishing...' : 'Publish to Discussion Board →'}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
