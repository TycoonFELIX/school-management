import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import { Plus, Search, Edit, Trash2, X, Bell, Pin } from 'lucide-react';

interface Announcement {
  id: string;
  title: string;
  body: string;
  audience: string;
  is_pinned: boolean;
  published_at: string | null;
  expires_at: string | null;
  is_active: boolean;
  class_id: string | null;
  author: { first_name: string; last_name: string; role: string };
  class: { name: string; section: string | null } | null;
}

interface AnnouncementFormProps {
  form: any;
  setForm: (f: any) => void;
  classes: any[];
}

// Form defined OUTSIDE main component to prevent re-render bug
const AnnouncementForm = ({ form, setForm, classes }: AnnouncementFormProps) => (
  <div className="space-y-4">
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
      <input type="text" value={form.title}
        onChange={(e) => setForm({ ...form, title: e.target.value })}
        placeholder="Announcement title"
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
    </div>
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">Message *</label>
      <textarea value={form.body}
        onChange={(e) => setForm({ ...form, body: e.target.value })}
        rows={4} placeholder="Write your announcement here..."
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
    </div>
    <div className="grid grid-cols-2 gap-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Audience</label>
        <select value={form.audience}
          onChange={(e) => setForm({ ...form, audience: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="all">Everyone</option>
          <option value="teachers">Teachers only</option>
          <option value="students">Students only</option>
          <option value="parents">Parents only</option>
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Class (optional)</label>
        <select value={form.class_id}
          onChange={(e) => setForm({ ...form, class_id: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">All Classes</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>{c.name} {c.section ?? ''}</option>
          ))}
        </select>
      </div>
    </div>
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">Expires On (optional)</label>
      <input type="date" value={form.expires_at}
        onChange={(e) => setForm({ ...form, expires_at: e.target.value })}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
    </div>
    <label className="flex items-center gap-2 cursor-pointer">
      <input type="checkbox" checked={form.is_pinned}
        onChange={(e) => setForm({ ...form, is_pinned: e.target.checked })}
        className="rounded" />
      <span className="text-sm text-gray-700">Pin this announcement to the top</span>
    </label>
  </div>
);

export default function AnnouncementsPage() {
  const { schoolId, profile } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<Announcement | null>(null);
  const [form, setForm] = useState({
    title: '', body: '', audience: 'all',
    class_id: '', is_pinned: false, expires_at: '',
  });

  useEffect(() => {
    if (schoolId) { fetchAnnouncements(); fetchClasses(); }
  }, [schoolId]);

  const fetchAnnouncements = async () => {
    const { data, error } = await supabase
      .from('announcements')
      .select(`
        id, title, body, audience, is_pinned,
        published_at, expires_at, is_active, class_id,
        author:profiles(first_name, last_name, role),
        class:classes(name, section)
      `)
      .eq('school_id', schoolId)
      .eq('is_active', true)
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false });
    if (!error && data) setAnnouncements(data as any);
    setLoading(false);
  };

  const fetchClasses = async () => {
    const { data } = await supabase
      .from('classes').select('id, name, section')
      .eq('school_id', schoolId).eq('is_active', true).order('name');
    if (data) setClasses(data);
  };

  const handleCreate = async () => {
    if (!form.title || !form.body) { alert('Title and body are required.'); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from('announcements').insert({
        school_id: schoolId, author_id: profile?.id,
        title: form.title, body: form.body,
        audience: form.audience, class_id: form.class_id || null,
        is_pinned: form.is_pinned,
        published_at: new Date().toISOString(),
        expires_at: form.expires_at || null, is_active: true,
      });
      if (error) throw error;

      // Send notifications
      let roleFilter: string[] = [];
      if (form.audience === 'all') roleFilter = ['teacher', 'student', 'parent'];
      else if (form.audience === 'teachers') roleFilter = ['teacher'];
      else if (form.audience === 'students') roleFilter = ['student'];
      else if (form.audience === 'parents') roleFilter = ['parent'];

      const { data: users } = await supabase
        .from('profiles').select('id')
        .eq('school_id', schoolId).in('role', roleFilter).eq('is_active', true);

      if (users && users.length > 0) {
        const notifications = users.map((u) => ({
          school_id: schoolId, user_id: u.id,
          title: form.title, body: form.body, type: 'announcement',
        }));
        for (let i = 0; i < notifications.length; i += 100) {
          await supabase.from('notifications').insert(notifications.slice(i, i + 100));
        }
      }

      setShowModal(false);
      setForm({ title: '', body: '', audience: 'all', class_id: '', is_pinned: false, expires_at: '' });
      fetchAnnouncements();
      alert('Announcement published!');
    } catch (err: any) { alert('Error: ' + err.message); }
    finally { setSaving(false); }
  };

  const openEdit = (a: Announcement) => {
    setSelected(a);
    setForm({
      title: a.title, body: a.body, audience: a.audience,
      class_id: a.class_id ?? '', is_pinned: a.is_pinned,
      expires_at: a.expires_at?.split('T')[0] ?? '',
    });
    setShowEditModal(true);
  };

  const handleEdit = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await supabase.from('announcements').update({
        title: form.title, body: form.body, audience: form.audience,
        class_id: form.class_id || null, is_pinned: form.is_pinned,
        expires_at: form.expires_at || null,
      }).eq('id', selected.id);
      setShowEditModal(false);
      fetchAnnouncements();
    } catch (err: any) { alert('Error: ' + err.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this announcement?')) return;
    await supabase.from('announcements').update({ is_active: false }).eq('id', id);
    fetchAnnouncements();
  };

  const togglePin = async (id: string, currentPin: boolean) => {
    await supabase.from('announcements').update({ is_pinned: !currentPin }).eq('id', id);
    fetchAnnouncements();
  };

  const filtered = announcements.filter((a) =>
    `${a.title} ${a.body}`.toLowerCase().includes(search.toLowerCase())
  );

  const audienceColors: Record<string, string> = {
    all: 'bg-blue-100 text-blue-700',
    teachers: 'bg-green-100 text-green-700',
    students: 'bg-purple-100 text-purple-700',
    parents: 'bg-orange-100 text-orange-700',
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Announcements</h1>
          <p className="text-gray-500 mt-1">{announcements.length} announcements</p>
        </div>
        <button onClick={() => { setForm({ title: '', body: '', audience: 'all', class_id: '', is_pinned: false, expires_at: '' }); setShowModal(true); }}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors">
          <Plus className="w-4 h-4" /> New Announcement
        </button>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input type="text" placeholder="Search announcements..."
          value={search} onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-400">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <Bell className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-gray-500">No announcements yet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((a) => (
            <div key={a.id} className={`bg-white rounded-xl shadow-sm border p-5 ${a.is_pinned ? 'border-blue-300 bg-blue-50' : 'border-gray-200'}`}>
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2 flex-1">
                  {a.is_pinned && <Pin className="w-4 h-4 text-blue-600 flex-shrink-0" />}
                  <h3 className="text-base font-semibold text-gray-900">{a.title}</h3>
                </div>
                <span className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${audienceColors[a.audience] ?? 'bg-gray-100 text-gray-700'}`}>
                  {a.audience === 'all' ? 'Everyone' : a.audience}
                </span>
              </div>
              <p className="text-sm text-gray-600 mb-3 line-clamp-3">{a.body}</p>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 text-xs text-gray-400">
                  <span>By {a.author?.first_name} {a.author?.last_name}</span>
                  {a.published_at && <span>{new Date(a.published_at).toLocaleDateString()}</span>}
                  {a.class && <span>• {a.class.name} {a.class.section ?? ''}</span>}
                  {a.expires_at && <span className="text-orange-500">Expires: {new Date(a.expires_at).toLocaleDateString()}</span>}
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => togglePin(a.id, a.is_pinned)}
                    className={`p-1.5 rounded-lg transition-colors ${a.is_pinned ? 'text-blue-600 bg-blue-100' : 'text-gray-400 hover:text-blue-600 hover:bg-blue-50'}`}>
                    <Pin className="w-4 h-4" />
                  </button>
                  <button onClick={() => openEdit(a)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg">
                    <Edit className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(a.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
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
              <h2 className="text-lg font-bold text-gray-900">New Announcement</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <AnnouncementForm form={form} setForm={setForm} classes={classes} />
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowModal(false)} className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
              <button onClick={handleCreate} disabled={saving} className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                {saving ? 'Publishing...' : 'Publish'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && selected && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">Edit Announcement</h2>
              <button onClick={() => setShowEditModal(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <AnnouncementForm form={form} setForm={setForm} classes={classes} />
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowEditModal(false)} className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
              <button onClick={handleEdit} disabled={saving} className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                {saving ? 'Saving...' : 'Update'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}