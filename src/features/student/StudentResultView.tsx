import React, { useEffect, useState, useMemo } from 'react';
import {
  Award,
  CheckCircle2,
  Clock,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  FileText,
  AlertCircle,
  Shield,
  Printer,
  RotateCw,
  Sparkles,
  Lock,
  XCircle,
  MinusCircle,
  Bookmark,
  ListFilter,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  LayoutGrid,
} from 'lucide-react';
import { StudentAttempt, TestItem, QuestionItem } from '../../types/exam';
import {
  getTestById,
  getQuestionsForTest,
  subscribeToTest,
  getAllStudentAttemptsForTest,
} from '../../services/examService';

interface StudentResultViewProps {
  attempt: StudentAttempt;
  onBackToPortal: () => void;
  onReattempt?: (test: TestItem) => void;
}

export const StudentResultView: React.FC<StudentResultViewProps> = ({
  attempt,
  onBackToPortal,
  onReattempt,
}) => {
  const [test, setTest] = useState<TestItem | null>(null);
  const [questions, setQuestions] = useState<QuestionItem[]>([]);
  const [activeFilter, setActiveFilter] = useState<'all' | 'correct' | 'incorrect' | 'unattempted' | 'marked'>('all');
  const [selectedQuestionId, setSelectedQuestionId] = useState<string>('');
  const [isMobilePaletteOpen, setIsMobilePaletteOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [allAttempts, setAllAttempts] = useState<StudentAttempt[]>([attempt]);
  const [selectedAttemptId, setSelectedAttemptId] = useState<string>(attempt.id);

  // Load test data, all student attempts, & questions
  const loadData = async (isManualRefresh = false) => {
    if (isManualRefresh) setIsRefreshing(true);
    try {
      const [t, atts] = await Promise.all([
        getTestById(attempt.testId),
        getAllStudentAttemptsForTest(attempt.testId, attempt.studentId, attempt.studentName),
      ]);
      setTest(t);

      if (atts && atts.length > 0) {
        setAllAttempts(atts);
        if (!atts.some((a) => a.id === selectedAttemptId)) {
          setSelectedAttemptId(atts[atts.length - 1].id);
        }
      }

      const isPublished =
        Boolean(t?.instantResult) ||
        t?.status === 'completed' ||
        t?.status === 'result_published' ||
        t?.status === 'released';

      if (isPublished) {
        const qList = await getQuestionsForTest(attempt.testId, 'admin');
        setQuestions(qList);
        if (qList.length > 0) {
          setSelectedQuestionId((prev) => prev || qList[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to load result test data:', err);
    } finally {
      setLoading(false);
      if (isManualRefresh) setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();

    // Subscribe to real-time test updates (when admin clicks "End Exam" or "Publish Results", auto-refresh instantly!)
    const unsubscribe = subscribeToTest(attempt.testId, (updatedTest) => {
      setTest(updatedTest);
      const isPublished =
        Boolean(updatedTest?.instantResult) ||
        updatedTest?.status === 'completed' ||
        updatedTest?.status === 'result_published' ||
        updatedTest?.status === 'released';

      if (isPublished) {
        getQuestionsForTest(attempt.testId, 'admin').then((qList) => {
          setQuestions(qList);
          if (qList.length > 0) {
            setSelectedQuestionId((prev) => prev || qList[0].id);
          }
        });
      }
    });

    return () => unsubscribe();
  }, [attempt.testId]);

  // Current active attempt to inspect
  const currentAttempt = allAttempts.find((a) => a.id === selectedAttemptId) || attempt;

  // Exact rule: Result is published if Admin set instantResult: true OR ended/published exam OR test is released for open practice
  const isResultPublished =
    Boolean(test?.instantResult) ||
    test?.status === 'completed' ||
    test?.status === 'result_published' ||
    test?.status === 'released';

  const answers = currentAttempt.answers || {};
  const totalQuestions = currentAttempt.totalQuestions || questions.length || 1;
  const attemptedCount = currentAttempt.attemptedCount ?? 0;
  const correctCount = currentAttempt.correctCount ?? 0;
  const incorrectCount = currentAttempt.incorrectCount ?? 0;
  const unattemptedCount = currentAttempt.unattemptedCount ?? Math.max(0, totalQuestions - attemptedCount);
  const posMarks = currentAttempt.positiveMarks ?? (test?.marksPerQuestion ?? 1);
  const negMarks = currentAttempt.negativeMarks ?? (test?.negativeMarks ?? 0.25);
  const maxPossibleMarks = totalQuestions * posMarks;
  const finalScore = currentAttempt.finalScore ?? 0;
  const percentage =
    currentAttempt.percentage ??
    (maxPossibleMarks > 0 ? Number(((finalScore / maxPossibleMarks) * 100).toFixed(1)) : 0);
  const accuracy =
    currentAttempt.accuracy ??
    (attemptedCount > 0
      ? Number(((correctCount / attemptedCount) * 100).toFixed(1))
      : 0);

  const markedForReviewIds = currentAttempt.markedForReviewIds || [];
  const markedIdsSet = useMemo(() => new Set(markedForReviewIds), [markedForReviewIds]);
  const markedForReviewCount = markedForReviewIds.length;

  // Filtered questions based on activeFilter
  const filteredQuestions = useMemo(() => {
    return questions.filter((q) => {
      const studentAns = answers[q.id];
      const isAttempted = Boolean(studentAns);
      const isCorrect = studentAns === q.correctAnswer;
      const isMarked = markedIdsSet.has(q.id);

      if (activeFilter === 'correct') return isAttempted && isCorrect;
      if (activeFilter === 'incorrect') return isAttempted && !isCorrect;
      if (activeFilter === 'unattempted') return !isAttempted;
      if (activeFilter === 'marked') return isMarked;
      return true; // 'all'
    });
  }, [questions, answers, activeFilter, markedIdsSet]);

  // Current selected question within filteredQuestions
  const currentQuestion = useMemo(() => {
    if (filteredQuestions.length === 0) return null;
    const found = filteredQuestions.find((q) => q.id === selectedQuestionId);
    return found || filteredQuestions[0];
  }, [filteredQuestions, selectedQuestionId]);

  const currentFilteredIndex = currentQuestion
    ? filteredQuestions.findIndex((q) => q.id === currentQuestion.id)
    : -1;

  const actualOverallIndex = currentQuestion
    ? questions.findIndex((q) => q.id === currentQuestion.id)
    : -1;

  const displayQNum = currentQuestion?.questionNumber || (actualOverallIndex >= 0 ? actualOverallIndex + 1 : 1);

  // Time metrics if available from attempt timestamps
  const totalTimeTakenFormatted = useMemo(() => {
    if (currentAttempt.startedAt && currentAttempt.submittedAt) {
      const start = new Date(currentAttempt.startedAt).getTime();
      const end = new Date(currentAttempt.submittedAt).getTime();
      const diffSec = Math.max(0, Math.round((end - start) / 1000));
      const mins = Math.floor(diffSec / 60);
      const secs = diffSec % 60;
      if (mins > 0) return `${mins}m ${secs}s`;
      return `${secs}s`;
    }
    return null;
  }, [currentAttempt.startedAt, currentAttempt.submittedAt]);

  const avgTimePerQuestion = useMemo(() => {
    if (currentAttempt.startedAt && currentAttempt.submittedAt && totalQuestions > 0) {
      const start = new Date(currentAttempt.startedAt).getTime();
      const end = new Date(currentAttempt.submittedAt).getTime();
      const diffSec = Math.max(0, Math.round((end - start) / 1000));
      const avg = Math.round(diffSec / totalQuestions);
      return `${avg} sec`;
    }
    return null;
  }, [currentAttempt.startedAt, currentAttempt.submittedAt, totalQuestions]);

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="text-center space-y-3 bg-white p-8 rounded-2xl border border-slate-200 shadow-sm max-w-sm w-full">
          <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <h3 className="text-base font-bold text-slate-900">Loading Examination Status</h3>
          <p className="text-xs text-slate-500">Checking evaluation status from institute server...</p>
        </div>
      </div>
    );
  }

  const handleFilterChange = (filter: 'all' | 'correct' | 'incorrect' | 'unattempted' | 'marked') => {
    setActiveFilter(filter);
    const matches = questions.filter((q) => {
      const studentAns = answers[q.id];
      const isAttempted = Boolean(studentAns);
      const isCorrect = studentAns === q.correctAnswer;
      const isMarked = markedIdsSet.has(q.id);

      if (filter === 'correct') return isAttempted && isCorrect;
      if (filter === 'incorrect') return isAttempted && !isCorrect;
      if (filter === 'unattempted') return !isAttempted;
      if (filter === 'marked') return isMarked;
      return true;
    });
    if (matches.length > 0) {
      if (!matches.some((q) => q.id === selectedQuestionId)) {
        setSelectedQuestionId(matches[0].id);
      }
    }
  };

  const handlePrevQuestion = () => {
    if (currentFilteredIndex > 0) {
      setSelectedQuestionId(filteredQuestions[currentFilteredIndex - 1].id);
    }
  };

  const handleNextQuestion = () => {
    if (currentFilteredIndex >= 0 && currentFilteredIndex < filteredQuestions.length - 1) {
      setSelectedQuestionId(filteredQuestions[currentFilteredIndex + 1].id);
    }
  };

  const handleSelectQuestion = (qId: string) => {
    setSelectedQuestionId(qId);
    setIsMobilePaletteOpen(false);
  };

  return (
    <div className="min-h-screen bg-slate-100 py-8 px-4 sm:px-6 lg:px-8 print:bg-white print:p-0">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Navigation & Action Bar */}
        <div className="flex items-center justify-between print:hidden">
          <button
            onClick={onBackToPortal}
            className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-slate-700 hover:text-slate-900 bg-white px-3.5 py-2 rounded-xl border border-slate-200 shadow-xs cursor-pointer transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Portal</span>
          </button>

          <div className="flex items-center gap-2">
            {test?.status === 'released' && onReattempt && (
              <button
                onClick={() => onReattempt(test)}
                className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-white bg-linear-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 px-3.5 py-2 rounded-xl border border-emerald-500 cursor-pointer transition-all shadow-xs"
              >
                <RotateCw className="w-4 h-4" />
                <span>Reattempt Exam</span>
              </button>
            )}

            {!isResultPublished && (
              <button
                onClick={() => loadData(true)}
                disabled={isRefreshing}
                className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-amber-800 bg-amber-100 hover:bg-amber-200 px-3.5 py-2 rounded-xl border border-amber-300 cursor-pointer transition-colors shadow-xs disabled:opacity-50"
              >
                <RotateCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                <span>{isRefreshing ? 'Checking...' : 'Check Status'}</span>
              </button>
            )}

            {isResultPublished && (
              <button
                onClick={handlePrint}
                className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-3.5 py-2 rounded-xl border border-indigo-200 cursor-pointer transition-colors shadow-xs"
              >
                <Printer className="w-4 h-4" />
                <span>Print Scorecard</span>
              </button>
            )}
          </div>
        </div>

        {/* Attempt History Switcher (When student has multiple attempts or for released tests) */}
        {(allAttempts.length > 1 || test?.status === 'released') && (
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3 print:hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Award className="w-4 h-4 text-indigo-600" />
                <span>All Attempts History ({allAttempts.length} Total)</span>
              </span>
              <span className="text-[11px] text-slate-500">
                Switch attempt to view scorecard & questions review anytime
              </span>
            </div>

            <div className="flex flex-wrap gap-2">
              {allAttempts.map((att, idx) => {
                const isSelected = att.id === currentAttempt.id;
                const isLatest = idx === allAttempts.length - 1;
                return (
                  <button
                    key={att.id}
                    onClick={() => setSelectedAttemptId(att.id)}
                    className={`px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                      isSelected
                        ? 'bg-indigo-600 text-white shadow-sm ring-2 ring-indigo-300'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
                    }`}
                  >
                    <span>Attempt #{att.attemptNumber || idx + 1}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-bold ${
                        isSelected ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-800'
                      }`}
                    >
                      {att.finalScore} Marks ({att.percentage}%)
                    </span>
                    {isLatest && (
                      <span
                        className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded ${
                          isSelected ? 'bg-emerald-400 text-slate-900' : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        Latest
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* -------------------------------------------------------------
            CASE 1: AWAITING RESULT (When admin has NOT ended exam yet & instantResult is OFF)
            ------------------------------------------------------------- */}
        {!isResultPublished ? (
          <div className="space-y-6">
            {/* Status Card */}
            <div className="bg-white rounded-3xl p-6 sm:p-10 shadow-sm border border-amber-200/90 text-center space-y-4">
              <div className="w-20 h-20 rounded-full bg-amber-100 text-amber-600 mx-auto flex items-center justify-center shadow-inner relative">
                <Clock className="w-10 h-10 animate-pulse" />
                <span className="absolute -bottom-1 -right-1 p-1 bg-amber-500 rounded-full text-white">
                  <Lock className="w-3.5 h-3.5" />
                </span>
              </div>

              <div className="space-y-1">
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-300">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Result Awaited</span>
                </span>
                <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight pt-2">
                  Examination Submitted Successfully
                </h1>
                <p className="text-sm font-semibold text-slate-600">
                  Your responses have been recorded securely.
                </p>
              </div>

              {/* Informative Notice Box */}
              <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-4 sm:p-5 text-left space-y-2 max-w-xl mx-auto">
                <div className="flex items-start gap-2.5">
                  <AlertCircle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                  <div className="space-y-1 text-xs text-amber-900 leading-relaxed">
                    <p className="font-bold text-amber-950 text-sm">
                      Result Publication Notice:
                    </p>
                    <p>
                      Your exam response sheet has been recorded successfully. Once the exam administrator ends the session, your official scorecard and solutions will be published.
                    </p>
                    <p className="text-[11px] text-amber-800 pt-1">
                      (As per examination guidelines, results are withheld while the session is underway and will unlock automatically once the administrator ends the exam.)
                    </p>
                  </div>
                </div>
              </div>

              {/* Real-time sync badge */}
              <div className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-700 bg-emerald-50 px-3.5 py-1.5 rounded-full border border-emerald-200">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                <span>Real-time Live Sync: Score will reveal automatically when exam ends</span>
              </div>
            </div>

            {/* Official Submission Slip */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <div className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-indigo-600" />
                  <h3 className="font-bold text-sm sm:text-base text-slate-900">
                    Candidate Submission Slip
                  </h3>
                </div>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                  Receipt Verified
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
                  <span className="text-slate-400 block uppercase tracking-wider text-[10px] font-bold">
                    Candidate Name
                  </span>
                  <span className="font-bold text-slate-900 text-sm">{attempt.studentName}</span>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
                  <span className="text-slate-400 block uppercase tracking-wider text-[10px] font-bold">
                    Candidate ID
                  </span>
                  <span className="font-mono font-bold text-slate-900 text-sm">{attempt.studentId}</span>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
                  <span className="text-slate-400 block uppercase tracking-wider text-[10px] font-bold">
                    Exam Paper
                  </span>
                  <span className="font-bold text-slate-900 text-sm">{attempt.testTitle}</span>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
                  <span className="text-slate-400 block uppercase tracking-wider text-[10px] font-bold">
                    Submission Time
                  </span>
                  <span className="font-semibold text-slate-800 text-sm">
                    {attempt.submittedAt ? new Date(attempt.submittedAt).toLocaleString() : 'Recorded'}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
                  <span className="text-slate-400 block uppercase tracking-wider text-[10px] font-bold">
                    Attempted Questions
                  </span>
                  <span className="font-bold text-slate-900 text-sm">
                    {attempt.attemptedCount} / {totalQuestions} Questions
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
                  <span className="text-slate-400 block uppercase tracking-wider text-[10px] font-bold">
                    Status
                  </span>
                  <span className="font-bold text-amber-700 text-sm flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Awaiting Admin End Exam Trigger</span>
                  </span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* -------------------------------------------------------------
             CASE 2: RESULT PUBLISHED (Admin ended exam OR instantResult is true)
             ------------------------------------------------------------- */
          <div className="space-y-6">
            {/* Status Confirmation Banner */}
            <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-slate-200 text-center space-y-3">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center shadow-xs">
                <CheckCircle2 className="w-9 h-9" />
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                Examination Scorecard & Result
              </h1>
              <p className="text-xs sm:text-sm text-slate-700 max-w-md mx-auto">
                Candidate: <strong className="text-slate-900">{currentAttempt.studentName}</strong> &bull; Paper:{' '}
                <strong className="text-slate-900">{currentAttempt.testTitle}</strong>
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2 text-[11px] text-slate-500 pt-1">
                <span>
                  Submission: {currentAttempt.submittedAt ? new Date(currentAttempt.submittedAt).toLocaleString() : 'Recorded'}
                </span>
                <span>&bull;</span>
                <span className="px-2 py-0.5 rounded font-mono font-bold bg-slate-100 text-slate-800">
                  Attempt #{currentAttempt.attemptNumber || 1}
                </span>
                <span>&bull;</span>
                <span className="px-2.5 py-0.5 rounded-full font-bold bg-emerald-100 text-emerald-800">
                  {test?.instantResult ? 'Instant Result Published' : 'Exam Ended by Admin - Result Published'}
                </span>
              </div>
            </div>

            {/* Scorecard Hero Banner */}
            <div className="bg-linear-to-br from-indigo-800 via-indigo-900 to-slate-900 rounded-2xl p-6 sm:p-8 text-white shadow-lg space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-6">
                <div>
                  <span className="text-xs font-semibold tracking-wider uppercase text-indigo-300 block">
                    Candidate Scorecard & Rank Evaluation &bull; Attempt #{currentAttempt.attemptNumber || 1}
                  </span>
                  <h2 className="text-2xl font-black mt-0.5">{currentAttempt.testTitle}</h2>
                  <div className="text-xs text-indigo-200 mt-1">
                    Candidate ID: <span className="font-mono">{currentAttempt.studentId}</span>
                  </div>
                </div>
                <div className="text-left sm:text-right bg-white/10 sm:bg-transparent p-4 sm:p-0 rounded-xl sm:rounded-none">
                  <span className="text-xs text-indigo-200 block uppercase font-bold tracking-wider">
                    Total Score
                  </span>
                  <span className="text-4xl font-black text-amber-300">{finalScore}</span>
                  <span className="text-xs text-indigo-200 block mt-0.5">
                    / {maxPossibleMarks} Maximum Marks
                  </span>
                </div>
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <div className="bg-white/10 backdrop-blur-xs p-3.5 rounded-xl border border-white/10">
                  <span className="text-[11px] uppercase tracking-wider text-indigo-200 block">Percentage</span>
                  <span className="text-xl sm:text-2xl font-black">{percentage}%</span>
                </div>

                <div className="bg-white/10 backdrop-blur-xs p-3.5 rounded-xl border border-white/10">
                  <span className="text-[11px] uppercase tracking-wider text-indigo-200 block">Accuracy</span>
                  <span className="text-xl sm:text-2xl font-black">{accuracy}%</span>
                </div>

                <div className="bg-white/10 backdrop-blur-xs p-3.5 rounded-xl border border-white/10">
                  <span className="text-[11px] uppercase tracking-wider text-emerald-300 block">
                    Correct (+{posMarks})
                  </span>
                  <span className="text-xl sm:text-2xl font-black text-emerald-300">{currentAttempt.correctCount}</span>
                </div>

                <div className="bg-white/10 backdrop-blur-xs p-3.5 rounded-xl border border-white/10">
                  <span className="text-[11px] uppercase tracking-wider text-rose-300 block">
                    Wrong (-{negMarks})
                  </span>
                  <span className="text-xl sm:text-2xl font-black text-rose-300">{currentAttempt.incorrectCount}</span>
                </div>
              </div>

              {/* Breakdown summary bar */}
              <div className="pt-2 border-t border-white/10 flex flex-wrap items-center justify-between text-xs text-indigo-200">
                <div>
                  Total Questions: <strong>{totalQuestions}</strong>
                </div>
                <div>
                  Attempted: <strong>{currentAttempt.attemptedCount}</strong>
                </div>
                <div>
                  Unattempted: <strong>{currentAttempt.unattemptedCount}</strong>
                </div>
                {currentAttempt.tabSwitchCount && currentAttempt.tabSwitchCount > 0 ? (
                  <div className="text-amber-300">
                    Tab Switches Detected: <strong>{currentAttempt.tabSwitchCount}</strong>
                  </div>
                ) : null}
              </div>
            </div>

            {/* Testbook-style Answer Key / Review Interface */}
            {questions.length > 0 ? (
              <div className="space-y-4">
                {/* Compact Result Overview Bar */}
                <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-xs border border-slate-200">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="font-extrabold text-sm sm:text-base text-slate-900 leading-tight">
                          Solutions & Answer Review
                        </h3>
                        <p className="text-[11px] text-slate-500">
                          Detailed answer analysis with official keys and full explanations
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 self-start sm:self-auto">
                      <span className="text-[11px] font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg">
                        Score: <span className="text-indigo-600 font-extrabold">{finalScore}</span>/{maxPossibleMarks}
                      </span>
                      <span className="text-[11px] font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg">
                        Accuracy: <span className="text-emerald-600 font-extrabold">{accuracy}%</span>
                      </span>
                    </div>
                  </div>

                  {/* Summary metric chips */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-3">
                    <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-2.5 text-center">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Total</span>
                      <span className="text-base font-black text-slate-800">{totalQuestions}</span>
                    </div>
                    <div className="bg-blue-50/70 border border-blue-200/80 rounded-xl p-2.5 text-center">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 block">Attempted</span>
                      <span className="text-base font-black text-blue-800">{attemptedCount}</span>
                    </div>
                    <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-xl p-2.5 text-center">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block">Correct (+{posMarks})</span>
                      <span className="text-base font-black text-emerald-700">{correctCount}</span>
                    </div>
                    <div className="bg-rose-50/70 border border-rose-200/80 rounded-xl p-2.5 text-center">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700 block">Incorrect (-{negMarks})</span>
                      <span className="text-base font-black text-rose-700">{incorrectCount}</span>
                    </div>
                    <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-2.5 text-center col-span-2 sm:col-span-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 block">Unattempted</span>
                      <span className="text-base font-black text-amber-800">{unattemptedCount}</span>
                    </div>
                  </div>
                </div>

                {/* Filter Bar (Testbook Style Tabs) */}
                <div className="bg-white rounded-2xl p-2 shadow-xs border border-slate-200">
                  <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar scroll-smooth">
                    <button
                      type="button"
                      onClick={() => handleFilterChange('all')}
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 shrink-0 cursor-pointer ${
                        activeFilter === 'all'
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/80'
                      }`}
                    >
                      <ListFilter className="w-3.5 h-3.5" />
                      <span>All Questions</span>
                      <span
                        className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-full ${
                          activeFilter === 'all' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {totalQuestions}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleFilterChange('correct')}
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 shrink-0 cursor-pointer ${
                        activeFilter === 'correct'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-emerald-50/60 hover:bg-emerald-100/70 text-emerald-800 border border-emerald-200/70'
                      }`}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Correct</span>
                      <span
                        className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-full ${
                          activeFilter === 'correct' ? 'bg-white/20 text-white' : 'bg-emerald-200/70 text-emerald-900'
                        }`}
                      >
                        {correctCount}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleFilterChange('incorrect')}
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 shrink-0 cursor-pointer ${
                        activeFilter === 'incorrect'
                          ? 'bg-rose-600 text-white shadow-xs'
                          : 'bg-rose-50/60 hover:bg-rose-100/70 text-rose-800 border border-rose-200/70'
                      }`}
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Incorrect</span>
                      <span
                        className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-full ${
                          activeFilter === 'incorrect' ? 'bg-white/20 text-white' : 'bg-rose-200/70 text-rose-900'
                        }`}
                      >
                        {incorrectCount}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleFilterChange('unattempted')}
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 shrink-0 cursor-pointer ${
                        activeFilter === 'unattempted'
                          ? 'bg-slate-800 text-white shadow-xs'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
                      }`}
                    >
                      <MinusCircle className="w-3.5 h-3.5" />
                      <span>Unattempted</span>
                      <span
                        className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-full ${
                          activeFilter === 'unattempted' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {unattemptedCount}
                      </span>
                    </button>

                    {markedForReviewCount > 0 && (
                      <button
                        type="button"
                        onClick={() => handleFilterChange('marked')}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 shrink-0 cursor-pointer ${
                          activeFilter === 'marked'
                            ? 'bg-purple-600 text-white shadow-xs'
                            : 'bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200'
                        }`}
                      >
                        <Bookmark className="w-3.5 h-3.5" />
                        <span>Marked for Review</span>
                        <span
                          className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-full ${
                            activeFilter === 'marked' ? 'bg-white/20 text-white' : 'bg-purple-200 text-purple-900'
                          }`}
                        >
                          {markedForReviewCount}
                        </span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Filtered Empty State */}
                {filteredQuestions.length === 0 ? (
                  <div className="bg-white rounded-2xl p-8 border border-slate-200 text-center space-y-2">
                    <AlertCircle className="w-8 h-8 text-slate-400 mx-auto" />
                    <h4 className="font-bold text-slate-800 text-sm">No Questions Found</h4>
                    <p className="text-xs text-slate-500">
                      There are no questions in the "{activeFilter}" category for this attempt.
                    </p>
                    <button
                      type="button"
                      onClick={() => handleFilterChange('all')}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3.5 py-2 rounded-xl border border-indigo-200 cursor-pointer mt-2"
                    >
                      View All Questions
                    </button>
                  </div>
                ) : currentQuestion ? (
                  /* Responsive 2-Column Interface: Single Question on Left, Fixed Palette on Right */
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                    {/* Main Area: One Question At A Time */}
                    <div className="lg:col-span-8 space-y-4">
                      {(() => {
                        const studentAns = answers[currentQuestion.id];
                        const isCorrect = studentAns === currentQuestion.correctAnswer;
                        const isAttempted = Boolean(studentAns);
                        const isMarked = markedIdsSet.has(currentQuestion.id);

                        let statusBadge = (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
                            <MinusCircle className="w-3.5 h-3.5 text-slate-500" />
                            <span>Unattempted (0 Marks)</span>
                          </span>
                        );
                        let cardBorderClass = 'border-slate-200';

                        if (isAttempted && isCorrect) {
                          statusBadge = (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Correct (+{posMarks} Marks)</span>
                            </span>
                          );
                          cardBorderClass = 'border-emerald-200 ring-1 ring-emerald-100';
                        } else if (isAttempted && !isCorrect) {
                          statusBadge = (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-800 border border-rose-200">
                              <XCircle className="w-3.5 h-3.5 text-rose-600" />
                              <span>Incorrect (-{negMarks} Marks)</span>
                            </span>
                          );
                          cardBorderClass = 'border-rose-200 ring-1 ring-rose-100';
                        }

                        return (
                          <div className={`bg-white rounded-2xl shadow-xs border ${cardBorderClass} overflow-hidden transition-all`}>
                            {/* Card Header with Question Counter */}
                            <div className="px-5 py-3.5 bg-slate-50/80 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="px-3 py-1 rounded-xl font-black text-xs sm:text-sm bg-slate-900 text-white shadow-xs flex items-center gap-1.5">
                                  <span>Question {displayQNum}</span>
                                  <span className="text-slate-400 font-semibold text-xs">of {totalQuestions}</span>
                                </span>

                                {activeFilter !== 'all' && (
                                  <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md">
                                    {currentFilteredIndex + 1} of {filteredQuestions.length} ({activeFilter})
                                  </span>
                                )}

                                {currentQuestion.subject && (
                                  <span className="text-[11px] font-bold text-slate-600 bg-white border border-slate-200 px-2 py-0.5 rounded-md">
                                    {currentQuestion.subject}
                                  </span>
                                )}

                                {isMarked && (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full border border-purple-200">
                                    <Bookmark className="w-3 h-3" />
                                    Marked for Review
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-2">
                                {/* Mobile question navigator toggle button */}
                                <button
                                  type="button"
                                  onClick={() => setIsMobilePaletteOpen(true)}
                                  className="lg:hidden inline-flex items-center gap-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-2.5 py-1 rounded-xl cursor-pointer transition-colors"
                                >
                                  <LayoutGrid className="w-3.5 h-3.5" />
                                  <span>Questions</span>
                                </button>

                                {statusBadge}
                              </div>
                            </div>

                            {/* Card Body */}
                            <div className="p-5 space-y-5">
                              {/* Question Text */}
                              <div className="space-y-1.5">
                                {currentQuestion.questionTextHindi && (
                                  <p className="text-sm sm:text-base font-semibold text-slate-900 leading-relaxed">
                                    {currentQuestion.questionTextHindi}
                                  </p>
                                )}
                                {currentQuestion.questionText && (
                                  <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
                                    {currentQuestion.questionText}
                                  </p>
                                )}
                              </div>

                              {/* Question Diagram / Image */}
                              {(currentQuestion.questionImageUrl || currentQuestion.imageUrl) && (
                                <div className="p-2 bg-slate-50 rounded-xl border border-slate-200 max-w-lg">
                                  <img
                                    src={currentQuestion.questionImageUrl || currentQuestion.imageUrl}
                                    alt={`Question ${displayQNum} Diagram`}
                                    className="w-full h-auto max-h-64 object-contain rounded-lg bg-white"
                                    loading="lazy"
                                  />
                                </div>
                              )}

                              {/* Options Display (Stacked text + image support) */}
                              <div className="space-y-2.5 pt-1">
                                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                                  Options
                                </span>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                  {(['A', 'B', 'C', 'D'] as const).map((key) => {
                                    const isStudentPick = studentAns === key;
                                    const isOfficialCorrect = currentQuestion.correctAnswer === key;
                                    const optImg = currentQuestion.optionImages?.[key];
                                    const optEng = currentQuestion.options?.[key];
                                    const optHi = currentQuestion.optionsHindi?.[key];

                                    // Color coding: Green if correct, Red if student's wrong selection, Neutral otherwise
                                    let optContainerClass = 'bg-white border-slate-200 text-slate-700';
                                    let optBadgeClass = 'bg-slate-100 text-slate-700 border-slate-300';

                                    if (isOfficialCorrect) {
                                      optContainerClass = 'bg-emerald-50/70 border-emerald-400 text-emerald-950 font-medium ring-1 ring-emerald-200';
                                      optBadgeClass = 'bg-emerald-600 text-white border-emerald-600';
                                    } else if (isStudentPick && !isCorrect) {
                                      optContainerClass = 'bg-rose-50/70 border-rose-400 text-rose-950 font-medium ring-1 ring-rose-200';
                                      optBadgeClass = 'bg-rose-600 text-white border-rose-600';
                                    }

                                    return (
                                      <div
                                        key={key}
                                        className={`p-3.5 rounded-xl border text-xs flex flex-col justify-between gap-2.5 transition-all ${optContainerClass}`}
                                      >
                                        <div>
                                          <div className="flex items-start justify-between gap-2">
                                            <div className="flex items-start gap-2.5">
                                              <span
                                                className={`w-6 h-6 rounded-lg font-bold text-xs flex items-center justify-center shrink-0 border ${optBadgeClass}`}
                                              >
                                                {key}
                                              </span>

                                              <div className="space-y-0.5">
                                                {optEng && optHi && optEng.trim() !== optHi.trim() ? (
                                                  <>
                                                    <div className="font-semibold text-slate-900">{optEng}</div>
                                                    <div className="text-slate-600 text-[11px]">{optHi}</div>
                                                  </>
                                                ) : optEng || optHi ? (
                                                  <div className="text-slate-900 font-medium">{optEng || optHi}</div>
                                                ) : (
                                                  <div className="italic text-slate-400 text-[11px]">[Image Option]</div>
                                                )}
                                              </div>
                                            </div>

                                            {/* Status Badge */}
                                            <div className="flex flex-col items-end gap-1 shrink-0">
                                              {isOfficialCorrect && (
                                                <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-emerald-600 text-white px-2 py-0.5 rounded-full shadow-2xs">
                                                  <CheckCircle2 className="w-3 h-3" />
                                                  <span>Correct Option</span>
                                                </span>
                                              )}
                                              {isStudentPick && !isCorrect && (
                                                <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-rose-600 text-white px-2 py-0.5 rounded-full shadow-2xs">
                                                  <XCircle className="w-3 h-3" />
                                                  <span>Your Choice (Wrong)</span>
                                                </span>
                                              )}
                                              {isStudentPick && isCorrect && (
                                                <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-emerald-700 text-white px-2 py-0.5 rounded-full shadow-2xs">
                                                  <CheckCircle2 className="w-3 h-3" />
                                                  <span>Your Choice</span>
                                                </span>
                                              )}
                                            </div>
                                          </div>

                                          {/* Stacked Option Image Below Text */}
                                          {optImg?.imageUrl && (
                                            <div className="mt-2.5 max-w-[220px] rounded-lg overflow-hidden border border-slate-200 bg-white p-1 shadow-2xs">
                                              <img
                                                src={optImg.imageUrl}
                                                alt={`Option ${key} image`}
                                                className="max-h-28 w-auto object-contain rounded"
                                                loading="lazy"
                                              />
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>

                              {/* Question Navigation Buttons: Right after options in the same card frame */}
                              <div className="flex items-center justify-between gap-2.5 p-3 bg-slate-100/80 rounded-xl border border-slate-200 shadow-2xs">
                                <button
                                  type="button"
                                  onClick={handlePrevQuestion}
                                  disabled={currentFilteredIndex <= 0}
                                  className="inline-flex items-center gap-1.5 px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 hover:text-slate-900 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs"
                                >
                                  <ChevronLeft className="w-4 h-4" />
                                  <span>Previous</span>
                                </button>

                                {/* Question Navigator Button */}
                                <button
                                  type="button"
                                  onClick={() => setIsMobilePaletteOpen(true)}
                                  className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold text-indigo-700 bg-white border border-indigo-200 hover:bg-indigo-50 transition-all cursor-pointer shadow-2xs"
                                >
                                  <LayoutGrid className="w-3.5 h-3.5 text-indigo-600" />
                                  <span>Q {displayQNum} of {totalQuestions}</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={handleNextQuestion}
                                  disabled={currentFilteredIndex >= filteredQuestions.length - 1}
                                  className="inline-flex items-center gap-1.5 px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs"
                                >
                                  <span>Next</span>
                                  <ChevronRight className="w-4 h-4" />
                                </button>
                              </div>

                              {/* Answer Review & Comparison Strip */}
                              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/90 flex flex-wrap items-center justify-between gap-3 text-xs">
                                <div className="flex flex-wrap items-center gap-3 sm:gap-4">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-slate-500 font-semibold">Your Answer:</span>
                                    {isAttempted ? (
                                      <span
                                        className={`font-black px-2 py-0.5 rounded ${
                                          isCorrect
                                            ? 'bg-emerald-100 text-emerald-800'
                                            : 'bg-rose-100 text-rose-800'
                                        }`}
                                      >
                                        Option {studentAns}
                                      </span>
                                    ) : (
                                      <span className="font-semibold text-slate-500 italic bg-slate-200/70 px-2 py-0.5 rounded">
                                        Not Attempted
                                      </span>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-1.5">
                                    <span className="text-slate-500 font-semibold">Correct Answer:</span>
                                    <span className="font-black px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                                      Option {currentQuestion.correctAnswer}
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-1.5">
                                    <span className="text-slate-500 font-semibold">Status:</span>
                                    {isAttempted && isCorrect ? (
                                      <span className="font-bold text-emerald-700 flex items-center gap-1">
                                        <CheckCircle2 className="w-3.5 h-3.5" /> Correct
                                      </span>
                                    ) : isAttempted && !isCorrect ? (
                                      <span className="font-bold text-rose-700 flex items-center gap-1">
                                        <XCircle className="w-3.5 h-3.5" /> Incorrect
                                      </span>
                                    ) : (
                                      <span className="font-bold text-slate-500 flex items-center gap-1">
                                        <MinusCircle className="w-3.5 h-3.5" /> Unattempted
                                      </span>
                                    )}
                                  </div>
                                </div>

                                <div className="flex items-center gap-3 text-[11px] font-bold">
                                  {avgTimePerQuestion && (
                                    <div className="flex items-center gap-1 text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200">
                                      <Clock className="w-3 h-3 text-indigo-600" />
                                      <span>Avg Time: {avgTimePerQuestion}</span>
                                    </div>
                                  )}
                                  <div className="flex items-center gap-1">
                                    <span className="text-slate-500">Marks:</span>
                                    {isAttempted && isCorrect ? (
                                      <span className="text-emerald-700 font-black">+{posMarks}</span>
                                    ) : isAttempted && !isCorrect ? (
                                      <span className="text-rose-700 font-black">-{negMarks}</span>
                                    ) : (
                                      <span className="text-slate-600 font-black">0</span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Detailed Solution / Explanation */}
                              {(currentQuestion.explanationHindi || currentQuestion.explanation) && (
                                <div className="p-4 bg-indigo-50/50 rounded-xl border border-indigo-100 text-xs space-y-2">
                                  <span className="font-bold text-indigo-950 flex items-center gap-1.5 text-xs">
                                    <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                                    <span>Explanation / Solution:</span>
                                  </span>
                                  {currentQuestion.explanation && (
                                    <p className="text-slate-800 leading-relaxed">{currentQuestion.explanation}</p>
                                  )}
                                  {currentQuestion.explanationHindi && (
                                    <p className="text-slate-800 leading-relaxed pt-0.5">{currentQuestion.explanationHindi}</p>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })()}
                    </div>

                    {/* Desktop Right Side: Fixed/Sticky Question Navigation Panel */}
                    <div className="hidden lg:block lg:col-span-4 sticky top-6 space-y-3">
                      <div className="bg-white rounded-2xl p-4 shadow-xs border border-slate-200 space-y-3">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                            <LayoutGrid className="w-4 h-4 text-indigo-600" />
                            <span>QUESTION NAVIGATION</span>
                          </div>
                          <span className="text-[11px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                            {filteredQuestions.length} {activeFilter !== 'all' ? activeFilter : 'Total'}
                          </span>
                        </div>

                        {/* Status Color Legend */}
                        <div className="grid grid-cols-2 gap-2 text-[10px] font-bold text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                          <div className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                            <span>Correct ({correctCount})</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0" />
                            <span>Incorrect ({incorrectCount})</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-slate-300 shrink-0" />
                            <span>Unattempted ({unattemptedCount})</span>
                          </div>
                          {markedForReviewCount > 0 && (
                            <div className="flex items-center gap-1.5">
                              <span className="w-2.5 h-2.5 rounded-full bg-purple-500 shrink-0" />
                              <span>Marked ({markedForReviewCount})</span>
                            </div>
                          )}
                        </div>

                        {/* Question palette grid */}
                        <div className="grid grid-cols-5 gap-2 max-h-[460px] overflow-y-auto p-1">
                          {filteredQuestions.map((q) => {
                            const studentPick = answers[q.id];
                            const isPickCorrect = studentPick === q.correctAnswer;
                            const isPickAttempted = Boolean(studentPick);
                            const isPickMarked = markedIdsSet.has(q.id);
                            const qIndex = questions.findIndex((item) => item.id === q.id);
                            const qNum = q.questionNumber || qIndex + 1;
                            const isSelected = q.id === currentQuestion.id;

                            let btnBg = 'bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-200';
                            if (isPickAttempted && isPickCorrect) {
                              btnBg = 'bg-emerald-600 text-white hover:bg-emerald-700 border-emerald-600';
                            } else if (isPickAttempted && !isPickCorrect) {
                              btnBg = 'bg-rose-600 text-white hover:bg-rose-700 border-rose-600';
                            }

                            return (
                              <button
                                key={q.id}
                                type="button"
                                onClick={() => handleSelectQuestion(q.id)}
                                title={`Q${qNum}: ${
                                  !isPickAttempted ? 'Unattempted' : isPickCorrect ? 'Correct' : 'Incorrect'
                                }${isPickMarked ? ' (Marked for Review)' : ''}`}
                                className={`h-9 rounded-xl text-xs font-bold transition-all border flex items-center justify-center relative cursor-pointer ${btnBg} ${
                                  isSelected
                                    ? 'ring-3 ring-indigo-600 ring-offset-2 scale-105 shadow-md font-black z-10'
                                    : 'hover:scale-102'
                                }`}
                              >
                                {qNum}
                                {isPickMarked && (
                                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-purple-500 ring-1.5 ring-white" />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}

                {/* Mobile Question Navigator Drawer / Modal */}
                {isMobilePaletteOpen && (
                  <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
                    <div
                      className="fixed inset-0"
                      onClick={() => setIsMobilePaletteOpen(false)}
                    />
                    <div className="relative bg-white w-full max-w-lg rounded-t-3xl sm:rounded-2xl max-h-[85vh] flex flex-col shadow-2xl z-10 overflow-hidden">
                      {/* Drawer Header */}
                      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <LayoutGrid className="w-5 h-5 text-indigo-600" />
                          <div>
                            <h3 className="font-extrabold text-sm sm:text-base text-slate-900">
                              Question Navigator
                            </h3>
                            <p className="text-[11px] text-slate-500">
                              Showing {filteredQuestions.length} {activeFilter} questions
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setIsMobilePaletteOpen(false)}
                          className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center cursor-pointer transition-colors"
                          aria-label="Close Navigator"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Drawer Filter Chips */}
                      <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                        {(
                          [
                            { id: 'all', label: 'All', count: totalQuestions },
                            { id: 'correct', label: 'Correct', count: correctCount },
                            { id: 'incorrect', label: 'Incorrect', count: incorrectCount },
                            { id: 'unattempted', label: 'Unattempted', count: unattemptedCount },
                            ...(markedForReviewCount > 0
                              ? [{ id: 'marked', label: 'Marked', count: markedForReviewCount }]
                              : []),
                          ] as const
                        ).map((tab) => (
                          <button
                            key={tab.id}
                            type="button"
                            onClick={() => handleFilterChange(tab.id as any)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                              activeFilter === tab.id
                                ? 'bg-indigo-600 text-white shadow-2xs'
                                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            {tab.label} ({tab.count})
                          </button>
                        ))}
                      </div>

                      {/* Drawer Color Legend */}
                      <div className="px-5 py-2.5 bg-slate-50/50 border-b border-slate-100 grid grid-cols-2 gap-2 text-[10px] font-bold text-slate-600">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                          <span>Correct ({correctCount})</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0" />
                          <span>Incorrect ({incorrectCount})</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-slate-300 shrink-0" />
                          <span>Unattempted ({unattemptedCount})</span>
                        </div>
                        {markedForReviewCount > 0 && (
                          <div className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-purple-500 shrink-0" />
                            <span>Marked ({markedForReviewCount})</span>
                          </div>
                        )}
                      </div>

                      {/* Drawer Question Grid */}
                      <div className="p-4 overflow-y-auto max-h-[50vh]">
                        <div className="grid grid-cols-5 sm:grid-cols-6 gap-2">
                          {filteredQuestions.map((q) => {
                            const studentPick = answers[q.id];
                            const isPickCorrect = studentPick === q.correctAnswer;
                            const isPickAttempted = Boolean(studentPick);
                            const isPickMarked = markedIdsSet.has(q.id);
                            const qIndex = questions.findIndex((item) => item.id === q.id);
                            const qNum = q.questionNumber || qIndex + 1;
                            const isSelected = q.id === currentQuestion?.id;

                            let btnBg = 'bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-200';
                            if (isPickAttempted && isPickCorrect) {
                              btnBg = 'bg-emerald-600 text-white hover:bg-emerald-700 border-emerald-600';
                            } else if (isPickAttempted && !isPickCorrect) {
                              btnBg = 'bg-rose-600 text-white hover:bg-rose-700 border-rose-600';
                            }

                            return (
                              <button
                                key={q.id}
                                type="button"
                                onClick={() => handleSelectQuestion(q.id)}
                                className={`h-10 rounded-xl text-xs font-bold transition-all border flex items-center justify-center relative cursor-pointer ${btnBg} ${
                                  isSelected
                                    ? 'ring-3 ring-indigo-600 ring-offset-2 scale-105 shadow-md font-black'
                                    : ''
                                }`}
                              >
                                {qNum}
                                {isPickMarked && (
                                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-purple-500 ring-1.5 ring-white" />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white rounded-2xl p-6 border border-slate-200 text-center space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
                <h3 className="font-bold text-slate-900 text-sm">Response Sheet Recorded</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Your score and metrics have been evaluated successfully.
                </p>
              </div>
            )}

            {/* Released Test Reattempt Card */}
            {test?.status === 'released' && onReattempt && (
              <div className="bg-linear-to-r from-emerald-50 via-teal-50 to-indigo-50 border border-emerald-200 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    <h3 className="font-bold text-sm sm:text-base text-slate-900">
                      Want to Improve Your Score?
                    </h3>
                  </div>
                  <p className="text-xs text-slate-600">
                    This released test is available for unlimited reattempts anytime. You can take it again, and all your past attempt scores remain saved in your history.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onReattempt(test)}
                  className="px-5 py-2.5 rounded-xl bg-linear-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer shrink-0"
                >
                  <RotateCw className="w-4 h-4" />
                  <span>Start Reattempt Now</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
