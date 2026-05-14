import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  LayoutDashboard, Award, ClipboardList,
  LogOut, Menu, X, Bell, Users
} from 'lucide-react';

const navigation = [
  { name: 'Dashboard',    icon: LayoutDashboard, page: 'dashboard' },
  { name: 'Performance',  icon: Award,           page: 'performance' },
  { name: 'Attendance',   icon: ClipboardList,   page: 'attendance' },
];

export default function ParentDashboard() {
  const { profile, schoolId, signOut } = useAuth();
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [children, setChildren] = useState<any[]>([]);
  const [selectedChild, setSelectedChild] = useState<any>(null);
  const [reportCards, setReportCards] = useState<any[]>([]);
  const [attendance, setAttendance] = useState({ total: 0, present: 0, absent: 0 });
  const [announcements, setAnnouncements] = useState<any[]>([]);

  useEffect(() => {
    if (profile?.id) {
      fetchChildren();
      fetchAnnouncements();
    }
  }, [profile]);

  useEffect(() => {
    if (selectedChild) {
      fetchChildData(selectedChild.id);
    }
  }, [selectedChild]);

  const fetchChildren = async () => {
    const { data: parent } = await supabase
      .from('parents')
      .select('id')
      .eq('profile_id', profile?.id)
      .single();

    if (parent) {
      const { data: relationships } = await supabase
        .from('parent_student_relationships')
        .select(`
          student:students(
            id, student_uid,
            profile:profiles(first_name, last_name)
          )
        `)
        .eq('parent_id', parent.id)
        .eq('school_id', schoolId);

      if (relationships) {
        const childList = relationships.map((r: any) => r.student);
        setChildren(childList);
        if (childList.length > 0) setSelectedChild(childList[0]);
      }
    }
  };

  const fetchChildData = async (studentId: string) => {
    // Report cards
    const { data: rcData } = await supabase
      .from('report_cards')
      .select(`
        id, average_score, class_position, total_score,
        is_approved, pdf_url,
        term:terms(name),
        class:classes(name, section),
        report_card_subjects(score, grade, subject:subjects(name))
      `)
      .eq('student_id', studentId)
      .eq('school_id', schoolId)
      .order('created_at', { ascending: false });

    if (rcData) setReportCards(rcData as any);

    // Attendance
    const { data: attRecords } = await supabase
      .from('attendance_records')
      .select('status')
      .eq('student_id', studentId);

    if (attRecords) {
      const total = attRecords.length;
      const present = attRecords.filter((r: any) => r.status === 'present').length;
      const absent = attRecords.filter((r: any) => r.status === 'absent').length;
      setAttendance({ total, present, absent });
    }
  };

  const fetchAnnouncements = async () => {
    const { data } = await supabase
      .from('announcements')
      .select('id, title, body, published_at')
      .eq('school_id', schoolId)
      .eq('is_active', true)
      .in('audience', ['all', 'parents'])
      .order('created_at', { ascending: false })
      .limit(3);
    if (data) setAnnouncements(data);
  };

  const attendancePct = attendance.total > 0
    ? Math.round((attendance.present / attendance.total) * 100)
    : 0;

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard': return (
        <div>
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Welcome, {profile?.first_name}!</h1>
            <p className="text-gray-500 mt-1">Parent Portal</p>
          </div>

          {/* Child selector */}
          {children.length > 1 && (
            <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">Select Child</label>
              <div className="flex gap-2 flex-wrap">
                {children.map((child) => (
                  <button key={child.id}
                    onClick={() => setSelectedChild(child)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      selectedChild?.id === child.id
                        ? 'bg-orange-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}>
                    {child.profile?.first_name} {child.profile?.last_name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {selectedChild && (
            <>
              {/* Child info */}
              <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-orange-600 rounded-full flex items-center justify-center">
                    <span className="text-white font-medium">
                      {selectedChild.profile?.first_name?.[0]}{selectedChild.profile?.last_name?.[0]}
                    </span>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">
                      {selectedChild.profile?.first_name} {selectedChild.profile?.last_name}
                    </p>
                    <p className="text-sm text-gray-500">{selectedChild.student_uid}</p>
                  </div>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                {[
                  { label: 'Attendance', value: `${attendancePct}%`, color: 'bg-green-500' },
                  { label: 'Days Present', value: attendance.present, color: 'bg-blue-500' },
                  { label: 'Days Absent', value: attendance.absent, color: 'bg-red-500' },
                  { label: 'Latest Avg', value: reportCards[0]?.average_score?.toFixed(1) ?? '—', color: 'bg-purple-500' },
                ].map((s) => (
                  <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-4">
                    <p className="text-sm text-gray-500">{s.label}</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">{s.value}</p>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Report Cards */}
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <h2 className="text-base font-semibold text-gray-900 mb-4">Report Cards</h2>
                  {reportCards.length === 0 ? (
                    <p className="text-sm text-gray-400">No report cards yet.</p>
                  ) : reportCards.map((rc: any) => (
                    <div key={rc.id} className="p-3 bg-gray-50 rounded-lg mb-2">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-medium text-gray-900">{rc.term?.name}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          rc.is_approved ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                        }`}>
                          {rc.is_approved ? 'Approved' : 'Pending'}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span>Average: <strong>{rc.average_score?.toFixed(1) ?? '—'}%</strong></span>
                        <span>Position: <strong>{rc.class_position ?? '—'}</strong></span>
                      </div>
                      {rc.pdf_url && (
                        <a href={rc.pdf_url} target="_blank" rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:underline mt-1 block">
                          Download PDF
                        </a>
                      )}
                    </div>
                  ))}
                </div>

                {/* Announcements */}
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <h2 className="text-base font-semibold text-gray-900 mb-4">School Announcements</h2>
                  {announcements.length === 0 ? (
                    <p className="text-sm text-gray-400">No announcements.</p>
                  ) : announcements.map((a: any) => (
                    <div key={a.id} className="p-3 bg-blue-50 border border-blue-100 rounded-lg mb-2">
                      <p className="text-sm font-medium text-gray-900">{a.title}</p>
                      <p className="text-xs text-gray-600 mt-1 line-clamp-2">{a.body}</p>
                      <p className="text-xs text-gray-400 mt-1">{new Date(a.published_at).toLocaleDateString()}</p>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {children.length === 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
              <Users className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-500">No children linked to your account yet.</p>
              <p className="text-sm text-gray-400 mt-1">Please contact your school admin.</p>
            </div>
          )}
        </div>
      );
      default: return (
        <div className="flex items-center justify-center h-64">
          <p className="text-gray-500">Coming soon...</p>
        </div>
      );
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <aside className={`${sidebarOpen ? 'w-64' : 'w-16'} bg-white border-r border-gray-200 flex flex-col transition-all duration-300 fixed h-full z-10`}>
        <div className="h-16 flex items-center px-4 border-b border-gray-200">
          <div className="w-8 h-8 bg-orange-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <Users className="w-5 h-5 text-white" />
          </div>
          {sidebarOpen && <span className="ml-3 font-bold text-gray-900 truncate">Parent Portal</span>}
        </div>
        <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
          {navigation.map((item) => {
            const Icon = item.icon;
            const isActive = currentPage === item.page;
            return (
              <button key={item.page} onClick={() => setCurrentPage(item.page)}
                className={`w-full flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive ? 'bg-orange-50 text-orange-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}>
                <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-orange-700' : 'text-gray-400'}`} />
                {sidebarOpen && <span className="ml-3">{item.name}</span>}
              </button>
            );
          })}
        </nav>
        <div className="p-2 border-t border-gray-200">
          <button onClick={signOut} className="w-full flex items-center px-3 py-2.5 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-colors">
            <LogOut className="w-5 h-5 flex-shrink-0" />
            {sidebarOpen && <span className="ml-3">Sign Out</span>}
          </button>
        </div>
      </aside>

      <div className={`flex-1 ${sidebarOpen ? 'ml-64' : 'ml-16'} transition-all duration-300`}>
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 sticky top-0 z-10">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100">
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <div className="flex items-center gap-4">
            <button className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 relative">
              <Bell className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-orange-600 rounded-full flex items-center justify-center">
                <span className="text-white text-sm font-medium">
                  {profile?.first_name?.[0]}{profile?.last_name?.[0]}
                </span>
              </div>
              <div className="hidden md:block">
                <p className="text-sm font-medium text-gray-900">{profile?.first_name} {profile?.last_name}</p>
                <p className="text-xs text-gray-500">Parent</p>
              </div>
            </div>
          </div>
        </header>
        <main className="p-6">{renderPage()}</main>
      </div>
    </div>
  );
}