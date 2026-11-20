import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ToastProvider } from "./modules/ToastContext";
import Login from "./modules/login";
import Navbar from "./modules/Navbar";
import StudentDashboard from "./modules/StudentDashboard";
import CatalogPage from "./modules/CatalogPage";
import CourseDiscovery from "./modules/CourseDiscovery";
import BookRequests from "./modules/BookRequests";
import FinancialHistory from "./modules/FinancialHistory";
import AdminDashboard from "./modules/AdminDashboard";
import CirculationDesk from "./modules/CirculationDesk";
import InventoryManager from "./modules/InventoryManager";
import UserManager from "./modules/UserManager";
import AcquisitionsView from "./modules/AcquisitionsView";
import FinesManager from "./modules/FinesManager";
import ProfilePage from "./modules/ProfilePage";
import DiscussionPage from "./modules/DiscussionPage";

function getUser() {
  try {
    return JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    return null;
  }
}

function ProtectedRoute({ children, allowedRoles }) {
  const user = getUser();
  if (!user) return <Navigate to="/login" replace />;
  const isAdmin = user.role_id === 1 || user.role_name === 'admin';
  if (allowedRoles && !allowedRoles.includes(user.role_id)) {
    return <Navigate to={isAdmin ? "/admin" : "/dashboard"} replace />;
  }
  return children;
}

function WithNav({ children }) {
  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-[#faf9f7] text-stone-900 pt-16 font-sans">
        {children}
      </div>
    </>
  );
}

function RootRedirect() {
  const user = getUser();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role_id === 1 || user.role_name === 'admin') return <Navigate to="/admin" replace />;
  return <Navigate to="/dashboard" replace />;
}

export default function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<RootRedirect />} />

        {/* Student / Faculty routes */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute allowedRoles={[2, 3, 4]}>
              <WithNav><StudentDashboard /></WithNav>
            </ProtectedRoute>
          }
        />
        <Route
          path="/fines"
          element={
            <ProtectedRoute allowedRoles={[2, 3, 4]}>
              <WithNav><FinancialHistory /></WithNav>
            </ProtectedRoute>
          }
        />

        {/* All-user routes */}
        <Route
          path="/catalog"
          element={
            <ProtectedRoute>
              <WithNav><CatalogPage /></WithNav>
            </ProtectedRoute>
          }
        />
        <Route
          path="/courses"
          element={
            <ProtectedRoute>
              <WithNav><CourseDiscovery /></WithNav>
            </ProtectedRoute>
          }
        />
        <Route
          path="/requests"
          element={
            <ProtectedRoute>
              <WithNav><BookRequests /></WithNav>
            </ProtectedRoute>
          }
        />
        <Route
          path="/discussions"
          element={
            <ProtectedRoute>
              <WithNav><DiscussionPage /></WithNav>
            </ProtectedRoute>
          }
        />

        {/* Admin routes */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute allowedRoles={[1]}>
              <WithNav><AdminDashboard /></WithNav>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/circulation"
          element={
            <ProtectedRoute allowedRoles={[1]}>
              <WithNav><CirculationDesk /></WithNav>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/inventory"
          element={
            <ProtectedRoute allowedRoles={[1]}>
              <WithNav><InventoryManager /></WithNav>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/users"
          element={
            <ProtectedRoute allowedRoles={[1]}>
              <WithNav><UserManager /></WithNav>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/acquisitions"
          element={
            <ProtectedRoute allowedRoles={[1]}>
              <WithNav><AcquisitionsView /></WithNav>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/fines"
          element={
            <ProtectedRoute allowedRoles={[1]}>
              <WithNav><FinesManager /></WithNav>
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <WithNav><ProfilePage /></WithNav>
            </ProtectedRoute>
          }
        />

        {/* Catch-all */}
        <Route path="*" element={<RootRedirect />} />
      </Routes>
    </BrowserRouter>
  </ToastProvider>
  );
}
