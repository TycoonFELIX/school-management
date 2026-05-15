import toast from 'react-hot-toast';

// Universal error handler
export const handleError = (err: unknown, fallback = 'An error occurred') => {
  const message = err instanceof Error ? err.message : fallback;
  toast.error(message);
  console.error(err);
};

// Universal success handler
export const handleSuccess = (message: string) => {
  toast.success(message);
};

// Format date
export const formatDate = (date: string | null | undefined): string => {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
};

// Format date with time
export const formatDateTime = (date: string | null | undefined): string => {
  if (!date) return '—';
  return new Date(date).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
};

// Calculate grade from score
export const calculateGrade = (score: number): string => {
  if (score >= 80) return 'A';
  if (score >= 70) return 'B';
  if (score >= 60) return 'C';
  if (score >= 50) return 'D';
  return 'F';
};

// Grade color
export const gradeColor = (grade: string | null): string => {
  switch (grade) {
    case 'A': return 'text-green-600';
    case 'B': return 'text-blue-600';
    case 'C': return 'text-yellow-600';
    case 'D': return 'text-orange-600';
    case 'F': return 'text-red-600';
    default:  return 'text-gray-400';
  }
};

// Truncate text
export const truncate = (text: string, length = 50): string => {
  return text.length > length ? text.substring(0, length) + '...' : text;
};

// Format file size
export const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
};

// Validate file size (max 50MB)
export const validateFileSize = (file: File, maxMB = 50): boolean => {
  return file.size <= maxMB * 1024 * 1024;
};

// Validate file type
export const validateFileType = (file: File, allowedTypes: string[]): boolean => {
  return allowedTypes.includes(file.type);
};

// Get initials from name
export const getInitials = (firstName: string, lastName: string): string => {
  return `${firstName?.[0] ?? ''}${lastName?.[0] ?? ''}`.toUpperCase();
};

// Days until date
export const daysUntil = (date: string): number => {
  return Math.ceil((new Date(date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
};

// Is date overdue
export const isOverdue = (date: string): boolean => {
  return new Date(date) < new Date();
};

// Allowed file types for uploads
export const ALLOWED_DOCUMENT_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

export const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/svg+xml',
];