import React, { useEffect, useState, useRef } from 'react';
import {
  Clock,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  User,
  Shield,
  Loader2,
  ArrowLeft,
} from 'lucide-react';
import { TestItem, StudentAttempt } from '../../types/exam';
import { subscribeToTest, findStudentAttempt } from '../../services/examService';
import { useAuth } from '../../context/AuthContext';

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
  const [currentTest, setCurrentTest] = useState<TestItem>(initialTest);
  const [, setPulseSeconds] = useState(0);

  const onExamStartedRef = useRef(onExamStarted);
  useEffect(() => {
    onExamStartedRef.current = onExamStarted;
  }, [onExamStarted]);

  useEffect(() => {
    let isCancelled = false;

    if (initialTest.status === 'released') {
      onExamStartedRef.current(initialTest);
      return;
    }

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

    if (initialTest.status === 'completed' || initialTest.status === 'result_published') {
      onExit();
      return;
    }

    if (initialTest.status === 'live') {
      onExamStartedRef.current(initialTest);
      return;
    }

    const unsubscribe = subscribeToTest(initialTest.id, (updatedTest) => {
      setCurrentTest(updatedTest);
      if (updatedTest.status === 'live') {
        onExamStartedRef.current(updatedTest);
      } else if (updatedTest.status === 'completed' || updatedTest.status === 'result_published') {
        onExit();
      }
    });

    return () => {
      isCancelled = true;
      unsubscribe();
    };
  }, [initialTest.id, studentName]);

  useEffect(() => {
    const timer = setInterval(() => {
      setPulseSeconds((s) => s + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="min-h-screen bg-surface font-body text-on-surface py-6 px-4 sm:px-6 antialiased">
      <div className="max-w-3xl mx-auto space-y-5">
        {/* Waiting Status Hero Banner */}
        <div className="bg-linear-to-br from-primary via-primary-container to-surface-tint rounded-2xl p-6 text-on-primary shadow-md relative overflow-hidden">
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-white/15 backdrop-blur-xs flex items-center justify-center shrink-0">
                <Loader2 className="w-7 h-7 text-white animate-spin" />
              </div>
              <div>
                <span className="inline-block px-2.5 py-0.5 rounded-md text-[11px] font-headline font-bold tracking-wider uppercase bg-white/20 text-white mb-1">
                  Examination Waiting Room
                </span>
                <h1 className="font-headline text-xl sm:text-2xl font-extrabold tracking-tight leading-tight">
                  Waiting for Exam Controller to Start
                </h1>
                <p className="text-xs sm:text-sm text-on-primary-container mt-0.5">
                  Your screen will transition automatically the moment the session goes live.
                </p>
              </div>
            </div>

            <div className="self-start sm:self-center bg-white/15 backdrop-blur-xs px-3.5 py-2 rounded-xl text-center border border-white/15 shrink-0">
              <span className="text-[10px] uppercase tracking-wider text-on-primary-container block font-bold">
                Status
              </span>
              <span className="font-headline text-xs font-bold text-white flex items-center gap-1.5 mt-0.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Connected</span>
              </span>
            </div>
          </div>
        </div>

        {/* Candidate & Test Details Card */}
        <div className="bg-surface-container-lowest rounded-2xl shadow-2xs border border-outline-variant/20 overflow-hidden">
          <div className="bg-surface-container-low px-5 py-3.5 border-b border-outline-variant/15 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-primary" />
              <h2 className="font-headline text-xs font-bold text-on-surface uppercase tracking-wider">
                Candidate &amp; Test Info
              </h2>
            </div>
            <span className="text-[11px] font-headline font-bold px-2.5 py-0.5 bg-primary-fixed text-on-primary-fixed rounded-md">
              {currentTest.examCategory}
            </span>
          </div>

          <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="bg-surface-container-low p-3.5 rounded-xl">
              <span className="text-on-surface-variant block text-[11px]">Candidate Name</span>
              <span className="font-headline text-sm font-bold text-on-surface mt-0.5 block">
                {studentName || user?.name || 'Candidate'}
              </span>
            </div>

            <div className="bg-surface-container-low p-3.5 rounded-xl">
              <span className="text-on-surface-variant block text-[11px]">Candidate Email</span>
              <span className="font-headline text-sm font-bold text-on-surface truncate block mt-0.5">
                {user?.email || 'Verified Candidate'}
              </span>
            </div>

            <div className="bg-surface-container-low p-3.5 rounded-xl sm:col-span-2">
              <span className="text-on-surface-variant block text-[11px]">Examination Paper</span>
              <span className="font-headline text-base font-bold text-on-surface mt-0.5 block">
                {currentTest.title}
              </span>
            </div>

            <div className="bg-surface-container-low p-3.5 rounded-xl">
              <div className="flex items-center gap-1.5 text-on-surface-variant text-[11px] mb-0.5">
                <Calendar className="w-3.5 h-3.5 text-primary" />
                <span>Scheduled Window</span>
              </div>
              <span className="font-headline text-xs font-bold text-on-surface tabular-nums">
                {currentTest.startDate || 'Today'} &bull; {currentTest.startTime || 'Live Session'}
              </span>
            </div>

            <div className="bg-surface-container-low p-3.5 rounded-xl">
              <div className="flex items-center gap-1.5 text-on-surface-variant text-[11px] mb-0.5">
                <Clock className="w-3.5 h-3.5 text-primary" />
                <span>Test Duration</span>
              </div>
              <span className="font-headline text-xs font-bold text-on-surface tabular-nums">
                {currentTest.durationMinutes} Minutes
              </span>
            </div>
          </div>
        </div>

        {/* Marking Scheme Bento Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 tabular-nums">
          <div className="bg-surface-container-lowest p-4 rounded-xl border border-outline-variant/20 text-center">
            <span className="text-[11px] font-medium text-on-surface-variant block">
              Questions
            </span>
            <span className="font-headline text-2xl font-extrabold text-on-surface">
              {currentTest.totalQuestions}
            </span>
          </div>

          <div className="bg-emerald-50/70 p-4 rounded-xl border border-emerald-200 text-center">
            <span className="text-[11px] font-medium text-emerald-700 block">Correct Answer</span>
            <span className="font-headline text-2xl font-extrabold text-emerald-700">
              +{currentTest.marksPerQuestion}
            </span>
          </div>

          <div className="bg-error-container/30 p-4 rounded-xl border border-error/20 text-center">
            <span className="text-[11px] font-medium text-error block">Wrong Answer</span>
            <span className="font-headline text-2xl font-extrabold text-error">
              -{currentTest.negativeMarks}
            </span>
          </div>

          <div className="bg-surface-container-lowest p-4 rounded-xl border border-outline-variant/20 text-center">
            <span className="text-[11px] font-medium text-on-surface-variant block">
              Unattempted
            </span>
            <span className="font-headline text-2xl font-extrabold text-on-surface">0</span>
          </div>
        </div>

        {/* Important Instructions Card */}
        <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/20 p-5 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-outline-variant/15">
            <Shield className="w-5 h-5 text-primary" />
            <h3 className="font-headline font-bold text-sm sm:text-base text-on-surface">
              Important Examination Rules &amp; Instructions
            </h3>
          </div>

          <ul className="space-y-2.5 text-xs sm:text-sm text-on-surface-variant">
            <li className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>
                <strong className="text-on-surface">Single-Question Focus:</strong> Navigate
                smoothly using Prev, Save &amp; Next, and the slide-up Question Palette.
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>
                <strong className="text-on-surface">Marking Scheme:</strong> +{currentTest.marksPerQuestion}{' '}
                for each correct answer and -{currentTest.negativeMarks} for each wrong response.
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-tertiary shrink-0 mt-0.5" />
              <span>
                <strong className="text-on-surface">Proctoring Active:</strong> Switching tabs or
                minimizing the examination window is logged automatically.
              </span>
            </li>
          </ul>
        </div>

        {/* Bottom Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-1">
          <button
            type="button"
            onClick={onExit}
            className="inline-flex items-center gap-1.5 text-xs font-headline font-bold text-on-surface-variant hover:text-on-surface cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Leave Waiting Room</span>
          </button>

          <div className="flex items-center gap-2 text-xs font-headline font-bold text-on-primary-fixed bg-primary-fixed px-4 py-2 rounded-xl">
            <span className="w-2 h-2 rounded-full bg-primary animate-ping" />
            <span>Standing by for Exam Controller to start...</span>
          </div>
        </div>
      </div>
    </div>
  );
};
