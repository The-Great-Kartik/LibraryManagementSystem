import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const navigate = useNavigate();

  const handleLogin = async (e, directEmail) => {
    e?.preventDefault();
    const targetEmail = (directEmail || email || '').trim();
    if (!targetEmail) {
      setError('Please enter your registered email address.');
      return;
    }

    setError('');
    setLoading(true);
    
    try {
      const response = await fetch('http://localhost:3000/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: targetEmail }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Authentication failed. Please verify your email.');
        setLoading(false);
        return;
      }

      // Store authenticated user session in localStorage
      localStorage.setItem('user', JSON.stringify(data.user));

      // Role-based routing: Admin (1) goes to /admin, Faculty (2) & Students (3) go to /dashboard
      if (data.user.role_id === 1 || data.user.role_name === 'admin') {
        navigate('/admin');
      } else {
        navigate('/dashboard');
      }
      
    } catch (err) {
      setError('Cannot connect to the library server. Is the backend running on port 3000?');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = (demoEmail) => {
    setEmail(demoEmail);
    handleLogin(null, demoEmail);
  };

  return (
    <div className="min-h-screen bg-[#faf9f7] flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden font-sans">
      
      {/* Subtle decorative background shapes */}
      <div className="absolute top-[-10%] right-[-5%] w-[450px] h-[450px] bg-rose-100/40 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-[-10%] left-[-5%] w-[450px] h-[450px] bg-amber-50/60 rounded-full blur-3xl pointer-events-none"></div>

      <div className="w-full max-w-md relative z-10">
        
        {/* Header Branding */}
        <div className="text-center mb-8">
          <div className="inline-block text-[11px] font-semibold tracking-widest text-[#881337] uppercase bg-rose-50 px-3 py-1 rounded-full border border-rose-200/60 mb-3">
            Academic Library Portal
          </div>
          <h1 className="font-serif text-3xl sm:text-4xl font-bold tracking-tight text-stone-900 leading-tight">
            Library Management System
          </h1>
          <p className="mt-2 text-sm text-stone-600 max-w-sm mx-auto font-medium">
            Passwordless patron access with institutional email
          </p>
        </div>

        {/* Card Box */}
        <div className="bg-white rounded-2xl border border-stone-200/90 shadow-sm p-8">
          
          {error && (
            <div className="mb-6 p-3.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-center gap-2">
              <span className="font-bold text-rose-600">Notice:</span>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-stone-700 mb-1.5">
                Institutional Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-stone-50/80 border border-stone-300 rounded-xl text-stone-900 px-4 py-2.5 text-sm focus:outline-none focus:border-[#881337] focus:ring-2 focus:ring-rose-500/10 transition-all placeholder:text-stone-400"
                placeholder="e.g. student@college.edu"
                required
                autoFocus
              />
              <p className="text-[11px] text-stone-500 mt-1.5">
                Enter your registered student, faculty, or librarian email address.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#881337] hover:bg-[#700f2b] active:scale-[0.99] text-white font-medium py-3 px-6 rounded-xl text-sm shadow-sm hover:shadow transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? "Verifying Patron..." : "Continue to Portal"}
              {!loading && <span>&rarr;</span>}
            </button>
          </form>

          {/* One-Click Role Logins */}
          <div className="mt-8 pt-6 border-t border-stone-100">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-stone-700">
                Quick Role Access
              </span>
              <span className="text-[11px] text-stone-500">1-click login</span>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
              <button
                type="button"
                onClick={() => handleQuickLogin('student@college.edu')}
                className="p-3 rounded-xl border border-stone-200 hover:border-[#881337] hover:bg-rose-50/40 text-left transition-all group"
              >
                <div className="font-semibold text-stone-800 group-hover:text-[#881337]">
                  Student
                </div>
                <div className="text-[10px] text-stone-500 truncate mt-0.5">student@college.edu</div>
                <div className="text-[10px] text-stone-600 mt-1 font-mono">Role ID: 3</div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickLogin('teacher@college.edu')}
                className="p-3 rounded-xl border border-stone-200 hover:border-[#881337] hover:bg-rose-50/40 text-left transition-all group"
              >
                <div className="font-semibold text-stone-800 group-hover:text-[#881337]">
                  Teacher
                </div>
                <div className="text-[10px] text-stone-500 truncate mt-0.5">teacher@college.edu</div>
                <div className="text-[10px] text-stone-600 mt-1 font-mono">Role ID: 2</div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickLogin('admin@college.edu')}
                className="p-3 rounded-xl border border-stone-200 hover:border-[#881337] hover:bg-rose-50/40 text-left transition-all group"
              >
                <div className="font-semibold text-stone-800 group-hover:text-[#881337]">
                  Admin
                </div>
                <div className="text-[10px] text-stone-500 truncate mt-0.5">admin@college.edu</div>
                <div className="text-[10px] text-stone-600 mt-1 font-mono">Role ID: 1</div>
              </button>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
