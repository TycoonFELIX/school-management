import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import { CreditCard, CheckCircle, Clock, AlertCircle, Zap } from 'lucide-react';

export default function BillingPage() {
  const { schoolId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<any>(null);
  const [plan, setPlan] = useState<any>(null);
  const [payments, setPayments] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [studentCount, setStudentCount] = useState(0);

  useEffect(() => {
    if (schoolId) fetchBillingData();
  }, [schoolId]);

  const fetchBillingData = async () => {
    const [subRes, paymentsRes, plansRes, studentsRes] = await Promise.all([
      supabase.from('subscriptions').select('*, plan:plans(*)').eq('school_id', schoolId)
        .order('created_at', { ascending: false }).limit(1).single(),
      supabase.from('payments').select('*').eq('school_id', schoolId)
        .order('created_at', { ascending: false }).limit(10),
      supabase.from('plans').select('*').eq('is_active', true).order('price_monthly'),
      supabase.from('students').select('id', { count: 'exact' }).eq('school_id', schoolId).eq('is_active', true),
    ]);

    if (subRes.data) { setSubscription(subRes.data); setPlan(subRes.data.plan); }
    if (paymentsRes.data) setPayments(paymentsRes.data);
    if (plansRes.data) setPlans(plansRes.data);
    if (studentsRes.count !== null) setStudentCount(studentsRes.count);
    setLoading(false);
  };

  const handlePayWithPaystack = (planData: any) => {
    const amount = planData.price_monthly * 100; // Paystack uses pesewas
    const email = 'admin@school.com'; // Use actual admin email

    // @ts-ignore
    const handler = window.PaystackPop?.setup({
      key: import.meta.env.VITE_PAYSTACK_PUBLIC_KEY ?? 'pk_test_placeholder',
      email,
      amount,
      currency: 'GHS',
      ref: `SCH_${schoolId}_${Date.now()}`,
      metadata: { school_id: schoolId, subscription_id: subscription?.id, plan_id: planData.id },
      callback: (response: any) => {
        alert(`Payment successful! Reference: ${response.reference}`);
        fetchBillingData();
      },
      onClose: () => {},
    });
    handler?.openIframe();
  };

  const daysLeft = subscription?.current_period_end
    ? Math.max(0, Math.ceil((new Date(subscription.current_period_end).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;

  const isExpired = subscription?.status === 'expired' ||
    (subscription?.current_period_end && new Date(subscription.current_period_end) < new Date());

  const statusColors: Record<string, string> = {
    active: 'bg-green-100 text-green-700',
    trialing: 'bg-blue-100 text-blue-700',
    past_due: 'bg-orange-100 text-orange-700',
    cancelled: 'bg-red-100 text-red-700',
    expired: 'bg-red-100 text-red-700',
  };

  if (loading) return <div className="text-center py-8 text-gray-400">Loading billing...</div>;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Billing & Subscription</h1>
        <p className="text-gray-500 mt-1">Manage your school subscription and payments</p>
      </div>

      {/* Current Subscription */}
      <div className={`rounded-xl border p-6 mb-6 ${isExpired ? 'border-red-300 bg-red-50' : 'border-blue-200 bg-blue-50'}`}>
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              {isExpired ? <AlertCircle className="w-5 h-5 text-red-500" /> : <CheckCircle className="w-5 h-5 text-blue-600" />}
              <h2 className="text-base font-semibold text-gray-900">
                {plan?.name ?? 'No Plan'} Plan
              </h2>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                statusColors[subscription?.status ?? 'expired'] ?? 'bg-gray-100 text-gray-700'
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
            {plan && (
              <div className="mt-3 flex items-center gap-4 text-sm">
                <span className="text-gray-600">
                  Students: <strong>{studentCount} / {plan.student_limit ?? '∞'}</strong>
                </span>
                <span className="text-gray-600">
                  Storage: <strong>{plan.storage_gb}GB</strong>
                </span>
              </div>
            )}
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-gray-900">
              GHS {plan?.price_monthly?.toFixed(2) ?? '0.00'}
            </p>
            <p className="text-sm text-gray-500">per month</p>
          </div>
        </div>

        {isExpired && (
          <div className="mt-4 p-3 bg-red-100 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700 font-medium">
              ⚠️ Your subscription has expired. Please renew to continue using all features.
            </p>
          </div>
        )}

        {subscription?.status === 'trialing' && (
          <div className="mt-4 p-3 bg-blue-100 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-700">
              🎉 You are on a <strong>14-day free trial</strong>. Upgrade to a paid plan to continue after trial ends.
            </p>
          </div>
        )}
      </div>

      {/* Plans */}
      <div className="mb-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Available Plans</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {plans.map((p) => {
            const isCurrentPlan = plan?.id === p.id;
            return (
              <div key={p.id} className={`bg-white rounded-xl border p-5 ${isCurrentPlan ? 'border-blue-500 ring-2 ring-blue-500' : 'border-gray-200'}`}>
                {isCurrentPlan && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 mb-2">
                    Current Plan
                  </span>
                )}
                <h3 className="text-base font-bold text-gray-900">{p.name}</h3>
                <p className="text-2xl font-bold text-gray-900 mt-2">
                  GHS {p.price_monthly?.toFixed(2)}
                  <span className="text-sm font-normal text-gray-500">/month</span>
                </p>
                <ul className="mt-4 space-y-2">
                  <li className="flex items-center gap-2 text-sm text-gray-600">
                    <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                    {p.student_limit ? `Up to ${p.student_limit} students` : 'Unlimited students'}
                  </li>
                  <li className="flex items-center gap-2 text-sm text-gray-600">
                    <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                    {p.storage_gb}GB storage
                  </li>
                  {(p.features ?? []).map((f: string, i: number) => (
                    <li key={i} className="flex items-center gap-2 text-sm text-gray-600">
                      <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                      {f.replace(/_/g, ' ')}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => handlePayWithPaystack(p)}
                  disabled={isCurrentPlan}
                  className={`mt-4 w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isCurrentPlan
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                  }`}>
                  <Zap className="w-4 h-4" />
                  {isCurrentPlan ? 'Current Plan' : `Upgrade to ${p.name}`}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Payment History */}
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
                <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Provider</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Reference</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {payments.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {new Date(p.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                    {p.currency} {p.amount?.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 capitalize">{p.provider}</td>
                  <td className="px-4 py-3 text-sm text-gray-500 font-mono text-xs">{p.provider_ref}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      p.status === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {p.status}
                    </span>
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