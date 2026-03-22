import React, { useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import LoginPage from './modules/auth/LoginPage';
import SuperAdminDashboard from './modules/schools/SuperAdminDashboard';
import SchoolAdminDashboard from './modules/schools/SchoolAdminDashboard';
import TeacherDashboard from './modules/teachers/TeacherDashboard';
import StudentDashboard from './modules/students/StudentDashboard';
import ParentDashboard from './modules/parents/ParentDashboard';

const Spinner = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
  </div>
);

const ProtectedRoute = ({
  children,
  allowedRoles,
}: {
  children: React.ReactElement;
  allowedRoles?: string[];
}) => {
  const { user, profile, loading } = useAuth();
  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/login" replace />;
  if (allowedRoles && profile?.role && !allowedRoles.includes(profile.role)) {
    return <Navigate to="/unauthorized" replace />;
  }
  return children;
};

const RoleRedirect = () => {
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate('/login', { replace: true });
      return;
    }
    if (profile?.role) {
      switch (profile.role) {
        case 'super_admin':  navigate('/super-admin', { replace: true }); break;
        case 'school_admin': navigate('/admin', { replace: true }); break;
        case 'teacher':      navigate('/teacher', { replace: true }); break;
        case 'student':      navigate('/student', { replace: true }); break;
        case 'parent':       navigate('/parent', { replace: true }); break;
        default:             navigate('/login', { replace: true }); break;
      }
      return;
    }
    const timer = setTimeout(() => {
      if (!profile) navigate('/login', { replace: true });
    }, 3000);
    return () => clearTimeout(timer);
  }, [user, profile, loading, navigate]);

  return <Spinner />;
};

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<RoleRedirect />} />
      <Route
        path="/super-admin/*"
        element={
          <ProtectedRoute allowedRoles={['super_admin']}>
            <SuperAdminDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/*"
        element={
          <ProtectedRoute allowedRoles={['school_admin']}>
            <SchoolAdminDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/teacher/*"
        element={
          <ProtectedRoute allowedRoles={['teacher']}>
            <TeacherDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/student/*"
        element={
          <ProtectedRoute allowedRoles={['student']}>
            <StudentDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/parent/*"
        element={
          <ProtectedRoute allowedRoles={['parent']}>
            <ParentDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/unauthorized"
        element={
          <div className="min-h-screen flex items-center justify-center">
            <div className="text-center">
              <h1 className="text-2xl font-bold text-red-600">Access Denied</h1>
              <p className="text-gray-600 mt-2">You don't have permission to view this page.</p>
            </div>
          </div>
        }
      />
      <Route
        path="*"
        element={
          <div className="min-h-screen flex items-center justify-center">
            <div className="text-center">
              <h1 className="text-2xl font-bold text-gray-800">Page Not Found</h1>
              <p className="text-gray-600 mt-2">The page you're looking for doesn't exist.</p>
            </div>
          </div>
        }
      />
    </Routes>
  );
}

export default App;