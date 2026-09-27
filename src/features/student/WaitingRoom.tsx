import React, { useEffect, useState, useRef } from 'react';
import {
  Clock,
  HelpCircle,
  Award,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  BookOpen,
  User,
  Shield,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { TestItem, StudentAttempt } from '../../types/exam';
import { subscribeToTest, updateSessionStatus, findStudentAttempt } from '../../services/examService';
import { useAuth } from '../../context/AuthContext';
import { useInstitute } from '../../context/InstituteContext';

interface WaitingRoomProps {
  test: TestItem;
  studentName: string;
  onExamStarted: (liveTest: TestItem) => void;
  onViewResult?: (attempt: StudentAttempt) => void;
  onExit: () => void;
}

export const WaitingRoom: React.FC<WaitingRoomProps> = ({
  test: initialTest,
  studentName,
  onExamStarted,
  onViewResult,
  onExit,
}) => {
  const { user } = useAuth();
  const { settings } = useInstitute();
  const [currentTest, setCurrentTest] = useState<TestItem>(initialTest);
  const [pulseSeconds, setPulseSeconds] = useState(0);

  const onExamStartedRef = useRef(onExamStarted);
  useEffect(() => {
    onExamStartedRef.current = onExamStarted;
  }, [onExamStarted]);

  // Real-time synchronization with Cloud Firestore, BroadcastChannel, and Storage events
  useEffect(() => {
    let isCancelled = false;

    // If test is released for open practice and reattempts, transition immediately!
    if (initialTest.status === 'released') {
      onExamStartedRef.current(initialTest);
      return;
    }

    // Check if student has already submitted this test (for regular single-attempt live exams)
    const candidateUid =
      user?.uid ||
      (typeof window !== 'undefined' ? localStorage.getItem('pariksha_candidate_uid') || '' : '');
    findStudentAttempt(initialTest.id, studentName, candidateUid).then((attempt) => {
      if (attempt && !isCancelled && initialTest.status !== 'released') {
        if (onViewResult) {
          onViewResult(attempt);
        } else {
          onExit();
        }
      }
    });

    // If test is completed/ended, immediately exit waiting room!
    if (initialTest.status === 'completed' || initialTest.status === 'result_published') {
      onExit();
      return;
    }

    // If test is already live, immediately transition!
    if (initialTest.status === 'live') {
      onExamStartedRef.current(initialTest);
      return;
    }

    const unsubscribe = subscribeToTest(initialTest.id, (updatedTest) => {
      setCurrentTest(updatedTest);
      if (updatedTest.status === 'live') {
        // Automatic transition to live examination screen without refreshing
        onExamStartedRef.current(updatedTest);
      } else if (updatedTest.status === 'completed' || updatedTest.status === 'result_published') {
        // Exam ended by admin
        onExit();
      }
    });

    return () => {
      isCancelled = true;
      unsubscribe();
    };
  }, [initialTest.id, studentName]);

  // Keep heartbeat alive in waiting room
  useEffect(() => {
    const timer = setInterval(() => {
      setPulseSeconds((s) => s + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="min-h-screen bg-slate-100 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Waiting Status Banner */}
        <div className="bg-linear-to-r from-amber-500 via-orange-500 to-amber-600 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-xs flex items-center justify-center shrink-0">
                <Loader2 className="w-8 h-8 text-white animate-spin" />
              </div>
              <div>
                <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-bold tracking-wide uppercase bg-white/20 text-white mb-1">
                  Examination Waiting Room
                </span>
                <h1 className="text-xl sm:text-2xl font-black tracking-tight leading-tight">
                  WAITING FOR EXAMINATION TO START
                </h1>
                <p className="text-sm text-amber-100 mt-0.5">
                  The examination will start automatically when the exam controller initiates it. Do not refresh.
                </p>
              </div>
            </div>

            <div className="self-start sm:self-center bg-black/20 backdrop-blur-xs px-3.5 py-2 rounded-xl text-center border border-white/10 shrink-0">
              <span className="text-[11px] uppercase tracking-wider text-amber-200 block">Status</span>
              <span className="text-xs sm:text-sm font-bold text-white flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                Connected
              </span>
            </div>
          </div>
        </div>

        {/* Candidate & Test Details Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <User className="w-5 h-5 text-indigo-600" />
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Candidate & Test Info</h2>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-full border border-indigo-200">
              {currentTest.examCategory}
            </span>
          </div>

          <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
              <span className="text-xs font-medium text-slate-500 block">Candidate Name</span>
              <span className="text-base font-bold text-slate-900">{studentName || user?.name || 'Candidate'}</span>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
              <span className="text-xs font-medium text-slate-500 block">Candidate Email</span>
              <span className="text-base font-semibold text-slate-800 truncate block">
                {user?.email || 'Registered Candidate'}
              </span>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 sm:col-span-2">
              <span className="text-xs font-medium text-slate-500 block">Test Name</span>
              <span className="text-base font-bold text-slate-900">{currentTest.title}</span>
              {currentTest.seriesTitle && (
                <span className="text-xs text-indigo-600 font-medium block mt-0.5">
                  Series: {currentTest.seriesTitle}
                </span>
              )}
            </div>

            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
              <div className="flex items-center gap-2 text-slate-500 text-xs font-medium mb-1">
                <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                <span>Scheduled Date & Time</span>
              </div>
              <span className="text-sm font-bold text-slate-900">
                {currentTest.startDate || 'Today'} &bull; {currentTest.startTime || 'Scheduled'}
              </span>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
              <div className="flex items-center gap-2 text-slate-500 text-xs font-medium mb-1">
                <Clock className="w-3.5 h-3.5 text-indigo-600" />
                <span>Test Duration</span>
              </div>
              <span className="text-sm font-bold text-slate-900">{currentTest.durationMinutes} Minutes</span>
            </div>
          </div>
        </div>

        {/* Examination Marking Scheme Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white p-4 rounded-xl border border-slate-200 text-center shadow-xs">
            <span className="text-xs font-medium text-slate-500 block">Total Questions</span>
            <span className="text-2xl font-black text-slate-900">{currentTest.totalQuestions}</span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-emerald-200 bg-emerald-50/30 text-center shadow-xs">
            <span className="text-xs font-medium text-emerald-700 block">Correct Answer</span>
            <span className="text-2xl font-black text-emerald-700">+{currentTest.marksPerQuestion}</span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-red-200 bg-red-50/30 text-center shadow-xs">
            <span className="text-xs font-medium text-red-700 block">Wrong Answer</span>
            <span className="text-2xl font-black text-red-700">-{currentTest.negativeMarks}</span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 text-center shadow-xs">
            <span className="text-xs font-medium text-slate-500 block">Unattempted</span>
            <span className="text-2xl font-black text-slate-600">0</span>
          </div>
        </div>

        {/* Important Instructions Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-200">
            <Shield className="w-5 h-5 text-indigo-600" />
            <h3 className="font-bold text-base text-slate-900">Important Examination Rules & Instructions</h3>
          </div>

          <ul className="space-y-2.5 text-xs sm:text-sm text-slate-700">
            <li className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>
                <strong>One Question at a Time:</strong> Only one question will appear on your screen. You can navigate freely using Previous and Save & Next buttons.
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>
                <strong>Negative Marking:</strong> Each correct response awards +{currentTest.marksPerQuestion} mark. An incorrect response will deduct {currentTest.negativeMarks} marks.
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>
                <strong>Server-Synchronized Timer:</strong> The countdown timer is strictly synchronized with the examination server. If time runs out, your examination will be submitted automatically.
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>
                <strong>Anti-Cheating Policy:</strong> Switching browser tabs, minimizing the window or reloading is monitored and recorded in your examination activity log.
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>
                <strong>Offline Protection:</strong> In case of temporary internet drops, your answers remain saved on your device and will synchronize once your connection resumes.
              </span>
            </li>
          </ul>

          {currentTest.instructions && (
            <div className="mt-4 p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 whitespace-pre-line">
              <span className="font-semibold text-slate-800 block mb-1">Additional Institute Instructions:</span>
              {currentTest.instructions}
            </div>
          )}

          {currentTest.syllabus && (
            <div className="mt-2 p-3.5 bg-indigo-50/60 rounded-xl border border-indigo-100 text-xs text-indigo-900">
              <span className="font-bold text-indigo-950 block mb-0.5">Syllabus Covered:</span>
              {currentTest.syllabus}
            </div>
          )}
        </div>

        {/* Waiting Actions & Exit */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
          <button
            type="button"
            onClick={onExit}
            className="text-xs text-slate-500 hover:text-slate-700 underline font-medium cursor-pointer"
          >
            Leave Waiting Room
          </button>

          <div className="flex items-center gap-2 text-xs font-semibold text-amber-700 bg-amber-50 px-4 py-2 rounded-xl border border-amber-200">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
            <span>Standing by for Exam Controller to start...</span>
          </div>
        </div>
      </div>
    </div>
  );
};
