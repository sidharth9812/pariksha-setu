import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Clock,
  ChevronLeft,
  ChevronRight,
  Bookmark,
  RotateCcw,
  X,
  WifiOff,
  AlertTriangle,
  Send,
  Languages,
  ShieldAlert,
  LayoutGrid,
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
  syncSessionProgress,
  getExamSession,
  subscribeToTest,
  findStudentAttempt,
} from '../../services/examService';
import { useAuth } from '../../context/AuthContext';
import { CachedImage } from '../../components/common/CachedImage';
import {
  FormattedQuestionText,
  prefixQuestionWithNumber,
} from '../../utils/questionTextFormatter';

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

  // Guard against rejoining after submission
  useEffect(() => {
    let isCancelled = false;
    async function checkSubmitted() {
      const isReattempt =
        test.status === 'released' ||
        (typeof window !== 'undefined' &&
          localStorage.getItem(`pariksha_is_reattempt_${test.id}_${effectiveStudentId}`) ===
            'true');

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
  const isSubmittingRef = useRef<boolean>(false);
  const answersRef = useRef<Record<string, 'A' | 'B' | 'C' | 'D'>>(answers);
  const visitedRef = useRef<string[]>(visited);
  const markedForReviewRef = useRef<string[]>(markedForReview);
  const tabSwitchCountRef = useRef<number>(tabSwitchCount);
  const activityLogsRef = useRef<ActivityLogEntry[]>(activityLogs);

  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);
  useEffect(() => {
    visitedRef.current = visited;
  }, [visited]);
  useEffect(() => {
    markedForReviewRef.current = markedForReview;
  }, [markedForReview]);
  useEffect(() => {
    tabSwitchCountRef.current = tabSwitchCount;
  }, [tabSwitchCount]);
  useEffect(() => {
    activityLogsRef.current = activityLogs;
  }, [activityLogs]);

  const headerRef = useRef<HTMLElement>(null);
  const [headerHeight, setHeaderHeight] = useState<number>(88);

  // Measure dynamic top header height for sticky Question navigation
  useEffect(() => {
    const updateHeaderHeight = () => {
      if (headerRef.current) {
        setHeaderHeight(headerRef.current.offsetHeight);
      }
    };

    updateHeaderHeight();

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && headerRef.current) {
      resizeObserver = new ResizeObserver(() => {
        updateHeaderHeight();
      });
      resizeObserver.observe(headerRef.current);
    }

    window.addEventListener('resize', updateHeaderHeight);
    window.addEventListener('orientationchange', updateHeaderHeight);

    return () => {
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      window.removeEventListener('resize', updateHeaderHeight);
      window.removeEventListener('orientationchange', updateHeaderHeight);
    };
  }, []);

  // Smooth scroll to top when navigating between questions
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentIndex]);

  // Load questions & restore any cloud session answers if local cache was cleared
  useEffect(() => {
    async function loadExamQuestions() {
      setLoading(true);
      try {
        const [qList, existingSession] = await Promise.all([
          getQuestionsForTest(test.id, 'student'),
          getExamSession(test.id, effectiveStudentId),
        ]);
        setQuestions(qList);

        if (
          existingSession?.answers &&
          Object.keys(existingSession.answers).length > 0 &&
          Object.keys(answersRef.current).length === 0
        ) {
          setAnswers(existingSession.answers);
          answersRef.current = existingSession.answers;
          localStorage.setItem(answersStorageKey, JSON.stringify(existingSession.answers));
        }

        if (qList.length > 0) {
          const firstQId = qList[0].id;
          setVisited((prev) => {
            const next = Array.from(new Set([...prev, firstQId]));
            visitedRef.current = next;
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
  }, [test.id, visitedStorageKey, effectiveStudentId, answersStorageKey]);

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

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue =
        'You have an active examination in progress. Are you sure you want to leave?';
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

  // Real-time synchronization: Auto-submit if examination is ended by administrator
  useEffect(() => {
    const isReattempt =
      test.status === 'released' ||
      (typeof window !== 'undefined' &&
        localStorage.getItem(`pariksha_is_reattempt_${test.id}_${effectiveStudentId}`) === 'true');

    if (isReattempt) return;
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
    return `${hours.toString().padStart(2, '0')}:${minutes
      .toString()
      .padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }, [remainingSeconds]);

  // Distinct subject sections for section switcher tabs
  const sections = useMemo(() => {
    const map = new Map<string, { name: string; firstIndex: number; count: number }>();
    questions.forEach((q, idx) => {
      const subj = (q.subject || test.subject || test.examCategory || 'General').trim();
      const existing = map.get(subj);
      if (existing) {
        existing.count += 1;
      } else {
        map.set(subj, { name: subj, firstIndex: idx, count: 1 });
      }
    });
    return Array.from(map.values());
  }, [questions, test.subject, test.examCategory]);

  // Current Question
  const currentQuestion = questions[currentIndex] || null;
  const currentSubject =
    (currentQuestion?.subject || test.subject || test.examCategory || 'General').trim();

  // Answer handler
  const handleSelectOption = (optionKey: 'A' | 'B' | 'C' | 'D') => {
    if (!currentQuestion) return;
    const nextAnswers = { ...answersRef.current, [currentQuestion.id]: optionKey };
    answersRef.current = nextAnswers;
    setAnswers(nextAnswers);
    localStorage.setItem(answersStorageKey, JSON.stringify(nextAnswers));
    syncSessionProgress(test.id, effectiveStudentId, {
      studentName,
      studentEmail,
      answers: nextAnswers,
      visitedQuestionIds: visitedRef.current,
      markedForReviewIds: markedForReviewRef.current,
      tabSwitchCount: tabSwitchCountRef.current,
      startedAt: startTimeRef.current,
    });
  };

  const handleClearResponse = () => {
    if (!currentQuestion) return;
    const nextAnswers = { ...answersRef.current };
    delete nextAnswers[currentQuestion.id];
    answersRef.current = nextAnswers;
    setAnswers(nextAnswers);
    localStorage.setItem(answersStorageKey, JSON.stringify(nextAnswers));
    syncSessionProgress(test.id, effectiveStudentId, {
      studentName,
      studentEmail,
      answers: nextAnswers,
      visitedQuestionIds: visitedRef.current,
      markedForReviewIds: markedForReviewRef.current,
      tabSwitchCount: tabSwitchCountRef.current,
      startedAt: startTimeRef.current,
    });
  };

  const handleToggleReview = () => {
    if (!currentQuestion) return;
    const qId = currentQuestion.id;
    let nextReviews: string[];
    if (markedForReviewRef.current.includes(qId)) {
      nextReviews = markedForReviewRef.current.filter((id) => id !== qId);
    } else {
      nextReviews = [...markedForReviewRef.current, qId];
    }
    markedForReviewRef.current = nextReviews;
    setMarkedForReview(nextReviews);
    localStorage.setItem(reviewStorageKey, JSON.stringify(nextReviews));
    syncSessionProgress(test.id, effectiveStudentId, {
      studentName,
      studentEmail,
      answers: answersRef.current,
      visitedQuestionIds: visitedRef.current,
      markedForReviewIds: nextReviews,
      tabSwitchCount: tabSwitchCountRef.current,
      startedAt: startTimeRef.current,
    });
  };

  const handleSaveAndNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((i) => i + 1);
    } else {
      setShowSubmitModal(true);
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex((i) => i - 1);
    }
  };

  const cycleLanguageMode = () => {
    setLanguageMode((prev) => (prev === 'both' ? 'en' : prev === 'en' ? 'hi' : 'both'));
  };

  // Submission handler
  const handleFinalSubmit = async (isAuto: boolean = false) => {
    if (isSubmitting || isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setIsSubmitting(true);
    setShowSubmitModal(false);

    try {
      // Always read the latest answers from ref and localStorage backup so auto-submit never uses stale mount state
      let latestAnswers = { ...answersRef.current };
      if (Object.keys(latestAnswers).length === 0) {
        try {
          const savedRaw = localStorage.getItem(answersStorageKey);
          if (savedRaw) {
            latestAnswers = JSON.parse(savedRaw);
          }
        } catch {
          // ignore
        }
      }

      const attempt = await submitExamAttempt({
        testId: test.id,
        studentId: effectiveStudentId,
        studentName,
        studentEmail,
        answers: latestAnswers,
        visitedQuestionIds: visitedRef.current,
        markedForReviewIds: markedForReviewRef.current,
        startedAt: startTimeRef.current,
        isAutoSubmitted: isAuto,
        tabSwitchCount: tabSwitchCountRef.current,
        activityLogs: activityLogsRef.current,
      });

      try {
        localStorage.removeItem(answersStorageKey);
        localStorage.removeItem(reviewStorageKey);
        localStorage.removeItem(visitedStorageKey);
        localStorage.removeItem(tabSwitchesKey);
        localStorage.removeItem(`pariksha_is_reattempt_${test.id}_${effectiveStudentId}`);
        localStorage.setItem(`pariksha_attempt_${test.id}`, JSON.stringify(attempt));
        localStorage.setItem(
          `pariksha_attempt_${test.id}_${studentName.toLowerCase().trim()}`,
          JSON.stringify(attempt)
        );
      } catch {
        // ignore
      }

      onSubmitted(attempt);
    } catch (err) {
      console.error('Submission error:', err);
      isSubmittingRef.current = false;
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

  const progressPercentage = useMemo(() => {
    if (questions.length === 0) return 0;
    return Math.min(100, Math.round((stats.answered / questions.length) * 100));
  }, [stats.answered, questions.length]);

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
      <div className="min-h-screen bg-surface flex items-center justify-center p-4 font-body text-on-surface">
        <div className="bg-surface-container-lowest p-6 rounded-2xl shadow-xs border border-outline-variant/20 text-center space-y-3 max-w-xs w-full">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="font-headline text-sm font-bold text-on-surface">
            Loading Examination Paper...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface font-body text-on-surface flex flex-col justify-between select-none antialiased">
      {/* =========================================================
          TOP UTILITY CONTEXT BAR (Aspirant Neo Exam Header)
      ========================================================= */}
      <header
        ref={headerRef}
        className="sticky top-0 z-30 bg-surface/95 backdrop-blur-md border-b border-outline-variant/20"
      >
        {/* Row 1: Exam Title, Language Toggle, Countdown Timer Pill & Submit */}
        <div className="max-w-5xl mx-auto px-4 py-2.5 flex items-center justify-between gap-2">
          <div className="flex flex-col min-w-0 flex-1">
            <span className="text-[10px] font-headline font-bold uppercase tracking-wider text-on-surface-variant truncate">
              {test.examCategory || 'ParikshaSetu Assessment'}
            </span>
            <h1 className="font-headline font-bold text-sm sm:text-base text-on-surface truncate">
              {test.title}
            </h1>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {!isOnline && (
              <span
                title="Offline Practice Mode: Answers saved locally"
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-tertiary-fixed text-on-tertiary-fixed text-[10px] font-headline font-bold"
              >
                <WifiOff className="w-3 h-3" />
                <span className="hidden sm:inline">Offline</span>
              </span>
            )}

            {/* Bilingual / Language Toggle Pill */}
            <button
              type="button"
              onClick={cycleLanguageMode}
              className="flex items-center gap-1 bg-primary-fixed text-on-primary-fixed px-2.5 py-1.5 rounded-lg text-xs font-headline font-bold active:scale-95 transition-transform cursor-pointer"
              title="Toggle Question Language (ENG / HIN / Both)"
            >
              <Languages className="w-3.5 h-3.5" />
              <span>
                {languageMode === 'both'
                  ? 'ENG / HIN'
                  : languageMode === 'en'
                  ? 'ENG ONLY'
                  : 'HIN ONLY'}
              </span>
            </button>

            {/* Dynamic Countdown Timer Pill */}
            <div
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border tabular-nums ${
                remainingSeconds < 300
                  ? 'bg-error text-on-error border-error animate-pulse'
                  : 'bg-surface-container-low text-on-surface border-outline-variant/30'
              }`}
            >
              <Clock
                className={`w-4 h-4 shrink-0 ${
                  remainingSeconds < 300 ? 'text-on-error' : 'text-primary'
                }`}
              />
              <span className="font-headline font-extrabold text-sm tracking-tight tabular-nums">
                {formattedTime}
              </span>
            </div>

            {/* Quick Submit Button */}
            <button
              type="button"
              onClick={() => setShowSubmitModal(true)}
              className="hidden sm:inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary text-on-primary font-headline font-bold text-xs shadow-2xs active:scale-95 transition-all cursor-pointer"
            >
              <span>Submit</span>
            </button>
          </div>
        </div>

        {/* Row 2: Section Switcher Tabs */}
        <div className="bg-surface-container-low border-t border-outline-variant/10">
          <div className="max-w-5xl mx-auto px-4 py-2 flex items-center justify-between gap-2 overflow-x-auto no-scrollbar">
            <div className="flex items-center gap-2">
              {sections.map((sec) => {
                const isActiveSec = currentSubject === sec.name;
                return (
                  <button
                    key={sec.name}
                    type="button"
                    onClick={() => setCurrentIndex(sec.firstIndex)}
                    className={`shrink-0 px-3 py-1 rounded-md text-xs font-headline font-bold transition-colors cursor-pointer ${
                      isActiveSec
                        ? 'bg-primary text-on-primary shadow-2xs'
                        : 'bg-surface-container-lowest text-on-surface-variant hover:text-on-surface border border-outline-variant/25'
                    }`}
                  >
                    {sec.name} ({sec.count})
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => setShowSubmitModal(true)}
              className="sm:hidden shrink-0 px-2.5 py-1 rounded-md bg-primary/10 text-primary font-headline font-bold text-xs cursor-pointer"
            >
              Submit Test
            </button>
          </div>
        </div>

        {/* Real-Time Micro Progress Bar */}
        <div className="w-full h-1 bg-surface-container-highest">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
      </header>

      {/* =========================================================
          MAIN QUESTION WORKSPACE
      ========================================================= */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 pt-4 pb-28 space-y-4">
        {currentQuestion ? (
          <>
            {/* Sticky Question Meta Header (stays visible on scroll below top navigation) */}
            <div
              className="sticky z-20 bg-surface/95 backdrop-blur-md p-3 sm:p-3.5 rounded-xl shadow-xs border border-outline-variant/20 flex items-center justify-between gap-2 transition-all"
              style={{ top: `${headerHeight}px` }}
            >
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-headline font-extrabold text-sm text-primary tabular-nums">
                  Question {currentIndex + 1} of {questions.length}
                </span>
                <span className="px-2 py-0.5 rounded bg-surface-container text-[11px] font-headline font-bold text-on-surface-variant tabular-nums">
                  +{test.marksPerQuestion} | -{test.negativeMarks}
                </span>
              </div>

              <button
                type="button"
                onClick={handleToggleReview}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-headline font-semibold transition-colors cursor-pointer ${
                  markedForReview.includes(currentQuestion.id)
                    ? 'bg-tertiary-fixed text-on-tertiary-fixed font-bold'
                    : 'text-on-surface-variant hover:text-primary hover:bg-surface-container-low'
                }`}
              >
                <Bookmark
                  className={`w-4 h-4 ${
                    markedForReview.includes(currentQuestion.id) ? 'fill-current' : ''
                  }`}
                />
                <span>
                  {markedForReview.includes(currentQuestion.id)
                    ? 'Marked for Review'
                    : 'Mark for Review'}
                </span>
              </button>
            </div>

            {/* Question Content Box (Bilingual / Formatted Display) */}
            <article className="bg-surface-container-lowest p-5 rounded-xl shadow-2xs border border-outline-variant/15 space-y-3">
              {currentQuestion.subject && (
                <div className="inline-block px-2 py-0.5 rounded bg-primary-fixed text-on-primary-fixed text-[10px] font-headline font-bold uppercase tracking-wider">
                  {currentQuestion.subject}
                </div>
              )}

              {/* Primary English Question */}
              {(languageMode === 'both' || languageMode === 'en') &&
                currentQuestion.questionText && (
                  <FormattedQuestionText
                    text={prefixQuestionWithNumber(currentQuestion.questionText, currentIndex + 1)}
                    className="text-[15px] sm:text-base leading-relaxed font-bold text-on-surface"
                    paragraphClassName="font-bold text-on-surface"
                  />
                )}

              {/* Secondary Hindi Question */}
              {(languageMode === 'both' || languageMode === 'hi') &&
                currentQuestion.questionTextHindi && (
                  <div
                    className={
                      languageMode === 'both' && currentQuestion.questionText
                        ? 'pt-2.5 border-t border-outline-variant/20'
                        : ''
                    }
                  >
                    <FormattedQuestionText
                      text={prefixQuestionWithNumber(currentQuestion.questionTextHindi, currentIndex + 1)}
                      className={
                        languageMode === 'both'
                          ? 'text-sm sm:text-[15px] leading-relaxed font-bold text-on-surface-variant'
                          : 'text-[15px] sm:text-base leading-relaxed font-bold text-on-surface'
                      }
                      paragraphClassName={
                        languageMode === 'both'
                          ? 'font-bold text-on-surface-variant'
                          : 'font-bold text-on-surface'
                      }
                    />
                  </div>
                )}

              {/* Question Diagram / Image */}
              {(currentQuestion.questionImageUrl || currentQuestion.imageUrl) && (
                <div className="pt-2">
                  <div className="max-w-md rounded-xl overflow-hidden border border-outline-variant/25 bg-surface-container-low p-2">
                    <CachedImage
                      src={currentQuestion.questionImageUrl || currentQuestion.imageUrl}
                      alt="Question Diagram"
                      className="w-full h-auto max-h-64 object-contain mx-auto bg-white rounded-lg"
                    />
                  </div>
                </div>
              )}
            </article>

            {/* Option Selection Rows */}
            <div className="space-y-2.5">
              {(['A', 'B', 'C', 'D'] as const).map((key) => {
                const optEng = currentQuestion.options?.[key];
                const optHindi = currentQuestion.optionsHindi?.[key];
                const optImage = currentQuestion.optionImages?.[key];
                if (!optEng && !optHindi && !optImage?.imageUrl) return null;

                const isSelected = answers[currentQuestion.id] === key;

                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleSelectOption(key)}
                    className={`w-full text-left p-4 rounded-xl transition-all flex items-start gap-3.5 active:scale-[0.99] cursor-pointer ${
                      isSelected
                        ? 'bg-primary/5 border-2 border-primary shadow-2xs'
                        : 'bg-surface-container-lowest border border-outline-variant/30 hover:border-primary/40'
                    }`}
                  >
                    {/* Option Letter Pill */}
                    <span
                      className={`w-8 h-8 rounded-full font-headline font-bold text-xs flex items-center justify-center shrink-0 transition-colors ${
                        isSelected
                          ? 'bg-primary text-on-primary shadow-2xs'
                          : 'bg-surface-container text-on-surface-variant'
                      }`}
                    >
                      {key}
                    </span>

                    {/* Option Content */}
                    <div className="flex-1 min-w-0 space-y-2 pt-1">
                      {(optEng || optHindi) && (
                        <div>
                          {languageMode === 'both' &&
                          optEng &&
                          optHindi &&
                          optEng.trim() !== optHindi.trim() ? (
                            <div className="flex flex-wrap items-start gap-1.5">
                              <FormattedQuestionText
                                text={optEng}
                                className={`text-sm ${
                                  isSelected
                                    ? 'font-bold text-on-surface'
                                    : 'font-medium text-on-surface'
                                }`}
                              />
                              <span className="text-outline font-bold">/</span>
                              <FormattedQuestionText
                                text={optHindi}
                                className={`text-sm ${
                                  isSelected
                                    ? 'font-semibold text-on-surface'
                                    : 'font-normal text-on-surface-variant'
                                }`}
                              />
                            </div>
                          ) : languageMode === 'hi' ? (
                            <FormattedQuestionText
                              text={optHindi || optEng}
                              className={`text-sm ${
                                isSelected
                                  ? 'font-bold text-on-surface'
                                  : 'font-medium text-on-surface'
                              }`}
                            />
                          ) : (
                            <FormattedQuestionText
                              text={optEng || optHindi}
                              className={`text-sm ${
                                isSelected
                                  ? 'font-bold text-on-surface'
                                  : 'font-medium text-on-surface'
                              }`}
                            />
                          )}
                        </div>
                      )}

                      {optImage?.imageUrl && (
                        <div className="max-w-xs rounded-xl overflow-hidden border border-outline-variant/25 bg-white p-1.5">
                          <CachedImage
                            src={optImage.imageUrl}
                            alt={`Option ${key} diagram`}
                            className="w-auto h-auto max-h-48 object-contain rounded"
                            loading="lazy"
                          />
                        </div>
                      )}
                    </div>

                    {/* Radio Indicator Dot */}
                    <span
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-1.5 ${
                        isSelected ? 'border-primary' : 'border-outline-variant'
                      }`}
                    >
                      {isSelected && <span className="w-2.5 h-2.5 rounded-full bg-primary" />}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Quick Palette Trigger Bar */}
            <div className="bg-surface-container-low p-3.5 rounded-xl flex items-center justify-between border border-outline-variant/15">
              <div className="flex items-center gap-2">
                <LayoutGrid className="w-4 h-4 text-primary" />
                <span className="text-xs font-headline font-semibold text-on-surface">
                  Overall Attempt Status
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsDrawerOpen(true)}
                className="flex items-center gap-2 text-xs font-headline font-bold text-primary cursor-pointer"
              >
                <span className="px-2 py-0.5 rounded bg-primary/10 text-primary tabular-nums">
                  {stats.answered}/{questions.length} Answered
                </span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </>
        ) : (
          <div className="text-center py-12 text-on-surface-variant">No question available.</div>
        )}
      </main>

      {/* =========================================================
          STICKY BOTTOM FLOATING ACTION STRIP
      ========================================================= */}
      <footer className="fixed bottom-0 left-0 right-0 z-40 bg-surface/95 backdrop-blur-lg border-t border-outline-variant/20 px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-2">
          {/* Clear Response */}
          <button
            type="button"
            onClick={handleClearResponse}
            disabled={!currentQuestion || !answers[currentQuestion.id]}
            className="px-3 py-2.5 rounded-lg bg-surface-container text-on-surface-variant font-headline font-bold text-xs hover:bg-surface-container-high active:scale-95 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Clear</span>
          </button>

          {/* Question Palette Trigger */}
          <button
            type="button"
            onClick={() => setIsDrawerOpen(true)}
            className="px-3 py-2.5 rounded-lg bg-surface-container-low border border-outline-variant/30 text-on-surface font-headline font-bold text-xs flex items-center gap-1.5 active:scale-95 transition-all cursor-pointer"
          >
            <LayoutGrid className="w-4 h-4 text-primary" />
            <span>Palette</span>
            <span className="px-1.5 py-0.5 rounded bg-primary-fixed text-on-primary-fixed text-[10px] tabular-nums">
              {stats.answered}/{questions.length}
            </span>
          </button>

          {/* Previous */}
          <button
            type="button"
            onClick={handlePrevious}
            disabled={currentIndex === 0}
            className="px-3 py-2.5 rounded-lg bg-surface-container text-on-surface font-headline font-bold text-xs flex items-center gap-1 active:scale-95 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Prev</span>
          </button>

          {/* Save & Next / Submit */}
          <button
            type="button"
            onClick={handleSaveAndNext}
            className="flex-1 sm:flex-none bg-linear-to-r from-primary to-primary-container text-on-primary font-headline font-bold text-xs sm:text-sm py-2.5 px-5 rounded-lg shadow-sm flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer"
          >
            <span>
              {currentIndex === questions.length - 1 ? 'Review & Submit' : 'Save & Next'}
            </span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </footer>

      {/* =========================================================
          SLIDE-UP QUESTION PALETTE BOTTOM SHEET
      ========================================================= */}
      {isDrawerOpen && (
        <div className="fixed inset-0 z-50 bg-on-surface/40 backdrop-blur-xs flex items-end justify-center">
          <div className="fixed inset-0" onClick={() => setIsDrawerOpen(false)} />
          <div className="relative w-full max-w-lg bg-surface-container-lowest rounded-t-3xl p-5 space-y-4 max-h-[82vh] flex flex-col shadow-2xl z-10 border-t border-outline-variant/20">
            <div className="w-10 h-1 bg-outline-variant/50 rounded-full mx-auto" />
            <div className="flex items-center justify-between border-b border-outline-variant/20 pb-3">
              <div>
                <h2 className="font-headline font-bold text-base text-on-surface">
                  Question Palette
                </h2>
                <p className="text-xs text-on-surface-variant">{test.title}</p>
              </div>
              <button
                type="button"
                onClick={() => setIsDrawerOpen(false)}
                className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* 4-State Status Legend */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center gap-2 bg-surface-container-low p-2 rounded-lg">
                <span className="w-3 h-3 rounded-sm bg-primary shrink-0" />
                <span className="text-on-surface-variant font-medium">
                  Answered:{' '}
                  <strong className="text-on-surface tabular-nums">{stats.answered}</strong>
                </span>
              </div>
              <div className="flex items-center gap-2 bg-surface-container-low p-2 rounded-lg">
                <span className="w-3 h-3 rounded-sm bg-error shrink-0" />
                <span className="text-on-surface-variant font-medium">
                  Not Answered:{' '}
                  <strong className="text-on-surface tabular-nums">{stats.notAnswered}</strong>
                </span>
              </div>
              <div className="flex items-center gap-2 bg-surface-container-low p-2 rounded-lg">
                <span className="w-3 h-3 rounded-sm bg-tertiary-container shrink-0" />
                <span className="text-on-surface-variant font-medium">
                  Marked Review:{' '}
                  <strong className="text-on-surface tabular-nums">
                    {stats.reviewOnly + stats.reviewAndAnswered}
                  </strong>
                </span>
              </div>
              <div className="flex items-center gap-2 bg-surface-container-low p-2 rounded-lg">
                <span className="w-3 h-3 rounded-sm bg-surface-container-highest border border-outline-variant shrink-0" />
                <span className="text-on-surface-variant font-medium">
                  Not Visited:{' '}
                  <strong className="text-on-surface tabular-nums">{stats.notVisited}</strong>
                </span>
              </div>
            </div>

            {/* 5-Column Question Number Grid */}
            <div className="grid grid-cols-5 gap-2.5 overflow-y-auto py-1">
              {questions.map((q, idx) => {
                const status = getQuestionNavStatus(q.id);
                const isCurrent = idx === currentIndex;

                let btnClass =
                  'bg-surface-container text-on-surface-variant border border-outline-variant/30';
                if (status === 'answered') {
                  btnClass = 'bg-primary text-on-primary';
                } else if (status === 'marked_and_answered') {
                  btnClass = 'bg-primary text-on-primary ring-2 ring-tertiary-container';
                } else if (status === 'marked_for_review') {
                  btnClass = 'bg-tertiary-container text-on-tertiary';
                } else if (status === 'not_answered') {
                  btnClass = 'bg-error-container text-on-error-container font-bold';
                }

                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => {
                      setCurrentIndex(idx);
                      setIsDrawerOpen(false);
                    }}
                    className={`h-10 rounded-lg font-headline font-bold text-xs flex items-center justify-center tabular-nums cursor-pointer relative ${btnClass} ${
                      isCurrent ? 'ring-2 ring-offset-2 ring-primary scale-105' : ''
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

            {/* Bottom Actions */}
            <div className="pt-2 border-t border-outline-variant/20 flex gap-3">
              <button
                type="button"
                onClick={() => setIsDrawerOpen(false)}
                className="flex-1 py-3 rounded-xl bg-surface-container text-on-surface font-headline font-bold text-xs cursor-pointer"
              >
                Back to Test
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsDrawerOpen(false);
                  setShowSubmitModal(true);
                }}
                className="flex-1 py-3 rounded-xl bg-primary text-on-primary font-headline font-bold text-xs shadow-sm cursor-pointer"
              >
                Submit Test
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================
          SUBMISSION CONFIRMATION MODAL
      ========================================================= */}
      {showSubmitModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-on-surface/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest rounded-2xl max-w-md w-full shadow-2xl border border-outline-variant/20 overflow-hidden">
            <div className="bg-linear-to-r from-primary to-primary-container px-6 py-4 text-on-primary">
              <h3 className="font-headline font-bold text-base">Submit Examination Confirmation</h3>
              <p className="text-xs text-on-primary-container">
                Review your attempt summary before final submission
              </p>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3 text-center tabular-nums">
                <div className="p-3 bg-primary-fixed/50 rounded-xl border border-primary/20">
                  <span className="text-xs text-on-primary-fixed font-headline font-semibold block">
                    Answered
                  </span>
                  <span className="text-2xl font-headline font-extrabold text-primary">
                    {stats.answered}
                  </span>
                </div>
                <div className="p-3 bg-error-container/40 rounded-xl border border-error/20">
                  <span className="text-xs text-on-error-container font-headline font-semibold block">
                    Unanswered
                  </span>
                  <span className="text-2xl font-headline font-extrabold text-error">
                    {stats.unanswered}
                  </span>
                </div>
              </div>

              <p className="text-xs sm:text-sm text-on-surface-variant text-center leading-relaxed">
                You have answered <strong className="text-on-surface">{stats.answered}</strong>{' '}
                questions and left <strong className="text-on-surface">{stats.unanswered}</strong>{' '}
                questions unanswered. Are you ready to submit your examination?
              </p>

              <div className="bg-tertiary-fixed/50 p-3 rounded-xl border border-tertiary/20 text-on-tertiary-fixed text-xs flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-tertiary" />
                <span>
                  Once submitted, your response sheet is locked and evaluated immediately.
                </span>
              </div>

              {!isOnline && (
                <div className="bg-primary-fixed/40 p-3 rounded-xl border border-primary/20 text-on-primary-fixed text-xs flex items-start gap-2">
                  <WifiOff className="w-4 h-4 shrink-0 mt-0.5 text-primary" />
                  <span>
                    <strong>Offline Practice Submission:</strong> Your scorecard will be calculated
                    locally on this device and synced automatically when internet resumes.
                  </span>
                </div>
              )}

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowSubmitModal(false)}
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 rounded-xl bg-surface-container text-on-surface font-headline font-bold text-xs sm:text-sm cursor-pointer"
                >
                  Cancel &amp; Review
                </button>
                <button
                  type="button"
                  onClick={() => handleFinalSubmit(false)}
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 bg-linear-to-r from-primary to-primary-container text-on-primary rounded-xl font-headline font-bold text-xs sm:text-sm shadow-xs cursor-pointer disabled:opacity-60 flex items-center justify-center gap-1.5"
                >
                  <Send className="w-4 h-4" />
                  <span>{isSubmitting ? 'Submitting...' : 'Submit Test'}</span>
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
        <div className="fixed inset-0 z-50 bg-on-surface/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest rounded-2xl max-w-sm w-full p-6 text-center space-y-4 border border-error/30 shadow-2xl">
            <div className="w-12 h-12 rounded-full bg-error-container text-error mx-auto flex items-center justify-center">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-headline text-base font-bold text-on-surface">
                Exam Proctoring Warning
              </h3>
              <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">
                You navigated away or minimized the examination screen. This event has been recorded
                in your examination activity log.
              </p>
            </div>
            <div className="bg-error-container/40 text-on-error-container text-xs font-headline font-bold py-2 px-3 rounded-lg border border-error/20 tabular-nums">
              Recorded Tab Switches: {tabSwitchCount}
            </div>
            <button
              type="button"
              onClick={() => setShowTabWarning(false)}
              className="w-full py-2.5 bg-primary text-on-primary rounded-xl font-headline font-bold text-xs cursor-pointer transition-opacity hover:opacity-95"
            >
              I Understand &amp; Return to Exam
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
