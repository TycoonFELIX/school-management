import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';

import {
  LayoutDashboard,
  ClipboardList,
  FileText,
  BookOpen,
  LogOut,
  Menu,
  X,
  Bell,
  GraduationCap,
  Users,
  CheckSquare,
  Key
} from 'lucide-react';

const navigation = [
  { name: 'Dashboard', icon: LayoutDashboard, page: 'dashboard' },
  { name: 'My Classes', icon: Users, page: 'classes' },
  { name: 'Attendance', icon: ClipboardList, page: 'attendance' },
  { name: 'Assignments', icon: FileText, page: 'assignments' },
  { name: 'Grades', icon: CheckSquare, page: 'grades' },
  { name: 'Materials', icon: BookOpen, page: 'materials' },

  // NEW
  { name: 'Change Password', icon: Key, page: 'password' },
];

const ChangePasswordForm = () => {
  const [form, setForm] = useState({
    newPass: '',
    confirm: '',
  });

  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (form.newPass.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }

    if (!/[A-Z]/.test(form.newPass)) {
      toast.error('Must contain at least one uppercase letter');
      return;
    }

    if (!/[0-9]/.test(form.newPass)) {
      toast.error('Must contain at least one number');
      return;
    }

    if (form.newPass !== form.confirm) {
      toast.error('Passwords do not match');
      return;
    }

    setSaving(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: form.newPass,
      });

      if (error) throw error;

      toast.success('Password changed!');

      setForm({
        newPass: '',
        confirm: '',
      });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          New Password *
        </label>

        <input
          type="password"
          value={form.newPass}
          onChange={(e) =>
            setForm({ ...form, newPass: e.target.value })
          }
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        />

        <p className="text-xs text-gray-400 mt-1">
          Min 8 chars, 1 uppercase, 1 number
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Confirm Password *
        </label>

        <input
          type="password"
          value={form.confirm}
          onChange={(e) =>
            setForm({ ...form, confirm: e.target.value })
          }
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        />
      </div>

      <button
        type="submit"
        disabled={saving}
        className="w-full bg-green-600 hover:bg-green-700 text-white py-2.5 rounded-lg text-sm font-medium disabled:opacity-50"
      >
        {saving ? 'Changing...' : 'Change Password'}
      </button>
    </form>
  );
};

