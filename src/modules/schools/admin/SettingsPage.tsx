import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import { Save, Upload, School } from 'lucide-react';

export default function SettingsPage() {
  const { schoolId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [school, setSchool] = useState<any>(null);
  const [branding, setBranding] = useState<any>(null);
  const [form, setForm] = useState({
    name: '', email: '', phone: '', address: '',
    timezone: 'Africa/Accra', id_prefix: '',
  });
  const [brandingForm, setBrandingForm] = useState({
    primary_color: '#1a56db', secondary_color: '#e1effe', report_footer: '',
  });
  const [settingsForm, setSettingsForm] = useState({
    attendance_type: 'daily', terms_per_year: '3', academic_year_format: 'YYYY/YYYY',
  });

  useEffect(() => {
    if (schoolId) fetchSettings();
  }, [schoolId]);

  const fetchSettings = async () => {
    const { data: schoolData } = await supabase
      .from('schools').select('*').eq('id', schoolId).single();
    if (schoolData) {
      setSchool(schoolData);
      setForm({
        name: schoolData.name ?? '',
        email: schoolData.email ?? '',
        phone: schoolData.phone ?? '',
        address: schoolData.address ?? '',
        timezone: schoolData.timezone ?? 'Africa/Accra',
        id_prefix: schoolData.id_prefix ?? '',
      });
      setSettingsForm({
        attendance_type: schoolData.settings?.attendance_type ?? 'daily',
        terms_per_year: schoolData.settings?.term_structure?.terms_per_year?.toString() ?? '3',
        academic_year_format: schoolData.settings?.academic_year_format ?? 'YYYY/YYYY',
      });
    }

    const { data: brandingData } = await supabase
      .from('branding_assets').select('*').eq('school_id', schoolId).single();
    if (brandingData) {
      setBranding(brandingData);
      setBrandingForm({
        primary_color: brandingData.primary_color ?? '#1a56db',
        secondary_color: brandingData.secondary_color ?? '#e1effe',
        report_footer: brandingData.report_footer ?? '',
      });
    }
    setLoading(false);
  };

  const handleSaveSchool = async () => {
    setSaving(true);
    try {
      await supabase.from('schools').update({
        name: form.name, email: form.email, phone: form.phone,
        address: form.address, timezone: form.timezone, id_prefix: form.id_prefix,
        settings: {
          ...school?.settings,
          attendance_type: settingsForm.attendance_type,
          term_structure: { terms_per_year: parseInt(settingsForm.terms_per_year) },
          academic_year_format: settingsForm.academic_year_format,
        },
      }).eq('id', schoolId);
      alert('School settings saved!');
      fetchSettings();
    } catch (err: any) { alert('Error: ' + err.message); }
    finally { setSaving(false); }
  };

  const handleSaveBranding = async () => {
    setSaving(true);
    try {
      if (branding) {
        await supabase.from('branding_assets').update(brandingForm).eq('school_id', schoolId);
      } else {
        await supabase.from('branding_assets').insert({ ...brandingForm, school_id: schoolId });
      }
      alert('Branding saved!');
      fetchSettings();
    } catch (err: any) { alert('Error: ' + err.message); }
    finally { setSaving(false); }
  };

  const handleLogoUpload = async (file: File, type: 'logo' | 'watermark') => {
    const path = `schools/${schoolId}/branding/${type}_${Date.now()}.${file.name.split('.').pop()}`;
    const { error } = await supabase.storage.from('branding').upload(path, file, { upsert: true });
    if (!error) {
      const { data } = supabase.storage.from('branding').getPublicUrl(path);
      const update = type === 'logo' ? { logo_url: data.publicUrl } : { watermark_url: data.publicUrl };
      if (branding) {
        await supabase.from('branding_assets').update(update).eq('school_id', schoolId);
      } else {
        await supabase.from('branding_assets').insert({ ...update, school_id: schoolId, ...brandingForm });
      }
      fetchSettings();
      alert(`${type === 'logo' ? 'Logo' : 'Watermark'} uploaded!`);
    }
  };

  if (loading) return <div className="text-center py-8 text-gray-400">Loading settings...</div>;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500 mt-1">Manage your school configuration</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* School Info */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <School className="w-5 h-5 text-blue-600" />
            <h2 className="text-base font-semibold text-gray-900">School Information</h2>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">School Name</label>
              <input type="text" value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
              <textarea value={form.address} rows={2}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ID Prefix</label>
                <input type="text" value={form.id_prefix} maxLength={5}
                  onChange={(e) => setForm({ ...form, id_prefix: e.target.value.toUpperCase() })}
                  placeholder="e.g. OBG"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Timezone</label>
                <select value={form.timezone}
                  onChange={(e) => setForm({ ...form, timezone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="Africa/Accra">Africa/Accra (GMT)</option>
                  <option value="Africa/Lagos">Africa/Lagos (WAT)</option>
                  <option value="Africa/Nairobi">Africa/Nairobi (EAT)</option>
                  <option value="Europe/London">Europe/London (GMT)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Academic Settings */}
          <div className="mt-6 pt-6 border-t border-gray-100">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Academic Configuration</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Attendance Type</label>
                <select value={settingsForm.attendance_type}
                  onChange={(e) => setSettingsForm({ ...settingsForm, attendance_type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="daily">Daily</option>
                  <option value="per_period">Per Period</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Terms Per Year</label>
                <select value={settingsForm.terms_per_year}
                  onChange={(e) => setSettingsForm({ ...settingsForm, terms_per_year: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="2">2 Semesters</option>
                  <option value="3">3 Terms</option>
                  <option value="4">4 Quarters</option>
                </select>
              </div>
            </div>
          </div>

          <button onClick={handleSaveSchool} disabled={saving}
            className="mt-6 w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium disabled:opacity-50">
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save School Settings'}
          </button>
        </div>

        {/* Branding */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Branding & Appearance</h2>
          <div className="space-y-4">
            {/* Logo upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">School Logo</label>
              {branding?.logo_url && (
                <img src={branding.logo_url} alt="Logo" className="w-20 h-20 object-contain border border-gray-200 rounded-lg mb-2" />
              )}
              <label className="flex items-center gap-2 px-4 py-2 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors">
                <Upload className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-500">Upload Logo (PNG, JPG)</span>
                <input type="file" accept="image/*" className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleLogoUpload(e.target.files[0], 'logo')} />
              </label>
            </div>

            {/* Watermark upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Report Card Watermark</label>
              {branding?.watermark_url && (
                <img src={branding.watermark_url} alt="Watermark" className="w-20 h-20 object-contain border border-gray-200 rounded-lg mb-2 opacity-50" />
              )}
              <label className="flex items-center gap-2 px-4 py-2 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors">
                <Upload className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-500">Upload Watermark (PNG)</span>
                <input type="file" accept="image/*" className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleLogoUpload(e.target.files[0], 'watermark')} />
              </label>
            </div>

            {/* Colors */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Primary Color</label>
                <div className="flex items-center gap-2">
                  <input type="color" value={brandingForm.primary_color}
                    onChange={(e) => setBrandingForm({ ...brandingForm, primary_color: e.target.value })}
                    className="w-10 h-10 rounded cursor-pointer border border-gray-300" />
                  <input type="text" value={brandingForm.primary_color}
                    onChange={(e) => setBrandingForm({ ...brandingForm, primary_color: e.target.value })}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Secondary Color</label>
                <div className="flex items-center gap-2">
                  <input type="color" value={brandingForm.secondary_color}
                    onChange={(e) => setBrandingForm({ ...brandingForm, secondary_color: e.target.value })}
                    className="w-10 h-10 rounded cursor-pointer border border-gray-300" />
                  <input type="text" value={brandingForm.secondary_color}
                    onChange={(e) => setBrandingForm({ ...brandingForm, secondary_color: e.target.value })}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Report Card Footer Text</label>
              <input type="text" value={brandingForm.report_footer}
                onChange={(e) => setBrandingForm({ ...brandingForm, report_footer: e.target.value })}
                placeholder="e.g. School Name • Confidential • 2025/2026"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>

            {/* Preview */}
            <div className="mt-4 p-4 rounded-lg border border-gray-200" style={{ backgroundColor: brandingForm.secondary_color }}>
              <div className="h-8 rounded flex items-center justify-center" style={{ backgroundColor: brandingForm.primary_color }}>
                <span className="text-white text-sm font-medium">{form.name || 'School Name'}</span>
              </div>
              <p className="text-xs text-center mt-2 text-gray-600">{brandingForm.report_footer || 'Footer preview'}</p>
            </div>
          </div>

          <button onClick={handleSaveBranding} disabled={saving}
            className="mt-6 w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium disabled:opacity-50">
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save Branding'}
          </button>
        </div>
      </div>
    </div>
  );
}