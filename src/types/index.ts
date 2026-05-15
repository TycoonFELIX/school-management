// =============================================================================
// Global TypeScript interfaces for the School Management System
// =============================================================================

export interface School {
  id: string;
  name: string;
  slug: string;
  email: string;
  phone: string | null;
  address: string | null;
  country: string;
  timezone: string;
  id_prefix: string;
  settings: SchoolSettings;
  is_active: boolean;
  created_at: string;
}

export interface SchoolSettings {
  grading_scale: Record<string, number[]>;
  attendance_type: 'daily' | 'per_period';
  term_structure: { terms_per_year: number };
  academic_year_format: string;
  max_login_attempts: number;
  late_penalty_percent: number;
}

export type UserRole = 'super_admin' | 'school_admin' | 'teacher' | 'student' | 'parent';

export interface Profile {
  id: string;
  school_id: string;
  role: UserRole;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  school_uid: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Teacher {
  id: string;
  profile_id: string;
  school_id: string;
  teacher_uid: string;
  department: string | null;
  qualification: string | null;
  is_active: boolean;
  created_at: string;
  profile?: Pick<Profile, 'id' | 'first_name' | 'last_name' | 'email' | 'phone'>;
}

export interface Student {
  id: string;
  profile_id: string;
  school_id: string;
  student_uid: string;
  date_of_birth: string | null;
  gender: string | null;
  guardian_name: string | null;
  guardian_phone: string | null;
  is_active: boolean;
  created_at: string;
  profile?: Pick<Profile, 'id' | 'first_name' | 'last_name' | 'email' | 'phone'>;
}

export interface Parent {
  id: string;
  profile_id: string;
  school_id: string;
  occupation: string | null;
  is_active: boolean;
  profile?: Pick<Profile, 'id' | 'first_name' | 'last_name' | 'email' | 'phone'>;
}

export interface AcademicYear {
  id: string;
  school_id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_current: boolean;
  terms?: Term[];
}

export interface Term {
  id: string;
  school_id: string;
  academic_year_id: string;
  name: string;
  term_number: number;
  start_date: string;
  end_date: string;
  is_current: boolean;
  is_closed: boolean;
  closed_at: string | null;
}

export interface Class {
  id: string;
  school_id: string;
  academic_year_id: string;
  name: string;
  level: string | null;
  section: string | null;
  max_students: number;
  is_active: boolean;
  class_teacher_id: string | null;
  class_teacher?: Pick<Teacher, 'id' | 'teacher_uid' | 'profile'>;
}

export interface Subject {
  id: string;
  school_id: string;
  name: string;
  code: string | null;
  category: 'core' | 'elective';
  description: string | null;
  is_active: boolean;
}

export interface ClassSubject {
  id: string;
  school_id: string;
  class_id: string;
  subject_id: string;
  teacher_id: string | null;
  term_id: string;
  class?: Pick<Class, 'id' | 'name' | 'section'>;
  subject?: Pick<Subject, 'id' | 'name' | 'category'>;
  teacher?: Pick<Teacher, 'id' | 'teacher_uid' | 'profile'>;
}

export interface Enrollment {
  id: string;
  school_id: string;
  student_id: string;
  class_id: string;
  term_id: string;
  is_active: boolean;
  student?: Pick<Student, 'id' | 'student_uid' | 'profile'>;
  class?: Pick<Class, 'id' | 'name' | 'section'>;
  term?: Pick<Term, 'id' | 'name'>;
}

export interface Assignment {
  id: string;
  school_id: string;
  class_subject_id: string;
  teacher_id: string | null;
  term_id: string;
  title: string;
  description: string | null;
  instructions: string | null;
  weight: number;
  max_score: number;
  due_date: string;
  allow_late: boolean;
  late_penalty: number;
  is_published: boolean;
  published_at: string | null;
  is_active: boolean;
  class_subject?: ClassSubject;
  term?: Pick<Term, 'id' | 'name'>;
  assignment_files?: AssignmentFile[];
}

export interface AssignmentFile {
  id: string;
  school_id: string;
  assignment_id: string;
  file_name: string;
  file_url: string;
  file_size: number | null;
  mime_type: string | null;
}

export interface AssignmentSubmission {
  id: string;
  school_id: string;
  assignment_id: string;
  student_id: string;
  submitted_at: string;
  is_late: boolean;
  status: 'pending' | 'submitted' | 'graded' | 'returned';
  student_note: string | null;
  submission_files?: SubmissionFile[];
  grade?: AssignmentGrade;
}

export interface SubmissionFile {
  id: string;
  submission_id: string;
  file_name: string;
  file_url: string;
  file_size: number | null;
  mime_type: string | null;
}

export interface AssignmentGrade {
  id: string;
  submission_id: string;
  teacher_id: string;
  score: number;
  remarks: string | null;
  graded_at: string;
}

export interface AttendanceSession {
  id: string;
  school_id: string;
  class_id: string;
  teacher_id: string | null;
  term_id: string;
  session_date: string;
  attendance_type: 'daily' | 'per_period';
  period: string | null;
}

export interface AttendanceRecord {
  id: string;
  school_id: string;
  session_id: string;
  student_id: string;
  status: 'present' | 'absent' | 'late' | 'excused';
  remarks: string | null;
}

export interface ReportCard {
  id: string;
  school_id: string;
  student_id: string;
  class_id: string;
  term_id: string;
  total_score: number | null;
  average_score: number | null;
  class_position: number | null;
  attendance_days: number | null;
  present_days: number | null;
  principal_remark: string | null;
  class_teacher_remark: string | null;
  is_approved: boolean;
  approved_at: string | null;
  pdf_url: string | null;
  student?: Pick<Student, 'id' | 'student_uid' | 'profile'>;
  class?: Pick<Class, 'id' | 'name' | 'section'>;
  term?: Pick<Term, 'id' | 'name'>;
  report_card_subjects?: ReportCardSubject[];
}

export interface ReportCardSubject {
  id: string;
  school_id: string;
  report_card_id: string;
  subject_id: string;
  teacher_id: string | null;
  score: number | null;
  grade: string | null;
  position: number | null;
  teacher_remark: string | null;
  subject?: Pick<Subject, 'id' | 'name' | 'category'>;
}

export interface Announcement {
  id: string;
  school_id: string;
  author_id: string;
  title: string;
  body: string;
  audience: 'all' | 'teachers' | 'students' | 'parents';
  class_id: string | null;
  is_pinned: boolean;
  published_at: string | null;
  expires_at: string | null;
  is_active: boolean;
  author?: Pick<Profile, 'first_name' | 'last_name' | 'role'>;
  class?: Pick<Class, 'name' | 'section'> | null;
}

export interface Notification {
  id: string;
  school_id: string;
  user_id: string;
  title: string;
  body: string;
  type: string;
  reference_id: string | null;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
}

export interface Subscription {
  id: string;
  school_id: string;
  plan_id: string;
  status: 'trialing' | 'active' | 'past_due' | 'cancelled' | 'expired';
  trial_ends_at: string | null;
  current_period_start: string;
  current_period_end: string;
  provider: string | null;
  provider_ref: string | null;
  plan?: Plan;
}

export interface Plan {
  id: string;
  name: string;
  price_monthly: number;
  price_yearly: number | null;
  student_limit: number | null;
  teacher_limit: number | null;
  storage_gb: number;
  features: string[];
  is_active: boolean;
}

export interface Payment {
  id: string;
  school_id: string;
  subscription_id: string;
  amount: number;
  currency: string;
  provider: string;
  provider_ref: string;
  status: string;
  paid_at: string | null;
  created_at: string;
}

export interface BrandingAssets {
  id: string;
  school_id: string;
  logo_url: string | null;
  watermark_url: string | null;
  primary_color: string;
  secondary_color: string;
  report_footer: string | null;
}

// Form validation helpers
export interface ValidationError {
  field: string;
  message: string;
}

export const validateEmail = (email: string): boolean => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

export const validatePhone = (phone: string): boolean => {
  return /^[+]?[\d\s\-()]{10,15}$/.test(phone);
};

export const validateRequired = (value: string): boolean => {
  return value.trim().length > 0;
};

export const validatePassword = (password: string): string | null => {
  if (password.length < 8) return 'Password must be at least 8 characters';
  if (!/[A-Z]/.test(password)) return 'Password must contain at least one uppercase letter';
  if (!/[0-9]/.test(password)) return 'Password must contain at least one number';
  return null;
};