import React, { useState, useEffect } from 'react';

const API = 'http://localhost:3000';

export default function CopySelectionModal({ book, onClose, onBorrowSuccess }) {
  const [copies, setCopies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedBarcode, setSelectedBarcode] = useState('');
  const [warningConfirmed, setWarningConfirmed] = useState(false);
  const [borrowing, setBorrowing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const currentUser = JSON.parse(localStorage.getItem('user') || 'null');

  useEffect(() => {
    if (!book) return;
    setLoading(true);
    fetch(`${API}/api/books/${book.book_id}/copies`)
      .then((res) => res.json())
      .then((data) => {
        setCopies(data);
        const availableCopies = data.filter((c) => c.status === 'available');
        if (availableCopies.length > 0) {
          setSelectedBarcode(availableCopies[0].barcode_id);
        }
      })
      .catch((err) => setErrorMsg('Failed to load physical copies.'))
      .finally(() => setLoading(false));
  }, [book]);

  if (!book) return null;

  const selectedCopy = copies.find((c) => c.barcode_id === selectedBarcode);
  const isDamaged = selectedCopy && (selectedCopy.damage_score > 0 || selectedCopy.condition_status !== 'Good');

  const handleBorrow = async () => {
    if (!currentUser || !selectedBarcode) return;
    if (isDamaged && !warningConfirmed) {
      setErrorMsg('Please acknowledge the condition notice before borrowing this copy.');
      return;
    }

    setBorrowing(true);
    setErrorMsg('');

    try {
      const res = await fetch(`${API}/api/borrow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: currentUser.id || currentUser.user_id,
          book_id: book.book_id,
          barcode_id: selectedBarcode,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        if (onBorrowSuccess) {
          onBorrowSuccess(data);
        }
        onClose();
      } else {
        setErrorMsg(data.error || 'Checkout failed.');
      }
    } catch (e) {
      setErrorMsg('Network error communicating with library server.');
    } finally {
      setBorrowing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs font-sans animate-fade-in">
      <div className="bg-white w-full max-w-xl rounded-2xl border border-stone-300 shadow-2xl overflow-hidden flex flex-col">
        
        {/* Modal Header */}
        <div className="px-6 py-4 bg-stone-50 border-b border-stone-200 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#881337] block">
              Physical Copy Selection
            </span>
            <h3 className="text-base font-bold text-stone-900 truncate max-w-md">
              {book.title}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full border border-stone-300 text-stone-500 hover:text-stone-900 hover:bg-stone-200/60 flex items-center justify-center text-xs"
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl font-semibold">
              {errorMsg}
            </div>
          )}

          <p className="text-xs text-stone-600">
            Inspect all copies currently assigned to library shelves. You can choose a pristine copy or an existing worn copy:
          </p>

          {loading ? (
            <div className="py-8 text-center text-xs text-stone-500">Retrieving physical inventory...</div>
          ) : copies.length === 0 ? (
            <div className="p-6 text-center text-xs text-stone-500 bg-stone-50 rounded-xl">
              No physical copies found for this title.
            </div>
          ) : (
            <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
              {copies.map((c) => {
                const isAvail = c.status === 'available';
                const isSelected = c.barcode_id === selectedBarcode;
                const copyDamaged = c.damage_score > 0 || c.condition_status !== 'Good';

                return (
                  <div
                    key={c.barcode_id}
                    onClick={() => {
                      if (isAvail) {
                        setSelectedBarcode(c.barcode_id);
                        setWarningConfirmed(false);
                      }
                    }}
                    className={`p-3.5 rounded-xl border transition-all flex items-center justify-between cursor-pointer ${
                      !isAvail
                        ? 'opacity-50 bg-stone-50 border-stone-200 cursor-not-allowed'
                        : isSelected
                        ? 'border-[#881337] bg-rose-50/50 ring-2 ring-rose-500/20'
                        : 'border-stone-200 bg-white hover:border-stone-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="radio"
                        name="selected_barcode"
                        checked={isSelected}
                        disabled={!isAvail}
                        onChange={() => {
                          setSelectedBarcode(c.barcode_id);
                          setWarningConfirmed(false);
                        }}
                        className="text-[#881337] focus:ring-[#881337]"
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-stone-900">
                            {c.barcode_id}
                          </span>
                          <span
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                              copyDamaged
                                ? 'bg-amber-50 text-amber-800 border-amber-200'
                                : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            }`}
                          >
                            {c.condition_status}
                          </span>
                          {!isAvail && (
                            <span className="text-[10px] bg-stone-200 text-stone-700 px-2 py-0.5 rounded">
                              {c.status}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-stone-500 mt-0.5">
                          Floor {c.floor_number} &bull; Rack {c.rack_code} &bull; Slot: <span className="font-mono">{c.shelf_slot}</span>
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      {copyDamaged && (
                        <span className="text-[10px] font-bold text-amber-900 bg-amber-100/70 border border-amber-300 px-2 py-1 rounded">
                          Wear Tracked
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Damaged Book Warning Card */}
          {isDamaged && (
            <div className="p-4 bg-amber-50/90 border-2 border-amber-300 rounded-xl space-y-2 animate-fade-in">
              <div className="flex items-center gap-2 text-amber-950 font-bold text-xs uppercase tracking-wider">
                <span>Careful Handling Warning: Pre-Existing Damage</span>
              </div>
              <p className="text-xs text-amber-900 leading-relaxed">
                This copy (<strong>{selectedCopy.barcode_id}</strong>) has pre-existing condition notes:
                <em className="font-semibold block mt-0.5">&ldquo;{selectedCopy.damage_notes || 'Minor edge/spine wear'}&rdquo;</em>
                <strong>Important Policy:</strong> If a book with existing minor damage receives further damage, it will escalate to <strong>Severe Damage</strong>, resulting in patron merit star deduction and fine assessment.
              </p>
              
              <label className="flex items-center gap-2 pt-1 text-xs font-bold text-amber-950 cursor-pointer">
                <input
                  type="checkbox"
                  checked={warningConfirmed}
                  onChange={(e) => setWarningConfirmed(e.target.checked)}
                  className="rounded border-amber-400 text-[#881337] focus:ring-rose-500"
                />
                <span>I understand and agree to handle this worn copy with extra care.</span>
              </label>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-stone-50 border-t border-stone-200 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-stone-300 text-stone-700 hover:bg-stone-200 rounded-xl text-xs font-semibold"
          >
            Cancel
          </button>

          <button
            onClick={handleBorrow}
            disabled={borrowing || !selectedBarcode || (isDamaged && !warningConfirmed)}
            className="bg-[#881337] hover:bg-[#700f2b] text-white px-5 py-2.5 rounded-xl text-xs font-semibold shadow-xs hover:shadow transition-all disabled:opacity-50 flex items-center gap-1.5"
          >
            {borrowing ? 'Issuing Copy...' : `Confirm Checkout (${selectedBarcode || 'Select Copy'}) →`}
          </button>
        </div>

      </div>
    </div>
  );
}
