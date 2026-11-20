import React, { useState, useEffect } from 'react';

const API = 'http://localhost:3000';

export default function CourseDiscovery() {
  const user = JSON.parse(localStorage.getItem('user') || 'null');
  const [courses, setCourses] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [books, setBooks] = useState([]);
  const [codeQuery, setCodeQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState('');

  const fetchAllCourses = async () => {
    try {
      const res = await fetch(`${API}/api/courses`);
      if (res.ok) {
        const data = await res.json();
        setCourses(data);
        if (data.length > 0 && !selectedCourse) {
          selectCourse(data[0]);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const selectCourse = async (course) => {
    setSelectedCourse(course);
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/courses/${course.course_id}/books`);
      if (res.ok) {
        setBooks(await res.json());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!codeQuery.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/courses/search?code=${encodeURIComponent(codeQuery)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.length > 0) {
          selectCourse(data[0]);
        } else {
          setSelectedCourse(null);
          setBooks([]);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllCourses();
  }, []);

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
        setActionMsg(`✓ Borrowed! Barcode copy: ${data.barcode_id}`);
        if (selectedCourse) selectCourse(selectedCourse);
      } else {
        setActionMsg(`✕ ${data.error || 'Borrow failed'}`);
      }
    } catch (e) {
      setActionMsg('✕ Failed to process borrow');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-8 py-10 font-sans">
      
      {/* Header */}
      <div className="max-w-2xl mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-stone-900 tracking-tight leading-tight">
          Course Syllabus Textbooks
        </h1>
        <p className="text-stone-800 font-medium text-sm mt-1.5">
          Search by course code to retrieve primary textbooks and reference readings prescribed by department faculty.
        </p>
      </div>

      {/* Search & Course Selector Bar */}
      <div className="mb-8 space-y-4">
        <form onSubmit={handleSearch} className="flex gap-2 max-w-md">
          <input
            type="text"
            value={codeQuery}
            onChange={(e) => setCodeQuery(e.target.value)}
            placeholder="Enter course code (e.g. CS301)..."
            className="flex-1 bg-white border border-stone-200 rounded-full px-5 py-2.5 text-sm focus:outline-none focus:border-[#881337] focus:ring-2 focus:ring-rose-500/10 shadow-xs placeholder:text-stone-400"
          />
          <button
            type="submit"
            className="bg-[#881337] hover:bg-[#700f2b] text-white rounded-full px-5 py-2.5 text-xs font-medium shadow-xs transition-all"
          >
            Find
          </button>
        </form>

        {/* Quick select pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          <span className="text-xs text-stone-400 mr-1 font-medium">Quick Select:</span>
          {courses.map((c) => (
            <button
              key={c.course_id}
              onClick={() => selectCourse(c)}
              className={`rounded-full px-4 py-1.5 text-xs font-medium transition-all whitespace-nowrap ${
                selectedCourse?.course_id === c.course_id
                  ? 'bg-[#881337] text-white shadow-xs'
                  : 'bg-white text-stone-600 border border-stone-200 hover:border-stone-300 hover:bg-stone-50'
              }`}
            >
              {c.course_code}: {c.course_name}
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

      {/* Selected Course Overview Banner */}
      {selectedCourse && (
        <div className="bg-white rounded-3xl border border-stone-200/80 p-6 sm:p-8 shadow-2xs mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-mono text-xs font-bold text-[#881337] bg-rose-50 border border-rose-200/60 px-2.5 py-0.5 rounded-full">
                  {selectedCourse.course_code}
                </span>
                <span className="text-xs text-stone-400 uppercase tracking-wider">
                  {selectedCourse.department}
                </span>
              </div>
              <h2 className="font-serif text-2xl sm:text-3xl font-bold text-stone-900">
                {selectedCourse.course_name}
              </h2>
            </div>
            <div className="text-xs text-stone-500 bg-stone-50 border border-stone-200/60 rounded-2xl px-4 py-2.5 sm:text-right">
              <span className="font-semibold text-stone-800">{books.length} Textbooks</span> mapped to curriculum
            </div>
          </div>
        </div>
      )}

      {/* Textbooks Grid */}
      {loading ? (
        <div className="py-16 text-center">
          <div className="inline-block animate-spin w-8 h-8 border-2 border-[#881337] border-t-transparent rounded-full mb-3"></div>
          <p className="text-sm font-medium text-stone-500">Retrieving syllabus recommendations...</p>
        </div>
      ) : books.length === 0 ? (
        <div className="bg-white rounded-3xl border border-dashed border-stone-200 p-12 text-center">
          <p className="text-sm text-stone-500">No syllabus textbooks mapped to this course yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {books.map((b) => {
            const isPrimary = b.suggestion_type === 'primary';
            const inStock = b.available_copies > 0;
            return (
              <div
                key={b.book_id}
                className="bg-white rounded-3xl border border-stone-200/80 p-6 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span
                      className={`text-[11px] font-semibold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${
                        isPrimary
                          ? 'bg-[#881337] text-white border-transparent'
                          : 'bg-stone-100 text-stone-700 border-stone-200'
                      }`}
                    >
                      {isPrimary ? 'Primary Textbook' : 'Reference Reading'}
                    </span>
                    <span className="text-xs font-medium text-stone-400">
                      {inStock ? `${b.available_copies} Available` : 'Waitlist Only'}
                    </span>
                  </div>

                  <h3 className="font-serif text-lg font-bold text-stone-900 leading-snug">
                    {b.title}
                  </h3>

                  <p className="text-xs text-stone-500 mt-1">
                    By {b.authors || 'Academic Author'}
                  </p>

                  {/* Physical Shelf Rack Location Badge */}
                  <div className="mt-2.5">
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#881337] bg-rose-50/90 border border-rose-200/90 px-2.5 py-0.5 rounded-md font-mono">
                      <span className="text-stone-700 font-sans font-semibold">Location:</span>
                      <span>Floor {b.floor_number || 2}</span>
                      <span className="text-rose-400">•</span>
                      <span>Rack {b.rack_code || 'CS-A'}</span>
                    </span>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-stone-100 flex items-center justify-between gap-2">
                  <span className="font-mono text-[10px] text-stone-400">{b.isbn}</span>

                  <div>
                    {inStock ? (
                      <button
                        onClick={() => handleBorrow(b.book_id)}
                        className="bg-[#881337] hover:bg-[#700f2b] text-white text-xs font-semibold py-1.5 px-3.5 rounded-lg transition-all shadow-2xs"
                      >
                        Borrow Now →
                      </button>
                    ) : (
                      <span className="text-xs text-stone-400 font-medium italic">Checked out</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}
