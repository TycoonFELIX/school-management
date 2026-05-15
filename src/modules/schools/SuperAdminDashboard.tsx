import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  LayoutDashboard, School, Users, CreditCard,
  LogOut, Menu, X, Bell, Shield, TrendingUp, CheckCircle, XCircle
} from 'lucide-react';
import toast from 'react-hot-toast';

const navigation = [
  { name: 'Dashboard',     icon: LayoutDashboard, page: 'dashboard' },
  { name: 'Schools',       icon: School,          page: 'schools' },
  { name: 'Subscriptions', icon: CreditCard,      page: 'subscriptions' },
  { name: 'Users',         icon: Users,           page: 'users' },
];

export default function SuperAdminDashboard() {
  const { profile, signOut } = useAuth();
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [stats, setStats] = useState({ schools: 0, students: 0, teachers: 0, revenue: 0 });
  const [schools, setSchools] = useState<any[]>([]);
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [schoolsRes, studentsRes, teachersRes, subsRes, paymentsRes] = await Promise.all([
        supabase.from('schools').select('*, subscriptions(status, current_period_end, plan:plans(name, price_monthly))').eq('is_active', true).order('created_at', { ascending: false }),
        supabase.from('students').select('id', { count: 'exact' }).eq('is_active', true),
        supabase.from('teachers').select('id', { count: 'exact' }).eq('is_active', true),
        supabase.from('subscriptions').select('*, school:schools(name, email), plan:plans(name, price_monthly)').order('created_at', { ascending: false }),
        supabase.from('payments').select('amount').eq('status', 'success'),
      ]);

      if (schoolsRes.data) setSchools(schoolsRes.data);
      if (subsRes.data) setSubscriptions(subsRes.data);

      const totalRevenue = paymentsRes.data?.reduce((sum, p) => sum + (p.amount ?? 0), 0) ?? 0;

      setStats({
        schools: schoolsRes.data?.length ?? 0,
        students: studentsRes.count ?? 0,
        teachers: teachersRes.count ?? 0,
        revenue: totalRevenue,
      });
    } catch (err) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const toggleSchoolActive = async (schoolId: string, currentStatus: boolean) => {
    const { error } = await supabase.from('schools').update({ is_active: !currentStatus }).eq('id', schoolId);
    if (error) { toast.error('Failed to update school'); return; }
    toast.success(currentStatus ? 'School deactivated' : 'School activated');
    fetchData();
  };

  const renderDashboard = () => (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Super Admin Dashboard</h1>
        <p className="text-gray-500 mt-1">Platform-wide overview</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total Schools', value: stats.schools, icon: School, color: 'bg-blue-500' },
          { label: 'Total Students', value: stats.students, icon: Users, color: 'bg-green-500' },
          { label: 'Total Teachers', value: stats.teachers, icon: Users, color: 'bg-purple-500' },
          { label: 'Total Revenue', value: `GHS ${stats.revenue.toFixed(2)}`, icon: TrendingUp, color: 'bg-orange-500' },
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
              <p className="text-xl font-bold text-gray-900">{loading ? '...' : s.value}</p>
            </div>
          );
        })}
      </div>

      {/* Recent Schools */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Recent Schools</h2>
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">School</th>
              <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Plan</th>
              <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Status</th>
              <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {schools.slice(0, 5).map((school) => {
              const sub = school.subscriptions?.[0];
              return (
                <tr key={school.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium text-gray-900">{school.name}</p>
                    <p className="text-xs text-gray-500">{school.email}</p>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{sub?.plan?.name ?? 'No Plan'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      school.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {school.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleSchoolActive(school.id, school.is_active)}
                      className={`p-1.5 rounded-lg transition-colors ${
                        school.is_active
                          ? 'text-red-400 hover:text-red-600 hover:bg-red-50'
                          : 'text-green-400 hover:text-green-600 hover:bg-green-50'
                      }`}>
                      {school.is_active ? <XCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderSchools = () => (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">All Schools</h1>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">School</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Slug</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Plan</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Subscription</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {schools.map((school) => {
              const sub = school.subscriptions?.[0];
              const isExpired = sub?.current_period_end && new Date(sub.current_period_end) < new Date();
              return (
                <tr key={school.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <p className="text-sm font-medium text-gray-900">{school.name}</p>
                    <p className="text-xs text-gray-500">{school.email}</p>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 font-mono">{school.slug}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{sub?.plan?.name ?? '—'}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      sub?.status === 'active' ? 'bg-green-100 text-green-700' :
                      sub?.status === 'trialing' ? 'bg-blue-100 text-blue-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {sub?.status ?? 'none'}
                    </span>
                    {isExpired && <span className="ml-1 text-xs text-red-500">Expired</span>}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      school.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {school.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => toggleSchoolActive(school.id, school.is_active)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        school.is_active
                          ? 'bg-red-50 text-red-700 hover:bg-red-100'
                          : 'bg-green-50 text-green-700 hover:bg-green-100'
                      }`}>
                      {school.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderSubscriptions = () => (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Subscriptions</h1>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">School</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Plan</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Period End</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Price</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {subscriptions.map((sub) => (
              <tr key={sub.id} className="hover:bg-gray-50">
                <td className="px-6 py-4">
                  <p className="text-sm font-medium text-gray-900">{sub.school?.name}</p>
                  <p className="text-xs text-gray-500">{sub.school?.email}</p>
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">{sub.plan?.name ?? '—'}</td>
                <td className="px-6 py-4">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                    sub.status === 'active' ? 'bg-green-100 text-green-700' :
                    sub.status === 'trialing' ? 'bg-blue-100 text-blue-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {sub.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">
                  {sub.current_period_end ? new Date(sub.current_period_end).toLocaleDateString() : '—'}
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">
                  GHS {sub.plan?.price_monthly?.toFixed(2) ?? '0.00'}/mo
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':     return renderDashboard();
      case 'schools':       return renderSchools();
      case 'subscriptions': return renderSubscriptions();
      default: return (
        <div className="flex items-center justify-center h-64">
          <p className="text-gray-500">Coming soon...</p>
        </div>
      );
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
        <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
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
          <button onClick={signOut} className="w-full flex items-center px-3 py-2.5 rounded-lg text-sm font-medium text-red-400 hover:bg-gray-800 transition-colors">
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
            <button className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100">
              <Bell className="w-5 h-5" />
            </button>
            <div className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center">
              <span className="text-white text-sm font-medium">
                {profile?.first_name?.[0]}{profile?.last_name?.[0]}
              </span>
            </div>
            <div className="hidden md:block">
              <p className="text-sm font-medium text-gray-900">{profile?.first_name} {profile?.last_name}</p>
              <p className="text-xs text-gray-500">Super Admin</p>
            </div>
          </div>
        </header>
        <main className="p-6">{renderPage()}</main>
      </div>
    </div>
  );
}