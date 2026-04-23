import { useEffect, useState } from 'react';
import { supabase, callEdgeFunction } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import { Plus, Search, Edit, UserX, UserCheck, X } from 'lucide-react';

interface Teacher {
  id: string;
  teacher_uid: string;
  department: string | null;
  qualification: string | null;
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
interface Class { id: string; name: string; section: string | null; }

export default function TeachersPage() {
  const { schoolId } = useAuth();
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null);
  const [form, setForm] = useState({
    first_name: '', last_name: '', email: '',
    phone: '', department: '', qualification: '', password: '',
  });
  const [editForm, setEditForm] = useState({
    first_name: '', last_name: '', phone: '',
    department: '', qualification: '', is_active: true,
  });
  const [assignForm, setAssignForm] = useState({
    class_id: '', subject_id: '', term_id: '',
  });
  const [terms, setTerms] = useState<any[]>([]);

  useEffect(() => {
    if (schoolId) {
      fetchTeachers();
      fetchSubjects();
      fetchClasses();
      fetchTerms();
    }
  }, [schoolId]);

  const fetchTeachers = async () => {
    const { data, error } = await supabase
      .from('teachers')
      .select(`
        id, teacher_uid, department, qualification, is_active,
        profile:profiles(id, first_name, last_name, email, phone)
      `)
      .eq('school_id', schoolId)
      .order('created_at', { ascending: false });
    if (!error && data) setTeachers(data as any);
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
    if (data) {
      setTerms(data);
      const current = data.find((t) => t.is_current);
      if (current) setAssignForm((f) => ({ ...f, term_id: current.id }));
    }
  };

