import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import { Plus, Search, UserMinus } from 'lucide-react';

interface Enrollment {
  id: string;
  student: {
    id: string;
    student_uid: string;
    profile: { first_name: string; last_name: string };
  };
  class: { id: string; name: string; section: string | null };
  term: { id: string; name: string };
  is_active: boolean;
}

export default function EnrollmentsPage() {
  const { schoolId } = useAuth();
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [terms, setTerms] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [filterClass, setFilterClass] = useState('');
  const [form, setForm] = useState({
    student_id: '', class_id: '', term_id: '',
  });

  useEffect(() => {
    if (schoolId) {
      fetchEnrollments();
      fetchClasses();
      fetchTerms();
      fetchStudents();
    }
  }, [schoolId]);

  const fetchEnrollments = async () => {
    const { data, error } = await supabase
      .from('enrollments')
      .select(`
        id, is_active,
        student:students(
          id, student_uid,
          profile:profiles(first_name, last_name)
        ),
        class:classes(id, name, section),
        term:terms(id, name)
      `)
      .eq('school_id', schoolId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (!error && data) setEnrollments(data as any);
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
      .order('created_at', { ascending: false });
    if (data) setStudents(data as any);
  };

  const handleEnroll = async () => {
    if (!form.student_id || !form.class_id || !form.term_id) {
      alert('Please select student, class and term.');
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from('enrollments').insert({
        school_id: schoolId,
        student_id: form.student_id,
        class_id: form.class_id,
        term_id: form.term_id,
      });
      if (error) throw error;
      setShowModal(false);
      setForm({ student_id: '', class_id: '', term_id: form.term_id });
      fetchEnrollments();
    } catch (err: any) {
      alert('Error enrolling student: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleUnenroll = async (id: string) => {
    if (!confirm('Remove this student from the class?')) return;
    await supabase.from('enrollments').update({ is_active: false }).eq('id', id);
    fetchEnrollments();
  };

  const filtered = enrollments.filter((e) => {
    const name = `${e.student?.profile?.first_name} ${e.student?.profile?.last_name} ${e.student?.student_uid}`.toLowerCase();
    const matchSearch = name.includes(search.toLowerCase());
    const matchClass = filterClass ? e.class?.id === filterClass : true;
    return matchSearch && matchClass;
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Enrollments</h1>
          <p className="text-gray-500 mt-1">{enrollments.length} active enrollments</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Enroll Student
        </button>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search students..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          />
        </div>
        <select
          value={filterClass}
          onChange={(e) => setFilterClass(e.target.value)}
          className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
        >
          <option value="">All Classes</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} {c.section ? `- ${c.section}` : ''}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Student</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Student ID</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Class</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Term</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={5} className="text-center py-8 text-gray-400">Loading...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-8 text-gray-400">No enrollments found</td></tr>
            ) : filtered.map((enrollment) => (
              <tr key={enrollment.id} className="hover:bg-gray-50">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                      <span className="text-green-700 text-sm font-medium">
                        {enrollment.student?.profile?.first_name?.[0]}
                        {enrollment.student?.profile?.last_name?.[0]}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-gray-900">
                      {enrollment.student?.profile?.first_name} {enrollment.student?.profile?.last_name}
                    </p>
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">{enrollment.student?.student_uid}</td>
                <td className="px-6 py-4 text-sm text-gray-600">
                  {enrollment.class?.name} {enrollment.class?.section ? `- ${enrollment.class.section}` : ''}
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">{enrollment.term?.name}</td>
                <td className="px-6 py-4">
                  <button
                    onClick={() => handleUnenroll(enrollment.id)}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Remove from class"
                  >
                    <UserMinus className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Enroll Student</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Student *</label>
                <select
                  value={form.student_id}
                  onChange={(e) => setForm({ ...form, student_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
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
                <select
                  value={form.class_id}
                  onChange={(e) => setForm({ ...form, class_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Class</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.section ? `- ${c.section}` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Term *</label>
                <select
                  value={form.term_id}
                  onChange={(e) => setForm({ ...form, term_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Term</option>
                  {terms.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} {t.is_current ? '(Current)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleEnroll}
                disabled={saving}
                className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Enrolling...' : 'Enroll Student'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}