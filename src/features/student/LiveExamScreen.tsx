import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Clock,
  ChevronLeft,
  ChevronRight,
  Bookmark,
  RotateCcw,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Menu,
  X,
  Wifi,
  WifiOff,
  AlertTriangle,
  Send,
  Languages,
  ShieldAlert,
} from 'lucide-react';
import {
  TestItem,
  QuestionItem,
  QuestionNavStatus,
  ActivityLogEntry,
  StudentAttempt,
} from '../../types/exam';
import {
  getQuestionsForTest,
  submitExamAttempt,
  updateSessionStatus,
  subscribeToTest,
  findStudentAttempt,
} from '../../services/examService';
import { useAuth } from '../../context/AuthContext';

interface LiveExamScreenProps {
  test: TestItem;
  studentId?: string;
  studentName: string;
  onSubmitted: (attempt: StudentAttempt) => void;
}

export const LiveExamScreen: React.FC<LiveExamScreenProps> = ({
  test,
  studentId,
  studentName,
  onSubmitted,
}) => {
  const { user } = useAuth();
  const effectiveStudentId =
    studentId ||
    user?.uid ||
    (typeof window !== 'undefined' ? localStorage.getItem('pariksha_candidate_uid') || '' : '') ||
    `cand_${studentName.trim().replace(/\s+/g, '_')}`;
  const studentEmail = user?.email || `${effectiveStudentId}@student.exam`;

  // Local storage keys for answers & status backup
  const answersStorageKey = `pariksha_answers_${test.id}_${effectiveStudentId}`;
  const reviewStorageKey = `pariksha_reviews_${test.id}_${effectiveStudentId}`;
  const visitedStorageKey = `pariksha_visited_${test.id}_${effectiveStudentId}`;
  const tabSwitchesKey = `pariksha_tab_switches_${test.id}_${effectiveStudentId}`;

  // Guard against rejoining after submission:
  useEffect(() => {
    let isCancelled = false;
    async function checkSubmitted() {
      // Released tests or active reattempts are open for unlimited attempts!
      // Do NOT kick out of live exam screen.
      const isReattempt =
        test.status === 'released' ||
        (typeof window !== 'undefined' &&
          localStorage.getItem(`pariksha_is_reattempt_${test.id}_${effectiveStudentId}`) === 'true');

      if (isReattempt) return;

      const existing = await findStudentAttempt(test.id, studentName, effectiveStudentId);
      if (existing && !isCancelled) {
        onSubmitted(existing);
      }
    }
    checkSubmitted();
    return () => {
      isCancelled = true;
    };
  }, [test.id, studentName, effectiveStudentId, test.status]);

  // State
  const [questions, setQuestions] = useState<QuestionItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [answers, setAnswers] = useState<Record<string, 'A' | 'B' | 'C' | 'D'>>(() => {
    try {
      const saved = localStorage.getItem(answersStorageKey);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  const [markedForReview, setMarkedForReview] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(reviewStorageKey);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [visited, setVisited] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(visitedStorageKey);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [tabSwitchCount, setTabSwitchCount] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(tabSwitchesKey);
      return saved ? parseInt(saved, 10) : 0;
    } catch {
      return 0;
    }
  });

  const [activityLogs, setActivityLogs] = useState<ActivityLogEntry[]>([
    {
      timestamp: new Date().toISOString(),
      event: 'started_exam',
      details: 'Examination started on student device',
    },
  ]);

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [showTabWarning, setShowTabWarning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [languageMode, setLanguageMode] = useState<'both' | 'hi' | 'en'>('both');
  const [loading, setLoading] = useState(true);

  // Authoritative server-calculated remaining seconds
  const [remainingSeconds, setRemainingSeconds] = useState<number>(() => {
    // If test is released or candidate is reattempting, give full test duration:
    const isReattempt =
      test.status === 'released' ||
      (typeof window !== 'undefined' &&
        localStorage.getItem(`pariksha_is_reattempt_${test.id}_${effectiveStudentId}`) === 'true');

    if (isReattempt) {
      return test.durationMinutes * 60;
    }
    const durationMs = test.durationMinutes * 60 * 1000;
    if (test.examEndTime) {
      const diff = new Date(test.examEndTime).getTime() - Date.now();
      return Math.max(0, Math.floor(diff / 1000));
    }
    if (test.examStartTime) {
      const end = new Date(test.examStartTime).getTime() + durationMs;
      const diff = end - Date.now();
      return Math.max(0, Math.floor(diff / 1000));
    }
    return test.durationMinutes * 60;
  });

  const startTimeRef = useRef<string>(new Date().toISOString());

  // Load questions
  useEffect(() => {
    async function loadExamQuestions() {
      setLoading(true);
      try {
        const qList = await getQuestionsForTest(test.id, 'student');
        setQuestions(qList);
        if (qList.length > 0) {
          const firstQId = qList[0].id;
          setVisited((prev) => {
            const next = Array.from(new Set([...prev, firstQId]));
            localStorage.setItem(visitedStorageKey, JSON.stringify(next));
            return next;
          });
        }
      } catch (err) {
        console.error('Failed to load exam questions:', err);
      } finally {
        setLoading(false);
      }
    }
    loadExamQuestions();
  }, [test.id, visitedStorageKey]);

  // Mark current question as visited
  useEffect(() => {
    if (questions[currentIndex]) {
      const qId = questions[currentIndex].id;
      setVisited((prev) => {
        if (!prev.includes(qId)) {
          const next = [...prev, qId];
          localStorage.setItem(visitedStorageKey, JSON.stringify(next));
          return next;
        }
        return prev;
      });
    }
  }, [currentIndex, questions, visitedStorageKey]);

  // Network connection monitor
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      const log: ActivityLogEntry = {
        timestamp: new Date().toISOString(),
        event: 'connection_restored',
        details: 'Internet connection restored',
      };
      setActivityLogs((prev) => [...prev, log]);
      updateSessionStatus(test.id, effectiveStudentId, 'in_progress', tabSwitchCount, log);
    };

    const handleOffline = () => {
      setIsOnline(false);
      const log: ActivityLogEntry = {
        timestamp: new Date().toISOString(),
        event: 'connection_lost',
        details: 'Internet disconnected; answers preserved locally',
      };
      setActivityLogs((prev) => [...prev, log]);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [test.id, effectiveStudentId, tabSwitchCount]);

  // Anti-cheating: detect tab switches & visibility changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        const now = new Date().toISOString();
        setTabSwitchCount((count) => {
          const next = count + 1;
          localStorage.setItem(tabSwitchesKey, next.toString());
          const log: ActivityLogEntry = {
            timestamp: now,
            event: 'tab_hidden',
            details: `Candidate switched tab or minimized window (Warning #${next})`,
          };
          setActivityLogs((prev) => [...prev, log]);
          updateSessionStatus(test.id, effectiveStudentId, 'in_progress', next, log);
          return next;
        });
        setShowTabWarning(true);
      } else {
        const log: ActivityLogEntry = {
          timestamp: new Date().toISOString(),
          event: 'tab_visible',
          details: 'Candidate returned to examination tab',
        };
        setActivityLogs((prev) => [...prev, log]);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Prevent accidental page leave
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = 'You have an active examination in progress. Are you sure you want to leave?';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [test.id, studentId, tabSwitchesKey]);

  // Server-synchronized countdown timer
  useEffect(() => {
    const timer = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleFinalSubmit(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [test.id]);

  // Real-time synchronization: Auto-submit if examination is ended by administrator (for scheduled/live exams only)
  useEffect(() => {
    const isReattempt =
      test.status === 'released' ||
      (typeof window !== 'undefined' &&
        localStorage.getItem(`pariksha_is_reattempt_${test.id}_${effectiveStudentId}`) === 'true');

    if (isReattempt) return; // Active reattempts remain active until candidate finishes
    const unsub = subscribeToTest(test.id, (liveTest) => {
      if (liveTest.status === 'completed' || liveTest.status === 'result_published') {
        handleFinalSubmit(true);
      }
    });
    return () => unsub();
  }, [test.id, test.status]);

  // Format timer HH:MM:SS
  const formattedTime = useMemo(() => {
    const hours = Math.floor(remainingSeconds / 3600);
    const minutes = Math.floor((remainingSeconds % 3600) / 60);
    const seconds = remainingSeconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }, [remainingSeconds]);

  // Current Question
  const currentQuestion = questions[currentIndex] || null;

  // Answer handler
  const handleSelectOption = (optionKey: 'A' | 'B' | 'C' | 'D') => {
    if (!currentQuestion) return;
    const nextAnswers = { ...answers, [currentQuestion.id]: optionKey };
    setAnswers(nextAnswers);
    localStorage.setItem(answersStorageKey, JSON.stringify(nextAnswers));
  };

  const handleClearResponse = () => {
    if (!currentQuestion) return;
    const nextAnswers = { ...answers };
    delete nextAnswers[currentQuestion.id];
    setAnswers(nextAnswers);
    localStorage.setItem(answersStorageKey, JSON.stringify(nextAnswers));
  };

  const handleToggleReview = () => {
    if (!currentQuestion) return;
    const qId = currentQuestion.id;
    let nextReviews: string[];
    if (markedForReview.includes(qId)) {
      nextReviews = markedForReview.filter((id) => id !== qId);
    } else {
      nextReviews = [...markedForReview, qId];
    }
    setMarkedForReview(nextReviews);
    localStorage.setItem(reviewStorageKey, JSON.stringify(nextReviews));
  };

  const handleSaveAndNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((i) => i + 1);
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex((i) => i - 1);
    }
  };

  // Submission handler
  const handleFinalSubmit = async (isAuto: boolean = false) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setShowSubmitModal(false);

    try {
      const attempt = await submitExamAttempt({
        testId: test.id,
        studentId: effectiveStudentId,
        studentName,
        studentEmail,
        answers,
        visitedQuestionIds: visited,
        markedForReviewIds: markedForReview,
        startedAt: startTimeRef.current,
        isAutoSubmitted: isAuto,
        tabSwitchCount,
        activityLogs,
      });

      // Clear in-progress storage and cache completed attempt
      try {
        localStorage.removeItem(answersStorageKey);
        localStorage.removeItem(reviewStorageKey);
        localStorage.removeItem(visitedStorageKey);
        localStorage.removeItem(tabSwitchesKey);
        localStorage.removeItem(`pariksha_is_reattempt_${test.id}_${effectiveStudentId}`);
        localStorage.setItem(`pariksha_attempt_${test.id}`, JSON.stringify(attempt));
        localStorage.setItem(`pariksha_attempt_${test.id}_${studentName.toLowerCase().trim()}`, JSON.stringify(attempt));
      } catch {
        // ignore
      }

      onSubmitted(attempt);
    } catch (err) {
      console.error('Submission error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Status statistics for question drawer & submit modal
  const stats = useMemo(() => {
    let answered = 0;
    let reviewOnly = 0;
    let reviewAndAnswered = 0;
    let notAnswered = 0;
    let notVisited = 0;

    questions.forEach((q) => {
      const hasAnswer = Boolean(answers[q.id]);
      const isReview = markedForReview.includes(q.id);
      const isVisited = visited.includes(q.id);

      if (hasAnswer && isReview) {
        reviewAndAnswered++;
        answered++;
      } else if (hasAnswer) {
        answered++;
      } else if (isReview) {
        reviewOnly++;
      } else if (isVisited) {
        notAnswered++;
      } else {
        notVisited++;
      }
    });

    return {
      total: questions.length,
      answered,
      unanswered: Math.max(0, questions.length - answered),
      reviewOnly,
      reviewAndAnswered,
      notAnswered,
      notVisited,
    };
  }, [questions, answers, markedForReview, visited]);

  // Question navigation status resolver
  const getQuestionNavStatus = (qId: string): QuestionNavStatus => {
    const hasAnswer = Boolean(answers[qId]);
    const isReview = markedForReview.includes(qId);
    const isVisited = visited.includes(qId);

    if (hasAnswer && isReview) return 'marked_and_answered';
    if (hasAnswer) return 'answered';
    if (isReview) return 'marked_for_review';
    if (isVisited) return 'not_answered';
    return 'not_visited';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="bg-white p-6 rounded-2xl shadow-sm text-center space-y-3">
          <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-semibold text-slate-700">Loading Examination Paper...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-between select-none">
      {/* =========================================================
          TOP BAR (Mobile Ergonomic)
      ========================================================= */}
      <header className="sticky top-0 z-30 bg-slate-900 text-white shadow-md">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2.5 flex items-center justify-between gap-2">
          {/* Test Name & Progress */}
          <div className="min-w-0 flex-1">
            <h1 className="text-xs sm:text-sm font-bold truncate leading-tight text-slate-100">
              {test.title}
            </h1>
            <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
              <span>
                Q {currentIndex + 1} of {questions.length}
              </span>
              <span>&bull;</span>
              <span className="text-emerald-400 font-semibold">{stats.answered} Answered</span>
            </div>
          </div>

          {/* Synchronized Timer */}
          <div
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-mono text-sm sm:text-base font-bold shadow-inner ${
              remainingSeconds < 300
                ? 'bg-red-600 text-white animate-pulse'
                : 'bg-slate-800 text-amber-300 border border-slate-700'
            }`}
          >
            <Clock className="w-4 h-4 shrink-0 text-amber-400" />
            <span>{formattedTime}</span>
          </div>

          {/* Action buttons (Questions Drawer Toggle & Submit) */}
          <div className="flex items-center gap-1.5">
            {/* Offline indicator */}
            {!isOnline && (
              <span
                title="Working Offline. Answers are saved locally."
                className="p-1.5 bg-red-500/20 text-red-400 rounded-lg"
              >
                <WifiOff className="w-4 h-4" />
              </span>
            )}

            {/* Mobile Questions Drawer Button */}
            <button
              onClick={() => setIsDrawerOpen(true)}
              className="px-2.5 sm:px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
            >
              <Menu className="w-4 h-4" />
              <span className="hidden sm:inline">Questions</span>
              <span className="bg-indigo-800 text-[10px] px-1.5 py-0.5 rounded-full font-mono">
                {stats.answered}/{questions.length}
              </span>
            </button>

            {/* Submit Button */}
            <button
              onClick={() => setShowSubmitModal(true)}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors shadow-xs"
            >
              Submit
            </button>
          </div>
        </div>
      </header>

      {/* =========================================================
          MAIN QUESTION AREA (One Question At A Time)
      ========================================================= */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-3 sm:p-6 pb-28">
        {currentQuestion ? (
          <div className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden space-y-4">
            {/* Question Header & Controls */}
            <div className="bg-slate-50 px-4 sm:px-6 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 bg-indigo-600 text-white text-xs font-bold rounded-lg">
                  Question {currentIndex + 1}
                </span>
                {currentQuestion.subject && (
                  <span className="text-xs font-medium text-slate-600 bg-slate-200/80 px-2 py-0.5 rounded-md">
                    {currentQuestion.subject}
                  </span>
                )}
                {markedForReview.includes(currentQuestion.id) && (
                  <span className="text-xs font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-200 flex items-center gap-1">
                    <Bookmark className="w-3 h-3 fill-purple-600" />
                    Review
                  </span>
                )}
              </div>

              {/* Marks & Language Toggle */}
              <div className="flex items-center gap-3 text-xs">
                <div className="flex items-center gap-1 text-slate-500">
                  <span className="text-emerald-600 font-bold">+{test.marksPerQuestion}</span>
                  <span>/</span>
                  <span className="text-red-500 font-bold">-{test.negativeMarks}</span>
                </div>

                {/* Hindi/English Toggle */}
                {currentQuestion.questionTextHindi && (
                  <div className="flex items-center border border-slate-200 rounded-lg p-0.5 bg-white">
                    <button
                      onClick={() => setLanguageMode('both')}
                      className={`px-1.5 py-0.5 text-[11px] rounded font-medium cursor-pointer ${
                        languageMode === 'both' ? 'bg-indigo-50 text-indigo-700 font-bold' : 'text-slate-500'
                      }`}
                    >
                      Bilingual
                    </button>
                    <button
                      onClick={() => setLanguageMode('hi')}
                      className={`px-1.5 py-0.5 text-[11px] rounded font-medium cursor-pointer ${
                        languageMode === 'hi' ? 'bg-indigo-50 text-indigo-700 font-bold' : 'text-slate-500'
                      }`}
                    >
                      Hindi
                    </button>
                    <button
                      onClick={() => setLanguageMode('en')}
                      className={`px-1.5 py-0.5 text-[11px] rounded font-medium cursor-pointer ${
                        languageMode === 'en' ? 'bg-indigo-50 text-indigo-700 font-bold' : 'text-slate-500'
                      }`}
                    >
                      English
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Question Text */}
            <div className="px-4 sm:px-6 pt-2 pb-4 space-y-3">
              {/* Primary English question */}
              {(languageMode === 'both' || languageMode === 'en') && (
                <div className="text-base sm:text-lg font-semibold text-slate-900 leading-relaxed font-sans">
                  {currentQuestion.questionText}
                </div>
              )}

              {/* Secondary/Alternative question */}
              {(languageMode === 'both' || languageMode === 'hi') && currentQuestion.questionTextHindi && (
                <div className="text-sm sm:text-base text-slate-600 leading-relaxed pt-2 border-t border-slate-100">
                  {currentQuestion.questionTextHindi}
                </div>
              )}

              {/* Optional Question Diagram / Image from Firebase Storage */}
              {currentQuestion.imageUrl && (
                <div className="pt-2">
                  <div className="max-w-md rounded-xl overflow-hidden border border-slate-200 shadow-xs bg-slate-50">
                    <img
                      src={currentQuestion.imageUrl}
                      alt="Question Diagram"
                      className="w-full h-auto max-h-64 object-contain mx-auto bg-white"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Multiple Choice Options */}
            <div className="px-4 sm:px-6 pb-6 space-y-3">
              {(['A', 'B', 'C', 'D'] as const).map((key) => {
                const optEng = currentQuestion.options[key];
                const optHindi = currentQuestion.optionsHindi?.[key];
                if (!optEng && !optHindi) return null;

                const isSelected = answers[currentQuestion.id] === key;

                return (
                  <div
                    key={key}
                    onClick={() => handleSelectOption(key)}
                    className={`relative p-3.5 sm:p-4 rounded-xl border-2 cursor-pointer transition-all flex items-start gap-3.5 ${
                      isSelected
                        ? 'border-indigo-600 bg-indigo-50/60 shadow-xs'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/60 bg-white'
                    }`}
                  >
                    {/* Key badge indicator (Radio look) */}
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shrink-0 transition-colors ${
                        isSelected
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-100 text-slate-700 border border-slate-300'
                      }`}
                    >
                      {key}
                    </div>

                    {/* Option Text */}
                    <div className="flex-1 text-sm sm:text-base text-slate-800">
                      {languageMode === 'both' && optEng && optHindi && optEng.trim() !== optHindi.trim() ? (
                        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                          <span className="font-semibold text-slate-900">{optEng}</span>
                          <span className="text-slate-400 font-bold">/</span>
                          <span className="font-medium text-slate-800">{optHindi}</span>
                        </div>
                      ) : languageMode === 'hi' ? (
                        <div className="font-medium text-slate-900">{optHindi || optEng}</div>
                      ) : (
                        <div className="font-medium text-slate-900">{optEng || optHindi}</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="text-center py-12 text-slate-500">No question available.</div>
        )}
      </main>

      {/* =========================================================
          BOTTOM ERGONOMIC CONTROL BAR (Fixed thumb reach for mobile)
      ========================================================= */}
      <footer className="fixed bottom-0 inset-x-0 bg-white border-t border-slate-200 py-3 px-3 sm:px-6 z-30 shadow-lg">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-2">
          {/* Previous Button */}
          <button
            onClick={handlePrevious}
            disabled={currentIndex === 0}
            className="flex-1 sm:flex-none px-3 sm:px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-semibold text-xs sm:text-sm hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1 cursor-pointer transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Previous</span>
          </button>

          {/* Middle Buttons: Clear & Mark for Review */}
          <div className="flex items-center gap-2">
            {currentQuestion && answers[currentQuestion.id] && (
              <button
                onClick={handleClearResponse}
                title="Clear Response"
                className="px-2.5 sm:px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:text-red-600 hover:bg-red-50 border border-slate-200 cursor-pointer transition-colors"
              >
                <RotateCcw className="w-4 h-4 inline sm:mr-1" />
                <span className="hidden sm:inline">Clear</span>
              </button>
            )}

            <button
              onClick={handleToggleReview}
              className={`px-3 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer border ${
                currentQuestion && markedForReview.includes(currentQuestion.id)
                  ? 'bg-purple-100 text-purple-900 border-purple-300'
                  : 'bg-slate-50 hover:bg-purple-50 text-slate-700 hover:text-purple-700 border-slate-200'
              }`}
            >
              <Bookmark className="w-4 h-4" />
              <span className="hidden sm:inline">Mark Review</span>
              <span className="sm:hidden">Review</span>
            </button>
          </div>

          {/* Save & Next / Next Button */}
          <button
            onClick={handleSaveAndNext}
            disabled={currentIndex === questions.length - 1}
            className="flex-1 sm:flex-none px-4 sm:px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs sm:text-sm disabled:opacity-50 disabled:bg-slate-300 flex items-center justify-center gap-1 cursor-pointer transition-colors shadow-xs"
          >
            <span>Save & Next</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </footer>

      {/* =========================================================
          QUESTION STATUS NAVIGATION DRAWER / MODAL
      ========================================================= */}
      {isDrawerOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/60 backdrop-blur-xs flex justify-end">
          <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm">Question Navigation</h3>
                <p className="text-xs text-slate-400">Tap question number to jump</p>
              </div>
              <button
                onClick={() => setIsDrawerOpen(false)}
                className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Legend & Summary Counts */}
            <div className="p-4 bg-slate-50 border-b border-slate-200 grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center gap-2 p-1.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200">
                <span className="w-3 h-3 rounded-full bg-emerald-600 shrink-0" />
                <span className="font-bold">{stats.answered}</span>
                <span className="text-slate-600">Answered</span>
              </div>

              <div className="flex items-center gap-2 p-1.5 rounded-lg bg-rose-50 text-rose-800 border border-rose-200">
                <span className="w-3 h-3 rounded-full bg-rose-600 shrink-0" />
                <span className="font-bold">{stats.notAnswered}</span>
                <span className="text-slate-600">Not Answered</span>
              </div>

              <div className="flex items-center gap-2 p-1.5 rounded-lg bg-purple-50 text-purple-800 border border-purple-200">
                <span className="w-3 h-3 rounded-full bg-purple-600 shrink-0" />
                <span className="font-bold">{stats.reviewOnly}</span>
                <span className="text-slate-600">Marked Review</span>
              </div>

              <div className="flex items-center gap-2 p-1.5 rounded-lg bg-slate-100 text-slate-700 border border-slate-300">
                <span className="w-3 h-3 rounded-full bg-slate-300 shrink-0" />
                <span className="font-bold">{stats.notVisited}</span>
                <span className="text-slate-600">Not Visited</span>
              </div>
            </div>

            {/* Grid of Question Numbers */}
            <div className="flex-1 overflow-y-auto p-4">
              <div className="grid grid-cols-5 sm:grid-cols-6 gap-2.5">
                {questions.map((q, idx) => {
                  const status = getQuestionNavStatus(q.id);
                  const isCurrent = idx === currentIndex;

                  let colorClasses = 'bg-white text-slate-700 border-slate-300';
                  if (status === 'answered') {
                    colorClasses = 'bg-emerald-600 text-white border-emerald-700';
                  } else if (status === 'marked_and_answered') {
                    colorClasses = 'bg-blue-600 text-white border-blue-700 ring-2 ring-purple-500';
                  } else if (status === 'marked_for_review') {
                    colorClasses = 'bg-purple-600 text-white border-purple-700';
                  } else if (status === 'not_answered') {
                    colorClasses = 'bg-rose-500 text-white border-rose-600';
                  } else {
                    colorClasses = 'bg-slate-100 text-slate-600 border-slate-300';
                  }

                  return (
                    <button
                      key={q.id}
                      onClick={() => {
                        setCurrentIndex(idx);
                        setIsDrawerOpen(false);
                      }}
                      className={`h-11 rounded-xl font-bold text-xs flex flex-col items-center justify-center border-2 transition-transform active:scale-95 cursor-pointer relative ${colorClasses} ${
                        isCurrent ? 'ring-3 ring-indigo-500 ring-offset-2' : ''
                      }`}
                    >
                      <span>{idx + 1}</span>
                      {status === 'marked_and_answered' && (
                        <span className="w-1.5 h-1.5 rounded-full bg-white absolute bottom-1" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Drawer Bottom Actions */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center gap-2">
              <button
                onClick={() => setIsDrawerOpen(false)}
                className="flex-1 py-2.5 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-white"
              >
                Close Panel
              </button>
              <button
                onClick={() => {
                  setIsDrawerOpen(false);
                  setShowSubmitModal(true);
                }}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs"
              >
                Submit Examination
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================
          SUBMISSION CONFIRMATION MODAL (Manual Submission)
      ========================================================= */}
      {showSubmitModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-slate-900 px-6 py-4 text-white">
              <h3 className="font-bold text-base">Submit Examination Confirmation</h3>
              <p className="text-xs text-slate-400">Check your paper summary before final submit</p>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                  <span className="text-xs text-emerald-700 font-semibold block">Answered</span>
                  <span className="text-2xl font-black text-emerald-700">{stats.answered}</span>
                </div>
                <div className="p-3 bg-rose-50 rounded-xl border border-rose-200">
                  <span className="text-xs text-rose-700 font-semibold block">Unanswered</span>
                  <span className="text-2xl font-black text-rose-700">{stats.unanswered}</span>
                </div>
              </div>

              <p className="text-xs sm:text-sm text-slate-600 text-center leading-relaxed">
                You have answered <strong>{stats.answered}</strong> questions and left{' '}
                <strong>{stats.unanswered}</strong> questions unanswered. Are you sure you want to submit your
                examination now?
              </p>

              <div className="bg-amber-50 p-3 rounded-xl border border-amber-200 text-amber-900 text-xs flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                <span>
                  After clicking <strong>Submit Examination</strong>, answers become read-only and cannot be changed.
                </span>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowSubmitModal(false)}
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 border border-slate-300 rounded-xl text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel & Review
                </button>
                <button
                  type="button"
                  onClick={() => handleFinalSubmit(false)}
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-xs cursor-pointer disabled:opacity-60 flex items-center justify-center gap-1.5"
                >
                  <Send className="w-4 h-4" />
                  <span>{isSubmitting ? 'Submitting...' : 'Submit Examination'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================
          ANTI-CHEATING TAB SWITCH WARNING MODAL
      ========================================================= */}
      {showTabWarning && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 text-center space-y-4 border border-rose-200 shadow-2xl">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 mx-auto flex items-center justify-center">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Exam Proctoring Warning</h3>
              <p className="text-xs text-slate-600 mt-1">
                You navigated away or minimized the examination tab. This event has been recorded in your examination
                activity log.
              </p>
            </div>
            <div className="bg-rose-50 text-rose-900 text-xs font-semibold py-2 px-3 rounded-lg border border-rose-200">
              Total Recorded Tab Switches: {tabSwitchCount}
            </div>
            <button
              onClick={() => setShowTabWarning(false)}
              className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors"
            >
              I Understand & Return to Exam
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
