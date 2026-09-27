import React, { useEffect, useState } from 'react';
import {
  BookOpen,
  Clock,
  PlayCircle,
  Award,
  CheckCircle2,
  Calendar,
  Lock,
  ArrowRight,
  Shield,
  Search,
  LogOut,
  RotateCw,
  FolderKanban,
  Sparkles,
} from 'lucide-react';
import { TestItem, TestSeries, StudentAttempt } from '../../types/exam';
import {
  getTests,
  getSeriesList,
  getAllAttempts,
  subscribeToTestsList,
} from '../../services/examService';
import { useAuth } from '../../context/AuthContext';
import { useInstitute } from '../../context/InstituteContext';

interface StudentHomeProps {
  onSelectTest: (test: TestItem) => void;
  onOpenJoinModalWithTest?: (test: TestItem) => void;
  onViewAttempt: (attempt: StudentAttempt) => void;
  onReattemptTest?: (test: TestItem) => void;
}

export const StudentHome: React.FC<StudentHomeProps> = ({
  onSelectTest,
  onOpenJoinModalWithTest,
  onViewAttempt,
  onReattemptTest,
}) => {
  const { user, logout } = useAuth();
  const { settings } = useInstitute();
  const [tests, setTests] = useState<TestItem[]>([]);
  const [series, setSeries] = useState<TestSeries[]>([]);
  const [myAttempts, setMyAttempts] = useState<StudentAttempt[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // Initial load
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const [tList, sList, allAtt] = await Promise.all([
          getTests(),
          getSeriesList(),
          getAllAttempts(),
        ]);
        setTests(tList);
        setSeries(sList);

        const candUid =
          user?.uid ||
          (typeof window !== 'undefined' ? localStorage.getItem('pariksha_candidate_uid') || '' : '');
        const candName =
          user?.name ||
          (typeof window !== 'undefined' ? localStorage.getItem('pariksha_candidate_name') || '' : '');
        const candEmail = user?.email || '';

        const mine = allAtt.filter((a) => {
          if (!a) return false;
          if (candUid && (a.studentId === candUid || a.studentId?.toLowerCase() === candUid.toLowerCase())) return true;
          if (candEmail && a.studentEmail?.toLowerCase() === candEmail.toLowerCase()) return true;
          if (candName && a.studentName?.toLowerCase().trim() === candName.toLowerCase().trim()) return true;
          return false;
        });
        setMyAttempts(mine);
      } catch (err) {
        console.error('Failed to load student home data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();

    // Subscribe to real-time test catalog changes
    const unsub = subscribeToTestsList((updatedTests) => {
      setTests(updatedTests);
    });

    return () => unsub();
  }, [user]);

  // Categories
  const categories = ['all', 'MP Police', 'MP SI', 'SSC', 'General Knowledge'];

  // Filtered tests (show published, waiting, live, or completed)
  const availableTests = tests.filter((t) => {
    if (t.status === 'draft') return false; // Never show drafts to students
    const matchCategory =
      selectedCategory === 'all' ||
      t.examCategory?.toLowerCase() === selectedCategory.toLowerCase();
    const matchQuery =
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.accessCode.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCategory && matchQuery;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Student Welcome Hero Card */}
      <div className="bg-linear-to-r from-indigo-700 via-blue-700 to-indigo-800 rounded-3xl p-6 sm:p-8 text-white shadow-lg relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div className="max-w-2xl space-y-3">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-white/20 text-white backdrop-blur-xs">
              <Shield className="w-3.5 h-3.5" />
              <span>Official Examination Portal</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight leading-tight">
              Welcome, {user?.name || 'Candidate'}!
            </h1>
            <p className="text-xs sm:text-sm text-indigo-100 leading-relaxed">
              Prepare for MP Police Constable, MP Sub-Inspector (SI), SSC and state competitive examinations with authentic,
              live proctored mock examinations.
            </p>
          </div>

          <div className="shrink-0 flex items-center gap-2">
            <button
              onClick={logout}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/20 text-xs font-semibold transition-all cursor-pointer shadow-xs"
              title="Sign out of your account"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </div>

      {/* Category Pills & Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap cursor-pointer transition-all ${
                selectedCategory === cat
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {cat === 'all' ? 'All Examinations' : cat}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Search test or code..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl text-xs bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
          />
        </div>
      </div>

      {/* Test Series & Scheduled Programs */}
      {series.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <FolderKanban className="w-5 h-5 text-indigo-600" />
              <span>Test Series & Examination Programs</span>
            </h2>
            <span className="text-xs font-semibold text-slate-500">{series.length} Test Series</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {series.map((s) => {
              const seriesTests = tests.filter((t) => t.seriesId === s.id && t.status !== 'draft');
              const isScheduled = s.status === 'scheduled';
              const isSelected = selectedCategory.toLowerCase() === s.category.toLowerCase();

              return (
                <div
                  key={s.id}
                  onClick={() => setSelectedCategory(s.category)}
                  className={`bg-white rounded-2xl p-4 border transition-all cursor-pointer shadow-xs hover:shadow-md space-y-2.5 ${
                    isSelected ? 'border-indigo-500 ring-2 ring-indigo-200' : 'border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-indigo-50 text-indigo-700">
                      {s.category}
                    </span>
                    {isScheduled ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-200 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        <span>Scheduled: {s.startDate} {s.startTime || ''}</span>
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                        Active Series
                      </span>
                    )}
                  </div>

                  <div>
                    <h3 className="font-bold text-sm text-slate-900 line-clamp-1">{s.title}</h3>
                    {s.description && (
                      <p className="text-xs text-slate-500 line-clamp-2 mt-0.5">{s.description}</p>
                    )}
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
                    <span className="font-medium">{seriesTests.length} Tests in Series</span>
                    <span className="text-indigo-600 font-bold flex items-center gap-1">
                      <span>View Tests</span>
                      <ArrowRight className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* My Submitted Examinations / Results Section */}
      {myAttempts.length > 0 && (
        <div className="space-y-3 p-5 rounded-2xl bg-linear-to-r from-emerald-50 via-teal-50 to-indigo-50 border border-emerald-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Award className="w-5 h-5 text-emerald-600" />
              <span>My Evaluated Exam Results & Scorecards</span>
            </h2>
            <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full">
              {myAttempts.length} Submitted
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {myAttempts.map((att) => {
              const relatedTest = tests.find((t) => t.id === att.testId);
              const isPublished =
                Boolean(relatedTest?.instantResult) ||
                relatedTest?.status === 'completed' ||
                relatedTest?.status === 'result_published' ||
                relatedTest?.status === 'released';

              return (
                <div
                  key={att.id}
                  className={`bg-white rounded-xl p-4 border shadow-xs hover:shadow-sm transition-all flex flex-col justify-between space-y-3 ${
                    isPublished ? 'border-emerald-200/80' : 'border-amber-200/90'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                      <div className="flex items-center gap-1.5">
                        <span>{att.submittedAt ? new Date(att.submittedAt).toLocaleDateString() : 'Recent'}</span>
                        <span className="px-1.5 py-0.5 rounded font-mono font-bold bg-slate-100 text-slate-700 text-[10px]">
                          Attempt #{att.attemptNumber || 1}
                        </span>
                      </div>
                      <span
                        className={`font-bold px-2 py-0.5 rounded text-[10px] ${
                          isPublished
                            ? 'text-emerald-700 bg-emerald-50 border border-emerald-200'
                            : 'text-amber-800 bg-amber-50 border border-amber-200'
                        }`}
                      >
                        {isPublished ? 'Result Published' : 'Result Awaited'}
                      </span>
                    </div>
                    <h3 className="font-bold text-slate-900 text-sm line-clamp-1">{att.testTitle}</h3>
                    
                    {isPublished ? (
                      <div className="mt-2 flex items-baseline gap-2">
                        <span className="text-2xl font-black text-slate-900">{att.finalScore}</span>
                        <span className="text-xs text-slate-500">Marks</span>
                        <span className="text-xs font-bold text-emerald-600 ml-auto">
                          {att.percentage}% ({att.accuracy}% Accuracy)
                        </span>
                      </div>
                    ) : (
                      <div className="mt-2 text-xs text-amber-800 bg-amber-50/80 p-2 rounded-lg border border-amber-200/60 space-y-0.5">
                        <div className="font-bold flex items-center gap-1 text-[11px] text-amber-900">
                          <Clock className="w-3.5 h-3.5" />
                          <span>Result will be declared after exam ends</span>
                        </div>
                        <div className="text-[10px] text-amber-700">
                          (Will publish automatically once admin ends examination)
                        </div>
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => onViewAttempt(att)}
                    className={`w-full py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs ${
                      isPublished
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                        : 'bg-amber-600 hover:bg-amber-700 text-white'
                    }`}
                  >
                    {isPublished ? (
                      <>
                        <Award className="w-3.5 h-3.5" />
                        <span>View Scorecard & Answers (Attempt #{att.attemptNumber || 1})</span>
                      </>
                    ) : (
                      <>
                        <Clock className="w-3.5 h-3.5" />
                        <span>Check Status (Result Awaited)</span>
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Available Examinations Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-indigo-600" />
            <span>Available Examinations</span>
          </h2>
          <span className="text-xs text-slate-500">{availableTests.length} tests active</span>
        </div>

        {availableTests.length === 0 ? (
          <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center space-y-2">
            <p className="text-sm font-semibold text-slate-600">No active examinations matching criteria.</p>
            <p className="text-xs text-slate-400">Ask your test coordinator for your exam link and access code.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {availableTests.map((t) => {
              const myAttemptsForThis = myAttempts.filter((a) => a.testId === t.id);
              const latestAttempt = myAttemptsForThis[myAttemptsForThis.length - 1];
              const isLive = t.status === 'live';
              const isWaiting = t.status === 'waiting';
              const isReleased = t.status === 'released';
              const isScheduled = t.status === 'scheduled';

              return (
                <div
                  key={t.id}
                  className={`bg-white rounded-2xl border shadow-xs hover:shadow-md transition-all overflow-hidden flex flex-col justify-between ${
                    isReleased ? 'border-emerald-300 ring-1 ring-emerald-200/50' : isScheduled ? 'border-purple-300' : 'border-slate-200'
                  }`}
                >
                  <div className="p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200">
                        {t.examCategory}
                      </span>
                      {isReleased ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                          <RotateCw className="w-3 h-3 text-emerald-600" />
                          Release Test &bull; Reattempt Any Time
                        </span>
                      ) : isScheduled ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-300">
                          <Calendar className="w-3 h-3 text-purple-600" />
                          Scheduled: {t.startDate || ''} {t.startTime || ''}
                        </span>
                      ) : isLive ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 animate-pulse">
                          <span className="w-2 h-2 rounded-full bg-emerald-500" />
                          Live Exam
                        </span>
                      ) : isWaiting ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800">
                          Waiting Room Open
                        </span>
                      ) : (
                        <span className="text-[11px] font-semibold text-slate-400 capitalize">{t.status}</span>
                      )}
                    </div>

                    <div>
                      <h3 className="font-bold text-base text-slate-900 leading-snug line-clamp-1">
                        {t.title}
                      </h3>
                      {t.seriesTitle && (
                        <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">{t.seriesTitle}</p>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-indigo-600" />
                        <span>{t.durationMinutes} Minutes</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Award className="w-3.5 h-3.5 text-indigo-600" />
                        <span>{t.totalQuestions} Questions</span>
                      </div>
                      <div className="col-span-2 text-[11px] text-slate-500">
                        Marks: +{t.marksPerQuestion} | Negative: -{t.negativeMarks}
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-2">
                    {isReleased ? (
                      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200/80">
                        <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                        <span>No Code / Password Needed</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-xs font-mono font-bold text-slate-700">
                        <Lock className="w-3.5 h-3.5 text-slate-400" />
                        <span>Code: {t.accessCode}</span>
                      </div>
                    )}

                    {isReleased ? (
                      myAttemptsForThis.length > 0 ? (
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => onReattemptTest ? onReattemptTest(t) : onSelectTest(t)}
                            className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors shadow-xs"
                            title="Reattempt Exam (No Password or Code Required)"
                          >
                            <RotateCw className="w-3.5 h-3.5" />
                            <span>Reattempt</span>
                          </button>
                          <button
                            onClick={() => onViewAttempt(latestAttempt)}
                            className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                            title="View All Attempts Results"
                          >
                            <Award className="w-3.5 h-3.5" />
                            <span>All Results ({myAttemptsForThis.length})</span>
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => onReattemptTest ? onReattemptTest(t) : onSelectTest(t)}
                          className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors shadow-xs"
                          title="Start Test (No Password or Code Required)"
                        >
                          <PlayCircle className="w-4 h-4" />
                          <span>Start Test</span>
                        </button>
                      )
                    ) : latestAttempt ? (
                      (() => {
                        const isPublished =
                          Boolean(t.instantResult) ||
                          t.status === 'completed' ||
                          t.status === 'result_published';

                        return (
                          <button
                            onClick={() => onViewAttempt(latestAttempt)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors shadow-xs ${
                              isPublished
                                ? 'bg-emerald-700 hover:bg-emerald-800 text-white'
                                : 'bg-amber-600 hover:bg-amber-700 text-white'
                            }`}
                          >
                            {isPublished ? (
                              <Award className="w-3.5 h-3.5" />
                            ) : (
                              <Clock className="w-3.5 h-3.5" />
                            )}
                            <span>{isPublished ? 'View Result' : 'Result Awaited'}</span>
                          </button>
                        );
                      })()
                    ) : isScheduled ? (
                      <button
                        onClick={() => onOpenJoinModalWithTest?.(t)}
                        className="px-3.5 py-1.5 bg-purple-700 hover:bg-purple-800 text-white rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors shadow-xs"
                      >
                        <Calendar className="w-3.5 h-3.5" />
                        <span>Scheduled Details</span>
                      </button>
                    ) : t.status === 'completed' || t.status === 'result_published' ? (
                      <button
                        onClick={() => onOpenJoinModalWithTest?.(t)}
                        className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors shadow-xs"
                      >
                        <Award className="w-3.5 h-3.5" />
                        <span>Check Result</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => onOpenJoinModalWithTest?.(t)}
                        className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors shadow-xs"
                      >
                        <PlayCircle className="w-4 h-4" />
                        <span>Enter Test</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Previous Attempts Section */}
      {myAttempts.length > 0 && (
        <div className="space-y-4 pt-4 border-t border-slate-200">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <span>My Completed Examinations</span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {myAttempts.map((att) => (
              <div
                key={att.id}
                className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between gap-4"
              >
                <div>
                  <h3 className="font-bold text-sm text-slate-900">{att.testTitle}</h3>
                  <div className="text-xs text-slate-500 mt-0.5">
                    Submitted: {new Date(att.submittedAt).toLocaleDateString()} &bull; Score: {att.finalScore} Marks
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-xs">
                    <span className="text-emerald-700 font-semibold">{att.correctCount} Correct</span>
                    <span>&bull;</span>
                    <span className="text-rose-600 font-semibold">{att.incorrectCount} Wrong</span>
                    <span>&bull;</span>
                    <span className="text-slate-500">{att.percentage}%</span>
                  </div>
                </div>

                <button
                  onClick={() => onViewAttempt(att)}
                  className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold shrink-0 cursor-pointer"
                >
                  Scorecard
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
