import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import { Plus, Search, Edit, Trash2, X, FileText, Clock, Upload, Download } from 'lucide-react';

interface Assignment {
  id: string;
  title: string;
  description: string | null;
  instructions: string | null;
  due_date: string;
  weight: number;
  max_score: number;
  is_published: boolean;
  allow_late: boolean;
  class_subject: {
    class: { name: string; section: string | null };
    subject: { name: string };
  };
  term: { name: string };
  assignment_files: { id: string; file_name: string; file_url: string; mime_type: string }[];
}

export default function AssignmentsPage() {
  const { schoolId } = useAuth();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [classSubjects, setClassSubjects] = useState<any[]>([]);
  const [terms, setTerms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<{ name: string; url: string; size: number; type: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    title: '',
    description: '',
    instructions: '',
    class_subject_id: '',
    term_id: '',
    due_date: '',
    weight: '100',
    max_score: '100',
    allow_late: false,
    late_penalty: '0',
    is_published: false,
  });

  useEffect(() => {
    if (schoolId) {
      fetchAssignments();
      fetchClassSubjects();
      fetchTerms();
    }
  }, [schoolId]);

  const fetchAssignments = async () => {
    const { data, error } = await supabase
      .from('assignments')
      .select(`
        id, title, description, instructions, due_date, weight,
        max_score, is_published, allow_late,
        class_subject:class_subjects(
          class:classes(name, section),
          subject:subjects(name)
        ),
        term:terms(name),
        assignment_files(id, file_name, file_url, mime_type)
      `)
      .eq('school_id', schoolId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (!error && data) setAssignments(data as any);
    setLoading(false);
  };

  const fetchClassSubjects = async () => {
    const { data } = await supabase
      .from('class_subjects')
      .select(`
        id,
        class:classes(name, section),
        subject:subjects(name)
      `)
      .eq('school_id', schoolId);
    if (data) setClassSubjects(data as any);
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

  const handleFileUpload = async (files: FileList) => {
    if (!files.length) return;
    setUploading(true);
    const newFiles: { name: string; url: string; size: number; type: string }[] = [];

    for (const file of Array.from(files)) {
      const filePath = `schools/${schoolId}/assignments/${Date.now()}_${file.name}`;
      const { error } = await supabase.storage
        .from('assignments')
        .upload(filePath, file, { upsert: true });

      if (!error) {
        const { data: urlData } = supabase.storage
          .from('assignments')
          .getPublicUrl(filePath);
        newFiles.push({
          name: file.name,
          url: urlData.publicUrl,
          size: file.size,
          type: file.type,
        });
      }
    }

    setUploadedFiles((prev) => [...prev, ...newFiles]);
    setUploading(false);
  };

  const removeFile = (index: number) => {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleCreate = async () => {
    if (!form.title || !form.class_subject_id || !form.term_id || !form.due_date) {
      alert('Title, class/subject, term and due date are required.');
      return;
    }
    setSaving(true);
    try {
      const { data: assignment, error } = await supabase
        .from('assignments')
        .insert({
          school_id: schoolId,
          class_subject_id: form.class_subject_id,
          teacher_id: null,
          term_id: form.term_id,
          title: form.title,
          description: form.description || null,
          instructions: form.instructions || null,
          due_date: form.due_date,
          weight: parseFloat(form.weight) || 100,
          max_score: parseFloat(form.max_score) || 100,
          allow_late: form.allow_late,
          late_penalty: parseFloat(form.late_penalty) || 0,
          is_published: form.is_published,
          published_at: form.is_published ? new Date().toISOString() : null,
        })
        .select()
        .single();

      if (error) throw error;

      // Save uploaded files
      if (uploadedFiles.length > 0) {
        await supabase.from('assignment_files').insert(
          uploadedFiles.map((f) => ({
            school_id: schoolId,
            assignment_id: assignment.id,
            file_name: f.name,
            file_url: f.url,
            file_size: f.size,
            mime_type: f.type,
          }))
        );
      }

      setShowModal(false);
      setUploadedFiles([]);
      resetForm();
      fetchAssignments();
      alert('Assignment created successfully!');
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (assignment: Assignment) => {
    setSelectedAssignment(assignment);
    setForm({
      title: assignment.title,
      description: assignment.description ?? '',
      instructions: assignment.instructions ?? '',
      class_subject_id: '',
      term_id: '',
      due_date: assignment.due_date?.split('T')[0] ?? '',
      weight: assignment.weight.toString(),
      max_score: assignment.max_score.toString(),
      allow_late: assignment.allow_late,
      late_penalty: '0',
      is_published: assignment.is_published,
    });
    setUploadedFiles([]);
    setShowEditModal(true);
  };

  const handleEdit = async () => {
    if (!selectedAssignment) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('assignments').update({
        title: form.title,
        description: form.description || null,
        instructions: form.instructions || null,
        due_date: form.due_date,
        weight: parseFloat(form.weight) || 100,
        max_score: parseFloat(form.max_score) || 100,
        allow_late: form.allow_late,
        is_published: form.is_published,
        published_at: form.is_published ? new Date().toISOString() : null,
      }).eq('id', selectedAssignment.id);

      if (error) throw error;

      // Save any new uploaded files
      if (uploadedFiles.length > 0) {
        await supabase.from('assignment_files').insert(
          uploadedFiles.map((f) => ({
            school_id: schoolId,
            assignment_id: selectedAssignment.id,
            file_name: f.name,
            file_url: f.url,
            file_size: f.size,
            mime_type: f.type,
          }))
        );
      }

      setShowEditModal(false);
      setUploadedFiles([]);
      fetchAssignments();
      alert('Assignment updated successfully!');
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this assignment?')) return;
    await supabase.from('assignments').update({ is_active: false }).eq('id', id);
    fetchAssignments();
  };

  const togglePublish = async (id: string, currentStatus: boolean) => {
    await supabase.from('assignments').update({
      is_published: !currentStatus,
      published_at: !currentStatus ? new Date().toISOString() : null,
    }).eq('id', id);
    fetchAssignments();
  };

  const deleteFile = async (fileId: string, assignmentId: string) => {
    await supabase.from('assignment_files').delete().eq('id', fileId);
    fetchAssignments();
  };

  const resetForm = () => {
    const current = terms.find((t) => t.is_current);
    setForm({
      title: '', description: '', instructions: '',
      class_subject_id: '', term_id: current?.id ?? '',
      due_date: '', weight: '100', max_score: '100',
      allow_late: false, late_penalty: '0', is_published: false,
    });
  };

  const filtered = assignments.filter((a) =>
    `${a.title} ${a.class_subject?.subject?.name} ${a.class_subject?.class?.name}`
      .toLowerCase().includes(search.toLowerCase())
  );

  const isOverdue = (dueDate: string) => new Date(dueDate) < new Date();

  const FileUploadSection = () => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Attach Files (PDF, Images, Word docs)
      </label>
      <div
        onClick={() => fileInputRef.current?.click()}
        className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
      >
        <Upload className="w-6 h-6 text-gray-400 mx-auto mb-1" />
        <p className="text-sm text-gray-500">Click to upload or drag and drop</p>
        <p className="text-xs text-gray-400 mt-1">PDF, JPG, PNG, DOCX up to 50MB</p>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
        className="hidden"
        onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
      />
      {uploading && (
        <p className="text-sm text-blue-600 mt-2">Uploading files...</p>
      )}
      {uploadedFiles.length > 0 && (
        <div className="mt-2 space-y-1">
          {uploadedFiles.map((f, i) => (
            <div key={i} className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg">
              <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <span className="text-sm text-gray-700 flex-1 truncate">{f.name}</span>
              <button onClick={() => removeFile(i)} className="text-red-400 hover:text-red-600">
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const FormFields = () => (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
        <input type="text" value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          placeholder="e.g. Mid-Term Mathematics Test"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>
      {!selectedAssignment && (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Class & Subject *</label>
            <select value={form.class_subject_id}
              onChange={(e) => setForm({ ...form, class_subject_id: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Select Class & Subject</option>
              {classSubjects.map((cs) => (
                <option key={cs.id} value={cs.id}>
                  {cs.class?.name} {cs.class?.section ?? ''} — {cs.subject?.name}
                </option>
              ))}
            </select>
            {classSubjects.length === 0 && (
              <p className="text-xs text-red-500 mt-1">No class subjects found. Assign teachers to subjects first.</p>
            )}
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
        </>
      )}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
        <textarea value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          rows={2} placeholder="Brief description of the assignment"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Instructions</label>
        <textarea value={form.instructions}
          onChange={(e) => setForm({ ...form, instructions: e.target.value })}
          rows={3} placeholder="Detailed instructions for students"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Due Date *</label>
        <input type="datetime-local" value={form.due_date}
          onChange={(e) => setForm({ ...form, due_date: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Weight (%)</label>
          <input type="number" value={form.weight}
            onChange={(e) => setForm({ ...form, weight: e.target.value })}
            min="0" max="100"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Max Score</label>
          <input type="number" value={form.max_score}
            onChange={(e) => setForm({ ...form, max_score: e.target.value })}
            min="1"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      </div>
      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={form.allow_late}
            onChange={(e) => setForm({ ...form, allow_late: e.target.checked })}
            className="rounded" />
          <span className="text-sm text-gray-700">Allow late submissions</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={form.is_published}
            onChange={(e) => setForm({ ...form, is_published: e.target.checked })}
            className="rounded" />
          <span className="text-sm text-gray-700">Publish immediately</span>
        </label>
      </div>
      <FileUploadSection />
    </div>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Assignments</h1>
          <p className="text-gray-500 mt-1">{assignments.length} assignments created</p>
        </div>
        <button
          onClick={() => { resetForm(); setUploadedFiles([]); setShowModal(true); }}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Create Assignment
        </button>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input type="text" placeholder="Search assignments..."
          value={search} onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-400">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <FileText className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-gray-500">No assignments found. Create one to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((assignment) => (
            <div key={assignment.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h3 className="text-base font-semibold text-gray-900">{assignment.title}</h3>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {assignment.class_subject?.class?.name} {assignment.class_subject?.class?.section ?? ''} —{' '}
                    {assignment.class_subject?.subject?.name}
                  </p>
                </div>
                <span className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  assignment.is_published ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                }`}>
                  {assignment.is_published ? 'Published' : 'Draft'}
                </span>
              </div>

              {assignment.description && (
                <p className="text-sm text-gray-600 mb-3 line-clamp-2">{assignment.description}</p>
              )}

              <div className="flex items-center gap-4 text-xs text-gray-500 mb-3">
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  Due: {new Date(assignment.due_date).toLocaleDateString()}
                  {isOverdue(assignment.due_date) && (
                    <span className="text-red-500 ml-1">• Overdue</span>
                  )}
                </span>
                <span>Weight: {assignment.weight}%</span>
                <span>Max: {assignment.max_score} pts</span>
              </div>

              {/* Attached files */}
              {assignment.assignment_files?.length > 0 && (
                <div className="mb-3 space-y-1">
                  {assignment.assignment_files.map((file) => (
                    <div key={file.id} className="flex items-center gap-2 px-2 py-1.5 bg-gray-50 rounded-lg">
                      <FileText className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                      <span className="text-xs text-gray-600 flex-1 truncate">{file.file_name}</span>
                      <a href={file.file_url} target="_blank" rel="noopener noreferrer"
                        className="text-blue-500 hover:text-blue-700">
                        <Download className="w-3.5 h-3.5" />
                      </a>
                      <button
                        onClick={() => deleteFile(file.id, assignment.id)}
                        className="text-red-400 hover:text-red-600">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-2">
                <button
                  onClick={() => togglePublish(assignment.id, assignment.is_published)}
                  className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    assignment.is_published
                      ? 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100'
                      : 'bg-green-50 text-green-700 hover:bg-green-100'
                  }`}
                >
                  {assignment.is_published ? 'Unpublish' : 'Publish'}
                </button>
                <button onClick={() => openEdit(assignment)}
                  className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                  <Edit className="w-4 h-4" />
                </button>
                <button onClick={() => handleDelete(assignment.id)}
                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">Create Assignment</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <FormFields />
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowModal(false)}
                className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={handleCreate} disabled={saving || uploading}
                className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                {saving ? 'Creating...' : 'Create Assignment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && selectedAssignment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">Edit Assignment</h2>
              <button onClick={() => setShowEditModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <FormFields />
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowEditModal(false)}
                className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={handleEdit} disabled={saving || uploading}
                className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                {saving ? 'Saving...' : 'Update Assignment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}