import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  LayoutDashboard, ClipboardList, FileText, BookOpen,
  LogOut, Menu, X, Bell, GraduationCap, Users,
  CheckSquare, Key, Upload, Download,
} from 'lucide-react';
import toast from 'react-hot-toast';

const navigation = [
  { name: 'Dashboard',        icon: LayoutDashboard, page: 'dashboard' },
  { name: 'My Classes',       icon: Users,           page: 'classes' },
  { name: 'Attendance',       icon: ClipboardList,   page: 'attendance' },
  { name: 'Assignments',      icon: FileText,        page: 'assignments' },
  { name: 'Grades',           icon: CheckSquare,     page: 'grades' },
  { name: 'Materials',        icon: BookOpen,        page: 'materials' },
  { name: 'Change Password',  icon: Key,             page: 'password' },
];

const ChangePasswordForm = ({ supabase: sb }: { supabase: any }) => {
  const [form, setForm] = useState({ newPass: '', confirm: '' });
  const [saving, setSaving] = useState(false);
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.newPass.length < 8) { toast.error('Min 8 characters'); return; }
    if (!/[A-Z]/.test(form.newPass)) { toast.error('Need one uppercase letter'); return; }
    if (!/[0-9]/.test(form.newPass)) { toast.error('Need one number'); return; }
    if (form.newPass !== form.confirm) { toast.error('Passwords do not match'); return; }
    setSaving(true);
    try {
      const { error } = await sb.auth.updateUser({ password: form.newPass });
      if (error) throw error;
      toast.success('Password changed!');
      setForm({ newPass: '', confirm: '' });
    } catch (err: any) { toast.error(err.message); }
    finally { setSaving(false); }
  };
  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">New Password *</label>
        <input type="password" value={form.newPass} onChange={(e) => setForm({ ...form, newPass: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
        <p className="text-xs text-gray-400 mt-1">Min 8 chars, 1 uppercase, 1 number</p>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password *</label>
        <input type="password" value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
      </div>
      <button type="submit" disabled={saving}
        className="w-full bg-green-600 hover:bg-green-700 text-white py-2.5 rounded-lg text-sm font-medium disabled:opacity-50">
        {saving ? 'Changing...' : 'Change Password'}
      </button>
    </form>
  );
};

export default function TeacherDashboard() {
  const { profile, schoolId, signOut } = useAuth();
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [teacher, setTeacher] = useState<any>(null);
  const [myClasses, setMyClasses] = useState<any[]>([]);
  const [myAssignments, setMyAssignments] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [stats, setStats] = useState({ classes: 0, students: 0, assignments: 0, pending: 0 });
  // Attendance state
  const [attDate, setAttDate] = useState(new Date().toISOString().split('T')[0]);
  const [attClassSubject, setAttClassSubject] = useState('');
  const [attStudents, setAttStudents] = useState<any[]>([]);
  const [attRecords, setAttRecords] = useState<Record<string, string>>({});
  const [savingAtt, setSavingAtt] = useState(false);
  // Grades state
  const [gradingAssignment, setGradingAssignment] = useState<any>(null);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [grades, setGrades] = useState<Record<string, string>>({});
  const [savingGrades, setSavingGrades] = useState(false);
  // Materials state
  const [materials, setMaterials] = useState<any[]>([]);
  const [matForm, setMatForm] = useState({ title: '', description: '', class_subject_id: '' });
  const [matFile, setMatFile] = useState<File | null>(null);
  const [uploadingMat, setUploadingMat] = useState(false);

  useEffect(() => {
    if (profile?.id) { fetchTeacherData(); fetchAnnouncements(); }
  }, [profile]);

  const fetchTeacherData = async () => {
    const { data: teacherData } = await supabase.from('teachers')
      .select('id, teacher_uid, department').eq('profile_id', profile?.id).single();
    if (!teacherData) return;
    setTeacher(teacherData);

    const { data: cs } = await supabase.from('class_subjects')
      .select('id, class:classes(id, name, section, level), subject:subjects(id, name, category)')
      .eq('teacher_id', teacherData.id).eq('school_id', schoolId);
    if (cs) {
      setMyClasses(cs as any);
      const uniqueClasses = new Set(cs.map((c: any) => c.class?.id));
      setStats((s) => ({ ...s, classes: uniqueClasses.size }));
    }

    const { data: asgn } = await supabase.from('assignments')
      .select('id, title, due_date, is_published, class_subject:class_subjects(subject:subjects(name), class:classes(name))')
      .eq('teacher_id', teacherData.id).eq('school_id', schoolId).eq('is_active', true)
      .order('created_at', { ascending: false }).limit(5);
    if (asgn) setMyAssignments(asgn as any);

    const { count: pendingCount } = await supabase.from('assignment_submissions')
      .select('id', { count: 'exact' }).eq('school_id', schoolId).eq('status', 'submitted');
    setStats((s) => ({ ...s, assignments: asgn?.length ?? 0, pending: pendingCount ?? 0 }));

    const { data: mats } = await supabase.from('learning_materials')
      .select('id, title, description, file_url, file_name, created_at, class_subject:class_subjects(subject:subjects(name), class:classes(name))')
      .eq('school_id', schoolId).eq('uploaded_by', teacherData.id).order('created_at', { ascending: false });
    if (mats) setMaterials(mats as any);
  };

  const fetchAnnouncements = async () => {
    const { data } = await supabase.from('announcements').select('id, title, body, published_at')
      .eq('school_id', schoolId).eq('is_active', true).in('audience', ['all', 'teachers'])
      .order('created_at', { ascending: false }).limit(3);
    if (data) setAnnouncements(data);
  };

  const loadAttStudents = async () => {
    if (!attClassSubject) return;
    const cs = myClasses.find((c) => c.id === attClassSubject);
    if (!cs) return;
    const { data: enrollments } = await supabase.from('enrollments')
      .select('student:students(id, student_uid, profile:profiles(first_name, last_name))')
      .eq('class_id', cs.class?.id).eq('is_active', true).eq('school_id', schoolId);
    if (enrollments) {
      const students = enrollments.map((e: any) => e.student);
      setAttStudents(students);
      const init: Record<string, string> = {};
      students.forEach((s: any) => { init[s.id] = 'present'; });
      setAttRecords(init);
    }
  };

  const saveAttendance = async () => {
    if (!attClassSubject || attStudents.length === 0) { toast.error('Select class and load students first'); return; }
    setSavingAtt(true);
    try {
      const cs = myClasses.find((c) => c.id === attClassSubject);
      const { data: session, error: se } = await supabase.from('attendance_sessions').insert({
        school_id: schoolId, class_id: cs?.class?.id,
        teacher_id: teacher?.id, session_date: attDate, attendance_type: 'daily',
      }).select().single();
      if (se) throw se;
      const records = attStudents.map((s: any) => ({
        school_id: schoolId, session_id: session.id, student_id: s.id, status: attRecords[s.id] ?? 'present',
      }));
      await supabase.from('attendance_records').insert(records);
      toast.success(`Attendance saved for ${attStudents.length} students!`);
    } catch (err: any) { toast.error(err.message); }
    finally { setSavingAtt(false); }
  };

  const loadSubmissions = async (assignment: any) => {
    setGradingAssignment(assignment);
    const { data } = await supabase.from('assignment_submissions')
      .select('id, status, submitted_at, is_late, student_note, student:students(student_uid, profile:profiles(first_name, last_name)), assignment_grades(score, remarks)')
      .eq('assignment_id', assignment.id).eq('school_id', schoolId);
    if (data) {
      setSubmissions(data as any);
      const init: Record<string, string> = {};
      data.forEach((s: any) => { init[s.id] = s.assignment_grades?.[0]?.score?.toString() ?? ''; });
      setGrades(init);
    }
  };

  const saveGrades = async () => {
    setSavingGrades(true);
    try {
      for (const [submissionId, score] of Object.entries(grades)) {
        if (!score) continue;
        await supabase.from('assignment_grades').upsert({
          submission_id: submissionId, teacher_id: teacher?.id,
          score: parseFloat(score), graded_at: new Date().toISOString(),
        }, { onConflict: 'submission_id' });
        await supabase.from('assignment_submissions').update({ status: 'graded' }).eq('id', submissionId);
      }
      toast.success('Grades saved!');
    } catch (err: any) { toast.error(err.message); }
    finally { setSavingGrades(false); }
  };

  const uploadMaterial = async () => {
    if (!matForm.title || !matForm.class_subject_id || !matFile) {
      toast.error('Title, class/subject and file are required'); return;
    }
    setUploadingMat(true);
    try {
      const path = `schools/${schoolId}/materials/${Date.now()}_${matFile.name}`;
      const { error: upErr } = await supabase.storage.from('learning-materials').upload(path, matFile, { upsert: true });
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from('learning-materials').getPublicUrl(path);
      const { error: dbErr } = await supabase.from('learning_materials').insert({
        school_id: schoolId, class_subject_id: matForm.class_subject_id,
        uploaded_by: teacher?.id, title: matForm.title,
        description: matForm.description || null,
        file_url: urlData.publicUrl, file_name: matFile.name,
        file_size: matFile.size, mime_type: matFile.type,
      });
      if (dbErr) throw dbErr;
      toast.success('Material uploaded!');
      setMatForm({ title: '', description: '', class_subject_id: '' });
      setMatFile(null);
      fetchTeacherData();
    } catch (err: any) { toast.error(err.message); }
    finally { setUploadingMat(false); }
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard': return (
        <div>
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Welcome, {profile?.first_name}!</h1>
            <p className="text-gray-500 mt-1 font-mono text-sm">{teacher?.teacher_uid} • {teacher?.department ?? 'Teacher'}</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[
              { label: 'My Classes', value: stats.classes },
              { label: 'Subjects', value: myClasses.length },
              { label: 'Assignments', value: stats.assignments },
              { label: 'Pending Grading', value: stats.pending },
            ].map((s) => (
              <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-4">
                <p className="text-sm text-gray-500">{s.label}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{s.value}</p>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="text-base font-semibold text-gray-900 mb-4">My Classes & Subjects</h2>
              {myClasses.length === 0 ? <p className="text-sm text-gray-400">No classes assigned yet.</p> :
                myClasses.map((cs: any) => (
                  <div key={cs.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg mb-2">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{cs.class?.name} {cs.class?.section ?? ''}</p>
                      <p className="text-xs text-gray-500">{cs.subject?.name}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${cs.subject?.category === 'core' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                      {cs.subject?.category}
                    </span>
                  </div>
                ))}
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="text-base font-semibold text-gray-900 mb-4">Recent Assignments</h2>
              {myAssignments.length === 0 ? <p className="text-sm text-gray-400">No assignments yet.</p> :
                myAssignments.map((a: any) => (
                  <div key={a.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg mb-2">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{a.title}</p>
                      <p className="text-xs text-gray-500">Due: {new Date(a.due_date).toLocaleDateString()}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${a.is_published ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                      {a.is_published ? 'Published' : 'Draft'}
                    </span>
                  </div>
                ))}
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-5 md:col-span-2">
              <h2 className="text-base font-semibold text-gray-900 mb-4">Announcements</h2>
              {announcements.length === 0 ? <p className="text-sm text-gray-400">No announcements.</p> :
                announcements.map((a: any) => (
                  <div key={a.id} className="p-3 bg-blue-50 border border-blue-100 rounded-lg mb-2">
                    <p className="text-sm font-medium text-gray-900">{a.title}</p>
                    <p className="text-xs text-gray-600 mt-1 line-clamp-2">{a.body}</p>
                    <p className="text-xs text-gray-400 mt-1">{new Date(a.published_at).toLocaleDateString()}</p>
                  </div>
                ))}
            </div>
          </div>
        </div>
      );

      case 'classes': return (
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-6">My Classes</h1>
          {myClasses.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
              <Users className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-500">No classes assigned yet. Contact your school admin.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {myClasses.map((cs: any) => (
                <div key={cs.id} className="bg-white rounded-xl border border-gray-200 p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                      <GraduationCap className="w-5 h-5 text-green-600" />
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${cs.subject?.category === 'core' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                      {cs.subject?.category}
                    </span>
                  </div>
                  <h3 className="text-base font-semibold text-gray-900">{cs.class?.name} {cs.class?.section ?? ''}</h3>
                  <p className="text-sm text-gray-500 mt-1">{cs.subject?.name}</p>
                  {cs.class?.level && <p className="text-xs text-gray-400 mt-1">Level: {cs.class.level}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      );

      case 'attendance': return (
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-6">Mark Attendance</h1>
          <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                <input type="date" value={attDate} onChange={(e) => setAttDate(e.target.value)}
                  max={new Date().toISOString().split('T')[0]}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Class & Subject</label>
                <select value={attClassSubject} onChange={(e) => setAttClassSubject(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
                  <option value="">Select Class</option>
                  {myClasses.map((cs: any) => (
                    <option key={cs.id} value={cs.id}>{cs.class?.name} — {cs.subject?.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-end">
                <button onClick={loadAttStudents} disabled={!attClassSubject}
                  className="w-full bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50">
                  Load Students
                </button>
              </div>
            </div>

            {attStudents.length > 0 && (
              <>
                <div className="border border-gray-200 rounded-lg overflow-hidden mb-4">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Student</th>
                        <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">ID</th>
                        <th className="text-center px-4 py-2 text-xs font-medium text-gray-500">Present</th>
                        <th className="text-center px-4 py-2 text-xs font-medium text-gray-500">Absent</th>
                        <th className="text-center px-4 py-2 text-xs font-medium text-gray-500">Late</th>
                        <th className="text-center px-4 py-2 text-xs font-medium text-gray-500">Excused</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {attStudents.map((s: any) => (
                        <tr key={s.id} className={attRecords[s.id] === 'absent' ? 'bg-red-50' : attRecords[s.id] === 'late' ? 'bg-yellow-50' : ''}>
                          <td className="px-4 py-3 text-sm text-gray-900">{s.profile?.first_name} {s.profile?.last_name}</td>
                          <td className="px-4 py-3 text-xs text-gray-500 font-mono">{s.student_uid}</td>
                          {['present', 'absent', 'late', 'excused'].map((status) => (
                            <td key={status} className="px-4 py-3 text-center">
                              <input type="radio" name={`att_${s.id}`} value={status}
                                checked={attRecords[s.id] === status}
                                onChange={() => setAttRecords({ ...attRecords, [s.id]: status })}
                                className="cursor-pointer" />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-500">{attStudents.length} students • {Object.values(attRecords).filter((v) => v === 'present').length} present</p>
                  <button onClick={saveAttendance} disabled={savingAtt}
                    className="bg-green-600 hover:bg-green-700 text-white px-6 py-2.5 rounded-lg text-sm font-medium disabled:opacity-50">
                    {savingAtt ? 'Saving...' : 'Save Attendance'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      );

      case 'assignments': return (
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-6">My Assignments</h1>
          {myAssignments.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
              <FileText className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-500">No assignments created yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {myAssignments.map((a: any) => (
                <div key={a.id} className="bg-white rounded-xl border border-gray-200 p-5">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="text-base font-semibold text-gray-900">{a.title}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${a.is_published ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                      {a.is_published ? 'Published' : 'Draft'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">
                    {(a.class_subject as any)?.class?.name} — {(a.class_subject as any)?.subject?.name}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">Due: {new Date(a.due_date).toLocaleDateString()}</p>
                  <button onClick={() => { loadSubmissions(a); setCurrentPage('grades'); }}
                    className="mt-3 w-full text-sm text-center bg-green-50 text-green-700 hover:bg-green-100 py-1.5 rounded-lg font-medium transition-colors">
                    View Submissions & Grade
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      );

      case 'grades': return (
        <div>
          <div className="flex items-center gap-3 mb-6">
            <button onClick={() => { setGradingAssignment(null); setCurrentPage('assignments'); }}
              className="text-gray-500 hover:text-gray-700 text-sm">← Back</button>
            <h1 className="text-2xl font-bold text-gray-900">
              {gradingAssignment ? `Grade: ${gradingAssignment.title}` : 'Select an Assignment to Grade'}
            </h1>
          </div>
          {!gradingAssignment ? (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
              <CheckSquare className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-500">Go to Assignments and click "View Submissions & Grade"</p>
            </div>
          ) : submissions.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
              <p className="text-gray-500">No submissions yet for this assignment.</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Student</th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Submitted</th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Score / {gradingAssignment.max_score}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {submissions.map((sub: any) => (
                    <tr key={sub.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <p className="text-sm font-medium text-gray-900">{sub.student?.profile?.first_name} {sub.student?.profile?.last_name}</p>
                        <p className="text-xs text-gray-500 font-mono">{sub.student?.student_uid}</p>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {new Date(sub.submitted_at).toLocaleDateString()}
                        {sub.is_late && <span className="ml-1 text-xs text-red-500">(Late)</span>}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          sub.status === 'graded' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                        }`}>{sub.status}</span>
                      </td>
                      <td className="px-6 py-4">
                        <input type="number" min="0" max={gradingAssignment.max_score}
                          value={grades[sub.id] ?? ''}
                          onChange={(e) => setGrades({ ...grades, [sub.id]: e.target.value })}
                          className="w-20 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-green-500" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="p-4 border-t border-gray-100 flex justify-end">
                <button onClick={saveGrades} disabled={savingGrades}
                  className="bg-green-600 hover:bg-green-700 text-white px-6 py-2.5 rounded-lg text-sm font-medium disabled:opacity-50">
                  {savingGrades ? 'Saving...' : 'Save All Grades'}
                </button>
              </div>
            </div>
          )}
        </div>
      );

      case 'materials': return (
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-6">Learning Materials</h1>
          <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
            <h2 className="text-base font-semibold text-gray-900 mb-4">Upload New Material</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                <input type="text" value={matForm.title}
                  onChange={(e) => setMatForm({ ...matForm, title: e.target.value })}
                  placeholder="e.g. Chapter 5 Notes"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Class & Subject *</label>
                <select value={matForm.class_subject_id} onChange={(e) => setMatForm({ ...matForm, class_subject_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
                  <option value="">Select</option>
                  {myClasses.map((cs: any) => (
                    <option key={cs.id} value={cs.id}>{cs.class?.name} — {cs.subject?.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <input type="text" value={matForm.description}
                onChange={(e) => setMatForm({ ...matForm, description: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">File *</label>
              <input type="file" accept=".pdf,.doc,.docx,.ppt,.pptx,.jpg,.png,.mp4"
                onChange={(e) => setMatFile(e.target.files?.[0] ?? null)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              <p className="text-xs text-gray-400 mt-1">PDF, Word, PowerPoint, Images, Videos</p>
            </div>
            <button onClick={uploadMaterial} disabled={uploadingMat}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium disabled:opacity-50">
              <Upload className="w-4 h-4" />
              {uploadingMat ? 'Uploading...' : 'Upload Material'}
            </button>
          </div>

          <h2 className="text-base font-semibold text-gray-900 mb-3">My Materials ({materials.length})</h2>
          {materials.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-6 text-center">
              <BookOpen className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-500">No materials uploaded yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {materials.map((m: any) => (
                <div key={m.id} className="bg-white rounded-xl border border-gray-200 p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="text-sm font-semibold text-gray-900">{m.title}</h3>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {(m.class_subject as any)?.class?.name} — {(m.class_subject as any)?.subject?.name}
                      </p>
                      {m.description && <p className="text-xs text-gray-400 mt-1">{m.description}</p>}
                    </div>
                    <a href={m.file_url} target="_blank" rel="noopener noreferrer"
                      className="ml-3 p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                      <Download className="w-4 h-4" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      );

      case 'password': return (
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-6">Change Password</h1>
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <ChangePasswordForm supabase={supabase} />
          </div>
        </div>
      );

      default: return <div className="flex items-center justify-center h-64"><p className="text-gray-500">Coming soon...</p></div>;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <aside className={`${sidebarOpen ? 'w-64' : 'w-16'} bg-white border-r border-gray-200 flex flex-col transition-all duration-300 fixed h-full z-10`}>
        <div className="h-16 flex items-center px-4 border-b border-gray-200">
          <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <GraduationCap className="w-5 h-5 text-white" />
          </div>
          {sidebarOpen && <span className="ml-3 font-bold text-gray-900 truncate">Teacher Portal</span>}
        </div>
        <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
          {navigation.map((item) => {
            const Icon = item.icon;
            const isActive = currentPage === item.page;
            return (
              <button key={item.page} onClick={() => setCurrentPage(item.page)}
                className={`w-full flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive ? 'bg-green-50 text-green-700' : 'text-gray-600 hover:bg-gray-50'
                }`}>
                <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-green-700' : 'text-gray-400'}`} />
                {sidebarOpen && <span className="ml-3">{item.name}</span>}
              </button>
            );
          })}
        </nav>
        <div className="p-2 border-t border-gray-200">
          <button onClick={signOut} className="w-full flex items-center px-3 py-2.5 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50">
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
          <div className="flex items-center gap-3">
            <button className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100"><Bell className="w-5 h-5" /></button>
            <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center">
              <span className="text-white text-sm font-medium">{profile?.first_name?.[0]}{profile?.last_name?.[0]}</span>
            </div>
            <div className="hidden md:block">
              <p className="text-sm font-medium text-gray-900">{profile?.first_name} {profile?.last_name}</p>
              <p className="text-xs text-gray-500 font-mono">{teacher?.teacher_uid}</p>
            </div>
          </div>
        </header>
        <main className="p-6">{renderPage()}</main>
      </div>
    </div>
  );
}