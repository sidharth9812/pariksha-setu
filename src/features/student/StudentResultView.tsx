import React, { useEffect, useState, useMemo } from 'react';
import {
  Award,
  CheckCircle2,
  Clock,
  ArrowLeft,
  ArrowRight,
  AlertCircle,
  Shield,
  Printer,
  RotateCw,
  Sparkles,
  Lock,
  Calendar,
  TrendingUp,
  History,
  LayoutDashboard,
  WifiOff,
  CheckCheck,
  Target,
  BarChart3,
} from 'lucide-react';
import { StudentAttempt, TestItem, QuestionItem } from '../../types/exam';
import {
  getTestById,
  getQuestionsForTest,
  subscribeToTest,
  getAllStudentAttemptsForTest,
  getTestAttempts,
} from '../../services/examService';
import {
  syncPendingOfflineAttempts,
  getDownloadedQuestions,
} from '../../services/offlineStorageService';
import { StudentAnswerKeyView } from './StudentAnswerKeyView';

interface StudentResultViewProps {
  attempt: StudentAttempt;
  onBackToPortal: () => void;
  onReattempt?: (test: TestItem) => void;
  onOpenAnswerKey?: (attempt: StudentAttempt) => void;
  initialShowAnswerKey?: boolean;
}

export const StudentResultView: React.FC<StudentResultViewProps> = ({
  attempt,
  onBackToPortal,
  onReattempt,
  onOpenAnswerKey,
  initialShowAnswerKey = false,
}) => {
  const [test, setTest] = useState<TestItem | null>(null);
  const [questions, setQuestions] = useState<QuestionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [allAttempts, setAllAttempts] = useState<StudentAttempt[]>([attempt]);
  const [allTestSubmissions, setAllTestSubmissions] = useState<StudentAttempt[]>([attempt]);
  const [selectedAttemptId, setSelectedAttemptId] = useState<string>(attempt.id);
  const [showAttemptHistoryPanel, setShowAttemptHistoryPanel] = useState(false);
  const [showAnswerKeyScreen, setShowAnswerKeyScreen] = useState<boolean>(initialShowAnswerKey);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    setShowAnswerKeyScreen(initialShowAnswerKey);
  }, [initialShowAnswerKey]);

  useEffect(() => {
    const onOn = () => setIsOnline(true);
    const onOff = () => setIsOnline(false);
    window.addEventListener('online', onOn);
    window.addEventListener('offline', onOff);
    return () => {
      window.removeEventListener('online', onOn);
      window.removeEventListener('offline', onOff);
    };
  }, []);

  const handleSyncAttempt = async () => {
    if (!isOnline || isSyncing) return;
    setIsSyncing(true);
    try {
      const res = await syncPendingOfflineAttempts();
      if (res.syncedCount > 0) {
        const syncedNow = new Date().toISOString();
        setAllAttempts((prev) =>
          prev.map((a) =>
            a.id === selectedAttemptId ? { ...a, synced: true, syncedAt: syncedNow } : a
          )
        );
      }
    } catch (err) {
      console.warn('Manual sync error:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  const loadData = async (isManualRefresh = false) => {
    if (isManualRefresh) setIsRefreshing(true);
    try {
      const [t, atts, testCohortAttempts] = await Promise.all([
        getTestById(attempt.testId),
        getAllStudentAttemptsForTest(attempt.testId, attempt.studentId, attempt.studentName),
        getTestAttempts(attempt.testId),
      ]);
      setTest(t);

      if (atts && atts.length > 0) {
        setAllAttempts(atts);
        if (!atts.some((a) => a.id === selectedAttemptId)) {
          setSelectedAttemptId(atts[atts.length - 1].id);
        }
      }

      if (testCohortAttempts && testCohortAttempts.length > 0) {
        setAllTestSubmissions(testCohortAttempts);
      }

      const isPublished =
        Boolean(t?.instantResult) ||
        t?.status === 'completed' ||
        t?.status === 'result_published' ||
        t?.status === 'released' ||
        attempt.isOffline;

      if (isPublished) {
        let qList = await getQuestionsForTest(attempt.testId, 'admin');
        if (!qList || qList.length === 0) {
          qList = await getDownloadedQuestions(attempt.testId);
        }
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

  const currentAttempt = allAttempts.find((a) => a.id === selectedAttemptId) || attempt;

  const isResultPublished =
    Boolean(test?.instantResult) ||
    test?.status === 'completed' ||
    test?.status === 'result_published' ||
    test?.status === 'released' ||
    Boolean(currentAttempt.isOffline);

  const answers = currentAttempt.answers || {};
  const totalQuestions = currentAttempt.totalQuestions || questions.length || 1;
  const attemptedCount = currentAttempt.attemptedCount ?? 0;
  const correctCount = currentAttempt.correctCount ?? 0;
  const incorrectCount = currentAttempt.incorrectCount ?? 0;
  const unattemptedCount =
    currentAttempt.unattemptedCount ?? Math.max(0, totalQuestions - attemptedCount);
  const posMarks = currentAttempt.positiveMarks ?? (test?.marksPerQuestion ?? 1);
  const negMarks = currentAttempt.negativeMarks ?? (test?.negativeMarks ?? 0.25);
  const maxPossibleMarks = totalQuestions * posMarks;
  const finalScore = currentAttempt.finalScore ?? 0;
  const negativePenalty = Number((incorrectCount * negMarks).toFixed(2));
  const percentage =
    currentAttempt.percentage ??
    (maxPossibleMarks > 0 ? Number(((finalScore / maxPossibleMarks) * 100).toFixed(1)) : 0);
  const accuracy =
    currentAttempt.accuracy ??
    (attemptedCount > 0 ? Number(((correctCount / attemptedCount) * 100).toFixed(1)) : 0);

  const passingMarks = useMemo(() => {
    if (test?.passingMarks && test.passingMarks > 0) return test.passingMarks;
    return Number((maxPossibleMarks * 0.4).toFixed(1));
  }, [test?.passingMarks, maxPossibleMarks]);

  const isQualified = finalScore >= passingMarks;

  // Real Rank, Percentile, and Cohort Average calculated from allTestSubmissions
  const rankInfo = useMemo(() => {
    const pool = [...allTestSubmissions];
    if (!pool.some((a) => a.id === currentAttempt.id)) {
      pool.push(currentAttempt);
    }
    const sorted = [...pool].sort((a, b) => (b.finalScore ?? 0) - (a.finalScore ?? 0));
    const totalParticipants = Math.max(1, sorted.length);
    const rankIdx = sorted.findIndex((a) => a.id === currentAttempt.id);
    const rank = rankIdx >= 0 ? rankIdx + 1 : 1;

    const belowOrEqualCount = sorted.filter(
      (a) => (a.finalScore ?? 0) <= (currentAttempt.finalScore ?? 0)
    ).length;
    const percentile =
      totalParticipants > 1
        ? Number(((belowOrEqualCount / totalParticipants) * 100).toFixed(1))
        : Number(Math.min(99.9, Math.max(50, percentage)).toFixed(1));

    const sumScores = sorted.reduce((acc, item) => acc + (Number(item.finalScore) || 0), 0);
    const avgScore =
      totalParticipants > 0 ? Number((sumScores / totalParticipants).toFixed(1)) : finalScore;

    return {
      rank,
      totalParticipants,
      percentile,
      avgScore,
    };
  }, [allTestSubmissions, currentAttempt, percentage, finalScore]);

  // Sectional / Subject Breakdown computed dynamically from real questions
  const sectionalBreakdown = useMemo(() => {
    if (!questions || questions.length === 0) return [];
    const map = new Map<
      string,
      {
        subject: string;
        total: number;
        attempted: number;
        correct: number;
        wrong: number;
        skipped: number;
        score: number;
        maxMarks: number;
      }
    >();

    questions.forEach((q) => {
      const subj =
        (q.subject || test?.subject || test?.examCategory || 'General Studies').trim() ||
        'General Studies';
      const entry = map.get(subj) || {
        subject: subj,
        total: 0,
        attempted: 0,
        correct: 0,
        wrong: 0,
        skipped: 0,
        score: 0,
        maxMarks: 0,
      };
      entry.total += 1;
      entry.maxMarks = Number((entry.maxMarks + posMarks).toFixed(2));
      const pick = answers[q.id];
      if (pick) {
        entry.attempted += 1;
        if (pick === q.correctAnswer) {
          entry.correct += 1;
          entry.score = Number((entry.score + posMarks).toFixed(2));
        } else {
          entry.wrong += 1;
          entry.score = Number((entry.score - negMarks).toFixed(2));
        }
      } else {
        entry.skipped += 1;
      }
      map.set(subj, entry);
    });

    return Array.from(map.values()).map((sec) => {
      const secAccuracy =
        sec.attempted > 0 ? Math.round((sec.correct / sec.attempted) * 100) : 0;
      const pctWidth =
        sec.maxMarks > 0 ? Math.max(0, Math.min(100, Math.round((sec.score / sec.maxMarks) * 100))) : 0;
      return {
        ...sec,
        accuracy: secAccuracy,
        pctWidth,
      };
    });
  }, [questions, answers, posMarks, negMarks, test?.subject, test?.examCategory]);

  // Time taken formatted
  const timeTakenFormatted = useMemo(() => {
    if (currentAttempt.startedAt && currentAttempt.submittedAt) {
      const start = new Date(currentAttempt.startedAt).getTime();
      const end = new Date(currentAttempt.submittedAt).getTime();
      const diffSec = Math.max(0, Math.round((end - start) / 1000));
      const mins = Math.floor(diffSec / 60);
      const secs = diffSec % 60;
      if (mins > 0) return `${mins}m ${secs}s`;
      return `${secs}s`;
    }
    return test?.durationMinutes ? `${test.durationMinutes}m` : 'Completed';
  }, [currentAttempt.startedAt, currentAttempt.submittedAt, test?.durationMinutes]);

  const correctPctBar =
    totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;
  const wrongPctBar =
    totalQuestions > 0 ? Math.round((incorrectCount / totalQuestions) * 100) : 0;
  const skippedPctBar = Math.max(0, 100 - correctPctBar - wrongPctBar);

  // If the separate Answer Key screen is open, render StudentAnswerKeyView!
  if (showAnswerKeyScreen && isResultPublished) {
    return (
      <StudentAnswerKeyView
        attempt={currentAttempt}
        onBackToResultSummary={() => setShowAnswerKeyScreen(false)}
        onBackToPortal={onBackToPortal}
      />
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center p-4 font-body text-on-surface">
        <div className="text-center space-y-3 bg-surface-container-lowest p-8 rounded-2xl border border-outline-variant/20 shadow-xs max-w-sm w-full">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <h3 className="font-headline text-base font-bold text-on-surface">
            Loading Result Summary
          </h3>
          <p className="text-xs text-on-surface-variant">
            Fetching official scorecard and rank analytics...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface font-body text-on-surface pb-16 antialiased print:bg-white print:p-0">
      {/* Top App Bar */}
      <header className="sticky top-0 z-40 bg-surface/90 backdrop-blur-md border-b border-outline-variant/15 print:hidden">
        <div className="flex items-center justify-between px-4 h-14 max-w-3xl mx-auto">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBackToPortal}
              aria-label="Back to Dashboard"
              className="w-9 h-9 rounded-lg flex items-center justify-center text-on-surface hover:bg-surface-container-low active:scale-95 transition-all cursor-pointer"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="font-headline font-bold text-base tracking-tight text-on-surface">
              Result Summary
            </h1>
          </div>

          <div className="flex items-center gap-2">
            {test?.status === 'released' && onReattempt && (
              <button
                type="button"
                onClick={() => onReattempt(test)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary-fixed text-on-primary-fixed font-headline font-bold text-xs hover:opacity-90 active:scale-95 transition-all cursor-pointer"
              >
                <RotateCw className="w-3.5 h-3.5" />
                <span>Reattempt</span>
              </button>
            )}

            {!isResultPublished && (
              <button
                type="button"
                onClick={() => loadData(true)}
                disabled={isRefreshing}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-tertiary-fixed text-on-tertiary-fixed font-headline font-bold text-xs cursor-pointer disabled:opacity-50"
              >
                <RotateCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                <span>{isRefreshing ? 'Checking...' : 'Refresh'}</span>
              </button>
            )}

            {isResultPublished && (
              <button
                type="button"
                onClick={() => window.print()}
                aria-label="Print Scorecard"
                className="w-9 h-9 rounded-lg flex items-center justify-center text-primary hover:bg-surface-container-low active:scale-95 transition-all cursor-pointer"
                title="Print / Save Scorecard PDF"
              >
                <Printer className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 pt-4 space-y-5">
        {/* Offline Attempt Sync Banner */}
        {currentAttempt.isOffline && !currentAttempt.synced && (
          <div className="bg-tertiary-fixed/50 border border-tertiary/20 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 print:hidden">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-tertiary-fixed text-tertiary rounded-lg shrink-0">
                <WifiOff className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-headline text-xs sm:text-sm font-bold text-on-tertiary-fixed">
                  Offline Practice Result • Saved Locally
                </h4>
                <p className="text-[11px] text-on-surface-variant leading-relaxed mt-0.5">
                  Completed offline. Your scorecard and answer key are stored on this device.
                  {isOnline
                    ? ' Tap Sync to upload to your cloud profile.'
                    : ' Connect to the internet to sync.'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleSyncAttempt}
              disabled={isSyncing || !isOnline}
              className="px-3.5 py-2 bg-tertiary text-on-tertiary rounded-lg text-xs font-headline font-bold shrink-0 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <RotateCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Syncing...' : isOnline ? 'Sync Now' : 'Offline'}</span>
            </button>
          </div>
        )}

        {/* Attempt Switcher Panel (shown when multiple attempts exist or toggled) */}
        {(allAttempts.length > 1 || showAttemptHistoryPanel) && (
          <div className="bg-surface-container-lowest p-4 rounded-xl border border-outline-variant/20 shadow-2xs space-y-3 print:hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-headline font-bold text-on-surface uppercase tracking-wider flex items-center gap-1.5">
                <History className="w-4 h-4 text-primary" />
                <span>Attempt History ({allAttempts.length})</span>
              </span>
              <span className="text-[11px] text-on-surface-variant">
                Select any attempt to inspect its result
              </span>
            </div>

            <div className="flex flex-wrap gap-2">
              {allAttempts.map((att, idx) => {
                const isSelected = att.id === currentAttempt.id;
                const isLatest = idx === allAttempts.length - 1;
                return (
                  <button
                    key={att.id}
                    type="button"
                    onClick={() => setSelectedAttemptId(att.id)}
                    className={`px-3 py-2 rounded-lg text-xs font-headline font-bold transition-all cursor-pointer flex items-center gap-2 ${
                      isSelected
                        ? 'bg-primary text-on-primary shadow-xs'
                        : 'bg-surface-container-low hover:bg-surface-container text-on-surface border border-outline-variant/20'
                    }`}
                  >
                    <span>Attempt #{att.attemptNumber || idx + 1}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded tabular-nums ${
                        isSelected
                          ? 'bg-white/20 text-white'
                          : 'bg-surface-container-highest text-on-surface'
                      }`}
                    >
                      {att.finalScore} Marks ({att.percentage}%)
                    </span>
                    {isLatest && (
                      <span
                        className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded ${
                          isSelected
                            ? 'bg-primary-fixed text-on-primary-fixed'
                            : 'bg-emerald-100 text-emerald-800'
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

        {/* CASE 1: AWAITING ADMIN RESULT PUBLICATION */}
        {!isResultPublished ? (
          <div className="space-y-5">
            <div className="bg-surface-container-lowest rounded-2xl p-6 sm:p-8 shadow-xs border border-outline-variant/20 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-tertiary-fixed text-tertiary mx-auto flex items-center justify-center relative">
                <Clock className="w-8 h-8 animate-pulse" />
                <span className="absolute -bottom-1 -right-1 p-1 bg-tertiary rounded-full text-on-tertiary">
                  <Lock className="w-3 h-3" />
                </span>
              </div>

              <div className="space-y-1">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-headline font-bold uppercase tracking-wider bg-tertiary-fixed text-on-tertiary-fixed">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Result Awaited</span>
                </span>
                <h2 className="font-headline text-xl sm:text-2xl font-extrabold text-on-surface pt-1">
                  Test Submitted Successfully
                </h2>
                <p className="text-xs sm:text-sm text-on-surface-variant">
                  Your response sheet has been recorded securely on the examination server.
                </p>
              </div>

              <div className="bg-surface-container-low rounded-xl p-4 text-left space-y-1.5 max-w-lg mx-auto border border-outline-variant/20">
                <div className="flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-tertiary shrink-0 mt-0.5" />
                  <div className="text-xs text-on-surface-variant leading-relaxed">
                    <p className="font-headline font-bold text-on-surface">
                      Official Result Publication Notice
                    </p>
                    <p className="mt-0.5">
                      Once the administrator concludes this live examination session, your scorecard, rank, and detailed answer key will unlock automatically on this screen.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Candidate Submission Slip */}
            <div className="bg-surface-container-lowest rounded-xl p-5 shadow-xs border border-outline-variant/15 space-y-4">
              <div className="flex items-center justify-between border-b border-outline-variant/15 pb-3">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-primary" />
                  <h3 className="font-headline font-bold text-sm text-on-surface">
                    Candidate Submission Slip
                  </h3>
                </div>
                <span className="text-[10px] font-headline font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-primary-fixed text-on-primary-fixed">
                  Receipt Verified
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-lg bg-surface-container-low">
                  <span className="text-on-surface-variant block uppercase tracking-wider text-[10px] font-bold">
                    Candidate Name
                  </span>
                  <span className="font-headline font-bold text-on-surface text-sm mt-0.5 block">
                    {currentAttempt.studentName}
                  </span>
                </div>
                <div className="p-3 rounded-lg bg-surface-container-low">
                  <span className="text-on-surface-variant block uppercase tracking-wider text-[10px] font-bold">
                    Exam Paper
                  </span>
                  <span className="font-headline font-bold text-on-surface text-sm mt-0.5 block">
                    {currentAttempt.testTitle}
                  </span>
                </div>
                <div className="p-3 rounded-lg bg-surface-container-low">
                  <span className="text-on-surface-variant block uppercase tracking-wider text-[10px] font-bold">
                    Attempted Questions
                  </span>
                  <span className="font-headline font-bold text-on-surface text-sm mt-0.5 block tabular-nums">
                    {currentAttempt.attemptedCount} / {totalQuestions}
                  </span>
                </div>
                <div className="p-3 rounded-lg bg-surface-container-low">
                  <span className="text-on-surface-variant block uppercase tracking-wider text-[10px] font-bold">
                    Submitted At
                  </span>
                  <span className="font-headline font-bold text-on-surface text-sm mt-0.5 block tabular-nums">
                    {currentAttempt.submittedAt
                      ? new Date(currentAttempt.submittedAt).toLocaleString()
                      : 'Recorded'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* CASE 2: RESULT PUBLISHED — ASPIRANT NEO RESULT SUMMARY SCREEN */
          <>
            {/* Test Metadata & Status Header */}
            <section className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-primary-fixed text-on-primary-fixed font-headline font-bold text-[11px] uppercase tracking-wider">
                  <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
                  <span>Test Submitted Successfully</span>
                </span>
                <span className="text-xs font-medium text-on-surface-variant">
                  &bull; Attempt #{currentAttempt.attemptNumber || 1}
                </span>
                <span className="text-xs font-medium text-on-surface-variant">
                  &bull; Candidate: <strong className="text-on-surface">{currentAttempt.studentName}</strong>
                </span>
              </div>

              <h2 className="font-headline font-extrabold text-xl sm:text-2xl text-on-surface tracking-tight leading-snug">
                {currentAttempt.testTitle || test?.title}
              </h2>

              <div className="flex flex-wrap items-center gap-4 text-xs text-on-surface-variant pt-0.5">
                <span className="flex items-center gap-1 tabular-nums">
                  <Calendar className="w-3.5 h-3.5 text-outline" />
                  <span>
                    {currentAttempt.submittedAt
                      ? new Date(currentAttempt.submittedAt).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })
                      : 'Recent'}
                  </span>
                </span>
                <span className="flex items-center gap-1 tabular-nums">
                  <Clock className="w-3.5 h-3.5 text-outline" />
                  <span>
                    {timeTakenFormatted}
                    {test?.durationMinutes ? ` / ${test.durationMinutes}m` : ''}
                  </span>
                </span>
              </div>
            </section>

            {/* Hero Score Card */}
            <section className="bg-surface-container-lowest rounded-xl p-5 shadow-xs border border-outline-variant/15 relative overflow-hidden">
              <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-primary-fixed/40 blur-2xl pointer-events-none" />
              <div className="relative z-10 flex flex-col gap-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-headline font-bold uppercase tracking-wider text-on-surface-variant">
                      Overall Score
                    </p>
                    <div className="flex items-baseline gap-1.5 mt-1 tabular-nums">
                      <span className="font-headline font-extrabold text-4xl text-primary tracking-tight">
                        {finalScore}
                      </span>
                      <span className="font-headline font-semibold text-base text-outline">
                        / {maxPossibleMarks}
                      </span>
                    </div>
                  </div>

                  {/* Qualification Status Pill */}
                  <div
                    className={`flex flex-col items-end px-3 py-1.5 rounded-lg border ${
                      isQualified
                        ? 'bg-emerald-50 border-emerald-200/60'
                        : 'bg-tertiary-fixed/60 border-tertiary/20'
                    }`}
                  >
                    <div className="flex items-center gap-1">
                      <Award
                        className={`w-4 h-4 ${
                          isQualified ? 'text-emerald-700' : 'text-tertiary'
                        }`}
                      />
                      <span
                        className={`font-headline font-bold text-xs ${
                          isQualified ? 'text-emerald-800' : 'text-on-tertiary-fixed'
                        }`}
                      >
                        {isQualified ? 'Qualified Cutoff' : 'Below Cutoff'}
                      </span>
                    </div>
                    <span
                      className={`text-[10px] font-medium tabular-nums ${
                        isQualified ? 'text-emerald-600' : 'text-tertiary'
                      }`}
                    >
                      Passing Marks: {passingMarks}
                    </span>
                  </div>
                </div>

                {/* Score Bar & Cutoff Comparison */}
                <div className="pt-3 border-t border-outline-variant/15 grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[11px] text-on-surface-variant font-medium">
                      Total Percentage
                    </p>
                    <p className="font-headline font-bold text-sm text-on-surface tabular-nums mt-0.5">
                      {percentage}%
                    </p>
                  </div>
                  <div className="border-l border-outline-variant/15 pl-4">
                    <p className="text-[11px] text-on-surface-variant font-medium">
                      Marking Scheme
                    </p>
                    <p className="font-headline font-bold text-sm text-on-surface tabular-nums mt-0.5">
                      +{posMarks} / -{negMarks}{' '}
                      <span className="text-[11px] font-medium text-emerald-600">
                        ({correctCount} Right)
                      </span>
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* 2x2 Key Metrics Bento Grid */}
            <section className="grid grid-cols-2 gap-3">
              {/* Rank Card */}
              <div className="bg-surface-container-lowest rounded-xl p-4 border border-outline-variant/15 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-on-surface-variant">Rank</span>
                  <div className="w-7 h-7 rounded-lg bg-primary-fixed flex items-center justify-center text-primary">
                    <Award className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3 tabular-nums">
                  <p className="font-headline font-extrabold text-xl text-on-surface">
                    #{rankInfo.rank}{' '}
                    <span className="text-xs font-normal text-outline">
                      / {rankInfo.totalParticipants}
                    </span>
                  </p>
                  <p className="text-[11px] text-primary font-semibold mt-0.5">
                    {rankInfo.rank === 1
                      ? 'Top Scorer'
                      : `Among ${rankInfo.totalParticipants} Submissions`}
                  </p>
                </div>
              </div>

              {/* Percentile Card */}
              <div className="bg-surface-container-lowest rounded-xl p-4 border border-outline-variant/15 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-on-surface-variant">Percentile</span>
                  <div className="w-7 h-7 rounded-lg bg-secondary-fixed flex items-center justify-center text-secondary">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3 tabular-nums">
                  <p className="font-headline font-extrabold text-xl text-on-surface">
                    {rankInfo.percentile}%
                  </p>
                  <div className="w-full h-1.5 bg-surface-container rounded-full mt-1.5 overflow-hidden">
                    <div
                      className="bg-primary h-full rounded-full"
                      style={{ width: `${Math.min(100, Math.max(5, rankInfo.percentile))}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Accuracy Card */}
              <div className="bg-surface-container-lowest rounded-xl p-4 border border-outline-variant/15 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-on-surface-variant">
                    Overall Accuracy
                  </span>
                  <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700">
                    <Target className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3 tabular-nums">
                  <p className="font-headline font-extrabold text-xl text-on-surface">
                    {accuracy}%
                  </p>
                  <p className="text-[11px] text-emerald-700 font-medium mt-0.5">
                    {correctCount}/{attemptedCount} Attempted Right
                  </p>
                </div>
              </div>

              {/* Average Aspirant Score Card */}
              <div className="bg-surface-container-lowest rounded-xl p-4 border border-outline-variant/15 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-on-surface-variant">
                    Avg. Aspirant Score
                  </span>
                  <div className="w-7 h-7 rounded-lg bg-tertiary-fixed flex items-center justify-center text-tertiary">
                    <BarChart3 className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3 tabular-nums">
                  <p className="font-headline font-extrabold text-xl text-on-surface">
                    {rankInfo.avgScore}{' '}
                    <span className="text-xs font-normal text-outline">/{maxPossibleMarks}</span>
                  </p>
                  <p className="text-[11px] text-on-surface-variant font-medium mt-0.5">
                    {finalScore >= rankInfo.avgScore
                      ? `+${(finalScore - rankInfo.avgScore).toFixed(1)} above average`
                      : `${(finalScore - rankInfo.avgScore).toFixed(1)} vs average`}
                  </p>
                </div>
              </div>
            </section>

            {/* Question Breakdown & Negative Marking Analysis */}
            <section className="bg-surface-container-lowest rounded-xl p-5 border border-outline-variant/15 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-headline font-bold text-sm text-on-surface">
                  Question Distribution
                </h3>
                <span className="text-xs font-medium text-on-surface-variant tabular-nums">
                  Total: {totalQuestions} Qs
                </span>
              </div>

              {/* Segmented Visual Bar */}
              <div className="h-2.5 w-full rounded-full bg-surface-container overflow-hidden flex gap-0.5">
                {correctPctBar > 0 && (
                  <div
                    className="bg-primary h-full transition-all"
                    style={{ width: `${correctPctBar}%` }}
                    title={`Correct: ${correctCount}`}
                  />
                )}
                {wrongPctBar > 0 && (
                  <div
                    className="bg-error h-full transition-all"
                    style={{ width: `${wrongPctBar}%` }}
                    title={`Wrong: ${incorrectCount}`}
                  />
                )}
                {skippedPctBar > 0 && (
                  <div
                    className="bg-surface-dim h-full transition-all"
                    style={{ width: `${skippedPctBar}%` }}
                    title={`Skipped: ${unattemptedCount}`}
                  />
                )}
              </div>

              {/* 3-Column Stat Boxes */}
              <div className="grid grid-cols-3 gap-2.5 pt-1 tabular-nums">
                <div className="bg-surface-container-low rounded-lg p-3">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-primary" />
                    <span className="text-[11px] font-medium text-on-surface-variant">
                      Correct
                    </span>
                  </div>
                  <p className="font-headline font-extrabold text-lg text-on-surface mt-1">
                    {correctCount}
                  </p>
                  <p className="text-[10px] font-semibold text-primary">
                    +{(correctCount * posMarks).toFixed(2)} Marks
                  </p>
                </div>

                <div className="bg-error-container/30 rounded-lg p-3">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-error" />
                    <span className="text-[11px] font-medium text-on-error-container">Wrong</span>
                  </div>
                  <p className="font-headline font-extrabold text-lg text-error mt-1">
                    {incorrectCount}
                  </p>
                  <p className="text-[10px] font-semibold text-error">
                    -{negativePenalty.toFixed(2)} Marks
                  </p>
                </div>

                <div className="bg-surface-container-low rounded-lg p-3">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-outline" />
                    <span className="text-[11px] font-medium text-on-surface-variant">
                      Skipped
                    </span>
                  </div>
                  <p className="font-headline font-extrabold text-lg text-on-surface mt-1">
                    {unattemptedCount}
                  </p>
                  <p className="text-[10px] font-medium text-outline">0.00 Marks</p>
                </div>
              </div>

              {/* Negative Marking Impact Strip */}
              <div className="flex items-center justify-between bg-surface-container-low px-3.5 py-2.5 rounded-lg">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-error" />
                  <span className="text-xs font-medium text-on-surface">
                    Negative Marking Penalty (-{negMarks}/wrong)
                  </span>
                </div>
                <span className="font-headline font-bold text-xs text-error tabular-nums">
                  -{negativePenalty.toFixed(2)} Marks
                </span>
              </div>
            </section>

            {/* Sectional / Subject Breakdown */}
            {sectionalBreakdown.length > 0 && (
              <section className="space-y-3">
                <div className="flex items-center justify-between px-0.5">
                  <h3 className="font-headline font-bold text-sm text-on-surface">
                    Sectional Breakdown
                  </h3>
                  <span className="text-[11px] font-semibold text-primary">
                    {sectionalBreakdown.length}{' '}
                    {sectionalBreakdown.length === 1 ? 'Section' : 'Sections'}
                  </span>
                </div>

                <div className="space-y-2.5">
                  {sectionalBreakdown.map((sec) => (
                    <div
                      key={sec.subject}
                      className="bg-surface-container-lowest rounded-xl p-4 border border-outline-variant/15 space-y-2.5"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-headline font-bold text-xs text-on-surface">
                            {sec.subject}
                          </p>
                          <p className="text-[11px] text-on-surface-variant tabular-nums">
                            {sec.correct} Correct &bull; {sec.wrong} Wrong &bull; {sec.skipped}{' '}
                            Skipped
                          </p>
                        </div>
                        <div className="text-right tabular-nums">
                          <span className="font-headline font-extrabold text-sm text-on-surface">
                            {sec.score}
                          </span>
                          <span className="text-xs text-outline"> / {sec.maxMarks}</span>
                          <span
                            className={`block text-[10px] font-semibold px-1.5 py-0.5 rounded mt-0.5 ${
                              sec.accuracy >= 70
                                ? 'text-primary bg-primary-fixed'
                                : 'text-tertiary bg-tertiary-fixed'
                            }`}
                          >
                            {sec.accuracy}% Acc.
                          </span>
                        </div>
                      </div>
                      <div className="w-full h-1.5 bg-surface-container rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            sec.accuracy >= 70 ? 'bg-primary' : 'bg-tertiary-container'
                          }`}
                          style={{ width: `${sec.pctWidth}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Primary Call To Action Block (Strictly Separate Answer Key Page Navigation) */}
            <section className="pt-2 space-y-3 print:hidden">
              <button
                type="button"
                onClick={() => {
                  if (onOpenAnswerKey) {
                    onOpenAnswerKey(currentAttempt);
                  } else {
                    setShowAnswerKeyScreen(true);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }
                }}
                className="w-full bg-linear-to-r from-primary to-primary-container text-on-primary font-headline font-bold text-base py-4 px-6 rounded-xl shadow-md flex items-center justify-between active:scale-[0.98] transition-all cursor-pointer group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-white/15 flex items-center justify-center">
                    <CheckCheck className="w-5 h-5 text-white" />
                  </div>
                  <div className="text-left">
                    <span className="block leading-none">View Answer Key &amp; Solutions</span>
                    <span className="text-[11px] font-body font-normal text-on-primary-container opacity-90 mt-1 block">
                      Step-by-step explanations for all {totalQuestions} questions
                    </span>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
              </button>

              {/* Secondary Action Buttons */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setShowAttemptHistoryPanel((prev) => !prev)}
                  className="bg-surface-container-low hover:bg-surface-container text-on-surface font-headline font-bold text-xs py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 active:scale-[0.98] transition-all cursor-pointer"
                >
                  <History className="w-4 h-4 text-primary" />
                  <span>Attempt History ({allAttempts.length})</span>
                </button>
                <button
                  type="button"
                  onClick={onBackToPortal}
                  className="bg-surface-container-low hover:bg-surface-container text-on-surface font-headline font-bold text-xs py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 active:scale-[0.98] transition-all cursor-pointer"
                >
                  <LayoutDashboard className="w-4 h-4 text-on-surface-variant" />
                  <span>Back to Dashboard</span>
                </button>
              </div>
            </section>

            {/* Mentor Insight Card */}
            <section className="bg-surface-container-low rounded-xl p-4 flex items-start gap-3.5 border border-outline-variant/20">
              <div className="w-9 h-9 rounded-lg bg-primary text-on-primary flex items-center justify-center shrink-0 mt-0.5">
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="space-y-1">
                <h4 className="font-headline font-bold text-xs text-on-surface">
                  Performance Insight
                </h4>
                <p className="text-xs text-on-surface-variant leading-relaxed">
                  {incorrectCount > 0 ? (
                    <>
                      Reviewing your{' '}
                      <span className="font-semibold text-on-surface">
                        {incorrectCount} incorrect responses
                      </span>{' '}
                      (which deducted{' '}
                      <span className="font-semibold text-error">
                        -{negativePenalty.toFixed(2)} marks
                      </span>
                      ) and{' '}
                      <span className="font-semibold text-on-surface">
                        {unattemptedCount} unattempted questions
                      </span>{' '}
                      in the Answer Key can help boost your score by up to{' '}
                      <span className="font-semibold text-primary">
                        +{(incorrectCount * posMarks + negativePenalty).toFixed(1)} marks
                      </span>
                      .
                    </>
                  ) : unattemptedCount > 0 ? (
                    <>
                      Excellent accuracy! You made zero negative-marking mistakes. Review the{' '}
                      <span className="font-semibold text-on-surface">
                        {unattemptedCount} unattempted questions
                      </span>{' '}
                      in the Answer Key to maximize your total score.
                    </>
                  ) : (
                    <>
                      Outstanding attempt! Open the Answer Key &amp; Solutions to review the verified explanations for all {totalQuestions} questions.
                    </>
                  )}
                </p>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
};
