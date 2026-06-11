import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import { CreditCard, CheckCircle, Clock, AlertCircle } from 'lucide-react';

export default function BillingPage() {
  const { schoolId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<any>(null);
  const [plan, setPlan] = useState<any>(null);
  const [payments, setPayments] = useState<any[]>([]);
  const [studentCount, setStudentCount] = useState(0);

  useEffect(() => {
    if (schoolId) fetchBillingData();
  }, [schoolId]);

  const fetchBillingData = async () => {
    const [subRes, paymentsRes, studentsRes] = await Promise.all([
      supabase.from('subscriptions').select('*, plan:plans(*)').eq('school_id', schoolId)
        .order('created_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('payments').select('*').eq('school_id', schoolId)
        .order('created_at', { ascending: false }).limit(10),
      supabase.from('students').select('id', { count: 'exact' }).eq('school_id', schoolId).eq('is_active', true),
    ]);
    if (subRes.data) { setSubscription(subRes.data); setPlan(subRes.data.plan); }
    if (paymentsRes.data) setPayments(paymentsRes.data);
    if (studentsRes.count !== null) setStudentCount(studentsRes.count);
    setLoading(false);
  };

  const daysLeft = subscription?.current_period_end
    ? Math.max(0, Math.ceil((new Date(subscription.current_period_end).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;

  const isExpired = subscription?.status === 'expired' ||
    (subscription?.current_period_end && new Date(subscription.current_period_end) < new Date());

  if (loading) return <div className="text-center py-8 text-gray-400">Loading billing...</div>;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Billing & Subscription</h1>
        <p className="text-gray-500 mt-1">Your current subscription details</p>
      </div>

      <div className={`rounded-xl border p-6 mb-6 ${isExpired ? 'border-red-300 bg-red-50' : 'border-blue-200 bg-blue-50'}`}>
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              {isExpired
                ? <AlertCircle className="w-5 h-5 text-red-500" />
                : <CheckCircle className="w-5 h-5 text-blue-600" />}
              <h2 className="text-base font-semibold text-gray-900">{plan?.name ?? 'No Plan'}</h2>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                subscription?.status === 'active' ? 'bg-green-100 text-green-700' :
                subscription?.status === 'trialing' ? 'bg-blue-100 text-blue-700' :
                'bg-red-100 text-red-700'
              }`}>
                {subscription?.status ?? 'No subscription'}
              </span>
            </div>
            <div className="flex items-center gap-4 text-sm text-gray-600 mt-2">
              <span className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                {isExpired ? 'Expired' : `${daysLeft} days remaining`}
              </span>
              {subscription?.current_period_end && (
                <span>Expires: {new Date(subscription.current_period_end).toLocaleDateString()}</span>
              )}
            </div>
            <div className="mt-3 text-sm text-gray-600">
              Students: <strong>{studentCount} / {plan?.student_limit ?? '∞'}</strong>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-gray-900">GHS {plan?.price_monthly?.toFixed(2) ?? '0.00'}</p>
            <p className="text-sm text-gray-500">per month</p>
          </div>
        </div>
        {subscription?.status === 'trialing' && (
          <div className="mt-4 p-3 bg-blue-100 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-700">🎉 You are on a <strong>14-day free trial</strong>. Contact your Super Admin to upgrade.</p>
          </div>
        )}
        {isExpired && (
          <div className="mt-4 p-3 bg-red-100 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700">⚠️ Your subscription has expired. Contact your Super Admin to renew.</p>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Payment History</h2>
        {payments.length === 0 ? (
          <div className="text-center py-6">
            <CreditCard className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-400">No payments yet</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Date</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Amount</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Reference</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {payments.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-3 text-sm text-gray-600">{new Date(p.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{p.currency} {p.amount?.toFixed(2)}</td>
                  <td className="px-4 py-3 text-xs text-gray-500 font-mono">{p.provider_ref}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      p.status === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>{p.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}