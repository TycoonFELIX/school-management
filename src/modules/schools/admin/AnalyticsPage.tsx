import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import { TrendingUp, TrendingDown, Users, GraduationCap, ClipboardList, AlertTriangle } from 'lucide-react';

export default function AnalyticsPage() {
  const { schoolId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalStudents: 0, totalTeachers: 0, totalClasses: 0,
    avgAttendance: 0, avgScore: 0, atRiskCount: 0,
  });
  const [atRiskStudents, setAtRiskStudents] = useState<any[]>([]);
  const [teacherWorkload, setTeacherWorkload] = useState<any[]>([]);
  const [attendanceByClass, setAttendanceByClass] = useState<any[]>([]);
  const [topStudents, setTopStudents] = useState<any[]>([]);

  useEffect(() => {
    if (schoolId) fetchAnalytics();
  }, [schoolId]);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      // Basic counts
      const [studentsRes, teachersRes, classesRes] = await Promise.all([
        supabase.from('students').select('id', { count: 'exact' }).eq('school_id', schoolId).eq('is_active', true),
        supabase.from('teachers').select('id', { count: 'exact' }).eq('school_id', schoolId).eq('is_active', true),
        supabase.from('classes').select('id', { count: 'exact' }).eq('school_id', schoolId).eq('is_active', true),
      ]);

      // Attendance stats
      const { data: attData } = await supabase
        .from('attendance_records')
        .select('status')
        .eq('school_id', schoolId);

      const totalAtt = attData?.length ?? 0;
      const presentAtt = attData?.filter((a) => a.status === 'present').length ?? 0;
      const avgAttendance = totalAtt > 0 ? Math.round((presentAtt / totalAtt) * 100) : 0;

      // Average score from report cards
      const { data: rcData } = await supabase
        .from('report_cards')
        .select('average_score')
        .eq('school_id', schoolId)
        .not('average_score', 'is', null);

      const avgScore = rcData && rcData.length > 0
        ? Math.round(rcData.reduce((sum, r) => sum + (r.average_score ?? 0), 0) / rcData.length)
        : 0;

      // At risk students (from view)
      const { data: atRisk } = await supabase
        .from('students_at_risk')
        .select('student_id, current_avg, previous_avg, drop_pct, school_id')
        .eq('school_id', schoolId)
        .order('drop_pct', { ascending: false })
        .limit(10);

      // Get student names for at risk
      if (atRisk && atRisk.length > 0) {
        const studentIds = atRisk.map((r) => r.student_id);
        const { data: studentProfiles } = await supabase
          .from('students')
          .select('id, student_uid, profile:profiles(first_name, last_name)')
          .in('id', studentIds);

        const enriched = atRisk.map((r) => ({
          ...r,
          student: studentProfiles?.find((s) => s.id === r.student_id),
        }));
        setAtRiskStudents(enriched as any);
      }

      // Teacher workload
      const { data: workload } = await supabase
        .from('teacher_workload')
        .select('*')
        .eq('school_id', schoolId)
        .order('total_assignments', { ascending: false })
        .limit(10);
      if (workload) setTeacherWorkload(workload);

      // Top students by average score
      const { data: topRc } = await supabase
        .from('report_cards')
        .select(`
          average_score, class_position,
          student:students(student_uid, profile:profiles(first_name, last_name)),
          class:classes(name),
          term:terms(name)
        `)
        .eq('school_id', schoolId)
        .not('average_score', 'is', null)
        .order('average_score', { ascending: false })
        .limit(5);
      if (topRc) setTopStudents(topRc as any);

      // Attendance by class
      const { data: sessions } = await supabase
        .from('attendance_sessions')
        .select('class_id, class:classes(name)')
        .eq('school_id', schoolId);

      if (sessions) {
        const classMap: Record<string, { name: string; total: number }> = {};
        sessions.forEach((s: any) => {
          const id = s.class_id;
          if (!classMap[id]) classMap[id] = { name: s.class?.name ?? 'Unknown', total: 0 };
          classMap[id].total++;
        });
        setAttendanceByClass(Object.values(classMap));
      }

      setStats({
        totalStudents: studentsRes.count ?? 0,
        totalTeachers: teachersRes.count ?? 0,
        totalClasses: classesRes.count ?? 0,
        avgAttendance,
        avgScore,
        atRiskCount: atRisk?.length ?? 0,
      });
    } catch (err) {
      console.error('Analytics error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="text-center py-8 text-gray-400">Loading analytics...</div>;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
        <p className="text-gray-500 mt-1">School performance overview</p>
      </div>

      {/* Key Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        {[
          { label: 'Students', value: stats.totalStudents, icon: Users, color: 'bg-blue-500' },
          { label: 'Teachers', value: stats.totalTeachers, icon: GraduationCap, color: 'bg-green-500' },
          { label: 'Classes', value: stats.totalClasses, icon: ClipboardList, color: 'bg-purple-500' },
          { label: 'Attendance', value: `${stats.avgAttendance}%`, icon: TrendingUp, color: 'bg-teal-500' },
          { label: 'Avg Score', value: `${stats.avgScore}%`, icon: TrendingUp, color: 'bg-orange-500' },
          { label: 'At Risk', value: stats.atRiskCount, icon: AlertTriangle, color: 'bg-red-500' },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-gray-500">{s.label}</p>
                <div className={`${s.color} w-7 h-7 rounded-lg flex items-center justify-center`}>
                  <Icon className="w-4 h-4 text-white" />
                </div>
              </div>
              <p className="text-2xl font-bold text-gray-900">{s.value}</p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* At Risk Students */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            <h2 className="text-base font-semibold text-gray-900">Students At Risk</h2>
          </div>
          <p className="text-xs text-gray-500 mb-3">Students whose grades dropped 15% or more</p>
          {atRiskStudents.length === 0 ? (
            <div className="text-center py-4">
              <TrendingUp className="w-8 h-8 text-green-400 mx-auto mb-2" />
              <p className="text-sm text-green-600">No students at risk!</p>
            </div>
          ) : (
            <div className="space-y-2">
              {atRiskStudents.map((s, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-red-50 border border-red-100 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {(s.student as any)?.profile?.first_name} {(s.student as any)?.profile?.last_name}
                    </p>
                    <p className="text-xs text-gray-500">{(s.student as any)?.student_uid}</p>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-1">
                      <TrendingDown className="w-4 h-4 text-red-500" />
                      <span className="text-sm font-bold text-red-600">{s.drop_pct}% drop</span>
                    </div>
                    <p className="text-xs text-gray-500">
                      {s.previous_avg?.toFixed(1)} → {s.current_avg?.toFixed(1)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top Students */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-green-500" />
            <h2 className="text-base font-semibold text-gray-900">Top Performing Students</h2>
          </div>
          {topStudents.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">No report cards yet.</p>
          ) : (
            <div className="space-y-2">
              {topStudents.map((rc, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-green-50 border border-green-100 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 bg-green-600 rounded-full flex items-center justify-center">
                      <span className="text-white text-xs font-bold">{i + 1}</span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {(rc.student as any)?.profile?.first_name} {(rc.student as any)?.profile?.last_name}
                      </p>
                      <p className="text-xs text-gray-500">{(rc.class as any)?.name} • {(rc.term as any)?.name}</p>
                    </div>
                  </div>
                  <span className="text-sm font-bold text-green-700">{rc.average_score?.toFixed(1)}%</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Teacher Workload */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Teacher Workload</h2>
        {teacherWorkload.length === 0 ? (
          <p className="text-sm text-gray-400">No data yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Teacher</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Assignments</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Graded</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Pending</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Progress</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {teacherWorkload.map((t, i) => {
                  const progress = t.total_assignments > 0
                    ? Math.round((t.graded_count / t.total_assignments) * 100)
                    : 0;
                  return (
                    <tr key={i}>
                      <td className="px-4 py-3 text-sm text-gray-900">{t.teacher_name}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{t.total_assignments}</td>
                      <td className="px-4 py-3 text-sm text-green-600">{t.graded_count}</td>
                      <td className="px-4 py-3 text-sm text-orange-600">{t.pending_grading}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-gray-200 rounded-full h-2">
                            <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${progress}%` }} />
                          </div>
                          <span className="text-xs text-gray-500">{progress}%</span>
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

      {/* Attendance by Class */}
      {attendanceByClass.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Attendance Sessions by Class</h2>
          <div className="space-y-2">
            {attendanceByClass.map((c, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-900">{c.name}</p>
                <span className="text-sm font-medium text-blue-600">{c.total} sessions</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}