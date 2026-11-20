import { NavLink, useNavigate } from "react-router-dom";

export default function Navbar() {
  const navigate = useNavigate();
  let user = null;
  try {
    user = JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    user = null;
  }

  const isAdmin = user && (user.role_id === 1 || user.role_name === 'admin');

  const studentLinks = [
    { to: "/dashboard", label: "Dashboard" },
    { to: "/catalog", label: "Catalog & Books" },
    { to: "/courses", label: "Course Syllabus" },
    { to: "/discussions", label: "Discussions & Reviews" },
    { to: "/requests", label: "Book Requests" },
    { to: "/fines", label: "Financial Log" },
  ];

  const adminLinks = [
    { to: "/admin", label: "Overview" },
    { to: "/admin/circulation", label: "Circulation Desk" },
    { to: "/admin/inventory", label: "Inventory" },
    { to: "/admin/users", label: "Members" },
    { to: "/admin/acquisitions", label: "Book Approvals" },
    { to: "/admin/fines", label: "Fines Ledger" },
  ];

  const links = isAdmin ? adminLinks : studentLinks;

  function handleLogout() {
    localStorage.removeItem("user");
    navigate("/login");
  }

  const roleName = user?.role_name
    ? user.role_name.charAt(0).toUpperCase() + user.role_name.slice(1)
    : user?.role_id === 1
    ? "Admin"
    : user?.role_id === 2 || user?.role_name === 'teacher'
    ? "Faculty"
    : "Student";

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/85 backdrop-blur-md border-b border-stone-200/80 h-16 flex items-center px-4 sm:px-8 transition-all">
      <div className="max-w-7xl w-full mx-auto flex items-center justify-between">
        
        {/* Brand / Logo */}
        <div className="flex items-center gap-8">
          <NavLink to="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-lg bg-[#881337] flex items-center justify-center text-white font-bold text-[11px] shadow-xs tracking-wider">
              LIB
            </div>
            <span className="text-base sm:text-lg font-bold tracking-tight text-stone-900 group-hover:text-[#881337] transition-colors">
              LIBRARY MANAGEMENT SYSTEM
            </span>
          </NavLink>

          {/* Navigation Links */}
          <div className="hidden md:flex items-center gap-1 lg:gap-2">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.to === "/admin"}
                className={({ isActive }) =>
                  `px-3 py-1.5 text-sm font-medium transition-all rounded-full ${
                    isActive
                      ? "text-[#881337] bg-rose-50/80 font-semibold"
                      : "text-stone-600 hover:text-stone-900 hover:bg-stone-100/70"
                  }`
                }
              >
                {link.label}
              </NavLink>
            ))}
          </div>
        </div>

        {/* Right side: User pill + Logout */}
        <div className="flex items-center gap-3">
          {user && (
            <NavLink
              to="/profile"
              className={({ isActive }) =>
                `hidden sm:flex items-center gap-2 border rounded-full px-3 py-1 text-xs transition-all ${
                  isActive
                    ? 'bg-rose-50 border-[#881337]/40 shadow-xs'
                    : 'bg-stone-50 border-stone-200/80 hover:border-stone-300 hover:bg-stone-100/80'
                }`
              }
              title="Click to view full user profile & credentials"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span className="font-semibold text-stone-800">{user.name || user.first_name}</span>
              <span className="text-stone-400">|</span>
              <span className="text-stone-500 font-medium">{roleName}</span>
            </NavLink>
          )}

          <button
            onClick={handleLogout}
            className="rounded-full border border-stone-200 bg-white hover:bg-stone-50 hover:border-stone-300 text-stone-700 px-4 py-1.5 text-xs font-medium transition-all shadow-2xs hover:shadow-xs active:scale-95"
          >
            Log out
          </button>
        </div>
      </div>
    </nav>
  );
}
