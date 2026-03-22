import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import { Plus, Edit, ChevronDown, ChevronUp } from 'lucide-react';

interface Term {
  id: string;
  name: string;
  term_number: number;
  start_date: string;
  end_date: string;
  is_current: boolean;
  is_closed: boolean;
}

interface AcademicYear {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_current: boolean;
  terms: Term[];
}

export default function AcademicYearsPage() {
  const { schoolId } = useAuth();
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedYear, setExpandedYear] = useState<string | null>(null);
  const [showYearModal, setShowYearModal] = useState(false);
  const [showTermModal, setShowTermModal] = useState(false);
  const [selectedYearId, setSelectedYearId] = useState<string | null>(null);
  const [editingYearId, setEditingYearId] = useState<string | null>(null);
  const [editingTermId, setEditingTermId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [yearForm, setYearForm] = useState({
    name: '', start_date: '', end_date: '', is_current: false,
  });

  const [termForm, setTermForm] = useState({
    name: '', term_number: '1', start_date: '', end_date: '', is_current: false,
  });

  useEffect(() => {
    if (schoolId) fetchYears();
  }, [schoolId]);

  const fetchYears = async () => {
    const { data: yearsData } = await supabase
      .from('academic_years')
      .select('*')
      .eq('school_id', schoolId)
      .order('start_date', { ascending: false });

    if (yearsData) {
      const yearsWithTerms = await Promise.all(
        yearsData.map(async (year) => {
          const { data: terms } = await supabase
            .from('terms')
            .select('*')
            .eq('academic_year_id', year.id)
            .order('term_number');
          return { ...year, terms: terms ?? [] };
        })
      );
      setYears(yearsWithTerms);
    }
    setLoading(false);
  };

  const openCreateYear = () => {
    setEditingYearId(null);
    setYearForm({ name: '', start_date: '', end_date: '', is_current: false });
    setShowYearModal(true);
  };

  const openEditYear = (year: AcademicYear) => {
    setEditingYearId(year.id);
    setYearForm({
      name: year.name,
      start_date: year.start_date,
      end_date: year.end_date,
      is_current: year.is_current,
    });
    setShowYearModal(true);
  };

  const handleSaveYear = async () => {
    if (!yearForm.name || !yearForm.start_date || !yearForm.end_date) {
      alert('All fields are required.');
      return;
    }
    setSaving(true);
    try {
      if (editingYearId) {
        await supabase.from('academic_years').update({
          name: yearForm.name,
          start_date: yearForm.start_date,
          end_date: yearForm.end_date,
          is_current: yearForm.is_current,
        }).eq('id', editingYearId);
      } else {
        await supabase.from('academic_years').insert({
          school_id: schoolId,
          name: yearForm.name,
          start_date: yearForm.start_date,
          end_date: yearForm.end_date,
          is_current: yearForm.is_current,
        });
      }
      setShowYearModal(false);
      fetchYears();
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const openCreateTerm = (yearId: string) => {
    setSelectedYearId(yearId);
    setEditingTermId(null);
    setTermForm({ name: '', term_number: '1', start_date: '', end_date: '', is_current: false });
    setShowTermModal(true);
  };

  const openEditTerm = (yearId: string, term: Term) => {
    setSelectedYearId(yearId);
    setEditingTermId(term.id);
    setTermForm({
      name: term.name,
      term_number: term.term_number.toString(),
      start_date: term.start_date,
      end_date: term.end_date,
      is_current: term.is_current,
    });
    setShowTermModal(true);
  };

  const handleSaveTerm = async () => {
    if (!termForm.name || !termForm.start_date || !termForm.end_date) {
      alert('All fields are required.');
      return;
    }
    setSaving(true);
    try {
      if (editingTermId) {
        await supabase.from('terms').update({
          name: termForm.name,
          term_number: parseInt(termForm.term_number),
          start_date: termForm.start_date,
          end_date: termForm.end_date,
          is_current: termForm.is_current,
        }).eq('id', editingTermId);
      } else {
        await supabase.from('terms').insert({
          school_id: schoolId,
          academic_year_id: selectedYearId,
          name: termForm.name,
          term_number: parseInt(termForm.term_number),
          start_date: termForm.start_date,
          end_date: termForm.end_date,
          is_current: termForm.is_current,
        });
      }
      setShowTermModal(false);
      fetchYears();
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Academic Years & Terms</h1>
          <p className="text-gray-500 mt-1">Manage your school calendar</p>
        </div>
        <button
          onClick={openCreateYear}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Academic Year
        </button>
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-400">Loading...</div>
      ) : years.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <p className="text-gray-500">No academic years found. Create one to get started.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {years.map((year) => (
            <div key={year.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              {/* Year header */}
              <div className="flex items-center justify-between p-5">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setExpandedYear(expandedYear === year.id ? null : year.id)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    {expandedYear === year.id
                      ? <ChevronUp className="w-5 h-5" />
                      : <ChevronDown className="w-5 h-5" />}
                  </button>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-semibold text-gray-900">{year.name}</h3>
                      {year.is_current && (
                        <span className="bg-blue-100 text-blue-700 text-xs font-medium px-2 py-0.5 rounded-full">
                          Current
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500">
                      {year.start_date} — {year.end_date} · {year.terms.length} terms
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openCreateTerm(year.id)}
                    className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium px-3 py-1.5 rounded-lg hover:bg-blue-50"
                  >
                    <Plus className="w-4 h-4" />
                    Add Term
                  </button>
                  <button
                    onClick={() => openEditYear(year)}
                    className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Terms list */}
              {expandedYear === year.id && (
                <div className="border-t border-gray-100">
                  {year.terms.length === 0 ? (
                    <p className="text-center text-gray-400 py-4 text-sm">No terms yet. Click "Add Term" to create one.</p>
                  ) : (
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="text-left px-6 py-2 text-xs font-medium text-gray-500 uppercase">Term</th>
                          <th className="text-left px-6 py-2 text-xs font-medium text-gray-500 uppercase">Start Date</th>
                          <th className="text-left px-6 py-2 text-xs font-medium text-gray-500 uppercase">End Date</th>
                          <th className="text-left px-6 py-2 text-xs font-medium text-gray-500 uppercase">Status</th>
                          <th className="text-left px-6 py-2 text-xs font-medium text-gray-500 uppercase">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {year.terms.map((term) => (
                          <tr key={term.id} className="hover:bg-gray-50">
                            <td className="px-6 py-3">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-gray-900">{term.name}</span>
                                {term.is_current && (
                                  <span className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full">Current</span>
                                )}
                                {term.is_closed && (
                                  <span className="bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded-full">Closed</span>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-3 text-sm text-gray-600">{term.start_date}</td>
                            <td className="px-6 py-3 text-sm text-gray-600">{term.end_date}</td>
                            <td className="px-6 py-3">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                term.is_closed
                                  ? 'bg-red-100 text-red-700'
                                  : term.is_current
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-gray-100 text-gray-600'
                              }`}>
                                {term.is_closed ? 'Closed' : term.is_current ? 'Active' : 'Upcoming'}
                              </span>
                            </td>
                            <td className="px-6 py-3">
                              <button
                                onClick={() => openEditTerm(year.id, term)}
                                className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Academic Year Modal */}
      {showYearModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">
              {editingYearId ? 'Edit Academic Year' : 'Add Academic Year'}
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Year Name *</label>
                <input
                  type="text"
                  value={yearForm.name}
                  onChange={(e) => setYearForm({ ...yearForm, name: e.target.value })}
                  placeholder="e.g. 2025/2026"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Date *</label>
                  <input
                    type="date"
                    value={yearForm.start_date}
                    onChange={(e) => setYearForm({ ...yearForm, start_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Date *</label>
                  <input
                    type="date"
                    value={yearForm.end_date}
                    onChange={(e) => setYearForm({ ...yearForm, end_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={yearForm.is_current}
                  onChange={(e) => setYearForm({ ...yearForm, is_current: e.target.checked })}
                  className="rounded"
                />
                <span className="text-sm text-gray-700">Set as current academic year</span>
              </label>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowYearModal(false)}
                className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveYear}
                disabled={saving}
                className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Saving...' : editingYearId ? 'Update Year' : 'Create Year'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Term Modal */}
      {showTermModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">
              {editingTermId ? 'Edit Term' : 'Add Term'}
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Term Name *</label>
                <input
                  type="text"
                  value={termForm.name}
                  onChange={(e) => setTermForm({ ...termForm, name: e.target.value })}
                  placeholder="e.g. Term 1, First Semester"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Term Number *</label>
                <select
                  value={termForm.term_number}
                  onChange={(e) => setTermForm({ ...termForm, term_number: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="1">1</option>
                  <option value="2">2</option>
                  <option value="3">3</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Date *</label>
                  <input
                    type="date"
                    value={termForm.start_date}
                    onChange={(e) => setTermForm({ ...termForm, start_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Date *</label>
                  <input
                    type="date"
                    value={termForm.end_date}
                    onChange={(e) => setTermForm({ ...termForm, end_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={termForm.is_current}
                  onChange={(e) => setTermForm({ ...termForm, is_current: e.target.checked })}
                  className="rounded"
                />
                <span className="text-sm text-gray-700">Set as current term</span>
              </label>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowTermModal(false)}
                className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveTerm}
                disabled={saving}
                className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Saving...' : editingTermId ? 'Update Term' : 'Create Term'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}