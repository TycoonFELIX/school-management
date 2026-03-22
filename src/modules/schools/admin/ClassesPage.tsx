import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import { Plus, Search, Edit, Trash2 } from 'lucide-react';

interface Class {
  id: string;
  name: string;
  level: string | null;
  section: string | null;
  max_students: number;
  is_active: boolean;
  academic_year_id: string;
  class_teacher_id: string | null;
  class_teacher: {
    teacher_uid: string;
    profile: { first_name: string; last_name: string };
  } | null;
}

export default function ClassesPage() {
  const { schoolId } = useAuth();
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [academicYears, setAcademicYears] = useState<any[]>([]);
  const [form, setForm] = useState({
    name: '', level: '', section: '',
    max_students: '40', class_teacher_id: '', academic_year_id: '',
  });

  useEffect(() => {
    if (schoolId) {
      fetchClasses();
      fetchTeachers();
      fetchAcademicYears();
    }
  }, [schoolId]);

  const fetchClasses = async () => {
    const { data, error } = await supabase
      .from('classes')
      .select(`
        id, name, level, section, max_students, is_active,
        academic_year_id, class_teacher_id,
        class_teacher:teachers(
          teacher_uid,
          profile:profiles(first_name, last_name)
        )
      `)
      .eq('school_id', schoolId)
      .order('name');
    if (!error && data) setClasses(data as any);
    setLoading(false);
  };

  const fetchTeachers = async () => {
    const { data } = await supabase
      .from('teachers')
      .select('id, teacher_uid, profile:profiles(first_name, last_name)')
      .eq('school_id', schoolId)
      .eq('is_active', true);
    if (data) setTeachers(data as any);
  };

  const fetchAcademicYears = async () => {
    const { data } = await supabase
      .from('academic_years')
      .select('id, name')
      .eq('school_id', schoolId);
    if (data) setAcademicYears(data);
  };

  const openCreate = () => {
    setEditingId(null);
    setForm({ name: '', level: '', section: '', max_students: '40', class_teacher_id: '', academic_year_id: academicYears[0]?.id ?? '' });
    setShowModal(true);
  };

  const openEdit = (cls: Class) => {
    setEditingId(cls.id);
    setForm({
      name: cls.name,
      level: cls.level ?? '',
      section: cls.section ?? '',
      max_students: cls.max_students.toString(),
      class_teacher_id: cls.class_teacher_id ?? '',
      academic_year_id: cls.academic_year_id,
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.academic_year_id) {
      alert('Class name and academic year are required.');
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await supabase.from('classes').update({
          name: form.name,
          level: form.level || null,
          section: form.section || null,
          max_students: parseInt(form.max_students) || 40,
          class_teacher_id: form.class_teacher_id || null,
          academic_year_id: form.academic_year_id,
        }).eq('id', editingId);
      } else {
        await supabase.from('classes').insert({
          school_id: schoolId,
          academic_year_id: form.academic_year_id,
          name: form.name,
          level: form.level || null,
          section: form.section || null,
          max_students: parseInt(form.max_students) || 40,
          class_teacher_id: form.class_teacher_id || null,
        });
      }
      setShowModal(false);
      setEditingId(null);
      setForm({ name: '', level: '', section: '', max_students: '40', class_teacher_id: '', academic_year_id: '' });
      fetchClasses();
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (id: string, currentStatus: boolean) => {
    await supabase.from('classes').update({ is_active: !currentStatus }).eq('id', id);
    fetchClasses();
  };

  const filtered = classes.filter(c =>
    `${c.name} ${c.level} ${c.section}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Classes</h1>
          <p className="text-gray-500 mt-1">{classes.length} classes registered</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Class
        </button>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search classes..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
        />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Class Name</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Level</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Class Teacher</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Capacity</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={6} className="text-center py-8 text-gray-400">Loading...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-8 text-gray-400">No classes found</td></tr>
            ) : filtered.map((cls) => (
              <tr key={cls.id} className="hover:bg-gray-50">
                <td className="px-6 py-4">
                  <p className="text-sm font-medium text-gray-900">{cls.name}</p>
                  {cls.section && <p className="text-xs text-gray-500">Section {cls.section}</p>}
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">{cls.level ?? '—'}</td>
                <td className="px-6 py-4 text-sm text-gray-600">
                  {cls.class_teacher
                    ? `${(cls.class_teacher as any).profile?.first_name} ${(cls.class_teacher as any).profile?.last_name}`
                    : '—'}
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">{cls.max_students} students</td>
                <td className="px-6 py-4">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    cls.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {cls.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openEdit(cls)}
                      className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => toggleActive(cls.id, cls.is_active)}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">
              {editingId ? 'Edit Class' : 'Add New Class'}
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Academic Year *</label>
                <select
                  value={form.academic_year_id}
                  onChange={(e) => setForm({ ...form, academic_year_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Academic Year</option>
                  {academicYears.map((ay) => (
                    <option key={ay.id} value={ay.id}>{ay.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Class Name *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Grade 6, JSS 2"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Level</label>
                  <input
                    type="text"
                    value={form.level}
                    onChange={(e) => setForm({ ...form, level: e.target.value })}
                    placeholder="e.g. Grade 6"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Section</label>
                  <input
                    type="text"
                    value={form.section}
                    onChange={(e) => setForm({ ...form, section: e.target.value })}
                    placeholder="e.g. A, B, C"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Max Students</label>
                <input
                  type="number"
                  value={form.max_students}
                  onChange={(e) => setForm({ ...form, max_students: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Class Teacher</label>
                <select
                  value={form.class_teacher_id}
                  onChange={(e) => setForm({ ...form, class_teacher_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Teacher</option>
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.profile?.first_name} {t.profile?.last_name} ({t.teacher_uid})
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
                onClick={handleSave}
                disabled={saving}
                className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Saving...' : editingId ? 'Update Class' : 'Create Class'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}