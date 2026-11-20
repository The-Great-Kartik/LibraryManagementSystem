import React, { useState, useEffect } from 'react';
import CopySelectionModal from './CopySelectionModal';

const API = 'http://localhost:3000';

export default function CatalogPage() {
  const user = JSON.parse(localStorage.getItem('user') || 'null');
  const [books, setBooks] = useState([]);
  const [categories, setCategories] = useState([]);
  const [userBorrows, setUserBorrows] = useState([]);
  const [selectedCat, setSelectedCat] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionMsg, setActionMsg] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [copySelectionBook, setCopySelectionBook] = useState(null);

  const fetchUserBorrows = async () => {
    if (!user) return;
    try {
      const res = await fetch(`${API}/api/users/${user.id || user.user_id}/borrows`);
      if (res.ok) setUserBorrows(await res.json());
    } catch (e) {
      console.error(e);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await fetch(`${API}/api/categories`);
      if (res.ok) setCategories(await res.json());
    } catch (e) {
      console.error(e);
    }
  };

  const fetchBooks = async (searchTerm = '', catId = 'all') => {
    setLoading(true);
    try {
      let url = `${API}/api/books?search=${encodeURIComponent(searchTerm)}`;
      if (catId !== 'all') {
        url = `${API}/api/categories/${catId}/books`;
      }
      const res = await fetch(url);
      if (res.ok) {
        setBooks(await res.json());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
    fetchBooks();
    fetchUserBorrows();
  }, []);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setSelectedCat('all');
    fetchBooks(search, 'all');
  };

  const handleCategoryClick = (catId) => {
    setSelectedCat(catId);
    setSearch('');
    fetchBooks('', catId);
  };

  const handleBorrow = async (book_id) => {
    if (!user) return;
    setActionMsg('');
    try {
      const res = await fetch(`${API}/api/borrow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id || user.user_id, book_id }),
      });
      const data = await res.json();
      if (res.ok) {
        setActionMsg(`✓ Checked out! Physical copy barcode: ${data.barcode_id}`);
        fetchBooks(search, selectedCat);
      } else {
        setActionMsg(`✕ ${data.error || 'Borrow limit reached'}`);
      }
    } catch (e) {
      setActionMsg('✕ Failed to process borrow request');
    }
  };

  const handleWaitlist = async (book_id) => {
    if (!user) return;
    setActionMsg('');
    try {
      const res = await fetch(`${API}/api/reservations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id || user.user_id, book_id }),
      });
      const data = await res.json();
      if (res.ok) {
        setActionMsg(`✓ Added to waitlist! Queue Position: #${data.queue_position}. You will be held the copy for 48 hours once returned.`);
      } else {
        setActionMsg(`✕ ${data.error || 'Waitlist entry failed'}`);
      }
    } catch (e) {
      setActionMsg('✕ Failed to join waitlist');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-8 py-10 font-sans">
      
      {/* Header & Hero */}
      <div className="max-w-2xl mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-stone-900 tracking-tight leading-tight">
          Library Catalog & Book Inventory
        </h1>
        <p className="text-stone-800 font-medium text-sm mt-1.5">
          Browse academic titles, check real-time physical copy availability, and manage reservations.
        </p>
      </div>

      {/* Search and Category Filter Bar */}
      <div className="mb-8 space-y-4">
        
        {/* Search Input Box */}
        <form onSubmit={handleSearchSubmit} className="flex gap-2 max-w-xl">
          <div className="relative flex-1">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 text-xs font-semibold uppercase tracking-wider">
              Find
            </span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by title, author, or keyword..."
              className="w-full bg-white border border-stone-200 rounded-full pl-14 pr-4 py-3 text-sm text-stone-900 focus:outline-none focus:border-[#881337] focus:ring-2 focus:ring-rose-500/10 shadow-xs placeholder:text-stone-400 transition-all"
            />
          </div>
          <button
            type="submit"
            className="bg-[#881337] hover:bg-[#700f2b] text-white rounded-full px-6 py-3 text-sm font-medium shadow-xs hover:shadow transition-all"
          >
            Search
          </button>
        </form>

        {/* Category Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          <button
            onClick={() => handleCategoryClick('all')}
            className={`rounded-full px-4 py-1.5 text-xs font-medium transition-all whitespace-nowrap ${
              selectedCat === 'all'
                ? 'bg-[#881337] text-white shadow-xs'
                : 'bg-white text-stone-600 border border-stone-200 hover:border-stone-300 hover:bg-stone-50'
            }`}
          >
            All Disciplines
          </button>
          {categories.map((c) => (
            <button
              key={c.category_id}
              onClick={() => handleCategoryClick(c.category_id)}
              className={`rounded-full px-4 py-1.5 text-xs font-medium transition-all whitespace-nowrap ${
                selectedCat === c.category_id
                  ? 'bg-[#881337] text-white shadow-xs'
                  : 'bg-white text-stone-600 border border-stone-200 hover:border-stone-300 hover:bg-stone-50'
              }`}
            >
              {c.category_name}
            </button>
          ))}
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

      {/* Books Grid */}
      {loading ? (
        <div className="py-20 text-center">
          <div className="inline-block animate-spin w-8 h-8 border-2 border-[#881337] border-t-transparent rounded-full mb-3"></div>
          <p className="text-sm font-medium text-stone-500">Searching library shelves...</p>
        </div>
      ) : books.length === 0 ? (
        <div className="bg-white rounded-3xl border border-dashed border-stone-200 p-16 text-center">
          <h3 className="text-base font-semibold text-stone-800">No books found</h3>
          <p className="text-xs text-stone-400 mt-1 max-w-sm mx-auto">
            Try adjusting your search terms or selecting another category filter.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {books.map((b) => {
            const inStock = b.available_copies > 0;
            return (
              <div
                key={b.book_id}
                className="bg-white rounded-3xl border border-stone-200/80 p-6 shadow-2xs hover:shadow-md transition-all duration-300 flex flex-col justify-between group"
              >
                <div>
                  
                  {/* Top Bar: In-stock pill + ISBN */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span
                      className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${
                        inStock
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/70'
                          : 'bg-amber-50 text-amber-800 border border-amber-200/70'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${inStock ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
                      {inStock ? `${b.available_copies} of ${b.total_copies} Copies Available` : 'All Copies Loaned'}
                    </span>
                    <span className="font-mono text-[10px] text-stone-400">
                      {b.isbn}
                    </span>
                  </div>

                  {/* Title & Author */}
                  <h3 className="text-lg font-bold text-stone-900 group-hover:text-[#881337] transition-colors leading-snug">
                    {b.title}
                  </h3>
                  
                  <p className="text-xs font-medium text-stone-600 mt-1">
                    By {b.authors || `${b.author_first || ''} ${b.author_last || ''}` || 'Academic Contributor'}
                  </p>

                  {/* Physical Shelf Rack Location Badge */}
                  <div className="mt-2.5 flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#881337] bg-rose-50/90 border border-rose-200/90 px-2.5 py-1 rounded-lg font-mono shadow-2xs">
                      <span className="text-stone-700 font-sans font-semibold">Location:</span>
                      <span className="text-stone-950 font-semibold">Floor {b.floor_number || 2}</span>
                      <span className="text-rose-400">•</span>
                      <span>Rack {b.rack_code || 'CS-A'}</span>
                    </span>
                  </div>

                  <div className="mt-3 pt-3 border-t border-stone-100 flex items-center justify-between text-[11px] text-stone-500">
                    <span>Edition: {b.edition || 'Standard'}</span>
                    <span>Year: {b.publication_year || 'N/A'}</span>
                  </div>

                </div>

                {/* Bottom Actions */}
                <div className="mt-6 pt-4 border-t border-stone-100 space-y-2">
                  {userBorrows.some((ub) => ub.title === b.title || ub.book_id === b.book_id) ? (
                    <div className="w-full bg-stone-100 text-stone-700 border border-stone-200 text-xs font-medium py-2.5 px-3 rounded-lg text-center">
                      Currently In Your Possession
                    </div>
                  ) : inStock ? (
                    <button
                      onClick={() => setCopySelectionBook(b)}
                      className="w-full bg-[#881337] hover:bg-[#700f2b] active:scale-[0.99] text-white text-xs font-semibold py-2.5 px-4 rounded-lg shadow-2xs hover:shadow transition-all flex items-center justify-center gap-1.5"
                    >
                      <span>Choose Physical Copy & Borrow</span>
                      <span>→</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => handleWaitlist(b.book_id)}
                      className="w-full bg-amber-50 hover:bg-amber-100/80 text-amber-900 border border-amber-200/80 text-xs font-semibold py-2.5 px-4 rounded-lg transition-all flex items-center justify-center gap-1.5"
                    >
                      <span>Join Waitlist Queue</span>
                    </button>
                  )}
                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* Copy Selection & Condition Warning Modal */}
      {copySelectionBook && (
        <CopySelectionModal
          book={copySelectionBook}
          onClose={() => setCopySelectionBook(null)}
          onBorrowSuccess={(result) => {
            setActionMsg(
              result.damage_warning
                ? `✓ Checked out copy ${result.barcode_id}. NOTICE: ${result.damage_warning}`
                : `✓ Checked out physical copy ${result.barcode_id} in pristine condition!`
            );
            fetchBooks(search, selectedCat);
            fetchUserBorrows();
          }}
        />
      )}

    </div>
  );
}
