import { useEffect, useState } from 'react';
import { supabase, callEdgeFunction } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  LayoutDashboard, School, Users, LogOut, Menu, X,
  Bell, Shield, TrendingUp, CheckCircle, XCircle, Plus, Search, Eye, EyeOff
} from 'lucide-react';
import toast from 'react-hot-toast';

const navigation = [
  { name: 'Dashboard',     icon: LayoutDashboard, page: 'dashboard' },
  { name: 'Schools',       icon: School,          page: 'schools' },
  { name: 'Create School', icon: Plus,            page: 'create-school' },
];

export default function SuperAdminDashboard() {
  const { profile, signOut } = useAuth();
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [schoolStats, setSchoolStats] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [selectedSchool, setSelectedSchool] = useState<any>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [adminForm, setAdminForm] = useState({ first_name: '', last_name: '', email: '', password: '' });
  const [schoolForm, setSchoolForm] = useState({
    name: '', slug: '', email: '', phone: '', address: '',
    id_prefix: '', plan_id: '',
    admin_first_name: '', admin_last_name: '', admin_email: '', admin_password: '',
  });

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [statsRes, plansRes] = await Promise.all([
        supabase.from('school_stats').select('*').order('school_name'),
        supabase.from('plans').select('*').eq('is_active', true).order('price_monthly'),
      ]);
      if (statsRes.data) setSchoolStats(statsRes.data);
      if (plansRes.data) setPlans(plansRes.data);
    } catch {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const totalStats = {
    schools: schoolStats.length,
    students: schoolStats.reduce((s, r) => s + (r.student_count ?? 0), 0),
    teachers: schoolStats.reduce((s, r) => s + (r.teacher_count ?? 0), 0),
    active: schoolStats.filter((r) => r.is_active).length,
  };

  const toggleSchoolActive = async (schoolId: string, current: boolean) => {
    const { error } = await supabase.from('schools').update({ is_active: !current }).eq('id', schoolId);
    if (error) { toast.error('Failed to update'); return; }
    toast.success(current ? 'School suspended — all members deactivated' : 'School reactivated — all members restored');
    fetchData();
  };

  const handleCreateAdmin = async () => {
    if (!selectedSchool || !adminForm.first_name || !adminForm.last_name || !adminForm.email || !adminForm.password) {
      toast.error('All fields are required'); return;
    }
    setSaving(true);
    try {
      const result = await callEdgeFunction('create-school-user', {
        email: adminForm.email, password: adminForm.password,
        role: 'school_admin', school_id: selectedSchool.school_id,
        first_name: adminForm.first_name, last_name: adminForm.last_name,
        phone: null, metadata: {},
      });
      if (!result.success) throw new Error(result.error);
      await supabase.from('admins').insert({
        profile_id: result.user_id, school_id: selectedSchool.school_id, title: 'Admin',
      });
      toast.success('Admin created!');
      setShowAdminModal(false);
      setAdminForm({ first_name: '', last_name: '', email: '', password: '' });
      fetchData();
    } catch (err: any) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const handleCreateSchool = async () => {
    const { name, slug, email, id_prefix, plan_id, admin_first_name, admin_last_name, admin_email, admin_password } = schoolForm;
    if (!name || !slug || !email || !id_prefix || !admin_email || !admin_password || !admin_first_name || !admin_last_name) {
      toast.error('All fields required'); return;
    }
    setSaving(true);
    try {
      const { data: school, error: se } = await supabase.from('schools').insert({
        name, slug: slug.toLowerCase(), email,
        phone: schoolForm.phone || null, address: schoolForm.address || null,
        id_prefix: id_prefix.toUpperCase(), country: 'GH', timezone: 'Africa/Accra',
      }).select().single();
      if (se) throw se;

      const selectedPlan = plans.find((p) => p.id === plan_id) ?? plans[0];
      if (selectedPlan) {
        await supabase.from('subscriptions').insert({
          school_id: school.id, plan_id: selectedPlan.id, status: 'trialing',
          trial_ends_at: new Date(Date.now() + 14 * 86400000).toISOString(),
          current_period_end: new Date(Date.now() + 14 * 86400000).toISOString(),
        });
      }
      await supabase.from('branding_assets').insert({
        school_id: school.id, primary_color: '#1a56db', secondary_color: '#e1effe',
      });

      const result = await callEdgeFunction('create-school-user', {
        email: admin_email, password: admin_password, role: 'school_admin',
        school_id: school.id, first_name: admin_first_name, last_name: admin_last_name,
        phone: null, metadata: {},
      });
      if (!result.success) throw new Error(result.error);
      await supabase.from('admins').insert({ profile_id: result.user_id, school_id: school.id, title: 'Principal' });

      toast.success(`School "${name}" created!`);
      setSchoolForm({ name: '', slug: '', email: '', phone: '', address: '', id_prefix: '', plan_id: '', admin_first_name: '', admin_last_name: '', admin_email: '', admin_password: '' });
      setCurrentPage('schools');
      fetchData();
    } catch (err: any) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const filtered = schoolStats.filter((s) =>
    `${s.school_name} ${s.school_email} ${s.admin_name} ${s.admin_email}`.toLowerCase().includes(search.toLowerCase())
  );

  const renderDashboard = () => (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Super Admin Dashboard</h1>
        <p className="text-gray-500 mt-1">Complete platform overview</p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total Schools', value: totalStats.schools, icon: School, color: 'bg-blue-500' },
          { label: 'Active Schools', value: totalStats.active, icon: CheckCircle, color: 'bg-green-500' },
          { label: 'Total Students', value: totalStats.students, icon: Users, color: 'bg-purple-500' },
          { label: 'Total Teachers', value: totalStats.teachers, icon: TrendingUp, color: 'bg-orange-500' },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-gray-500">{s.label}</p>
                <div className={`${s.color} w-8 h-8 rounded-lg flex items-center justify-center`}>
                  <Icon className="w-4 h-4 text-white" />
                </div>
              </div>
              <p className="text-2xl font-bold text-gray-900">{loading ? '...' : s.value}</p>
            </div>
          );
        })}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Schools Overview</h2>
          <button onClick={() => setCurrentPage('create-school')}
            className="flex items-center gap-2 bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-blue-700">
            <Plus className="w-4 h-4" /> New School
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">School</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Admin</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Students</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Teachers</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {schoolStats.slice(0, 5).map((s) => (
                <tr key={s.school_id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <p className="text-sm font-medium text-gray-900">{s.school_name}</p>
                    <p className="text-xs text-gray-500">{s.school_email}</p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm text-gray-900">{s.admin_name ?? '—'}</p>
                    <p className="text-xs text-gray-500">{s.admin_email ?? '—'}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-2.5 py-0.5 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
                      {s.student_count} students
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-2.5 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                      {s.teacher_count} teachers
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      s.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {s.is_active ? 'Active' : 'Suspended'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <button onClick={() => { setSelectedSchool(s); setShowAdminModal(true); }}
                        className="px-2 py-1 text-xs bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 font-medium">
                        Add Admin
                      </button>
                      <button onClick={() => toggleSchoolActive(s.school_id, s.is_active)}
                        className={`p-1.5 rounded-lg ${s.is_active ? 'text-red-400 hover:bg-red-50' : 'text-green-400 hover:bg-green-50'}`}>
                        {s.is_active ? <XCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderSchools = () => (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">All Schools ({schoolStats.length})</h1>
        <button onClick={() => setCurrentPage('create-school')}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700">
          <Plus className="w-4 h-4" /> Create School
        </button>
      </div>
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input type="text" placeholder="Search schools, admins..." value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">School</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Admin</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Students</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Teachers</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Subscription</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map((s) => (
              <tr key={s.school_id} className="hover:bg-gray-50">
                <td className="px-6 py-4">
                  <p className="text-sm font-medium text-gray-900">{s.school_name}</p>
                  <p className="text-xs text-gray-500">{s.school_email} • {s.id_prefix}</p>
                </td>
                <td className="px-6 py-4">
                  <p className="text-sm text-gray-900">{s.admin_name ?? <span className="text-gray-400 italic">No admin</span>}</p>
                  <p className="text-xs text-gray-500">{s.admin_email ?? ''}</p>
                </td>
                <td className="px-6 py-4">
                  <span className="inline-flex items-center px-2.5 py-0.5 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
                    {s.student_count}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className="inline-flex items-center px-2.5 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                    {s.teacher_count}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                    s.subscription_status === 'active' ? 'bg-green-100 text-green-700' :
                    s.subscription_status === 'trialing' ? 'bg-blue-100 text-blue-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {s.subscription_status ?? 'none'}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                    s.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {s.is_active ? 'Active' : 'Suspended'}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <button onClick={() => { setSelectedSchool(s); setShowAdminModal(true); }}
                      className="px-2 py-1 text-xs bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 font-medium">
                      Add Admin
                    </button>
                    <button onClick={() => toggleSchoolActive(s.school_id, s.is_active)}
                      className={`px-2 py-1 text-xs rounded-lg font-medium ${
                        s.is_active ? 'bg-red-50 text-red-700 hover:bg-red-100' : 'bg-green-50 text-green-700 hover:bg-green-100'
                      }`}>
                      {s.is_active ? 'Suspend' : 'Activate'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderCreateSchool = () => (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Create New School</h1>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">School Information</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">School Name *</label>
              <input type="text" value={schoolForm.name}
                onChange={(e) => setSchoolForm({ ...schoolForm, name: e.target.value, slug: e.target.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Slug *</label>
              <input type="text" value={schoolForm.slug}
                onChange={(e) => setSchoolForm({ ...schoolForm, slug: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
              <input type="email" value={schoolForm.email}
                onChange={(e) => setSchoolForm({ ...schoolForm, email: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input type="text" value={schoolForm.phone}
                onChange={(e) => setSchoolForm({ ...schoolForm, phone: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
              <input type="text" value={schoolForm.address}
                onChange={(e) => setSchoolForm({ ...schoolForm, address: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ID Prefix * (3-5 letters)</label>
              <input type="text" value={schoolForm.id_prefix} maxLength={5}
                onChange={(e) => setSchoolForm({ ...schoolForm, id_prefix: e.target.value.toUpperCase() })}
                placeholder="e.g. GFA"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Plan</label>
              <select value={schoolForm.plan_id} onChange={(e) => setSchoolForm({ ...schoolForm, plan_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Select Plan (14-day trial)</option>
                {plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">School Admin Account</h2>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
                <input type="text" value={schoolForm.admin_first_name}
                  onChange={(e) => setSchoolForm({ ...schoolForm, admin_first_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Last Name *</label>
                <input type="text" value={schoolForm.admin_last_name}
                  onChange={(e) => setSchoolForm({ ...schoolForm, admin_last_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Admin Email *</label>
              <input type="email" value={schoolForm.admin_email}
                onChange={(e) => setSchoolForm({ ...schoolForm, admin_email: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Admin Password *</label>
              <div className="relative">
                <input type={showPassword ? 'text' : 'password'} value={schoolForm.admin_password}
                  onChange={(e) => setSchoolForm({ ...schoolForm, admin_password: e.target.value })}
                  className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800 font-medium">Will create:</p>
              <ul className="text-xs text-blue-700 mt-2 space-y-1">
                <li>✅ School with 14-day trial</li>
                <li>✅ School admin account</li>
                <li>✅ Default branding</li>
              </ul>
            </div>
          </div>
          <button onClick={handleCreateSchool} disabled={saving}
            className="mt-6 w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-lg text-sm font-semibold disabled:opacity-50">
            {saving ? 'Creating...' : 'Create School & Admin'}
          </button>
        </div>
      </div>
    </div>
  );

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':     return renderDashboard();
      case 'schools':       return renderSchools();
      case 'create-school': return renderCreateSchool();
      default: return <div className="text-center py-8 text-gray-500">Coming soon...</div>;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <aside className={`${sidebarOpen ? 'w-64' : 'w-16'} bg-gray-900 flex flex-col transition-all duration-300 fixed h-full z-10`}>
        <div className="h-16 flex items-center px-4 border-b border-gray-700">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <Shield className="w-5 h-5 text-white" />
          </div>
          {sidebarOpen && <span className="ml-3 font-bold text-white truncate">Super Admin</span>}
        </div>
        <nav className="flex-1 px-2 py-4 space-y-1">
          {navigation.map((item) => {
            const Icon = item.icon;
            const isActive = currentPage === item.page;
            return (
              <button key={item.page} onClick={() => setCurrentPage(item.page)}
                className={`w-full flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                }`}>
                <Icon className="w-5 h-5 flex-shrink-0" />
                {sidebarOpen && <span className="ml-3">{item.name}</span>}
              </button>
            );
          })}
        </nav>
        <div className="p-2 border-t border-gray-700">
          <button onClick={signOut} className="w-full flex items-center px-3 py-2.5 rounded-lg text-sm font-medium text-red-400 hover:bg-gray-800">
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
            <div className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center">
              <span className="text-white text-sm font-medium">{profile?.first_name?.[0]}{profile?.last_name?.[0]}</span>
            </div>
            <div className="hidden md:block">
              <p className="text-sm font-medium text-gray-900">{profile?.first_name} {profile?.last_name}</p>
              <p className="text-xs text-gray-500">Super Admin</p>
            </div>
          </div>
        </header>
        <main className="p-6">{renderPage()}</main>
      </div>

      {showAdminModal && selectedSchool && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">Add Admin — {selectedSchool.school_name}</h2>
              <button onClick={() => setShowAdminModal(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
                  <input type="text" value={adminForm.first_name} onChange={(e) => setAdminForm({ ...adminForm, first_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Last Name *</label>
                  <input type="text" value={adminForm.last_name} onChange={(e) => setAdminForm({ ...adminForm, last_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                <input type="email" value={adminForm.email} onChange={(e) => setAdminForm({ ...adminForm, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password *</label>
                <div className="relative">
                  <input type={showPassword ? 'text' : 'password'} value={adminForm.password}
                    onChange={(e) => setAdminForm({ ...adminForm, password: e.target.value })}
                    className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowAdminModal(false)} className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
              <button onClick={handleCreateAdmin} disabled={saving} className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                {saving ? 'Creating...' : 'Create Admin'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}