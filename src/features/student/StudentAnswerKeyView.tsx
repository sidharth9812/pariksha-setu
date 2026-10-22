import React, { useEffect, useState, useMemo } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  MinusCircle,
  Clock,
  Bookmark,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  X,
  Sparkles,
  Printer,
  Languages,
  AlertCircle,
  Award,
  CheckCheck,
} from 'lucide-react';
import { StudentAttempt, TestItem, QuestionItem } from '../../types/exam';
import {
  getTestById,
  getQuestionsForTest,
  getAllStudentAttemptsForTest,
} from '../../services/examService';
import { CachedImage } from '../../components/common/CachedImage';
import { getDownloadedQuestions } from '../../services/offlineStorageService';
import { FormattedQuestionText } from '../../utils/questionTextFormatter';

interface StudentAnswerKeyViewProps {
  attempt: StudentAttempt;
  onBackToResultSummary: () => void;
  onBackToPortal: () => void;
}

export const StudentAnswerKeyView: React.FC<StudentAnswerKeyViewProps> = ({
  attempt,
  onBackToResultSummary,
}) => {
  const [test, setTest] = useState<TestItem | null>(null);
  const [questions, setQuestions] = useState<QuestionItem[]>([]);
  const [activeFilter, setActiveFilter] = useState<
    'all' | 'correct' | 'incorrect' | 'unattempted' | 'marked'
  >('all');
  const [selectedQuestionId, setSelectedQuestionId] = useState<string>('');
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [languageMode, setLanguageMode] = useState<'both' | 'hi' | 'en'>('both');
  const [loading, setLoading] = useState(true);
  const [allAttempts, setAllAttempts] = useState<StudentAttempt[]>([attempt]);
  const [selectedAttemptId, setSelectedAttemptId] = useState<string>(attempt.id);

  useEffect(() => {
    let isMounted = true;
    async function loadAnswerKeyData() {
      setLoading(true);
      try {
        const [t, atts] = await Promise.all([
          getTestById(attempt.testId),
          getAllStudentAttemptsForTest(attempt.testId, attempt.studentId, attempt.studentName),
        ]);
        if (!isMounted) return;
        setTest(t);

        if (atts && atts.length > 0) {
          setAllAttempts(atts);
          if (!atts.some((a) => a.id === selectedAttemptId)) {
            setSelectedAttemptId(attempt.id);
          }
        }

        let qList = await getQuestionsForTest(attempt.testId, 'admin');
        if (!qList || qList.length === 0) {
          qList = await getDownloadedQuestions(attempt.testId);
        }
        if (!isMounted) return;
        setQuestions(qList);
        if (qList.length > 0) {
          setSelectedQuestionId((prev) => prev || qList[0].id);
        }
      } catch (err) {
        console.error('Failed to load answer key questions:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadAnswerKeyData();
    return () => {
      isMounted = false;
    };
  }, [attempt.testId, attempt.id, attempt.studentId, attempt.studentName]);

  const currentAttempt = useMemo(
    () => allAttempts.find((a) => a.id === selectedAttemptId) || attempt,
    [allAttempts, selectedAttemptId, attempt]
  );

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
  const accuracy =
    currentAttempt.accuracy ??
    (attemptedCount > 0 ? Number(((correctCount / attemptedCount) * 100).toFixed(1)) : 0);

  const markedForReviewIds = currentAttempt.markedForReviewIds || [];
  const markedIdsSet = useMemo(() => new Set(markedForReviewIds), [markedForReviewIds]);
  const markedForReviewCount = markedForReviewIds.length;

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
      return true;
    });
  }, [questions, answers, activeFilter, markedIdsSet]);

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

  const displayQNum =
    currentQuestion?.questionNumber || (actualOverallIndex >= 0 ? actualOverallIndex + 1 : 1);

  const avgTimePerQuestion = useMemo(() => {
    if (currentAttempt.startedAt && currentAttempt.submittedAt && totalQuestions > 0) {
      const start = new Date(currentAttempt.startedAt).getTime();
      const end = new Date(currentAttempt.submittedAt).getTime();
      const diffSec = Math.max(0, Math.round((end - start) / 1000));
      const avg = Math.max(1, Math.round(diffSec / totalQuestions));
      const mins = Math.floor(avg / 60);
      const secs = avg % 60;
      return `${mins.toString().padStart(2, '0')}m ${secs.toString().padStart(2, '0')}s`;
    }
    return null;
  }, [currentAttempt.startedAt, currentAttempt.submittedAt, totalQuestions]);

  const handleFilterChange = (
    filter: 'all' | 'correct' | 'incorrect' | 'unattempted' | 'marked'
  ) => {
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
    if (matches.length > 0 && !matches.some((q) => q.id === selectedQuestionId)) {
      setSelectedQuestionId(matches[0].id);
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
    setIsPaletteOpen(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center p-4 font-body text-on-surface">
        <div className="bg-surface-container-lowest p-8 rounded-2xl border border-outline-variant/20 shadow-sm text-center space-y-3 max-w-sm w-full">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <h3 className="font-headline text-base font-bold text-on-surface">
            Loading Answer Key & Solutions
          </h3>
          <p className="text-xs text-on-surface-variant">
            Preparing verified question-by-question breakdown...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface font-body text-on-surface flex flex-col pb-24 antialiased">
      {/* Top App Bar */}
      <header className="sticky top-0 z-40 h-14 bg-surface/95 backdrop-blur-md border-b border-outline-variant/20 px-4 flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onBackToResultSummary}
            className="w-9 h-9 rounded-lg flex items-center justify-center text-on-surface hover:bg-surface-container-low active:scale-95 transition-all cursor-pointer shrink-0"
            title="Back to Result Summary"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <h1 className="font-headline font-bold text-base sm:text-lg tracking-tight text-on-surface truncate">
              Answer Key &amp; Solutions
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Language Switcher Pill */}
          <div className="hidden sm:flex items-center bg-surface-container-low p-0.5 rounded-lg border border-outline-variant/20 text-[11px] font-headline font-bold">
            <button
              type="button"
              onClick={() => setLanguageMode('both')}
              className={`px-2 py-1 rounded-md cursor-pointer transition-colors ${
                languageMode === 'both'
                  ? 'bg-primary text-on-primary'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              ENG/HIN
            </button>
            <button
              type="button"
              onClick={() => setLanguageMode('en')}
              className={`px-2 py-1 rounded-md cursor-pointer transition-colors ${
                languageMode === 'en'
                  ? 'bg-primary text-on-primary'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              ENG
            </button>
            <button
              type="button"
              onClick={() => setLanguageMode('hi')}
              className={`px-2 py-1 rounded-md cursor-pointer transition-colors ${
                languageMode === 'hi'
                  ? 'bg-primary text-on-primary'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              HIN
            </button>
          </div>

          <button
            type="button"
            onClick={() =>
              setLanguageMode((prev) =>
                prev === 'both' ? 'hi' : prev === 'hi' ? 'en' : 'both'
              )
            }
            className="sm:hidden flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-surface-container-low border border-outline-variant/20 text-[11px] font-headline font-bold text-primary cursor-pointer"
            title="Switch Language"
          >
            <Languages className="w-3.5 h-3.5" />
            <span className="uppercase">{languageMode}</span>
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-container-low hover:bg-surface-container text-on-surface text-xs font-headline font-bold border border-outline-variant/20 cursor-pointer transition-colors"
          >
            <Printer className="w-3.5 h-3.5 text-primary" />
            <span>Print</span>
          </button>
        </div>
      </header>

      {/* Sub-header Meta Banner */}
      <div className="bg-surface-container-low px-4 py-3 border-b border-outline-variant/15">
        <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <div>
            <span className="text-xs font-headline font-bold uppercase tracking-wider text-on-surface-variant block">
              {currentAttempt.testTitle || test?.title || 'Official Examination'}
            </span>
            <p className="text-[11px] text-outline mt-0.5">
              Read-Only Review Mode &bull; Score:{' '}
              <strong className="text-on-surface tabular-nums">
                {finalScore}/{maxPossibleMarks}
              </strong>{' '}
              &bull; Accuracy: <strong className="text-emerald-700 tabular-nums">{accuracy}%</strong>
            </p>
          </div>
          <div className="flex items-center gap-2">
            {allAttempts.length > 1 && (
              <select
                value={currentAttempt.id}
                onChange={(e) => setSelectedAttemptId(e.target.value)}
                className="bg-surface-container-lowest border border-outline-variant/30 rounded-md px-2.5 py-1 text-[11px] font-headline font-bold text-on-surface outline-none cursor-pointer"
              >
                {allAttempts.map((att, idx) => (
                  <option key={att.id} value={att.id}>
                    Attempt #{att.attemptNumber || idx + 1} ({att.finalScore} Marks)
                  </option>
                ))}
              </select>
            )}
            <div className="bg-primary-fixed text-on-primary-fixed px-2.5 py-1 rounded-md text-[11px] font-headline font-bold flex items-center gap-1">
              <CheckCheck className="w-3.5 h-3.5" />
              <span>SOLUTIONS</span>
            </div>
          </div>
        </div>
      </div>

      {/* Horizontal Filter Pills Bar */}
      <div className="bg-surface sticky top-14 z-30 py-3 px-4 border-b border-outline-variant/15">
        <div className="max-w-5xl mx-auto flex items-center gap-2 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => handleFilterChange('all')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-headline font-bold whitespace-nowrap transition-all cursor-pointer shrink-0 ${
              activeFilter === 'all'
                ? 'bg-primary text-on-primary shadow-xs'
                : 'bg-surface-container-lowest text-on-surface-variant border border-outline-variant/30 hover:bg-surface-container-low'
            }`}
          >
            All ({totalQuestions})
          </button>

          <button
            type="button"
            onClick={() => handleFilterChange('correct')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-headline font-bold whitespace-nowrap transition-all cursor-pointer shrink-0 flex items-center gap-1.5 ${
              activeFilter === 'correct'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-surface-container-lowest text-on-surface-variant border border-outline-variant/30 hover:bg-surface-container-low'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                activeFilter === 'correct' ? 'bg-white' : 'bg-emerald-600'
              }`}
            />
            <span>Correct ({correctCount})</span>
          </button>

          <button
            type="button"
            onClick={() => handleFilterChange('incorrect')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-headline font-bold whitespace-nowrap transition-all cursor-pointer shrink-0 flex items-center gap-1.5 ${
              activeFilter === 'incorrect'
                ? 'bg-error text-on-error shadow-xs'
                : 'bg-surface-container-lowest text-on-surface-variant border border-outline-variant/30 hover:bg-surface-container-low'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                activeFilter === 'incorrect' ? 'bg-white' : 'bg-error'
              }`}
            />
            <span>Wrong ({incorrectCount})</span>
          </button>

          <button
            type="button"
            onClick={() => handleFilterChange('unattempted')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-headline font-bold whitespace-nowrap transition-all cursor-pointer shrink-0 flex items-center gap-1.5 ${
              activeFilter === 'unattempted'
                ? 'bg-inverse-surface text-inverse-on-surface shadow-xs'
                : 'bg-surface-container-lowest text-on-surface-variant border border-outline-variant/30 hover:bg-surface-container-low'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-outline-variant" />
            <span>Unattempted ({unattemptedCount})</span>
          </button>

          {markedForReviewCount > 0 && (
            <button
              type="button"
              onClick={() => handleFilterChange('marked')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-headline font-bold whitespace-nowrap transition-all cursor-pointer shrink-0 flex items-center gap-1.5 ${
                activeFilter === 'marked'
                  ? 'bg-tertiary text-on-tertiary shadow-xs'
                  : 'bg-surface-container-lowest text-on-surface-variant border border-outline-variant/30 hover:bg-surface-container-low'
              }`}
            >
              <Bookmark className="w-3 h-3" />
              <span>Marked ({markedForReviewCount})</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Content Container */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 pt-4">
        {questions.length === 0 ? (
          <div className="bg-surface-container-lowest rounded-2xl p-8 border border-outline-variant/20 text-center space-y-3 my-4">
            <AlertCircle className="w-10 h-10 text-outline mx-auto" />
            <h3 className="font-headline font-bold text-base text-on-surface">
              Answer Key Not Available Offline
            </h3>
            <p className="text-xs text-on-surface-variant max-w-md mx-auto">
              Question details could not be loaded. Please check your internet connection and reopen the Answer Key.
            </p>
            <button
              type="button"
              onClick={onBackToResultSummary}
              className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-on-primary text-xs font-headline font-bold cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Result Summary</span>
            </button>
          </div>
        ) : filteredQuestions.length === 0 ? (
          <div className="bg-surface-container-lowest rounded-2xl p-8 border border-outline-variant/20 text-center space-y-3 my-4">
            <AlertCircle className="w-8 h-8 text-outline mx-auto" />
            <h4 className="font-headline font-bold text-on-surface text-sm">
              No Questions Match This Filter
            </h4>
            <p className="text-xs text-on-surface-variant">
              There are no questions in the &ldquo;{activeFilter}&rdquo; category for this attempt.
            </p>
            <button
              type="button"
              onClick={() => handleFilterChange('all')}
              className="inline-flex items-center gap-1.5 text-xs font-headline font-bold text-primary bg-primary-fixed/50 hover:bg-primary-fixed px-4 py-2 rounded-xl cursor-pointer mt-2"
            >
              Show All Questions ({totalQuestions})
            </button>
          </div>
        ) : currentQuestion ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Column: Active Question Diagnostic + Stem + Options + Explanation */}
            <div className="lg:col-span-8 space-y-4">
              {(() => {
                const studentAns = answers[currentQuestion.id];
                const isAttempted = Boolean(studentAns);
                const isCorrect = studentAns === currentQuestion.correctAnswer;
                const isMarked = markedIdsSet.has(currentQuestion.id);

                return (
                  <>
                    {/* Question Diagnostic Header Card */}
                    <div className="bg-surface-container-lowest p-4 rounded-xl border border-outline-variant/15 flex flex-col gap-3 shadow-2xs">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-headline font-extrabold text-primary text-sm bg-primary/10 px-3 py-1 rounded-md tabular-nums">
                            Q {displayQNum} of {totalQuestions}
                          </span>
                          {currentQuestion.subject && (
                            <span className="text-[11px] font-headline font-bold text-on-surface-variant bg-surface-container-low px-2.5 py-1 rounded-md border border-outline-variant/20">
                              {currentQuestion.subject}
                            </span>
                          )}
                          {isMarked && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-headline font-bold text-tertiary bg-tertiary-fixed/60 px-2.5 py-1 rounded-md">
                              <Bookmark className="w-3 h-3 fill-current" />
                              <span>Marked</span>
                            </span>
                          )}
                        </div>

                        {/* Status Pill */}
                        {isAttempted && isCorrect ? (
                          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 border border-emerald-500/30">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            <span className="text-xs font-headline font-bold text-emerald-700">
                              Correct Answer
                            </span>
                          </div>
                        ) : isAttempted && !isCorrect ? (
                          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-error-container/40 border border-error/20">
                            <XCircle className="w-4 h-4 text-error" />
                            <span className="text-xs font-headline font-bold text-error">
                              Wrong Answer
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-surface-container border border-outline-variant/30">
                            <MinusCircle className="w-4 h-4 text-on-surface-variant" />
                            <span className="text-xs font-headline font-bold text-on-surface-variant">
                              Unattempted
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-outline-variant/10 text-xs text-on-surface-variant">
                        <div className="flex items-center gap-1.5 tabular-nums">
                          <Clock className="w-3.5 h-3.5 text-outline" />
                          <span>
                            Avg Time:{' '}
                            <strong className="text-on-surface">
                              {avgTimePerQuestion || 'Recorded'}
                            </strong>
                          </span>
                        </div>
                        <div className="flex items-center gap-2 font-headline font-bold tabular-nums">
                          {isAttempted && isCorrect ? (
                            <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                              +{posMarks} Marks
                            </span>
                          ) : isAttempted && !isCorrect ? (
                            <span className="text-error bg-error-container/30 px-2 py-0.5 rounded">
                              -{negMarks} Marks
                            </span>
                          ) : (
                            <span className="text-on-surface-variant bg-surface-container-low px-2 py-0.5 rounded">
                              0 Marks
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Question Content Box */}
                    <div className="bg-surface-container-lowest p-5 rounded-xl border border-outline-variant/15 space-y-4 shadow-2xs">
                      {(languageMode === 'both' || languageMode === 'en') &&
                        currentQuestion.questionText && (
                          <FormattedQuestionText
                            text={currentQuestion.questionText}
                            className="text-[15px] sm:text-base leading-relaxed text-on-surface font-medium"
                          />
                        )}

                      {(languageMode === 'both' || languageMode === 'hi') &&
                        currentQuestion.questionTextHindi && (
                          <div
                            className={
                              languageMode === 'both' && currentQuestion.questionText
                                ? 'pt-3 border-t border-outline-variant/15'
                                : ''
                            }
                          >
                            <FormattedQuestionText
                              text={currentQuestion.questionTextHindi}
                              className="text-[15px] sm:text-base leading-relaxed text-on-surface font-medium"
                            />
                          </div>
                        )}

                      {(currentQuestion.questionImageUrl || currentQuestion.imageUrl) && (
                        <div className="pt-2">
                          <div className="max-w-lg rounded-xl overflow-hidden border border-outline-variant/25 bg-surface-container-low p-2">
                            <CachedImage
                              src={currentQuestion.questionImageUrl || currentQuestion.imageUrl}
                              alt={`Question ${displayQNum} Diagram`}
                              className="w-full h-auto max-h-64 object-contain rounded-lg bg-white mx-auto"
                              loading="lazy"
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Options Analysis Section */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between px-1">
                        <span className="text-xs font-headline font-bold uppercase tracking-wider text-on-surface-variant">
                          Options Analysis
                        </span>
                        <span className="text-[11px] text-on-surface-variant">
                          Your Pick:{' '}
                          <strong className="text-on-surface">
                            {isAttempted ? `Option ${studentAns}` : 'Skipped'}
                          </strong>{' '}
                          &bull; Official Key:{' '}
                          <strong className="text-primary">
                            Option {currentQuestion.correctAnswer}
                          </strong>
                        </span>
                      </div>

                      {(['A', 'B', 'C', 'D'] as const).map((key) => {
                        const isStudentPick = studentAns === key;
                        const isOfficialCorrect = currentQuestion.correctAnswer === key;
                        const optImg = currentQuestion.optionImages?.[key];
                        const optEng = currentQuestion.options?.[key];
                        const optHi = currentQuestion.optionsHindi?.[key];

                        if (!optEng && !optHi && !optImg?.imageUrl) return null;

                        // Style according to Stitch Answer Key spec
                        let containerClass =
                          'bg-surface-container-lowest border border-outline-variant/30 p-4 rounded-xl flex flex-col gap-2 transition-all';
                        let badgeClass =
                          'w-7 h-7 rounded-full bg-surface-container text-on-surface-variant font-headline font-bold text-xs flex items-center justify-center shrink-0';
                        let accentBar: React.ReactNode = null;

                        if (isOfficialCorrect) {
                          containerClass =
                            'bg-primary-fixed/40 border-2 border-primary p-4 rounded-xl relative overflow-hidden flex flex-col gap-2';
                          badgeClass =
                            'w-7 h-7 rounded-full bg-primary text-on-primary font-headline font-bold text-xs flex items-center justify-center shrink-0';
                          accentBar = (
                            <div className="absolute top-0 left-0 w-1.5 h-full bg-primary" />
                          );
                        } else if (isStudentPick && !isCorrect) {
                          containerClass =
                            'bg-error-container/30 border-2 border-error p-4 rounded-xl relative overflow-hidden flex flex-col gap-2';
                          badgeClass =
                            'w-7 h-7 rounded-full bg-error text-on-error font-headline font-bold text-xs flex items-center justify-center shrink-0';
                          accentBar = (
                            <div className="absolute top-0 left-0 w-1.5 h-full bg-error" />
                          );
                        }

                        return (
                          <div key={key} className={containerClass}>
                            {accentBar}
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-start gap-3 min-w-0 flex-1">
                                <span className={badgeClass}>{key}</span>
                                <div className="space-y-1 min-w-0 flex-1 pt-0.5">
                                  {(languageMode === 'both' || languageMode === 'en') && optEng && (
                                    <FormattedQuestionText
                                      text={optEng}
                                      className={`text-sm ${
                                        isOfficialCorrect || isStudentPick
                                          ? 'font-bold text-on-surface'
                                          : 'font-medium text-on-surface'
                                      }`}
                                    />
                                  )}
                                  {(languageMode === 'both' || languageMode === 'hi') &&
                                    optHi &&
                                    (languageMode === 'hi' || optHi.trim() !== (optEng || '').trim()) && (
                                      <FormattedQuestionText
                                        text={optHi}
                                        className={`text-sm ${
                                          isOfficialCorrect || isStudentPick
                                            ? 'font-semibold text-on-surface-variant'
                                            : 'text-on-surface-variant'
                                        }`}
                                      />
                                    )}
                                  {!optEng && !optHi && (
                                    <span className="text-xs italic text-outline">
                                      [Diagram Option {key}]
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Status Tag */}
                              <div className="flex flex-col items-end gap-1 shrink-0">
                                {isOfficialCorrect && (
                                  <span className="flex items-center gap-1 text-[11px] font-headline font-bold text-primary bg-primary-fixed px-2.5 py-0.5 rounded-md">
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    <span>
                                      {isStudentPick ? 'Your Answer • Correct' : 'Correct Answer'}
                                    </span>
                                  </span>
                                )}
                                {isStudentPick && !isCorrect && (
                                  <span className="flex items-center gap-1 text-[11px] font-headline font-bold text-error bg-error-container/70 px-2.5 py-0.5 rounded-md">
                                    <XCircle className="w-3.5 h-3.5" />
                                    <span>Your Answer</span>
                                  </span>
                                )}
                              </div>
                            </div>

                            {optImg?.imageUrl && (
                              <div className="pl-10 pt-1">
                                <div className="max-w-xs rounded-lg overflow-hidden border border-outline-variant/25 bg-white p-1.5">
                                  <CachedImage
                                    src={optImg.imageUrl}
                                    alt={`Option ${key}`}
                                    className="max-h-36 w-auto object-contain rounded"
                                    loading="lazy"
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Detailed Explanation Card */}
                    <div className="bg-surface-container-low rounded-xl p-5 border border-outline-variant/25 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                            <Sparkles className="w-4 h-4" />
                          </div>
                          <h3 className="font-headline font-bold text-sm text-on-surface">
                            Detailed Explanation
                          </h3>
                        </div>
                        <span className="text-[11px] font-medium text-on-surface-variant bg-surface-container-highest px-2 py-0.5 rounded">
                          Verified Key: Option {currentQuestion.correctAnswer}
                        </span>
                      </div>

                      {currentQuestion.explanation || currentQuestion.explanationHindi ? (
                        <div className="text-sm text-on-surface-variant leading-relaxed space-y-2.5 pt-1">
                          {(languageMode === 'both' || languageMode === 'en') &&
                            currentQuestion.explanation && (
                              <FormattedQuestionText
                                text={currentQuestion.explanation}
                                className="text-on-surface leading-relaxed"
                              />
                            )}
                          {(languageMode === 'both' || languageMode === 'hi') &&
                            currentQuestion.explanationHindi && (
                              <FormattedQuestionText
                                text={currentQuestion.explanationHindi}
                                className="text-on-surface-variant leading-relaxed pt-1"
                              />
                            )}
                        </div>
                      ) : (
                        <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed pt-1">
                          The official correct answer for Question {displayQNum} is{' '}
                          <strong className="text-on-surface">
                            Option {currentQuestion.correctAnswer}
                          </strong>
                          .
                        </p>
                      )}
                    </div>
                  </>
                );
              })()}
            </div>

            {/* Desktop Right Column: Sticky Question Palette */}
            <div className="hidden lg:block lg:col-span-4 sticky top-32">
              <div className="bg-surface-container-lowest rounded-2xl p-5 border border-outline-variant/20 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-outline-variant/15 pb-3">
                  <div>
                    <h3 className="font-headline font-bold text-sm text-on-surface">
                      Solutions Palette
                    </h3>
                    <p className="text-[11px] text-on-surface-variant">
                      Tap any question number to jump
                    </p>
                  </div>
                  <span className="text-xs font-headline font-bold text-primary bg-primary-fixed/60 px-2.5 py-0.5 rounded-md tabular-nums">
                    {filteredQuestions.length} Shown
                  </span>
                </div>

                {/* Legend */}
                <div className="grid grid-cols-3 gap-2 py-2 px-3 bg-surface-container-low rounded-xl text-[11px] font-medium">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm bg-emerald-600 shrink-0" />
                    <span className="text-on-surface truncate">Correct ({correctCount})</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm bg-error shrink-0" />
                    <span className="text-on-surface truncate">Wrong ({incorrectCount})</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm bg-surface-container-highest border border-outline-variant shrink-0" />
                    <span className="text-on-surface truncate">Skipped ({unattemptedCount})</span>
                  </div>
                </div>

                {/* 5-Column Question Grid */}
                <div className="grid grid-cols-5 gap-2.5 max-h-[420px] overflow-y-auto p-1">
                  {filteredQuestions.map((q) => {
                    const studentPick = answers[q.id];
                    const isPickAttempted = Boolean(studentPick);
                    const isPickCorrect = studentPick === q.correctAnswer;
                    const qIndex = questions.findIndex((item) => item.id === q.id);
                    const qNum = q.questionNumber || qIndex + 1;
                    const isSelected = q.id === currentQuestion.id;

                    let btnClass =
                      'bg-surface-container-low text-on-surface-variant border border-outline-variant/30 hover:bg-surface-container';
                    if (isPickAttempted && isPickCorrect) {
                      btnClass = 'bg-emerald-600 text-white border-emerald-700';
                    } else if (isPickAttempted && !isPickCorrect) {
                      btnClass = 'bg-error text-on-error border-error';
                    }

                    return (
                      <button
                        key={q.id}
                        type="button"
                        onClick={() => handleSelectQuestion(q.id)}
                        className={`h-10 rounded-lg font-headline font-bold text-xs flex items-center justify-center transition-all cursor-pointer tabular-nums ${btnClass} ${
                          isSelected ? 'ring-2 ring-offset-2 ring-primary scale-105 shadow-xs' : ''
                        }`}
                      >
                        {qNum}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </main>

      {/* Sticky Bottom Navigation Dock */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-surface-container-lowest/95 backdrop-blur-lg border-t border-outline-variant/20 px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handlePrevQuestion}
            disabled={currentFilteredIndex <= 0}
            className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-surface-container-high text-on-surface font-headline font-bold text-xs active:scale-95 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Prev</span>
          </button>

          <button
            type="button"
            onClick={() => setIsPaletteOpen(true)}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-surface-container-low border border-outline-variant/30 text-on-surface font-headline font-bold text-xs active:scale-95 transition-all cursor-pointer max-w-xs"
          >
            <LayoutGrid className="w-4 h-4 text-primary" />
            <span className="tabular-nums">
              Question Palette ({displayQNum}/{totalQuestions})
            </span>
          </button>

          <button
            type="button"
            onClick={handleNextQuestion}
            disabled={currentFilteredIndex >= filteredQuestions.length - 1}
            className="flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl bg-primary text-on-primary font-headline font-bold text-xs shadow-sm active:scale-95 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <span>Next</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Sliding Solutions Palette Bottom Sheet */}
      {isPaletteOpen && (
        <div className="fixed inset-0 z-50 bg-on-surface/40 backdrop-blur-xs flex items-end justify-center">
          <div className="fixed inset-0" onClick={() => setIsPaletteOpen(false)} />
          <div className="relative bg-surface-container-lowest w-full max-w-lg rounded-t-3xl p-5 shadow-2xl border-t border-outline-variant/20 max-h-[80vh] flex flex-col z-10">
            <div className="w-10 h-1 bg-outline-variant/50 rounded-full mx-auto mb-4" />
            <div className="flex items-center justify-between pb-3 border-b border-outline-variant/15">
              <div>
                <h3 className="font-headline font-bold text-base text-on-surface">
                  Solutions Palette
                </h3>
                <p className="text-xs text-on-surface-variant">
                  Jump directly to any question analysis
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsPaletteOpen(false)}
                className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Legend */}
            <div className="grid grid-cols-3 gap-2 py-3 border-b border-outline-variant/15 text-xs">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-sm bg-emerald-600" />
                <span className="text-on-surface font-medium">Correct ({correctCount})</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-sm bg-error" />
                <span className="text-on-surface font-medium">Wrong ({incorrectCount})</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-sm bg-surface-container-highest border border-outline-variant" />
                <span className="text-on-surface font-medium">Skipped ({unattemptedCount})</span>
              </div>
            </div>

            {/* Question Number Grid */}
            <div className="grid grid-cols-5 gap-2.5 py-4 overflow-y-auto">
              {filteredQuestions.map((q) => {
                const studentPick = answers[q.id];
                const isPickAttempted = Boolean(studentPick);
                const isPickCorrect = studentPick === q.correctAnswer;
                const qIndex = questions.findIndex((item) => item.id === q.id);
                const qNum = q.questionNumber || qIndex + 1;
                const isSelected = q.id === currentQuestion?.id;

                let btnClass =
                  'bg-surface-container-low text-on-surface-variant border border-outline-variant/30';
                if (isPickAttempted && isPickCorrect) {
                  btnClass = 'bg-emerald-600 text-white';
                } else if (isPickAttempted && !isPickCorrect) {
                  btnClass = 'bg-error text-on-error';
                }

                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => handleSelectQuestion(q.id)}
                    className={`h-11 rounded-lg font-headline font-bold text-xs flex items-center justify-center tabular-nums cursor-pointer ${btnClass} ${
                      isSelected ? 'ring-2 ring-offset-2 ring-primary' : ''
                    }`}
                  >
                    {qNum}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
