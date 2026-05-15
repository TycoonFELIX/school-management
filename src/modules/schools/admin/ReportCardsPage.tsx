import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import { Plus, Search, Download, CheckCircle, X, Eye } from 'lucide-react';

interface ReportCard {
  id: string;
  total_score: number | null;
  average_score: number | null;
  class_position: number | null;
  attendance_days: number | null;
  present_days: number | null;
  principal_remark: string | null;
  class_teacher_remark: string | null;
  is_approved: boolean;
  pdf_url: string | null;
  student: {
    id: string;
    student_uid: string;
    profile: { first_name: string; last_name: string };
  };
  class: { name: string; section: string | null };
  term: { name: string };
  report_card_subjects: {
    id: string;
    score: number | null;
    grade: string | null;
    position: number | null;
    teacher_remark: string | null;
    subject: { name: string; category: string };
  }[];
}

export default function ReportCardsPage() {
  const { schoolId } = useAuth();
  const [reportCards, setReportCards] = useState<ReportCard[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [terms, setTerms] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterClass, setFilterClass] = useState('');
  const [filterTerm, setFilterTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [selectedCard, setSelectedCard] = useState<ReportCard | null>(null);
  const [form, setForm] = useState({
    student_id: '',
    class_id: '',
    term_id: '',
    attendance_days: '',
    present_days: '',
    principal_remark: '',
    class_teacher_remark: '',
  });
  const [subjectScores, setSubjectScores] = useState<Record<string, { score: string; grade: string; remark: string }>>({});

  useEffect(() => {
    if (schoolId) {
      fetchReportCards();
      fetchClasses();
      fetchTerms();
      fetchStudents();
      fetchSubjects();
    }
  }, [schoolId]);

  useEffect(() => {
    // Set current term as default
    const current = terms.find((t) => t.is_current);
    if (current) setFilterTerm(current.id);
  }, [terms]);

  const fetchReportCards = async () => {
    const { data, error } = await supabase
      .from('report_cards')
      .select(`
        id, total_score, average_score, class_position,
        attendance_days, present_days, principal_remark,
        class_teacher_remark, is_approved, pdf_url,
        student:students(
          id, student_uid,
          profile:profiles(first_name, last_name)
        ),
        class:classes(name, section),
        term:terms(name),
        report_card_subjects(
          id, score, grade, position, teacher_remark,
          subject:subjects(name, category)
        )
      `)
      .eq('school_id', schoolId)
      .order('created_at', { ascending: false });

    if (!error && data) setReportCards(data as any);
    setLoading(false);
  };

  const fetchClasses = async () => {
    const { data } = await supabase
      .from('classes')
      .select('id, name, section')
      .eq('school_id', schoolId)
      .eq('is_active', true)
      .order('name');
    if (data) setClasses(data);
  };

  const fetchTerms = async () => {
    const { data } = await supabase
      .from('terms')
      .select('id, name, is_current')
      .eq('school_id', schoolId)
      .order('start_date', { ascending: false });
    if (data) {
      setTerms(data);
      const current = data.find((t) => t.is_current);
      if (current) setForm((f) => ({ ...f, term_id: current.id }));
    }
  };

  const fetchStudents = async () => {
    const { data } = await supabase
      .from('students')
      .select('id, student_uid, profile:profiles(first_name, last_name)')
      .eq('school_id', schoolId)
      .eq('is_active', true)
      .order('created_at');
    if (data) setStudents(data as any);
  };

  const fetchSubjects = async () => {
    const { data } = await supabase
      .from('subjects')
      .select('id, name, category')
      .eq('school_id', schoolId)
      .eq('is_active', true)
      .order('name');
    if (data) {
      setSubjects(data);
      const initial: Record<string, { score: string; grade: string; remark: string }> = {};
      data.forEach((s) => { initial[s.id] = { score: '', grade: '', remark: '' }; });
      setSubjectScores(initial);
    }
  };

  const calculateGrade = (score: number): string => {
    if (score >= 80) return 'A';
    if (score >= 70) return 'B';
    if (score >= 60) return 'C';
    if (score >= 50) return 'D';
    return 'F';
  };

  const handleScoreChange = (subjectId: string, score: string) => {
    const numScore = parseFloat(score);
    const grade = !isNaN(numScore) ? calculateGrade(numScore) : '';
    setSubjectScores((prev) => ({
      ...prev,
      [subjectId]: { ...prev[subjectId], score, grade },
    }));
  };

  const handleCreate = async () => {
    if (!form.student_id || !form.class_id || !form.term_id) {
      alert('Student, class and term are required.');
      return;
    }
    setSaving(true);
    try {
      // Calculate totals
      const scores = Object.values(subjectScores)
        .filter((s) => s.score !== '')
        .map((s) => parseFloat(s.score));
      const totalScore = scores.reduce((a, b) => a + b, 0);
      const averageScore = scores.length > 0 ? totalScore / scores.length : 0;

      // Create report card
      const { data: rc, error: rcError } = await supabase
        .from('report_cards')
        .insert({
          school_id: schoolId,
          student_id: form.student_id,
          class_id: form.class_id,
          term_id: form.term_id,
          total_score: totalScore,
          average_score: parseFloat(averageScore.toFixed(2)),
          attendance_days: parseInt(form.attendance_days) || null,
          present_days: parseInt(form.present_days) || null,
          principal_remark: form.principal_remark || null,
          class_teacher_remark: form.class_teacher_remark || null,
        })
        .select()
        .single();

      if (rcError) throw rcError;

      // Create subject scores
      const subjectRows = subjects
        .filter((s) => subjectScores[s.id]?.score !== '')
        .map((s) => ({
          school_id: schoolId,
          report_card_id: rc.id,
          subject_id: s.id,
          score: parseFloat(subjectScores[s.id].score),
          grade: subjectScores[s.id].grade,
          teacher_remark: subjectScores[s.id].remark || null,
        }));

      if (subjectRows.length > 0) {
        await supabase.from('report_card_subjects').insert(subjectRows);
      }

      // Calculate class positions
      await calculatePositions(form.term_id, form.class_id);

      setShowModal(false);
      resetForm();
      fetchReportCards();
      alert('Report card created successfully!');
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const calculatePositions = async (termId: string, classId: string) => {
    const { data } = await supabase
      .rpc('calculate_class_positions', {
        p_term_id: termId,
        p_class_id: classId,
      });

    if (data) {
      for (const row of data) {
        await supabase
          .from('report_cards')
          .update({ class_position: row.class_position })
          .eq('student_id', row.student_id)
          .eq('term_id', termId);
      }
    }
  };

  const handleApprove = async (id: string) => {
    if (!confirm('Approve this report card? Grades will be locked after approval.')) return;
    await supabase.from('report_cards').update({
      is_approved: true,
      approved_at: new Date().toISOString(),
    }).eq('id', id);
    fetchReportCards();
    alert('Report card approved and locked!');
  };

  const handleGeneratePDF = async (reportCardId: string) => {
    setGenerating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-report-card`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`,
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({ report_card_id: reportCardId }),
        }
      );
      const result = await response.json();
      if (result.pdf_url) {
        window.open(result.pdf_url, '_blank');
        fetchReportCards();
      } else {
        alert('PDF generation failed: ' + (result.error ?? 'Unknown error'));
      }
    } catch (err: any) {
      alert('Error generating PDF: ' + err.message);
    } finally {
      setGenerating(false);
    }
  };

  const resetForm = () => {
    const current = terms.find((t) => t.is_current);
    setForm({
      student_id: '', class_id: '', term_id: current?.id ?? '',
      attendance_days: '', present_days: '',
      principal_remark: '', class_teacher_remark: '',
    });
    const initial: Record<string, { score: string; grade: string; remark: string }> = {};
    subjects.forEach((s) => { initial[s.id] = { score: '', grade: '', remark: '' }; });
    setSubjectScores(initial);
  };

  const filtered = reportCards.filter((rc) => {
    const name = `${rc.student?.profile?.first_name} ${rc.student?.profile?.last_name} ${rc.student?.student_uid}`.toLowerCase();
    const matchSearch = name.includes(search.toLowerCase());
    const matchClass = filterClass ? rc.class?.name === classes.find((c) => c.id === filterClass)?.name : true;
    const matchTerm = filterTerm ? rc.term?.name === terms.find((t) => t.id === filterTerm)?.name : true;
    return matchSearch && matchClass && matchTerm;
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Report Cards</h1>
          <p className="text-gray-500 mt-1">{reportCards.length} report cards generated</p>
        </div>
        <button
          onClick={() => { resetForm(); setShowModal(true); }}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Create Report Card
        </button>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" placeholder="Search students..."
            value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
        </div>
        <select value={filterClass} onChange={(e) => setFilterClass(e.target.value)}
          className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm">
          <option value="">All Classes</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>{c.name} {c.section ? `- ${c.section}` : ''}</option>
          ))}
        </select>
        <select value={filterTerm} onChange={(e) => setFilterTerm(e.target.value)}
          className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm">
          <option value="">All Terms</option>
          {terms.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      </div>

      {/* Report cards table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Student</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Class</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Term</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Average</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Position</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={7} className="text-center py-8 text-gray-400">Loading...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-8 text-gray-400">No report cards found</td></tr>
            ) : filtered.map((rc) => (
              <tr key={rc.id} className="hover:bg-gray-50">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                      <span className="text-blue-700 text-sm font-medium">
                        {rc.student?.profile?.first_name?.[0]}{rc.student?.profile?.last_name?.[0]}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {rc.student?.profile?.first_name} {rc.student?.profile?.last_name}
                      </p>
                      <p className="text-xs text-gray-500">{rc.student?.student_uid}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">
                  {rc.class?.name} {rc.class?.section ?? ''}
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">{rc.term?.name}</td>
                <td className="px-6 py-4 text-sm font-medium text-gray-900">
                  {rc.average_score?.toFixed(1) ?? '—'}%
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">
                  {rc.class_position ? `${rc.class_position}` : '—'}
                </td>
                <td className="px-6 py-4">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    rc.is_approved
                      ? 'bg-green-100 text-green-700'
                      : 'bg-yellow-100 text-yellow-700'
                  }`}>
                    {rc.is_approved ? 'Approved' : 'Pending'}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => { setSelectedCard(rc); setShowViewModal(true); }}
                      className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="View"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    {!rc.is_approved && (
                      <button
                        onClick={() => handleApprove(rc.id)}
                        className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                        title="Approve"
                      >
                        <CheckCircle className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => handleGeneratePDF(rc.id)}
                      disabled={generating}
                      className="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                      title="Generate PDF"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">Create Report Card</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Student *</label>
                <select value={form.student_id}
                  onChange={(e) => setForm({ ...form, student_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Select Student</option>
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.profile?.first_name} {s.profile?.last_name} ({s.student_uid})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Class *</label>
                <select value={form.class_id}
                  onChange={(e) => setForm({ ...form, class_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Select Class</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>{c.name} {c.section ?? ''}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Term *</label>
                <select value={form.term_id}
                  onChange={(e) => setForm({ ...form, term_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Select Term</option>
                  {terms.map((t) => (
                    <option key={t.id} value={t.id}>{t.name} {t.is_current ? '(Current)' : ''}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Subject scores */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Subject Scores</h3>
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Subject</th>
                      <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Category</th>
                      <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Score</th>
                      <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Grade</th>
                      <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Remark</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {subjects.map((subject) => (
                      <tr key={subject.id}>
                        <td className="px-4 py-2 text-sm text-gray-900">{subject.name}</td>
                        <td className="px-4 py-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            subject.category === 'core'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-purple-100 text-purple-700'
                          }`}>
                            {subject.category}
                          </span>
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={subjectScores[subject.id]?.score ?? ''}
                            onChange={(e) => handleScoreChange(subject.id, e.target.value)}
                            placeholder="0-100"
                            className="w-20 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <span className={`text-sm font-semibold ${
                            subjectScores[subject.id]?.grade === 'A' ? 'text-green-600' :
                            subjectScores[subject.id]?.grade === 'B' ? 'text-blue-600' :
                            subjectScores[subject.id]?.grade === 'C' ? 'text-yellow-600' :
                            subjectScores[subject.id]?.grade === 'D' ? 'text-orange-600' :
                            subjectScores[subject.id]?.grade === 'F' ? 'text-red-600' : 'text-gray-400'
                          }`}>
                            {subjectScores[subject.id]?.grade || '—'}
                          </span>
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="text"
                            value={subjectScores[subject.id]?.remark ?? ''}
                            onChange={(e) => setSubjectScores((prev) => ({
                              ...prev,
                              [subject.id]: { ...prev[subject.id], remark: e.target.value }
                            }))}
                            placeholder="Teacher's remark"
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Attendance & Remarks */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Total School Days</label>
                <input type="number" value={form.attendance_days}
                  onChange={(e) => setForm({ ...form, attendance_days: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Days Present</label>
                <input type="number" value={form.present_days}
                  onChange={(e) => setForm({ ...form, present_days: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Class Teacher's Remark</label>
              <textarea value={form.class_teacher_remark}
                onChange={(e) => setForm({ ...form, class_teacher_remark: e.target.value })}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Principal's Remark</label>
              <textarea value={form.principal_remark}
                onChange={(e) => setForm({ ...form, principal_remark: e.target.value })}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>

            <div className="flex gap-3">
              <button onClick={() => setShowModal(false)}
                className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={handleCreate} disabled={saving}
                className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                {saving ? 'Creating...' : 'Create Report Card'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Modal */}
      {showViewModal && selectedCard && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-gray-900">Report Card</h2>
              <button onClick={() => setShowViewModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Student info */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-500">Student Name</p>
                  <p className="font-semibold text-gray-900">
                    {selectedCard.student?.profile?.first_name} {selectedCard.student?.profile?.last_name}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">Student ID</p>
                  <p className="font-semibold text-gray-900 font-mono">{selectedCard.student?.student_uid}</p>
                </div>
                <div>
                  <p className="text-gray-500">Class</p>
                  <p className="font-semibold text-gray-900">{selectedCard.class?.name} {selectedCard.class?.section ?? ''}</p>
                </div>
                <div>
                  <p className="text-gray-500">Term</p>
                  <p className="font-semibold text-gray-900">{selectedCard.term?.name}</p>
                </div>
                <div>
                  <p className="text-gray-500">Average Score</p>
                  <p className="font-semibold text-gray-900">{selectedCard.average_score?.toFixed(1) ?? '—'}%</p>
                </div>
                <div>
                  <p className="text-gray-500">Class Position</p>
                  <p className="font-semibold text-gray-900">{selectedCard.class_position ?? '—'}</p>
                </div>
                <div>
                  <p className="text-gray-500">Attendance</p>
                  <p className="font-semibold text-gray-900">
                    {selectedCard.present_days ?? '—'} / {selectedCard.attendance_days ?? '—'} days
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">Status</p>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    selectedCard.is_approved ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                  }`}>
                    {selectedCard.is_approved ? 'Approved' : 'Pending Approval'}
                  </span>
                </div>
              </div>
            </div>

            {/* Subject scores */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Subject Results</h3>
              <table className="w-full border border-gray-200 rounded-lg overflow-hidden">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Subject</th>
                    <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Score</th>
                    <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Grade</th>
                    <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Remark</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {selectedCard.report_card_subjects?.map((rcs) => (
                    <tr key={rcs.id}>
                      <td className="px-4 py-2 text-sm text-gray-900">{rcs.subject?.name}</td>
                      <td className="px-4 py-2 text-sm font-medium text-gray-900">{rcs.score?.toFixed(1) ?? '—'}</td>
                      <td className="px-4 py-2">
                        <span className={`text-sm font-bold ${
                          rcs.grade === 'A' ? 'text-green-600' :
                          rcs.grade === 'B' ? 'text-blue-600' :
                          rcs.grade === 'C' ? 'text-yellow-600' :
                          rcs.grade === 'D' ? 'text-orange-600' :
                          rcs.grade === 'F' ? 'text-red-600' : 'text-gray-400'
                        }`}>
                          {rcs.grade ?? '—'}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-600">{rcs.teacher_remark ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Remarks */}
            {selectedCard.class_teacher_remark && (
              <div className="mb-3">
                <p className="text-sm font-medium text-gray-700">Class Teacher's Remark</p>
                <p className="text-sm text-gray-600 mt-1">{selectedCard.class_teacher_remark}</p>
              </div>
            )}
            {selectedCard.principal_remark && (
              <div className="mb-4">
                <p className="text-sm font-medium text-gray-700">Principal's Remark</p>
                <p className="text-sm text-gray-600 mt-1">{selectedCard.principal_remark}</p>
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={() => setShowViewModal(false)}
                className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50">
                Close
              </button>
              <button
                onClick={() => handleGeneratePDF(selectedCard.id)}
                disabled={generating}
                className="flex-1 px-4 py-2.5 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" />
                {generating ? 'Generating...' : 'Download PDF'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}