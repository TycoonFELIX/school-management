import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  LayoutDashboard, FileText, BookOpen, ClipboardList,
  LogOut, Menu, X, Bell, Users, Award
} from 'lucide-react';

const navigation = [
  { name: 'Dashboard',    icon: LayoutDashboard, page: 'dashboard' },
  { name: 'Assignments',  icon: FileText,        page: 'assignments' },
  { name: 'Attendance',   icon: ClipboardList,   page: 'attendance' },
  { name: 'Report Cards', icon: Award,           page: 'reports' },
  { name: 'Materials',    icon: BookOpen,        page: 'materials' },
];

export default function StudentDashboard() {
  const { profile, schoolId, signOut } = useAuth();
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [student, setStudent] = useState<any>(null);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [reportCards, setReportCards] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [attendance, setAttendance] = useState({ total: 0, present: 0 });

  useEffect(() => {
    if (profile?.id) {
      fetchStudentData();
      fetchAnnouncements();
    }
  }, [profile]);

  const fetchStudentData = async () => {
    const { data: studentData } = await supabase
      .from('students')
      .select('id, student_uid, date_of_birth, gender')
      .eq('profile_id', profile?.id)
      .single();

    if (studentData) {
      setStudent(studentData);

      // Get assignments for enrolled classes
      const { data: enrollments } = await supabase
        .from('enrollments')
        .select('class_id, term_id')
        .eq('student_id', studentData.id)
        .eq('is_active', true);

      if (enrollments && enrollments.length > 0) {
        const _classIds = enrollments.map((e: any) => e.class_id);
        const { data: assignmentsData } = await supabase
          .from('assignments')
          .select(`
            id, title, due_date, is_published, max_score, weight,
            class_subject:class_subjects(
              subject:subjects(name),
              class:classes(name)
            ),
            assignment_submissions(id, status, submitted_at)
          `)
          .eq('school_id', schoolId)
          .eq('is_published', true)
          .eq('is_active', true)
          .order('due_date', { ascending: true })
          .limit(10);

        if (assignmentsData) setAssignments(assignmentsData as any);
      }

      // Get report cards
      const { data: rcData } = await supabase
        .from('report_cards')
        .select(`
          id, average_score, class_position, total_score,
          is_approved, pdf_url,
          term:terms(name),
          class:classes(name, section),
          report_card_subjects(score, grade, subject:subjects(name))
        `)
        .eq('student_id', studentData.id)
        .eq('school_id', schoolId)
        .order('created_at', { ascending: false });

      if (rcData) setReportCards(rcData as any);

      // Get attendance summary
      const { data: attRecords } = await supabase
        .from('attendance_records')
        .select('status')
        .eq('student_id', studentData.id);

      if (attRecords) {
        const total = attRecords.length;
        const present = attRecords.filter((r: any) => r.status === 'present').length;
        setAttendance({ total, present });
      }
    }
  };

  const fetchAnnouncements = async () => {
    const { data } = await supabase
      .from('announcements')
      .select('id, title, body, published_at')
      .eq('school_id', schoolId)
      .eq('is_active', true)
      .in('audience', ['all', 'students'])
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
            <p className="text-gray-500 mt-1">{student?.student_uid}</p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[
              { label: 'Assignments', value: assignments.length, color: 'bg-blue-500' },
              { label: 'Attendance', value: `${attendancePct}%`, color: 'bg-green-500' },
              { label: 'Report Cards', value: reportCards.length, color: 'bg-purple-500' },
              { label: 'Latest Avg', value: reportCards[0]?.average_score?.toFixed(1) ?? '—', color: 'bg-orange-500' },
            ].map((s) => (
              <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-4">
                <p className="text-sm text-gray-500">{s.label}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{s.value}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Upcoming Assignments */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="text-base font-semibold text-gray-900 mb-4">Upcoming Assignments</h2>
              {assignments.length === 0 ? (
                <p className="text-sm text-gray-400">No assignments yet.</p>
              ) : (
                <div className="space-y-2">
                  {assignments.slice(0, 5).map((a: any) => {
                    const submitted = a.assignment_submissions?.length > 0;
                    const isOverdue = new Date(a.due_date) < new Date();
                    return (
                      <div key={a.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{a.title}</p>
                          <p className="text-xs text-gray-500">
                            {a.class_subject?.subject?.name} • Due: {new Date(a.due_date).toLocaleDateString()}
                            {isOverdue && !submitted && <span className="text-red-500 ml-1">• Overdue</span>}
                          </p>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          submitted ? 'bg-green-100 text-green-700' :
                          isOverdue ? 'bg-red-100 text-red-700' :
                          'bg-yellow-100 text-yellow-700'
                        }`}>
                          {submitted ? 'Submitted' : isOverdue ? 'Overdue' : 'Pending'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Report Cards */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="text-base font-semibold text-gray-900 mb-4">My Report Cards</h2>
              {reportCards.length === 0 ? (
                <p className="text-sm text-gray-400">No report cards yet.</p>
              ) : (
                <div className="space-y-2">
                  {reportCards.map((rc: any) => (
                    <div key={rc.id} className="p-3 bg-gray-50 rounded-lg">
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
              )}
            </div>

            {/* Announcements */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 md:col-span-2">
              <h2 className="text-base font-semibold text-gray-900 mb-4">Announcements</h2>
              {announcements.length === 0 ? (
                <p className="text-sm text-gray-400">No announcements.</p>
              ) : (
                <div className="space-y-3">
                  {announcements.map((a: any) => (
                    <div key={a.id} className="p-3 bg-blue-50 border border-blue-100 rounded-lg">
                      <p className="text-sm font-medium text-gray-900">{a.title}</p>
                      <p className="text-xs text-gray-600 mt-1">{a.body}</p>
                      <p className="text-xs text-gray-400 mt-1">{new Date(a.published_at).toLocaleDateString()}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
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
          <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <Users className="w-5 h-5 text-white" />
          </div>
          {sidebarOpen && <span className="ml-3 font-bold text-gray-900 truncate">Student Portal</span>}
        </div>
        <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
          {navigation.map((item) => {
            const Icon = item.icon;
            const isActive = currentPage === item.page;
            return (
              <button key={item.page} onClick={() => setCurrentPage(item.page)}
                className={`w-full flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive ? 'bg-purple-50 text-purple-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}>
                <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-purple-700' : 'text-gray-400'}`} />
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
              <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center">
                <span className="text-white text-sm font-medium">
                  {profile?.first_name?.[0]}{profile?.last_name?.[0]}
                </span>
              </div>
              <div className="hidden md:block">
                <p className="text-sm font-medium text-gray-900">{profile?.first_name} {profile?.last_name}</p>
                <p className="text-xs text-gray-500">Student</p>
              </div>
            </div>
          </div>
        </header>
        <main className="p-6">{renderPage()}</main>
      </div>
    </div>
  );
}