import React, { useEffect, useState } from 'react';
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
  const [expandedQId, setExpandedQId] = useState<string | null>(null);
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
        });
      }
    });

    return () => unsubscribe();
  }, [attempt.testId]);

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
  const posMarks = currentAttempt.positiveMarks ?? (test?.marksPerQuestion ?? 1);
  const negMarks = currentAttempt.negativeMarks ?? (test?.negativeMarks ?? 0.25);
  const maxPossibleMarks = totalQuestions * posMarks;
  const finalScore = currentAttempt.finalScore ?? 0;
  const percentage =
    currentAttempt.percentage ??
    (maxPossibleMarks > 0 ? Number(((finalScore / maxPossibleMarks) * 100).toFixed(1)) : 0);
  const accuracy =
    currentAttempt.accuracy ??
    (currentAttempt.attemptedCount > 0
      ? Number(((currentAttempt.correctCount / currentAttempt.attemptedCount) * 100).toFixed(1))
      : 0);

  return (
    <div className="min-h-screen bg-slate-100 py-8 px-4 sm:px-6 lg:px-8 print:bg-white print:p-0">
      <div className="max-w-3xl mx-auto space-y-6">
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

            {/* Detailed Question Review Breakdown */}
            {questions.length > 0 ? (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden space-y-4 p-6">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                  <div className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-indigo-600" />
                    <h3 className="font-bold text-base text-slate-900">Question-by-Question Solution & Review</h3>
                  </div>
                  <span className="text-xs font-semibold text-slate-500">{questions.length} Questions</span>
                </div>

                <div className="space-y-3">
                  {questions.map((q, idx) => {
                    const studentAns = answers[q.id];
                    const isCorrect = studentAns === q.correctAnswer;
                    const isAttempted = Boolean(studentAns);
                    const isExpanded = expandedQId === q.id || idx === 0;

                    return (
                      <div
                        key={q.id}
                        className={`border rounded-xl transition-all overflow-hidden ${
                          !isAttempted
                            ? 'border-slate-200 bg-slate-50/40'
                            : isCorrect
                            ? 'border-emerald-200 bg-emerald-50/20'
                            : 'border-rose-200 bg-rose-50/20'
                        }`}
                      >
                        {/* Accordion Bar */}
                        <div
                          onClick={() => setExpandedQId(expandedQId === q.id ? null : q.id)}
                          className="p-3.5 flex items-center justify-between gap-3 cursor-pointer select-none"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span
                              className={`w-7 h-7 rounded-lg text-xs font-bold flex items-center justify-center shrink-0 ${
                                !isAttempted
                                  ? 'bg-slate-200 text-slate-700'
                                  : isCorrect
                                  ? 'bg-emerald-600 text-white'
                                  : 'bg-rose-600 text-white'
                              }`}
                            >
                              Q{q.questionNumber || idx + 1}
                            </span>
                            <div className="truncate text-xs sm:text-sm font-semibold text-slate-800">
                              {q.questionText || q.questionTextHindi}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <span
                              className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                                !isAttempted
                                  ? 'bg-slate-100 text-slate-600'
                                  : isCorrect
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {!isAttempted ? 'Unattempted' : isCorrect ? 'Correct (+1)' : 'Wrong (-0.25)'}
                            </span>
                            {expandedQId === q.id ? (
                              <ChevronUp className="w-4 h-4 text-slate-400" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-slate-400" />
                            )}
                          </div>
                        </div>

                        {/* Question Content & Solutions */}
                        {isExpanded && (
                          <div className="p-4 border-t border-slate-200/60 bg-white space-y-3 text-sm">
                            {/* Question English & Hindi */}
                            <div className="space-y-1">
                              {q.questionTextHindi && (
                                <p className="font-semibold text-slate-900">{q.questionTextHindi}</p>
                              )}
                              <p className="text-slate-700">{q.questionText}</p>
                            </div>

                            {/* Options List */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                              {(['A', 'B', 'C', 'D'] as const).map((key) => {
                                const isStudentPick = studentAns === key;
                                const isOfficialCorrect = q.correctAnswer === key;

                                let badgeClasses = 'border-slate-200 bg-white text-slate-700';
                                if (isOfficialCorrect) {
                                  badgeClasses = 'border-emerald-400 bg-emerald-50 text-emerald-900 font-semibold';
                                } else if (isStudentPick && !isCorrect) {
                                  badgeClasses = 'border-rose-400 bg-rose-50 text-rose-900 font-semibold';
                                }

                                return (
                                  <div
                                    key={key}
                                    className={`p-2.5 rounded-lg border text-xs flex items-center justify-between gap-2 ${badgeClasses}`}
                                  >
                                    <div>
                                      <span className="font-bold mr-1.5">{key}.</span>
                                      {q.options?.[key] && q.optionsHindi?.[key] && q.options[key].trim() !== q.optionsHindi[key].trim() ? (
                                        <span className="inline-flex items-center gap-1.5 flex-wrap">
                                          <span className="font-semibold">{q.options[key]}</span>
                                          <span className="text-slate-400 font-bold">/</span>
                                          <span>{q.optionsHindi[key]}</span>
                                        </span>
                                      ) : (
                                        <span>{q.options?.[key] || q.optionsHindi?.[key] || ''}</span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                      {isStudentPick && (
                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200 text-slate-800">
                                          Your Choice
                                        </span>
                                      )}
                                      {isOfficialCorrect && (
                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-200 text-emerald-900 font-bold">
                                          Correct
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>

                            {/* Explanation */}
                            {(q.explanationHindi || q.explanation) && (
                              <div className="p-3 bg-slate-100 rounded-xl text-xs space-y-1">
                                <span className="font-bold text-slate-800 block">Explanation:</span>
                                {q.explanation && <p className="text-slate-800">{q.explanation}</p>}
                                {q.explanationHindi && !q.explanation && <p className="text-slate-800">{q.explanationHindi}</p>}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
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
