import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { 
  LayoutDashboard, Users, GraduationCap, BookOpen, 
  ClipboardList, BarChart2, Settings, 
  LogOut, Menu, X, Bell, School, Calendar
} from 'lucide-react';
import DashboardHome from './admin/DashboardHome';
import TeachersPage from './admin/TeachersPage';
import StudentsPage from './admin/StudentsPage';
import ClassesPage from './admin/ClassesPage';
import SubjectsPage from './admin/SubjectsPage';
import AcademicYearsPage from './admin/AcademicYearsPage';

const navigation = [
  { name: 'Dashboard',       icon: LayoutDashboard, page: 'dashboard' },
  { name: 'Academic Years',  icon: Calendar,        page: 'academic-years' },
  { name: 'Classes',         icon: School,          page: 'classes' },
  { name: 'Subjects',        icon: BookOpen,        page: 'subjects' },
  { name: 'Teachers',        icon: GraduationCap,   page: 'teachers' },
  { name: 'Students',        icon: Users,           page: 'students' },
  { name: 'Attendance',      icon: ClipboardList,   page: 'attendance' },
  { name: 'Reports',         icon: BarChart2,       page: 'reports' },
  { name: 'Settings',        icon: Settings,        page: 'settings' },
];

export default function SchoolAdminDashboard() {
  const { profile, signOut } = useAuth();
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':      return <DashboardHome onNavigate={setCurrentPage} />;
      case 'academic-years': return <AcademicYearsPage />;
      case 'teachers':       return <TeachersPage />;
      case 'students':       return <StudentsPage />;
      case 'classes':        return <ClassesPage />;
      case 'subjects':       return <SubjectsPage />;
      default: return (
        <div className="flex items-center justify-center h-64">
          <p className="text-gray-500 text-lg">Coming soon...</p>
        </div>
      );
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">

      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'w-64' : 'w-16'} bg-white border-r border-gray-200 flex flex-col transition-all duration-300 fixed h-full z-10`}>

        {/* Logo */}
        <div className="h-16 flex items-center px-4 border-b border-gray-200">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <School className="w-5 h-5 text-white" />
          </div>
          {sidebarOpen && (
            <span className="ml-3 font-bold text-gray-900 truncate">School Admin</span>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
          {navigation.map((item) => {
            const Icon = item.icon;
            const isActive = currentPage === item.page;
            return (
              <button
                key={item.page}
                onClick={() => setCurrentPage(item.page)}
                className={`w-full flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-blue-700' : 'text-gray-400'}`} />
                {sidebarOpen && <span className="ml-3">{item.name}</span>}
              </button>
            );
          })}
        </nav>

        {/* Sign out */}
        <div className="p-2 border-t border-gray-200">
          <button
            onClick={signOut}
            className="w-full flex items-center px-3 py-2.5 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />
            {sidebarOpen && <span className="ml-3">Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className={`flex-1 ${sidebarOpen ? 'ml-64' : 'ml-16'} transition-all duration-300`}>

        {/* Top bar */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 sticky top-0 z-10">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100"
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          <div className="flex items-center gap-4">
            <button className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 relative">
              <Bell className="w-5 h-5" />
              <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full"></span>
            </button>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                <span className="text-white text-sm font-medium">
                  {profile?.first_name?.[0]}{profile?.last_name?.[0]}
                </span>
              </div>
              <div className="hidden md:block">
                <p className="text-sm font-medium text-gray-900">
                  {profile?.first_name} {profile?.last_name}
                </p>
                <p className="text-xs text-gray-500">School Admin</p>
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="p-6">
          {renderPage()}
        </main>
      </div>
    </div>
  );
}