  const handleCreate = async () => {
    if (!form.first_name || !form.last_name || !form.email || !form.password) {
      alert('First name, last name, email and password are required.');
      return;
    }
    setSaving(true);
    try {
      const result = await callEdgeFunction('create-school-user', {
        email: form.email,
        password: form.password,
        role: 'teacher',
        school_id: schoolId,
        first_name: form.first_name,
        last_name: form.last_name,
        phone: form.phone,
        metadata: {
          department: form.department || null,
          qualification: form.qualification || null,
        },
      });
      setShowModal(false);
      setForm({ first_name: '', last_name: '', email: '', phone: '', department: '', qualification: '', password: '' });
      fetchTeachers();
      alert(`Teacher created! ID: ${result.school_uid}`);
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (teacher: Teacher) => {
    setSelectedTeacher(teacher);
    setEditForm({
      first_name: teacher.profile?.first_name ?? '',
      last_name: teacher.profile?.last_name ?? '',
      phone: teacher.profile?.phone ?? '',
      department: teacher.department ?? '',
      qualification: teacher.qualification ?? '',
      is_active: teacher.is_active,
    });
    setShowEditModal(true);
  };

  const handleEdit = async () => {
    if (!selectedTeacher) return;
    setSaving(true);
    try {
      await supabase.from('profiles').update({
        first_name: editForm.first_name,
        last_name: editForm.last_name,
        phone: editForm.phone || null,
      }).eq('id', selectedTeacher.profile?.id);

      await supabase.from('teachers').update({
        department: editForm.department || null,
        qualification: editForm.qualification || null,
        is_active: editForm.is_active,
      }).eq('id', selectedTeacher.id);

      setShowEditModal(false);
      fetchTeachers();
      alert('Teacher updated successfully!');
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const openAssign = (teacher: Teacher) => {
    setSelectedTeacher(teacher);
    setAssignForm((f) => ({ ...f, class_id: '', subject_id: '' }));
    setShowAssignModal(true);
  };

  const handleAssign = async () => {
    if (!assignForm.class_id || !assignForm.subject_id || !assignForm.term_id) {
      alert('Please select class, subject and term.');
      return;
    }
    setSaving(true);
    try {
      // Assign teacher to class subject
      const { error } = await supabase.from('class_subjects').upsert({
        school_id: schoolId,
        class_id: assignForm.class_id,
        subject_id: assignForm.subject_id,
        teacher_id: selectedTeacher?.id,
        term_id: assignForm.term_id,
      }, { onConflict: 'class_id,subject_id,term_id' });

      if (error) throw error;

      // Set as class teacher if requested
      setShowAssignModal(false);
      fetchTeachers();
      alert('Teacher assigned successfully!');
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (id: string, profileId: string, currentStatus: boolean) => {
    await supabase.from('teachers').update({ is_active: !currentStatus }).eq('id', id);
    await supabase.from('profiles').update({ is_active: !currentStatus }).eq('id', profileId);
    fetchTeachers();
  };

  const filtered = teachers.filter(t =>
    `${t.profile?.first_name} ${t.profile?.last_name} ${t.teacher_uid}`
      .toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Teachers</h1>
          <p className="text-gray-500 mt-1">{teachers.length} teachers registered</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Teacher
        </button>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search teachers..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
        />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Teacher</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">ID</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Department</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={5} className="text-center py-8 text-gray-400">Loading...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-8 text-gray-400">No teachers found</td></tr>
            ) : filtered.map((teacher) => (
              <tr key={teacher.id} className="hover:bg-gray-50">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                      <span className="text-blue-700 text-sm font-medium">
                        {teacher.profile?.first_name?.[0]}{teacher.profile?.last_name?.[0]}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {teacher.profile?.first_name} {teacher.profile?.last_name}
                      </p>
                      <p className="text-xs text-gray-500">{teacher.profile?.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-gray-600 font-mono">{teacher.teacher_uid}</td>
                <td className="px-6 py-4 text-sm text-gray-600">{teacher.department ?? '—'}</td>
                <td className="px-6 py-4">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    teacher.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {teacher.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openEdit(teacher)}
                      className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Edit"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => openAssign(teacher)}
                      className="px-2 py-1 text-xs text-purple-600 hover:bg-purple-50 rounded-lg transition-colors font-medium"
                      title="Assign to class/subject"
                    >
                      Assign
                    </button>
                    <button
                      onClick={() => toggleActive(teacher.id, teacher.profile?.id, teacher.is_active)}
                      className={`p-1.5 rounded-lg transition-colors ${
                        teacher.is_active
                          ? 'text-gray-400 hover:text-red-600 hover:bg-red-50'
                          : 'text-gray-400 hover:text-green-600 hover:bg-green-50'
                      }`}
                      title={teacher.is_active ? 'Deactivate' : 'Activate'}
                    >
                      {teacher.is_active ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
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
              <h2 className="text-lg font-bold text-gray-900">Add New Teacher</h2>
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                <input type="email" value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input type="text" value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                <input type="text" value={form.department}
                  onChange={(e) => setForm({ ...form, department: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Qualification</label>
                <input type="text" value={form.qualification}
                  onChange={(e) => setForm({ ...form, qualification: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
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
                {saving ? 'Creating...' : 'Create Teacher'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && selectedTeacher && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">Edit Teacher</h2>
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
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                <input type="text" value={editForm.department}
                  onChange={(e) => setEditForm({ ...editForm, department: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Qualification</label>
                <input type="text" value={editForm.qualification}
                  onChange={(e) => setEditForm({ ...editForm, qualification: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
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
                {saving ? 'Saving...' : 'Update Teacher'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assign Modal */}
      {showAssignModal && selectedTeacher && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">
                Assign {selectedTeacher.profile?.first_name} {selectedTeacher.profile?.last_name}
              </h2>
              <button onClick={() => setShowAssignModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Term *</label>
                <select value={assignForm.term_id}
                  onChange={(e) => setAssignForm({ ...assignForm, term_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Select Term</option>
                  {terms.map((t) => (
                    <option key={t.id} value={t.id}>{t.name} {t.is_current ? '(Current)' : ''}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Class *</label>
                <select value={assignForm.class_id}
                  onChange={(e) => setAssignForm({ ...assignForm, class_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Select Class</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>{c.name} {c.section ? `- ${c.section}` : ''}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Subject *</label>
                <select value={assignForm.subject_id}
                  onChange={(e) => setAssignForm({ ...assignForm, subject_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Select Subject</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>{s.name} ({s.category})</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowAssignModal(false)}
                className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={handleAssign} disabled={saving}
                className="flex-1 px-4 py-2.5 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50">
                {saving ? 'Assigning...' : 'Assign Teacher'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}