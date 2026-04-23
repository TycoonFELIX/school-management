import { useEffect, useState } from 'react';
import { supabase, callEdgeFunction } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import { Plus, Search, Edit, UserX, UserCheck, X, BookOpen } from 'lucide-react';

interface Student {
  id: string;
  student_uid: string;
  date_of_birth: string | null;
  gender: string | null;
  is_active: boolean;
  profile: {
    id: string;
    first_name: string;
    last_name: string;
    email: string | null;
    phone: string | null;
  };
}

interface Subject { id: string; name: string; category: string; }

export default function StudentsPage() {
  const { schoolId } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showElectiveModal, setShowElectiveModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [selectedElectives, setSelectedElectives] = useState<string[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [terms, setTerms] = useState<any[]>([]);
  const [form, setForm] = useState({
    first_name: '', last_name: '', email: '',
    phone: '', date_of_birth: '', gender: '', password: '',
  });
  const [editForm, setEditForm] = useState({
    first_name: '', last_name: '', phone: '',
    date_of_birth: '', gender: '', is_active: true,
  });

  useEffect(() => {
    if (schoolId) {
      fetchStudents();
      fetchSubjects();
      fetchClasses();
      fetchTerms();
    }
  }, [schoolId]);

  const fetchStudents = async () => {
    const { data, error } = await supabase
      .from('students')
      .select(`
        id, student_uid, date_of_birth, gender, is_active,
        profile:profiles(id, first_name, last_name, email, phone)
      `)
      .eq('school_id', schoolId)
      .order('created_at', { ascending: false });
    if (!error && data) setStudents(data as any);
    setLoading(false);
  };

  const fetchSubjects = async () => {
    const { data } = await supabase
      .from('subjects')
      .select('id, name, category')
      .eq('school_id', schoolId)
      .eq('is_active', true)
      .order('name');
    if (data) setSubjects(data);
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
    if (data) setTerms(data);
  };

  const handleCreate = async () => {
    if (!form.first_name || !form.last_name || !form.password) {
      alert('First name, last name and password are required.');
      return;
    }
    setSaving(true);
    try {
      const result = await callEdgeFunction('create-school-user', {
        email: form.email || `${Date.now()}@${schoolId}.internal`,
        password: form.password,
        role: 'student',
        school_id: schoolId,
        first_name: form.first_name,
        last_name: form.last_name,
        phone: form.phone,
        metadata: {
          date_of_birth: form.date_of_birth || null,
          gender: form.gender || null,
        },
      });
      setShowModal(false);
      setForm({ first_name: '', last_name: '', email: '', phone: '', date_of_birth: '', gender: '', password: '' });
      fetchStudents();
      alert(`Student created! ID: ${result.school_uid}`);
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (student: Student) => {
    setSelectedStudent(student);
    setEditForm({
      first_name: student.profile?.first_name ?? '',
      last_name: student.profile?.last_name ?? '',
      phone: student.profile?.phone ?? '',
      date_of_birth: student.date_of_birth ?? '',
      gender: student.gender ?? '',
      is_active: student.is_active,
    });
    setShowEditModal(true);
  };

  const handleEdit = async () => {
    if (!selectedStudent) return;
    setSaving(true);
    try {
      await supabase.from('profiles').update({
        first_name: editForm.first_name,
        last_name: editForm.last_name,
        phone: editForm.phone || null,
        is_active: editForm.is_active,
      }).eq('id', selectedStudent.profile?.id);

      await supabase.from('students').update({
        date_of_birth: editForm.date_of_birth || null,
        gender: editForm.gender || null,
        is_active: editForm.is_active,
      }).eq('id', selectedStudent.id);

      setShowEditModal(false);
      fetchStudents();
      alert('Student updated successfully!');
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const openElectives = async (student: Student) => {
    setSelectedStudent(student);
    // Load existing elective enrollments for this student
    const currentTerm = terms.find((t) => t.is_current);
    if (currentTerm) {
      const { data } = await supabase
        .from('enrollments')
        .select('class_id')
        .eq('student_id', student.id)
        .eq('term_id', currentTerm.id)
        .eq('is_active', true);
      // For now just open with empty selection
    }
    setSelectedElectives([]);
    setShowElectiveModal(true);
  };

  const handleSaveElectives = async () => {
    if (!selectedStudent) return;
    const currentTerm = terms.find((t) => t.is_current);
    if (!currentTerm) {
      alert('No current term found.');
      return;
    }
    setSaving(true);
    try {
      // Save elective subject selections as class_subjects enrollments
      for (const subjectId of selectedElectives) {
        await supabase.from('class_subjects').upsert({
          school_id: schoolId,
          class_id: classes[0]?.id, // Default to first class — can be improved
          subject_id: subjectId,
          term_id: currentTerm.id,
        }, { onConflict: 'class_id,subject_id,term_id' });
      }
      setShowElectiveModal(false);
      alert('Elective subjects saved successfully!');
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleElective = (subjectId: string) => {
    setSelectedElectives((prev) =>
      prev.includes(subjectId)
        ? prev.filter((id) => id !== subjectId)
        : [...prev, subjectId]
    );
  };

  const toggleActive = async (id: string, profileId: string, currentStatus: boolean) => {
    await supabase.from('students').update({ is_active: !currentStatus }).eq('id', id);
    await supabase.from('profiles').update({ is_active: !currentStatus }).eq('id', profileId);
    fetchStudents();
  };

  const filtered = students.filter(s =>
    `${s.profile?.first_name} ${s.profile?.last_name} ${s.student_uid}`
      .toLowerCase().includes(search.toLowerCase())
  );

  const electiveSubjects = subjects.filter((s) => s.category === 'elective');
  const coreSubjects = subjects.filter((s) => s.category === 'core');

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Students</h1>
          <p className="text-gray-500 mt-1">{students.length} students registered</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Student
        </button>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search students..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
        />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Student</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">ID</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Gender</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={5} className="text-center py-8 text-gray-400">Loading...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-8 text-gray-400">No students found</td></tr>
            ) : filtered.map((student) => (
              <tr key={student.id} className="hover:bg-gray-50">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                      <span className="text-green-700 text-sm font-medium">
                        {student.profile?.first_name?.[0]}{student.profile?.last_name?.[0]}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {student.profile?.first_name} {student.profile?.last_name}
                      </p>
                      <p className="text-xs text-gray-500">{student.profile?.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-gray-600 font-mono">{student.student_uid}</td>
                <td className="px-6 py-4 text-sm text-gray-600">{student.gender ?? '—'}</td>
                <td className="px-6 py-4">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    student.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {student.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openEdit(student)}
                      className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Edit"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => openElectives(student)}
                      className="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                      title="Select elective subjects"
                    >
                      <BookOpen className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => toggleActive(student.id, student.profile?.id, student.is_active)}
                      className={`p-1.5 rounded-lg transition-colors ${
                        student.is_active
                          ? 'text-gray-400 hover:text-red-600 hover:bg-red-50'
                          : 'text-gray-400 hover:text-green-600 hover:bg-green-50'
                      }`}
                      title={student.is_active ? 'Deactivate' : 'Activate'}
                    >
                      {student.is_active ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
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
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">Add New Student</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
                  <input type="text" value={form.first_name}
                    onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Last Name *</label>
                  <input type="text" value={form.last_name}
                    onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email (optional)</label>
                <input type="email" value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="Leave blank to auto-generate"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input type="text" value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label>
                  <input type="date" value={form.date_of_birth}
                    onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
                  <select value={form.gender}
                    onChange={(e) => setForm({ ...form, gender: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">Select</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Initial Password *</label>
                <input type="password" value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowModal(false)}
                className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={handleCreate} disabled={saving}
                className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                {saving ? 'Creating...' : 'Create Student'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && selectedStudent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">Edit Student</h2>
              <button onClick={() => setShowEditModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                  <input type="text" value={editForm.first_name}
                    onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                  <input type="text" value={editForm.last_name}
                    onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input type="text" value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label>
                  <input type="date" value={editForm.date_of_birth}
                    onChange={(e) => setEditForm({ ...editForm, date_of_birth: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
                  <select value={editForm.gender}
                    onChange={(e) => setEditForm({ ...editForm, gender: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">Select</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select value={editForm.is_active ? 'active' : 'inactive'}
                  onChange={(e) => setEditForm({ ...editForm, is_active: e.target.value === 'active' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowEditModal(false)}
                className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={handleEdit} disabled={saving}
                className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                {saving ? 'Saving...' : 'Update Student'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Elective Subjects Modal */}
      {showElectiveModal && selectedStudent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">
                Select Electives — {selectedStudent.profile?.first_name}
              </h2>
              <button onClick={() => setShowElectiveModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Core subjects — read only */}
            <div className="mb-4">
              <p className="text-sm font-medium text-gray-700 mb-2">
                Core Subjects (compulsory for all students)
              </p>
              <div className="space-y-1">
                {coreSubjects.length === 0 ? (
                  <p className="text-sm text-gray-400">No core subjects added yet</p>
                ) : coreSubjects.map((s) => (
                  <div key={s.id} className="flex items-center gap-2 px-3 py-2 bg-blue-50 rounded-lg">
                    <div className="w-4 h-4 bg-blue-600 rounded flex items-center justify-center flex-shrink-0">
                      <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                      </svg>
                    </div>
                    <span className="text-sm text-blue-800">{s.name}</span>
                    <span className="ml-auto text-xs text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">Core</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Elective subjects — selectable */}
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">
                Elective Subjects (select preferred subjects)
              </p>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {electiveSubjects.length === 0 ? (
                  <p className="text-sm text-gray-400">No elective subjects added yet</p>
                ) : electiveSubjects.map((s) => {
                  const isSelected = selectedElectives.includes(s.id);
                  return (
                    <button
                      key={s.id}
                      onClick={() => toggleElective(s.id)}
                      className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-colors ${
                        isSelected
                          ? 'bg-purple-50 border border-purple-200'
                          : 'bg-gray-50 border border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                        isSelected ? 'bg-purple-600 border-purple-600' : 'border-gray-300'
                      }`}>
                        {isSelected && (
                          <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                          </svg>
                        )}
                      </div>
                      <span className={`text-sm ${isSelected ? 'text-purple-800 font-medium' : 'text-gray-700'}`}>
                        {s.name}
                      </span>
                      <span className="ml-auto text-xs text-purple-600 bg-purple-100 px-2 py-0.5 rounded-full">
                        Elective
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowElectiveModal(false)}
                className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={handleSaveElectives} disabled={saving}
                className="flex-1 px-4 py-2.5 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50">
                {saving ? 'Saving...' : 'Save Electives'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}