import React, { useState, useEffect } from 'react';

const API = 'http://localhost:3000';

export default function InventoryManager() {
  const [books, setBooks] = useState([]);
  const [publishers, setPublishers] = useState([]);
  const [authors, setAuthors] = useState([]);
  const [categories, setCategories] = useState([]);

  // Book title form state
  const [isbn, setIsbn] = useState('');
  const [title, setTitle] = useState('');
  const [publisherId, setPublisherId] = useState('');
  const [edition, setEdition] = useState('');
  const [pubYear, setPubYear] = useState('');
  const [selectedAuthors, setSelectedAuthors] = useState([]);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [bookMsg, setBookMsg] = useState('');

  // Physical copy form state
  const [barcodeId, setBarcodeId] = useState('');
  const [selectedBookId, setSelectedBookId] = useState('');
  const [shelfSlot, setShelfSlot] = useState('');
  const [floorNumber, setFloorNumber] = useState(2);
  const [rackCode, setRackCode] = useState('CS-A');
  const [conditionStatus, setConditionStatus] = useState('Good');
  const [acqDate, setAcqDate] = useState(new Date().toISOString().split('T')[0]);
  const [copyMsg, setCopyMsg] = useState('');

  // Damaged books & replacement state
  const [damagedBooks, setDamagedBooks] = useState([]);
  const [loadingDamaged, setLoadingDamaged] = useState(false);
  const [replacingBarcode, setReplacingBarcode] = useState(null);
  const [replaceMsg, setReplaceMsg] = useState('');

  const loadDamagedBooks = async () => {
    setLoadingDamaged(true);
    try {
      const res = await fetch(`${API}/api/admin/damaged-books`);
      if (res.ok) {
        setDamagedBooks(await res.json());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingDamaged(false);
    }
  };

  const handleOrderReplacement = async (barcodeId) => {
    setReplacingBarcode(barcodeId);
    setReplaceMsg('');
    try {
      const res = await fetch(`${API}/api/admin/replace-book`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ barcode_id: barcodeId }),
      });
      const data = await res.json();
      if (res.ok) {
        setReplaceMsg(`✓ Ordered & Replaced! New pristine copy barcode: ${data.new_barcode}`);
        loadDamagedBooks();
        loadData();
      } else {
        setReplaceMsg(`✕ ${data.error || 'Replacement failed'}`);
      }
    } catch (e) {
      setReplaceMsg('✕ Server error processing replacement');
    } finally {
      setReplacingBarcode(null);
    }
  };

  const loadData = async () => {
    try {
      const [bRes, pRes, aRes, cRes] = await Promise.all([
        fetch(`${API}/api/books`),
        fetch(`${API}/api/publishers`),
        fetch(`${API}/api/authors`),
        fetch(`${API}/api/categories`),
      ]);

      if (bRes.ok) {
        const bData = await bRes.json();
        setBooks(bData);
        if (bData.length > 0 && !selectedBookId) {
          setSelectedBookId(bData[0].book_id);
        }
      }
      if (pRes.ok) setPublishers(await pRes.json());
      if (aRes.ok) setAuthors(await aRes.json());
      if (cRes.ok) setCategories(await cRes.json());
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadData();
    loadDamagedBooks();
  }, []);

  const handleAddBook = async (e) => {
    e.preventDefault();
    setBookMsg('');

    try {
      const res = await fetch(`${API}/api/admin/books`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isbn,
          title,
          publisher_id: publisherId ? Number(publisherId) : null,
          edition,
          publication_year: pubYear ? Number(pubYear) : null,
          author_ids: selectedAuthors.map(Number),
          category_ids: selectedCategories.map(Number),
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setBookMsg(`✓ Book title "${title}" cataloged successfully!`);
        setIsbn('');
        setTitle('');
        setEdition('');
        setPubYear('');
        setSelectedAuthors([]);
        setSelectedCategories([]);
        loadData();
      } else {
        setBookMsg(`✕ ${data.error || 'Failed to add book title'}`);
      }
    } catch (err) {
      setBookMsg('✕ Server error adding book title');
    }
  };

  const handleAddCopy = async (e) => {
    e.preventDefault();
    setCopyMsg('');

    try {
      const res = await fetch(`${API}/api/admin/book-items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          barcode_id: barcodeId,
          book_id: Number(selectedBookId),
          shelf_slot: shelfSlot,
          floor_number: Number(floorNumber),
          rack_code: rackCode,
          condition_status: conditionStatus,
          acquisition_date: acqDate,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setCopyMsg(`✓ Physical copy barcode [${barcodeId}] registered and placed on shelf!`);
        setBarcodeId('');
        setShelfSlot('');
        loadData();
      } else {
        setCopyMsg(`✕ ${data.error || 'Failed to register barcode copy'}`);
      }
    } catch (err) {
      setCopyMsg('✕ Server error registering copy');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-8 py-10 font-sans">
      
      {/* Header */}
      <div className="max-w-2xl mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-stone-900 tracking-tight leading-tight">
          Physical Inventory & Shelf Management
        </h1>
        <p className="text-stone-800 font-medium text-sm mt-1.5">
          Catalog book master titles or register individual physical copies with exact floor, rack, and shelf slot tracking.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Form 1: Master Title Entry */}
        <div className="bg-white rounded-3xl border border-stone-200/80 p-8 shadow-2xs">
          <h2 className="font-serif text-xl font-bold text-stone-900 mb-1">
            Catalog New Title
          </h2>
          <p className="text-xs text-stone-500 mb-6">
            Creates a master bibliographic record in the <code>books</code> relation.
          </p>

          {bookMsg && (
            <div className={`mb-5 p-3.5 rounded-2xl text-xs font-medium border ${
              bookMsg.startsWith('✓')
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-rose-50 text-rose-800 border-rose-200'
            }`}>
              {bookMsg}
            </div>
          )}

          <form onSubmit={handleAddBook} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1">
                Book Title *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Distributed Database Systems"
                className="w-full bg-stone-50/60 border border-stone-200 rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:border-[#881337] placeholder:text-stone-400"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1">
                  ISBN *
                </label>
                <input
                  type="text"
                  value={isbn}
                  onChange={(e) => setIsbn(e.target.value)}
                  placeholder="978-0-123456-78-9"
                  className="w-full bg-stone-50/60 border border-stone-200 rounded-xl px-3.5 py-2 text-xs font-mono focus:outline-none focus:border-[#881337] placeholder:text-stone-400"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1">
                  Publisher
                </label>
                <select
                  value={publisherId}
                  onChange={(e) => setPublisherId(e.target.value)}
                  className="w-full bg-stone-50/60 border border-stone-200 rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:border-[#881337]"
                >
                  <option value="">Select Publisher...</option>
                  {publishers.map((p) => (
                    <option key={p.publisher_id} value={p.publisher_id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1">
                  Edition
                </label>
                <input
                  type="text"
                  value={edition}
                  onChange={(e) => setEdition(e.target.value)}
                  placeholder="3rd International"
                  className="w-full bg-stone-50/60 border border-stone-200 rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:border-[#881337] placeholder:text-stone-400"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1">
                  Publication Year
                </label>
                <input
                  type="number"
                  value={pubYear}
                  onChange={(e) => setPubYear(e.target.value)}
                  placeholder="2023"
                  className="w-full bg-stone-50/60 border border-stone-200 rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:border-[#881337] placeholder:text-stone-400"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1">
                Authors (Hold Ctrl/Cmd for multiple)
              </label>
              <select
                multiple
                value={selectedAuthors}
                onChange={(e) => setSelectedAuthors(Array.from(e.target.selectedOptions, (o) => o.value))}
                className="w-full bg-stone-50/60 border border-stone-200 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-[#881337] h-20"
              >
                {authors.map((a) => (
                  <option key={a.author_id} value={a.author_id}>
                    {a.first_name} {a.last_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1">
                Categories (Hold Ctrl/Cmd for multiple)
              </label>
              <select
                multiple
                value={selectedCategories}
                onChange={(e) => setSelectedCategories(Array.from(e.target.selectedOptions, (o) => o.value))}
                className="w-full bg-stone-50/60 border border-stone-200 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-[#881337] h-20"
              >
                {categories.map((c) => (
                  <option key={c.category_id} value={c.category_id}>
                    {c.category_name} (Floor {c.floor_number})
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              className="w-full bg-[#881337] hover:bg-[#700f2b] text-white text-xs font-semibold py-2.5 px-4 rounded-full shadow-2xs hover:shadow transition-all mt-2"
            >
              Catalog Title Master →
            </button>
          </form>
        </div>

        {/* Form 2: Physical Copy & Barcode Register */}
        <div className="bg-white rounded-3xl border border-stone-200/80 p-8 shadow-2xs">
          <h2 className="font-serif text-xl font-bold text-stone-900 mb-1">
            Register Barcode Copy
          </h2>
          <p className="text-xs text-stone-500 mb-6">
            Assigns a physical barcode item to exact shelf slots in <code>book_items</code>.
          </p>

          {copyMsg && (
            <div className={`mb-5 p-3.5 rounded-2xl text-xs font-medium border ${
              copyMsg.startsWith('✓')
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-rose-50 text-rose-800 border-rose-200'
            }`}>
              {copyMsg}
            </div>
          )}

          <form onSubmit={handleAddCopy} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1">
                Assign To Book Title *
              </label>
              <select
                value={selectedBookId}
                onChange={(e) => setSelectedBookId(e.target.value)}
                className="w-full bg-stone-50/60 border border-stone-200 rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:border-[#881337]"
                required
              >
                {books.map((b) => (
                  <option key={b.book_id} value={b.book_id}>
                    {b.title} (ISBN: {b.isbn})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1">
                  Unique Barcode ID *
                </label>
                <input
                  type="text"
                  value={barcodeId}
                  onChange={(e) => setBarcodeId(e.target.value)}
                  placeholder="BC-025"
                  className="w-full bg-stone-50/60 border border-stone-200 rounded-xl px-3.5 py-2 text-xs font-mono uppercase focus:outline-none focus:border-[#881337] placeholder:text-stone-400"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1">
                  Shelf Slot Code *
                </label>
                <input
                  type="text"
                  value={shelfSlot}
                  onChange={(e) => setShelfSlot(e.target.value)}
                  placeholder="CS-A-25"
                  className="w-full bg-stone-50/60 border border-stone-200 rounded-xl px-3.5 py-2 text-xs font-mono uppercase focus:outline-none focus:border-[#881337] placeholder:text-stone-400"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1">
                  Floor Number
                </label>
                <input
                  type="number"
                  value={floorNumber}
                  onChange={(e) => setFloorNumber(e.target.value)}
                  className="w-full bg-stone-50/60 border border-stone-200 rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:border-[#881337]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1">
                  Rack Code
                </label>
                <input
                  type="text"
                  value={rackCode}
                  onChange={(e) => setRackCode(e.target.value)}
                  className="w-full bg-stone-50/60 border border-stone-200 rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:border-[#881337]"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1">
                  Physical Condition
                </label>
                <select
                  value={conditionStatus}
                  onChange={(e) => setConditionStatus(e.target.value)}
                  className="w-full bg-stone-50/60 border border-stone-200 rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:border-[#881337]"
                >
                  <option value="Good">Good (Pristine)</option>
                  <option value="Damaged">Damaged / Worn</option>
                  <option value="Lost">Lost / Missing</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1">
                  Acquisition Date
                </label>
                <input
                  type="date"
                  value={acqDate}
                  onChange={(e) => setAcqDate(e.target.value)}
                  className="w-full bg-stone-50/60 border border-stone-200 rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:border-[#881337]"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold py-2.5 px-4 rounded-full shadow-2xs hover:shadow transition-all mt-2"
            >
              Add Physical Copy to Shelf →
            </button>
          </form>
        </div>

      </div>

      {/* Section 3: Damaged Physical Copies & Replacement Orders */}
      <div className="mt-12 bg-white rounded-3xl border border-stone-200/90 p-8 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-stone-100">
          <div>
            <div className="inline-block text-[10px] font-bold uppercase tracking-wider text-amber-900 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full mb-1">
              Asset Lifecycle & Maintenance
            </div>
            <h2 className="text-xl font-bold text-stone-900">
              Damaged Copies & Replacement Orders
            </h2>
            <p className="text-xs text-stone-600 mt-0.5">
              Cumulative wear tracked by barcode. Worn books that suffer small damages escalate to severe damage and require replacement.
            </p>
          </div>

          <div className="text-xs text-stone-600 bg-stone-50 border border-stone-200 px-3.5 py-1.5 rounded-xl font-medium">
            Damaged Copies Tracked: <strong className="text-stone-900">{damagedBooks.length}</strong>
          </div>
        </div>

        {replaceMsg && (
          <div className={`mb-5 p-3.5 rounded-xl text-xs font-semibold border ${
            replaceMsg.startsWith('✓') ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}>
            {replaceMsg}
          </div>
        )}

        {loadingDamaged ? (
          <div className="py-12 text-center text-xs text-stone-500">Checking damaged copy registry...</div>
        ) : damagedBooks.length === 0 ? (
          <div className="p-8 text-center bg-stone-50 rounded-2xl border border-dashed border-stone-200">
            <p className="text-xs font-semibold text-stone-700">All physical book copies in library stacks are currently in good condition!</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-stone-200 text-stone-600 uppercase text-[10px] tracking-wider">
                  <th className="py-3 px-3">Barcode</th>
                  <th className="py-3 px-3">Book Title</th>
                  <th className="py-3 px-3">Shelf Slot</th>
                  <th className="py-3 px-3">Condition Status</th>
                  <th className="py-3 px-3">Damage Notes</th>
                  <th className="py-3 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {damagedBooks.map((item) => {
                  const isSevere = item.damage_score >= 2 || item.condition_status === 'Severe Damage';
                  return (
                    <tr key={item.barcode_id} className="hover:bg-stone-50/70 transition-colors">
                      <td className="py-3 px-3 font-mono font-bold text-stone-900">{item.barcode_id}</td>
                      <td className="py-3 px-3 font-medium text-stone-800 max-w-xs truncate">{item.title}</td>
                      <td className="py-3 px-3 font-mono text-stone-600">Floor {item.floor_number} &bull; {item.shelf_slot}</td>
                      <td className="py-3 px-3">
                        <span className={`inline-block text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                          isSevere
                            ? 'bg-rose-50 text-rose-800 border-rose-200'
                            : 'bg-amber-50 text-amber-800 border-amber-200'
                        }`}>
                          {item.condition_status} (Score: {item.damage_score})
                        </span>
                      </td>
                      <td className="py-3 px-3 text-stone-600 max-w-sm truncate">{item.damage_notes}</td>
                      <td className="py-3 px-3 text-right">
                        <button
                          onClick={() => handleOrderReplacement(item.barcode_id)}
                          disabled={replacingBarcode === item.barcode_id}
                          className={`text-xs font-semibold py-1.5 px-3 rounded-lg shadow-2xs transition-all ${
                            isSevere
                              ? 'bg-[#881337] hover:bg-[#700f2b] text-white'
                              : 'bg-stone-800 hover:bg-stone-900 text-white'
                          } disabled:opacity-50`}
                        >
                          {replacingBarcode === item.barcode_id ? 'Ordering...' : 'Order & Replace Copy →'}
                        </button>
                      </td>
                    </tr>
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