export default function TeacherDashboard() {
  const { profile, schoolId, signOut } = useAuth();

  const [currentPage, setCurrentPage] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const [stats, setStats] = useState({
    classes: 0,
    students: 0,
    assignments: 0,
    pending: 0,
  });

  const [myClasses, setMyClasses] = useState<any[]>([]);
  const [myAssignments, setMyAssignments] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [teacher, setTeacher] = useState<any>(null);

  useEffect(() => {
    if (profile?.id) {
      fetchTeacherData();
      fetchAnnouncements();
    }
  }, [profile]);

  const fetchTeacherData = async () => {
    const { data: teacherData } = await supabase
      .from('teachers')
      .select('id, teacher_uid, department')
      .eq('profile_id', profile?.id)
      .single();

    if (teacherData) {
      setTeacher(teacherData);

      const { data: classSubjects } = await supabase
        .from('class_subjects')
        .select(`
          id,
          class:classes(id, name, section, level),
          subject:subjects(id, name, category)
        `)
        .eq('teacher_id', teacherData.id)
        .eq('school_id', schoolId);

      if (classSubjects) {
        setMyClasses(classSubjects as any);

        const uniqueClasses = new Set(
          classSubjects.map((cs: any) => cs.class?.id)
        );

        setStats((s) => ({
          ...s,
          classes: uniqueClasses.size,
        }));
      }

      const { data: assignments } = await supabase
        .from('assignments')
        .select(`
          id,
          title,
          due_date,
          is_published,
          class_subject:class_subjects(
            subject:subjects(name),
            class:classes(name)
          )
        `)
        .eq('teacher_id', teacherData.id)
        .eq('school_id', schoolId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(5);

      if (assignments) {
        setMyAssignments(assignments as any);
      }

      const { count: pendingCount } = await supabase
        .from('assignment_submissions')
        .select('id', { count: 'exact' })
        .eq('school_id', schoolId)
        .eq('status', 'submitted');

      setStats((s) => ({
        ...s,
        assignments: assignments?.length ?? 0,
        pending: pendingCount ?? 0,
      }));
    }
  };

  const fetchAnnouncements = async () => {
    const { data } = await supabase
      .from('announcements')
      .select('id, title, body, published_at')
      .eq('school_id', schoolId)
      .eq('is_active', true)
      .in('audience', ['all', 'teachers'])
      .order('created_at', { ascending: false })
      .limit(3);

    if (data) setAnnouncements(data);
  };

  const renderPage = () => {
    switch (currentPage) {

      // NEW PASSWORD PAGE
      case 'password':
        return (
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-6">
              Change Password
            </h1>

            <div className="bg-white rounded-xl border border-gray-200 p-6 max-w-md">
              <p className="text-sm text-gray-500 mb-4">
                Use the form below to change your login password.
              </p>

              <ChangePasswordForm />
            </div>
          </div>
        );

      case 'dashboard':
        return (
          <div>
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-gray-900">
                Welcome, {profile?.first_name}!
              </h1>

              <p className="text-gray-500 mt-1">
                {teacher?.teacher_uid} •{' '}
                {teacher?.department ?? 'Teacher'}
              </p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              {[
                {
                  label: 'My Classes',
                  value: stats.classes,
                },
                {
                  label: 'Assignments',
                  value: stats.assignments,
                },
                {
                  label: 'Pending Grading',
                  value: stats.pending,
                },
                {
                  label: 'Subjects',
                  value: myClasses.length,
                },
              ].map((s) => (
                <div
                  key={s.label}
                  className="bg-white rounded-xl border border-gray-200 p-4"
                >
                  <p className="text-sm text-gray-500">
                    {s.label}
                  </p>

                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    {s.value}
                  </p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

              {/* My Classes */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h2 className="text-base font-semibold text-gray-900 mb-4">
                  My Classes & Subjects
                </h2>

                {myClasses.length === 0 ? (
                  <p className="text-sm text-gray-400">
                    No classes assigned yet.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {myClasses.map((cs: any) => (
                      <div
                        key={cs.id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                      >
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {cs.class?.name}{' '}
                            {cs.class?.section ?? ''}
                          </p>

                          <p className="text-xs text-gray-500">
                            {cs.subject?.name}
                          </p>
                        </div>

                        <span
                          className={`text-xs px-2 py-0.5 rounded-full ${
                            cs.subject?.category === 'core'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-purple-100 text-purple-700'
                          }`}
                        >
                          {cs.subject?.category}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Recent Assignments */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h2 className="text-base font-semibold text-gray-900 mb-4">
                  Recent Assignments
                </h2>

                {myAssignments.length === 0 ? (
                  <p className="text-sm text-gray-400">
                    No assignments created yet.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {myAssignments.map((a: any) => (
                      <div
                        key={a.id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                      >
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {a.title}
                          </p>

                          <p className="text-xs text-gray-500">
                            Due:{' '}
                            {new Date(
                              a.due_date
                            ).toLocaleDateString()}
                          </p>
                        </div>

                        <span
                          className={`text-xs px-2 py-0.5 rounded-full ${
                            a.is_published
                              ? 'bg-green-100 text-green-700'
                              : 'bg-yellow-100 text-yellow-700'
                          }`}
                        >
                          {a.is_published
                            ? 'Published'
                            : 'Draft'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Announcements */}
              <div className="bg-white rounded-xl border border-gray-200 p-5 md:col-span-2">
                <h2 className="text-base font-semibold text-gray-900 mb-4">
                  School Announcements
                </h2>

                {announcements.length === 0 ? (
                  <p className="text-sm text-gray-400">
                    No announcements.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {announcements.map((a: any) => (
                      <div
                        key={a.id}
                        className="p-3 bg-blue-50 border border-blue-100 rounded-lg"
                      >
                        <p className="text-sm font-medium text-gray-900">
                          {a.title}
                        </p>

                        <p className="text-xs text-gray-600 mt-1 line-clamp-2">
                          {a.body}
                        </p>

                        <p className="text-xs text-gray-400 mt-1">
                          {new Date(
                            a.published_at
                          ).toLocaleDateString()}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        );

      default:
        return (
          <div className="flex items-center justify-center h-64">
            <p className="text-gray-500">
              Coming soon...
            </p>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">

      {/* SIDEBAR */}
      <aside
        className={`${
          sidebarOpen ? 'w-64' : 'w-16'
        } bg-white border-r border-gray-200 flex flex-col transition-all duration-300 fixed h-full z-10`}
      >
        <div className="h-16 flex items-center px-4 border-b border-gray-200">
          <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <GraduationCap className="w-5 h-5 text-white" />
          </div>

          {sidebarOpen && (
            <span className="ml-3 font-bold text-gray-900 truncate">
              Teacher Portal
            </span>
          )}
        </div>

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
                    ? 'bg-green-50 text-green-700'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <Icon
                  className={`w-5 h-5 flex-shrink-0 ${
                    isActive
                      ? 'text-green-700'
                      : 'text-gray-400'
                  }`}
                />

                {sidebarOpen && (
                  <span className="ml-3">
                    {item.name}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-2 border-t border-gray-200">
          <button
            onClick={signOut}
            className="w-full flex items-center px-3 py-2.5 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />

            {sidebarOpen && (
              <span className="ml-3">
                Sign Out
              </span>
            )}
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <div
        className={`flex-1 ${
          sidebarOpen ? 'ml-64' : 'ml-16'
        } transition-all duration-300`}
      >
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 sticky top-0 z-10">
          <button
            onClick={() =>
              setSidebarOpen(!sidebarOpen)
            }
            className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100"
          >
            {sidebarOpen ? (
              <X className="w-5 h-5" />
            ) : (
              <Menu className="w-5 h-5" />
            )}
          </button>

          <div className="flex items-center gap-4">
            <button className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 relative">
              <Bell className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center">
                <span className="text-white text-sm font-medium">
                  {profile?.first_name?.[0]}
                  {profile?.last_name?.[0]}
                </span>
              </div>

              <div className="hidden md:block">
                <p className="text-sm font-medium text-gray-900">
                  {profile?.first_name}{' '}
                  {profile?.last_name}
                </p>

                <p className="text-xs text-gray-500">
                  Teacher
                </p>
              </div>
            </div>
          </div>
        </header>

        <main className="p-6">
          {renderPage()}
        </main>
      </div>
    </div>
  );
}