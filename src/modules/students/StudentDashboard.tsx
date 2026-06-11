import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  LayoutDashboard, FileText, BookOpen, ClipboardList,
  LogOut, Menu, X, Bell, Users, Award, Key, Download, CheckCircle
} from 'lucide-react';
import toast from 'react-hot-toast';

const navigation = [
  { name: 'Dashboard',      icon: LayoutDashboard, page: 'dashboard' },
  { name: 'Assignments',    icon: FileText,        page: 'assignments' },
  { name: 'Attendance',     icon: ClipboardList,   page: 'attendance' },
  { name: 'Report Cards',   icon: Award,           page: 'reports' },
  { name: 'Materials',      icon: BookOpen,        page: 'materials' },
  { name: 'Subjects',       icon: Users,           page: 'subjects' },
  { name: 'Change Password',icon: Key,             page: 'password' },
];

export default function StudentDashboard() {
  const { profile, schoolId, signOut } = useAuth();
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [student, setStudent] = useState<any>(null);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [reportCards, setReportCards] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [attRecords, setAttRecords] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [enrolledSubjects, setEnrolledSubjects] = useState<any[]>([]);
  const [electiveSubjects, setElectiveSubjects] = useState<any[]>([]);
  const [selectedElectives, setSelectedElectives] = useState<string[]>([]);
  const [currentTerm, setCurrentTerm] = useState<any>(null);
  const [passwordForm, setPasswordForm] = useState({ newPass: '', confirm: '' });
  const [savingPassword, setSavingPassword] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submittingAssignment, setSubmittingAssignment] = useState<string | null>(null);
  const [generating, setGenerating] = useState<string | null>(null);

  useEffect(() => {
    if (profile?.id) {
      fetchAll();
    }
  }, [profile]);

  const fetchAll = async () => {
    setLoading(true);
    await Promise.all([
      fetchStudentData(),
      fetchAnnouncements(),
      fetchCurrentTerm(),
    ]);
    setLoading(false);
  };

  const fetchCurrentTerm = async () => {
    const { data } = await supabase
      .from('terms')
      .select('id, name, start_date, end_date, is_current')
      .eq('school_id', schoolId)
      .eq('is_current', true)
      .maybeSingle();
    if (data) setCurrentTerm(data);
  };

  const fetchStudentData = async () => {
    const { data: studentData } = await supabase
      .from('students')
      .select('id, student_uid, date_of_birth, gender, is_active')
      .eq('profile_id', profile?.id)
      .single();

    if (!studentData) return;
    setStudent(studentData);

    await Promise.all([
      fetchAssignments(studentData.id),
      fetchReportCards(studentData.id),
      fetchAttendance(studentData.id),
      fetchMaterials(studentData.id),
      fetchSubjects(studentData.id),
    ]);
  };

  const fetchAssignments = async (studentId: string) => {
    const { data: enrollments } = await supabase
      .from('enrollments')
      .select('class_id')
      .eq('student_id', studentId)
      .eq('is_active', true);

    if (!enrollments?.length) { setAssignments([]); return; }
    const classIds = enrollments.map((e: any) => e.class_id);

    const { data } = await supabase
      .from('assignments')
      .select(`
        id, title, description, due_date, max_score, weight, is_published,
        class_subject:class_subjects(
          subject:subjects(name, category),
          class:classes(name, section)
        ),
        assignment_submissions(id, status, submitted_at, is_late, assignment_grades(score))
      `)
      .eq('school_id', schoolId)
      .eq('is_published', true)
      .eq('is_active', true)
      .in('class_subject_id', (
        await supabase.from('class_subjects').select('id').in('class_id', classIds).eq('school_id', schoolId)
      ).data?.map((cs: any) => cs.id) ?? [])
      .order('due_date', { ascending: true });

    if (data) setAssignments(data as any);
  };

  const fetchReportCards = async (studentId: string) => {
    const { data } = await supabase
      .from('report_cards')
      .select(`
        id, average_score, class_position, total_score,
        is_approved, pdf_url,
        term:terms(id, name),
        class:classes(name, section),
        report_card_subjects(
          id, score, grade, teacher_remark,
          subject:subjects(name, category)
        )
      `)
      .eq('student_id', studentId)
      .eq('school_id', schoolId)
      .eq('is_approved', true)
      .order('created_at', { ascending: false });
    if (data) setReportCards(data as any);
  };

  const fetchAttendance = async (studentId: string) => {
    const { data } = await supabase
      .from('attendance_records')
      .select(`
        id, status, remarks,
        session:attendance_sessions(session_date, class:classes(name))
      `)
      .eq('student_id', studentId)
      .eq('school_id', schoolId)
      .order('created_at', { ascending: false })
      .limit(30);
    if (data) setAttRecords(data as any);
  };

  const fetchMaterials = async (studentId: string) => {
    const { data: enrollments } = await supabase
      .from('enrollments')
      .select('class_id')
      .eq('student_id', studentId)
      .eq('is_active', true);

    if (!enrollments?.length) { setMaterials([]); return; }
    const classIds = enrollments.map((e: any) => e.class_id);

    const csData = await supabase.from('class_subjects').select('id').in('class_id', classIds).eq('school_id', schoolId);
    const csIds = csData.data?.map((c: any) => c.id) ?? [];

    if (!csIds.length) { setMaterials([]); return; }

    const { data } = await supabase
      .from('learning_materials')
      .select(`
        id, title, description, file_url, file_name, mime_type, created_at,
        class_subject:class_subjects(
          subject:subjects(name, category),
          class:classes(name)
        )
      `)
      .eq('school_id', schoolId)
      .in('class_subject_id', csIds)
      .order('created_at', { ascending: false });
    if (data) setMaterials(data as any);
  };

  const fetchSubjects = async (studentId: string) => {
    const { data: enrollments } = await supabase
      .from('enrollments')
      .select('class_id, term_id')
      .eq('student_id', studentId)
      .eq('is_active', true);

    if (!enrollments?.length) return;

    const classIds = [...new Set(enrollments.map((e: any) => e.class_id))];

    const { data: csData } = await supabase
      .from('class_subjects')
      .select('id, subject:subjects(id, name, category), class:classes(name)')
      .eq('school_id', schoolId)
      .in('class_id', classIds);

    if (csData) setEnrolledSubjects(csData as any);

    // Get all elective subjects
    const { data: allElectives } = await supabase
      .from('subjects')
      .select('id, name, category, description')
      .eq('school_id', schoolId)
      .eq('category', 'elective')
      .eq('is_active', true);
    if (allElectives) setElectiveSubjects(allElectives);

    // Get already selected electives
    if (currentTerm) {
      const { data: selElectives } = await supabase
        .from('student_electives')
        .select('subject_id')
        .eq('student_id', studentId)
        .eq('term_id', currentTerm.id);
      if (selElectives) setSelectedElectives(selElectives.map((e: any) => e.subject_id));
    }
  };

  const submitAssignment = async (assignmentId: string) => {
    if (!student) return;
    setSubmittingAssignment(assignmentId);
    try {
      const { error } = await supabase.from('assignment_submissions').insert({
        school_id: schoolId,
        assignment_id: assignmentId,
        student_id: student.id,
        submitted_at: new Date().toISOString(),
        status: 'submitted',
        is_late: assignments.find((a) => a.id === assignmentId)
          ? new Date() > new Date(assignments.find((a) => a.id === assignmentId)?.due_date)
          : false,
      });
      if (error) throw error;
      toast.success('Assignment submitted!');
      await fetchAssignments(student.id);
    } catch (err: any) { toast.error(err.message); }
    finally { setSubmittingAssignment(null); }
  };

  const downloadReport = async (rc: any) => {
    if (!rc.is_approved) { toast.error('Report not yet approved'); return; }
    if (rc.pdf_url) { window.open(rc.pdf_url, '_blank'); return; }
    setGenerating(rc.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(
        `${(import.meta as any).env.VITE_SUPABASE_URL}/functions/v1/generate-report-card`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`,
            'apikey': (import.meta as any).env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({ report_card_id: rc.id }),
        }
      );
      const result = await response.json();
      if (result.pdf_url) {
        window.open(result.pdf_url, '_blank');
        if (student) await fetchReportCards(student.id);
        toast.success('Report card opened!');
      } else {
        toast.error('Failed: ' + (result.error ?? 'Unknown'));
      }
    } catch (err: any) { toast.error(err.message); }
    finally { setGenerating(null); }
  };

  const saveElectives = async () => {
    if (!student || !currentTerm) { toast.error('No active term found'); return; }
    try {
      await supabase.from('student_electives')
        .delete().eq('student_id', student.id).eq('term_id', currentTerm.id);

      if (selectedElectives.length > 0) {
        await supabase.from('student_electives').insert(
          selectedElectives.map((subjectId) => ({
            school_id: schoolId,
            student_id: student.id,
            subject_id: subjectId,
            term_id: currentTerm.id,
          }))
        );
      }
      toast.success('Elective subjects saved!');
    } catch (err: any) { toast.error(err.message); }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordForm.newPass.length < 8) { toast.error('Min 8 characters'); return; }
    if (!/[A-Z]/.test(passwordForm.newPass)) { toast.error('Need one uppercase letter'); return; }
    if (!/[0-9]/.test(passwordForm.newPass)) { toast.error('Need one number'); return; }
    if (passwordForm.newPass !== passwordForm.confirm) { toast.error('Passwords do not match'); return; }
    setSavingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: passwordForm.newPass });
      if (error) throw error;
      toast.success('Password changed!');
      setPasswordForm({ newPass: '', confirm: '' });
    } catch (err: any) { toast.error(err.message); }
    finally { setSavingPassword(false); }
  };

  const present = attRecords.filter((r) => r.status === 'present').length;
  const attendancePct = attRecords.length > 0 ? Math.round((present / attRecords.length) * 100) : 0;

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard': return (
        <div>
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Welcome, {profile?.first_name}!</h1>
            <p className="text-gray-500 mt-1 font-mono text-sm">{student?.student_uid}</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[
              { label: 'Assignments', value: assignments.length, color: 'bg-blue-500' },
              { label: 'Attendance', value: `${attendancePct}%`, color: 'bg-green-500' },
              { label: 'Report Cards', value: reportCards.length, color: 'bg-purple-500' },
              { label: 'Subjects', value: enrolledSubjects.length, color: 'bg-orange-500' },
            ].map((s) => (
              <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-4">
                <p className="text-sm text-gray-500">{s.label}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{s.value}</p>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="text-base font-semibold text-gray-900 mb-4">Upcoming Assignments</h2>
              {assignments.length === 0 ? <p className="text-sm text-gray-400">No assignments.</p> :
                assignments.slice(0, 4).map((a: any) => {
                  const submitted = a.assignment_submissions?.length > 0;
                  const overdue = new Date(a.due_date) < new Date();
                  return (
                    <div key={a.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg mb-2">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{a.title}</p>
                        <p className="text-xs text-gray-500">{a.class_subject?.subject?.name} • Due: {new Date(a.due_date).toLocaleDateString()}</p>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${submitted ? 'bg-green-100 text-green-700' : overdue ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                        {submitted ? 'Submitted' : overdue ? 'Overdue' : 'Pending'}
                      </span>
                    </div>
                  );
                })
              }
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="text-base font-semibold text-gray-900 mb-4">Latest Report Cards</h2>
              {reportCards.length === 0 ? <p className="text-sm text-gray-400">No approved report cards yet.</p> :
                reportCards.slice(0, 3).map((rc: any) => (
                  <div key={rc.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg mb-2">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{rc.term?.name}</p>
                      <p className="text-xs text-gray-500">Avg: {rc.average_score?.toFixed(1)}% • Pos: {rc.class_position ?? '—'}</p>
                    </div>
                    <button onClick={() => downloadReport(rc)} disabled={generating === rc.id}
                      className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium">
                      <Download className="w-3.5 h-3.5" />
                      {generating === rc.id ? '...' : 'View'}
                    </button>
                  </div>
                ))
              }
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-5 md:col-span-2">
              <h2 className="text-base font-semibold text-gray-900 mb-4">School Announcements</h2>
              {announcements.length === 0 ? <p className="text-sm text-gray-400">No announcements.</p> :
                announcements.map((a: any) => (
                  <div key={a.id} className="p-3 bg-blue-50 border border-blue-100 rounded-lg mb-2">
                    <p className="text-sm font-medium text-gray-900">{a.title}</p>
                    <p className="text-xs text-gray-600 mt-1">{a.body}</p>
                    <p className="text-xs text-gray-400 mt-1">{new Date(a.published_at).toLocaleDateString()}</p>
                  </div>
                ))
              }
            </div>
          </div>
        </div>
      );

      case 'assignments': return (
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-6">Assignments</h1>
          {assignments.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
              <FileText className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-500">No assignments yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {assignments.map((a: any) => {
                const submitted = a.assignment_submissions?.length > 0;
                const grade = a.assignment_submissions?.[0]?.assignment_grades?.[0];
                const overdue = new Date(a.due_date) < new Date();
                return (
                  <div key={a.id} className="bg-white rounded-xl border border-gray-200 p-5">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="text-base font-semibold text-gray-900">{a.title}</h3>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {a.class_subject?.subject?.name} • {a.class_subject?.class?.name}
                        </p>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${submitted ? 'bg-green-100 text-green-700' : overdue ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                        {submitted ? 'Submitted' : overdue ? 'Overdue' : 'Pending'}
                      </span>
                    </div>
                    {a.description && <p className="text-sm text-gray-600 mb-3 line-clamp-2">{a.description}</p>}
                    <div className="flex items-center gap-4 text-xs text-gray-500 mb-3">
                      <span>Due: {new Date(a.due_date).toLocaleDateString()}</span>
                      <span>Max: {a.max_score} pts</span>
                      <span>Weight: {a.weight}%</span>
                    </div>
                    {grade && (
                      <div className="mb-3 p-2 bg-green-50 rounded-lg flex items-center justify-between">
                        <span className="text-xs text-green-700 font-medium">Score: {grade.score}/{a.max_score}</span>
                        <span className="text-xs text-green-600">{((grade.score / a.max_score) * 100).toFixed(1)}%</span>
                      </div>
                    )}
                    {!submitted && !overdue && (
                      <button onClick={() => submitAssignment(a.id)} disabled={submittingAssignment === a.id}
                        className="w-full mt-2 bg-purple-600 hover:bg-purple-700 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-50">
                        {submittingAssignment === a.id ? 'Submitting...' : 'Submit Assignment'}
                      </button>
                    )}
                    {submitted && !grade && (
                      <p className="text-xs text-center text-gray-400 mt-2">Awaiting grading...</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      );

      case 'attendance': return (
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-6">My Attendance</h1>
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-green-700">{present}</p>
              <p className="text-sm text-green-600 mt-1">Present</p>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-red-700">{attRecords.filter((r) => r.status === 'absent').length}</p>
              <p className="text-sm text-red-600 mt-1">Absent</p>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-blue-700">{attendancePct}%</p>
              <p className="text-sm text-blue-600 mt-1">Rate</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Class</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {attRecords.length === 0 ? (
                  <tr><td colSpan={4} className="text-center py-8 text-gray-400">No attendance records yet</td></tr>
                ) : attRecords.map((r: any) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-6 py-3 text-sm text-gray-900">
                      {r.session?.session_date ? new Date(r.session.session_date).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-6 py-3 text-sm text-gray-600">{r.session?.class?.name ?? '—'}</td>
                    <td className="px-6 py-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        r.status === 'present' ? 'bg-green-100 text-green-700' :
                        r.status === 'absent' ? 'bg-red-100 text-red-700' :
                        r.status === 'late' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-blue-100 text-blue-700'
                      }`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-sm text-gray-500">{r.remarks ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );

      case 'reports': return (
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-6">My Report Cards</h1>
          {reportCards.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
              <Award className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-500">No approved report cards yet.</p>
              <p className="text-xs text-gray-400 mt-1">Report cards will appear here once your school admin approves them.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {reportCards.map((rc: any) => (
                <div key={rc.id} className="bg-white rounded-xl border border-gray-200 p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-base font-semibold text-gray-900">{rc.term?.name}</h3>
                      <p className="text-sm text-gray-500">{rc.class?.name} {rc.class?.section ?? ''}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                        <CheckCircle className="w-3 h-3" />
                        Approved
                      </span>
                      <button onClick={() => downloadReport(rc)} disabled={generating === rc.id}
                        className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50">
                        <Download className="w-4 h-4" />
                        {generating === rc.id ? 'Loading...' : 'View Report'}
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div className="bg-blue-50 rounded-lg p-3 text-center">
                      <p className="text-xl font-bold text-blue-700">{rc.average_score?.toFixed(1) ?? '—'}%</p>
                      <p className="text-xs text-blue-600">Average</p>
                    </div>
                    <div className="bg-purple-50 rounded-lg p-3 text-center">
                      <p className="text-xl font-bold text-purple-700">{rc.class_position ?? '—'}</p>
                      <p className="text-xs text-purple-600">Position</p>
                    </div>
                    <div className="bg-green-50 rounded-lg p-3 text-center">
                      <p className="text-xl font-bold text-green-700">{rc.report_card_subjects?.length ?? 0}</p>
                      <p className="text-xs text-green-600">Subjects</p>
                    </div>
                  </div>

                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Subject</th>
                          <th className="text-center px-4 py-2 text-xs font-medium text-gray-500">Score</th>
                          <th className="text-center px-4 py-2 text-xs font-medium text-gray-500">Grade</th>
                          <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Remark</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {rc.report_card_subjects?.map((rcs: any) => (
                          <tr key={rcs.id}>
                            <td className="px-4 py-2 text-sm text-gray-900">{rcs.subject?.name}</td>
                            <td className="px-4 py-2 text-center text-sm font-medium">{rcs.score?.toFixed(1) ?? '—'}</td>
                            <td className="px-4 py-2 text-center">
                              <span className={`text-sm font-bold ${
                                rcs.grade === 'A' ? 'text-green-600' :
                                rcs.grade === 'B' ? 'text-blue-600' :
                                rcs.grade === 'C' ? 'text-yellow-600' :
                                rcs.grade === 'D' ? 'text-orange-600' : 'text-red-600'
                              }`}>{rcs.grade ?? '—'}</span>
                            </td>
                            <td className="px-4 py-2 text-xs text-gray-500">{rcs.teacher_remark ?? '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      );

      case 'materials': return (
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-6">Learning Materials</h1>
          {materials.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
              <BookOpen className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-500">No materials available yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {materials.map((m: any) => {
                const isImage = m.mime_type?.startsWith('image/');
                const isPDF = m.mime_type === 'application/pdf';
                const icon = isPDF ? '📄' : isImage ? '🖼️' : '📁';
                return (
                  <div key={m.id} className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col">
                    <div className="flex items-start gap-3 mb-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center text-lg flex-shrink-0">
                        {icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold text-gray-900 truncate">{m.title}</h3>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {m.class_subject?.subject?.name} • {m.class_subject?.class?.name}
                        </p>
                      </div>
                    </div>
                    {m.description && <p className="text-xs text-gray-500 mb-3 line-clamp-2">{m.description}</p>}
                    <p className="text-xs text-gray-400 mb-3">{new Date(m.created_at).toLocaleDateString()}</p>
                    <a href={m.file_url} target="_blank" rel="noopener noreferrer"
                      className="mt-auto flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg text-sm font-medium transition-colors">
                      <Download className="w-4 h-4" />
                      Download
                    </a>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      );

      case 'subjects': return (
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-6">My Subjects</h1>

          {/* Core Subjects */}
          <div className="mb-6">
            <h2 className="text-base font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <span className="w-3 h-3 bg-blue-600 rounded-full"></span>
              Core Subjects (Compulsory)
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {enrolledSubjects.filter((cs: any) => cs.subject?.category === 'core').map((cs: any) => (
                <div key={cs.id} className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                  <p className="text-sm font-semibold text-blue-900">{cs.subject?.name}</p>
                  <p className="text-xs text-blue-600 mt-1">{cs.class?.name}</p>
                </div>
              ))}
              {enrolledSubjects.filter((cs: any) => cs.subject?.category === 'core').length === 0 && (
                <p className="text-sm text-gray-400 col-span-3">No core subjects assigned yet.</p>
              )}
            </div>
          </div>

          {/* Elective Subjects */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                <span className="w-3 h-3 bg-purple-600 rounded-full"></span>
                Elective Subjects (Choose your subjects)
              </h2>
              <button onClick={saveElectives}
                className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
                Save Choices
              </button>
            </div>
            {electiveSubjects.length === 0 ? (
              <p className="text-sm text-gray-400">No elective subjects available.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {electiveSubjects.map((s: any) => {
                  const isSelected = selectedElectives.includes(s.id);
                  return (
                    <button key={s.id} onClick={() => setSelectedElectives((prev) =>
                      isSelected ? prev.filter((id) => id !== s.id) : [...prev, s.id]
                    )}
                      className={`flex items-center gap-3 p-4 rounded-xl border-2 text-left transition-all ${
                        isSelected ? 'border-purple-500 bg-purple-50' : 'border-gray-200 hover:border-purple-300 hover:bg-purple-50'
                      }`}>
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                        isSelected ? 'bg-purple-600 border-purple-600' : 'border-gray-300'
                      }`}>
                        {isSelected && <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                        </svg>}
                      </div>
                      <div>
                        <p className={`text-sm font-medium ${isSelected ? 'text-purple-900' : 'text-gray-900'}`}>{s.name}</p>
                        {s.description && <p className="text-xs text-gray-500 mt-0.5">{s.description}</p>}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
            <p className="text-xs text-gray-400 mt-4">
              Selected: {selectedElectives.length} elective{selectedElectives.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
      );

      case 'password': return (
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-6">Change Password</h1>
          <div className="bg-white rounded-xl border border-gray-200 p-6 max-w-md">
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">New Password *</label>
                <input type="password" value={passwordForm.newPass}
                  onChange={(e) => setPasswordForm({ ...passwordForm, newPass: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
                <p className="text-xs text-gray-400 mt-1">Min 8 chars, 1 uppercase, 1 number</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password *</label>
                <input type="password" value={passwordForm.confirm}
                  onChange={(e) => setPasswordForm({ ...passwordForm, confirm: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
              </div>
              <button type="submit" disabled={savingPassword}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white py-2.5 rounded-lg text-sm font-medium disabled:opacity-50">
                {savingPassword ? 'Changing...' : 'Change Password'}
              </button>
            </form>
          </div>
        </div>
      );

      default: return <div className="flex items-center justify-center h-64"><p className="text-gray-500">Coming soon...</p></div>;
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
                  isActive ? 'bg-purple-50 text-purple-700' : 'text-gray-600 hover:bg-gray-50'
                }`}>
                <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-purple-700' : 'text-gray-400'}`} />
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
            <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center">
              <span className="text-white text-sm font-medium">{profile?.first_name?.[0]}{profile?.last_name?.[0]}</span>
            </div>
            <div className="hidden md:block">
              <p className="text-sm font-medium text-gray-900">{profile?.first_name} {profile?.last_name}</p>
              <p className="text-xs text-gray-500 font-mono">{student?.student_uid}</p>
            </div>
          </div>
        </header>
        <main className="p-6">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
            </div>
          ) : renderPage()}
        </main>
      </div>
    </div>
  );
}