import { useEffect, useState } from 'react';
import { Users, GraduationCap, BookOpen, School } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';

interface Props {
  onNavigate?: (page: string) => void;
}

interface Stats {
  teachers: number;
  students: number;
  classes: number;
  subjects: number;
}

export default function DashboardHome({ onNavigate }: Props) {
  const { schoolId } = useAuth();
  const [stats, setStats] = useState<Stats>({ teachers: 0, students: 0, classes: 0, subjects: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!schoolId) return;
    fetchStats();
  }, [schoolId]);

  const fetchStats = async () => {
    const [teachers, students, classes, subjects] = await Promise.all([
      supabase.from('teachers').select('id', { count: 'exact' }).eq('school_id', schoolId).eq('is_active', true),
      supabase.from('students').select('id', { count: 'exact' }).eq('school_id', schoolId).eq('is_active', true),
      supabase.from('classes').select('id', { count: 'exact' }).eq('school_id', schoolId).eq('is_active', true),
      supabase.from('subjects').select('id', { count: 'exact' }).eq('school_id', schoolId).eq('is_active', true),
    ]);

    setStats({
      teachers: teachers.count ?? 0,
      students: students.count ?? 0,
      classes:  classes.count ?? 0,
      subjects: subjects.count ?? 0,
    });
    setLoading(false);
  };

  const cards = [
    { label: 'Total Teachers', value: stats.teachers, icon: GraduationCap, color: 'bg-blue-500',   page: 'teachers' },
    { label: 'Total Students', value: stats.students, icon: Users,          color: 'bg-green-500',  page: 'students' },
    { label: 'Total Classes',  value: stats.classes,  icon: School,         color: 'bg-purple-500', page: 'classes'  },
    { label: 'Total Subjects', value: stats.subjects, icon: BookOpen,       color: 'bg-orange-500', page: 'subjects' },
  ];

  const quickActions = [
    { label: 'Add Teacher', color: 'bg-blue-50 text-blue-700 hover:bg-blue-100',     page: 'teachers' },
    { label: 'Add Student', color: 'bg-green-50 text-green-700 hover:bg-green-100',  page: 'students' },
    { label: 'Create Class', color: 'bg-purple-50 text-purple-700 hover:bg-purple-100', page: 'classes' },
    { label: 'Add Subject', color: 'bg-orange-50 text-orange-700 hover:bg-orange-100', page: 'subjects' },
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-1">Welcome back! Here's what's happening.</p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <button
              key={card.label}
              onClick={() => onNavigate?.(card.page)}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-left hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">{card.label}</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">
                    {loading ? '...' : card.value}
                  </p>
                </div>
                <div className={`${card.color} w-12 h-12 rounded-xl flex items-center justify-center`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Quick actions */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {quickActions.map((action) => (
            <button
              key={action.label}
              onClick={() => onNavigate?.(action.page)}
              className={`${action.color} px-4 py-3 rounded-lg text-sm font-medium transition-colors`}
            >
              {action.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}