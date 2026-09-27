export type UserRole = 'student' | 'admin';

export interface JoinedExamRecord {
  testId: string;
  testTitle: string;
  accessCode?: string;
  joinedAt: string;
  status: 'waiting' | 'in_progress' | 'submitted' | 'auto_submitted';
  score?: number;
  percentage?: number;
  submittedAt?: string;
}

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  phone?: string;
  role: UserRole;
  photoUrl?: string;
  isBlocked?: boolean;
  registrationType?: 'registered' | 'direct_exam_join' | 'guest';
  isRegistered?: boolean;
  hasJoined?: boolean;
  joinedAt?: string;
  registeredAt?: string;
  createdAt?: string;
  lastLogin?: string;
  lastActive?: string;
  totalExamsJoined?: number;
  totalExamsSubmitted?: number;
  joinedExams?: JoinedExamRecord[];
}

export interface TestSeries {
  id: string;
  title: string;
  description: string;
  category: string; // e.g. MP Police, MP SI, SSC, General Knowledge
  status: 'active' | 'inactive' | 'scheduled';
  startDate?: string;
  startTime?: string;
  imageUrl?: string;
  createdAt: string;
  updatedAt?: string;
}

export type TestStatus = 'draft' | 'published' | 'scheduled' | 'waiting' | 'live' | 'completed' | 'result_published' | 'released';

export interface TestItem {
  id: string;
  seriesId: string;
  seriesTitle?: string;
  title: string;
  description: string;
  examCategory: string;
  subject?: string;
  syllabus?: string;
  instructions?: string;
  totalQuestions: number;
  durationMinutes: number;
  startDate?: string;
  startTime?: string;
  endDate?: string;
  marksPerQuestion: number;
  negativeMarks: number;
  passingMarks?: number;
  instantResult: boolean;
  status: TestStatus;
  accessCode: string; // e.g. MPPOLICE01
  accessPassword: string; // e.g. MP2026
  examStartTime?: string; // ISO string when admin clicked Start Exam
  examEndTime?: string; // ISO string when exam expires
  createdAt: string;
  updatedAt?: string;
}

export interface QuestionItem {
  id: string;
  testId: string;
  questionNumber: number;
  questionText: string;
  questionTextHindi?: string;
  options: {
    A: string;
    B: string;
    C: string;
    D: string;
  };
  optionsHindi?: {
    A: string;
    B: string;
    C: string;
    D: string;
  };
  correctAnswer: 'A' | 'B' | 'C' | 'D';
  explanation?: string;
  explanationHindi?: string;
  subject?: string;
  imageUrl?: string;
  createdAt?: string;
}

export type StudentExamStatus = 'waiting' | 'in_progress' | 'submitted' | 'auto_submitted';

export interface ActivityLogEntry {
  timestamp: string;
  event: 'joined_waiting_room' | 'started_exam' | 'tab_hidden' | 'tab_visible' | 'connection_lost' | 'connection_restored' | 'submitted_manual' | 'submitted_auto';
  details?: string;
}

export interface ExamSession {
  id: string; // usually `${testId}_${studentId}`
  testId: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  status: StudentExamStatus;
  joinedAt: string;
  startedAt?: string;
  submittedAt?: string;
  lastHeartbeat?: string;
  tabSwitchCount: number;
  activityLogs: ActivityLogEntry[];
}

export interface StudentAttempt {
  id: string;
  testId: string;
  testTitle: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  attemptNumber?: number;
  answers: Record<string, 'A' | 'B' | 'C' | 'D'>; // questionId -> chosenOption
  visitedQuestionIds?: string[];
  markedForReviewIds?: string[];
  startedAt: string;
  submittedAt: string;
  isAutoSubmitted: boolean;
  totalQuestions: number;
  attemptedCount: number;
  correctCount: number;
  incorrectCount: number;
  unattemptedCount: number;
  positiveMarks: number;
  negativeMarks: number;
  finalScore: number;
  percentage: number;
  accuracy: number;
  status: 'submitted' | 'auto_submitted' | 'evaluated';
  tabSwitchCount: number;
  activityLogs?: ActivityLogEntry[];
}

export interface InstituteSettings {
  instituteName: string;
  tagline: string;
  logoUrl?: string;
  contactEmail?: string;
  contactPhone?: string;
  defaultDurationMinutes: number;
  defaultMarksPerQuestion: number;
  defaultNegativeMarks: number;
  updatedAt?: string;
}

export type QuestionNavStatus = 'answered' | 'not_answered' | 'marked_for_review' | 'marked_and_answered' | 'not_visited';
