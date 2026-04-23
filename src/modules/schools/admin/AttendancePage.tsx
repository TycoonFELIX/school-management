import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import { Search, Check, X, Clock, Save } from 'lucide-react';

interface Student {
  id: string;
  student_uid: string;
  profile: { first_name: string; last_name: string };
}

interface AttendanceRecord {
  student_id: string;
  status: 'present' | 'absent' | 'late' | 'excused';
  remarks: string;
}

export default function AttendancePage() {
  const { schoolId } = useAuth();
  const [classes, setClasses] = useState<any[]>([]);
  const [terms, setTerms] = useState<any[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedTerm, setSelectedTerm] = useState('');
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [attendance, setAttendance] = useState<Record<string, AttendanceRecord>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [existingSession, setExistingSession] = useState<string | null>(null);

  useEffect(() => {
    if (schoolId) {
      fetchClasses();
      fetchTerms();
    }
  }, [schoolId]);

  useEffect(() => {
    if (selectedClass) fetchStudents();
  }, [selectedClass]);

  useEffect(() => {
    if (selectedClass && selectedDate) fetchExistingAttendance();
  }, [selectedClass, selectedDate]);

  const fetchClasses = async () => {
    const { data } = await supabase
      .from('classes')
      .select('id, name, level, section')
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
      if (current) setSelectedTerm(current.id);
    }
  };

  const fetchStudents = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('enrollments')
      .select(`
        student:students(
          id, student_uid,
          profile:profiles(first_name, last_name)
        )
      `)
      .eq('class_id', selectedClass)
      .eq('is_active', true);

    if (data) {
      const studentList = data.map((e: any) => e.student) as Student[];
      setStudents(studentList);
      const initial: Record<string, AttendanceRecord> = {};
      studentList.forEach((s) => {
        initial[s.id] = { student_id: s.id, status: 'present', remarks: '' };
      });
      setAttendance(initial);
    }
    setLoading(false);
  };

  const fetchExistingAttendance = async () => {
    const { data: session } = await supabase
      .from('attendance_sessions')
      .select('id')
      .eq('class_id', selectedClass)
      .eq('session_date', selectedDate)
      .single();

    if (session) {
      setExistingSession(session.id);
      const { data: records } = await supabase
        .from('attendance_records')
        .select('student_id, status, remarks')
        .eq('session_id', session.id);

      if (records) {
        const existing: Record<string, AttendanceRecord> = {};
        records.forEach((r: any) => {
          existing[r.student_id] = {
            student_id: r.student_id,
            status: r.status,
            remarks: r.remarks ?? '',
          };
        });
        setAttendance(existing);
      }
    } else {
      setExistingSession(null);
    }
  };

  const setStatus = (studentId: string, status: AttendanceRecord['status']) => {
    setAttendance((prev) => ({
      ...prev,
      [studentId]: { ...prev[studentId], status },
    }));
  };

  const handleSave = async () => {
    if (!selectedClass || !selectedTerm || !selectedDate) {
      alert('Please select class, term and date.');
      return;
    }
    setSaving(true);
    try {
      let sessionId = existingSession;

      if (!sessionId) {
        const { data: session, error: sessionError } = await supabase
          .from('attendance_sessions')
          .insert({
            school_id: schoolId,
            class_id: selectedClass,
            term_id: selectedTerm,
            teacher_id: null,
            session_date: selectedDate,
            attendance_type: 'daily',
          })
          .select()
          .single();

        if (sessionError) throw sessionError;
        sessionId = session.id;
        setExistingSession(sessionId);
      }

      const records = Object.values(attendance).map((r) => ({
        school_id: schoolId,
        session_id: sessionId,
        student_id: r.student_id,
        status: r.status,
        remarks: r.remarks || null,
      }));

      if (existingSession) {
        await supabase
          .from('attendance_records')
          .delete()
          .eq('session_id', sessionId);
      }

      await supabase.from('attendance_records').insert(records);
      alert('Attendance saved successfully!');
    } catch (err: any) {
      alert('Error saving attendance: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const statusColors = {
    present: 'bg-green-100 text-green-700 border-green-300',
    absent:  'bg-red-100 text-red-700 border-red-300',
    late:    'bg-yellow-100 text-yellow-700 border-yellow-300',
    excused: 'bg-blue-100 text-blue-700 border-blue-300',
  };

  const presentCount  = Object.values(attendance).filter((a) => a.status === 'present').length;
  const absentCount   = Object.values(attendance).filter((a) => a.status === 'absent').length;
  const lateCount     = Object.values(attendance).filter((a) => a.status === 'late').length;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Attendance</h1>
          <p className="text-gray-500 mt-1">Mark and track student attendance</p>
        </div>
        {students.length > 0 && (
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : existingSession ? 'Update Attendance' : 'Save Attendance'}
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Class</label>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select Class</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.section ? `- Section ${c.section}` : ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Term</label>
            <select
              value={selectedTerm}
              onChange={(e) => setSelectedTerm(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select Term</option>
              {terms.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} {t.is_current ? '(Current)' : ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Summary */}
      {students.length > 0 && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-green-700">{presentCount}</p>
            <p className="text-sm text-green-600">Present</p>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-red-700">{absentCount}</p>
            <p className="text-sm text-red-600">Absent</p>
          </div>
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-yellow-700">{lateCount}</p>
            <p className="text-sm text-yellow-600">Late</p>
          </div>
        </div>
      )}

      {/* Student list */}
      {!selectedClass ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <Search className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-gray-500">Select a class to mark attendance</p>
        </div>
      ) : loading ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <p className="text-gray-400">Loading students...</p>
        </div>
      ) : students.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <p className="text-gray-500">No students enrolled in this class yet.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {existingSession && (
            <div className="bg-blue-50 border-b border-blue-200 px-6 py-2">
              <p className="text-sm text-blue-700">Attendance already recorded for this date. You can update it.</p>
            </div>
          )}
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Student</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">ID</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {students.map((student) => {
                const record = attendance[student.id];
                return (
                  <tr key={student.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                          <span className="text-blue-700 text-sm font-medium">
                            {student.profile?.first_name?.[0]}{student.profile?.last_name?.[0]}
                          </span>
                        </div>
                        <p className="text-sm font-medium text-gray-900">
                          {student.profile?.first_name} {student.profile?.last_name}
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{student.student_uid}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {(['present', 'absent', 'late', 'excused'] as const).map((status) => (
                          <button
                            key={status}
                            onClick={() => setStatus(student.id, status)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                              record?.status === status
                                ? statusColors[status]
                                : 'bg-gray-50 text-gray-400 border-gray-200 hover:bg-gray-100'
                            }`}
                          >
                            {status === 'present' && <Check className="w-3 h-3 inline mr-1" />}
                            {status === 'absent'  && <X className="w-3 h-3 inline mr-1" />}
                            {status === 'late'    && <Clock className="w-3 h-3 inline mr-1" />}
                            {status.charAt(0).toUpperCase() + status.slice(1)}
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}