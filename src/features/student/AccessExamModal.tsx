import React, { useState, useEffect } from 'react';
import { Lock, X, AlertCircle, Play, CheckCircle2, Loader2, RefreshCw, KeyRound, User, Award, Eye, ArrowRight, ShieldCheck, RotateCw, Sparkles, Calendar } from 'lucide-react';
import { TestItem, StudentAttempt } from '../../types/exam';
import { getTestByAccessCode, normalizeCode, findStudentAttempt } from '../../services/examService';
import { useAuth } from '../../context/AuthContext';
import { useInstitute } from '../../context/InstituteContext';
import { getTestScheduleInfo } from '../../utils/scheduleHelper';

interface AccessExamModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAccessGranted: (test: TestItem, studentName: string) => void;
  onViewResult?: (attempt: StudentAttempt, test: TestItem) => void;
  onRequireSignIn?: () => void;
  preselectedTest?: TestItem | null;
  initialAccessCode?: string;
  defaultMode?: 'join' | 'result';
}

export const AccessExamModal: React.FC<AccessExamModalProps> = ({
  isOpen,
  onClose,
  onAccessGranted,
  onViewResult,
  onRequireSignIn,
  preselectedTest,
  initialAccessCode,
  defaultMode = 'join',
}) => {
  const { user } = useAuth();
  const { settings } = useInstitute();

  const [accessCode, setAccessCode] = useState(
    preselectedTest?.accessCode || (initialAccessCode ? normalizeCode(initialAccessCode) : '')
  );
  const [resolvedTest, setResolvedTest] = useState<TestItem | null>(preselectedTest || null);
  const [isVerifyingCode, setIsVerifyingCode] = useState(false);
  const [password, setPassword] = useState('');
  const [studentName, setStudentName] = useState(() => {
    return user?.name || (typeof window !== 'undefined' ? localStorage.getItem('pariksha_candidate_name') || '' : '');
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeIntent, setActiveIntent] = useState<'join' | 'result'>(defaultMode);

  // Sync when preselectedTest or initialAccessCode changes
  useEffect(() => {
    if (preselectedTest) {
      setResolvedTest(preselectedTest);
      setAccessCode(preselectedTest.accessCode || '');
      setError(null);
      if (preselectedTest.status === 'completed' || preselectedTest.status === 'result_published') {
        setActiveIntent('result');
      }
    } else if (initialAccessCode) {
      const clean = normalizeCode(initialAccessCode);
      setAccessCode(clean);
      fetchTest(clean);
    }
  }, [preselectedTest, initialAccessCode]);

  const fetchTest = async (codeToSearch: string) => {
    const clean = normalizeCode(codeToSearch);
    if (!clean) return;

    setIsVerifyingCode(true);
    setError(null);
    try {
      const found = await getTestByAccessCode(clean);
      if (found) {
        setResolvedTest(found);
        if (found.status === 'completed' || found.status === 'result_published') {
          setActiveIntent('result');
        }
      } else {
        // Retry once after 600ms to allow Firestore connection initialization
        setTimeout(async () => {
          const retryFound = await getTestByAccessCode(clean);
          if (retryFound) {
            setResolvedTest(retryFound);
            if (retryFound.status === 'completed' || retryFound.status === 'result_published') {
              setActiveIntent('result');
            }
          } else {
            setResolvedTest(null);
          }
          setIsVerifyingCode(false);
        }, 600);
        return;
      }
    } catch (err: any) {
      console.warn('Error fetching test by code:', err);
    } finally {
      setIsVerifyingCode(false);
    }
  };

  if (!isOpen) return null;

  const isExamEnded = resolvedTest?.status === 'completed' || resolvedTest?.status === 'result_published';

  const handleAccessCodeChange = (val: string) => {
    const clean = normalizeCode(val);
    setAccessCode(clean.toUpperCase());
    setError(null);
    if (resolvedTest && resolvedTest.accessCode?.toUpperCase() !== clean.toUpperCase()) {
      setResolvedTest(null);
    }
  };

  const handleManualVerifyCode = () => {
    if (!accessCode.trim()) {
      setError('Please enter the Examination Access Code.');
      return;
    }
    fetchTest(accessCode.trim());
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const cleanCode = normalizeCode(accessCode);
      let targetTest: TestItem | null = resolvedTest || preselectedTest || null;

      // 1. Verify target test exists
      if (
        !targetTest ||
        (targetTest.accessCode?.trim().toUpperCase() !== cleanCode.toUpperCase() &&
          targetTest.id !== cleanCode)
      ) {
        if (!cleanCode) {
          setError('Please provide the Examination Access Code.');
          setLoading(false);
          return;
        }

        setIsVerifyingCode(true);
        targetTest = await getTestByAccessCode(cleanCode);
        setIsVerifyingCode(false);
      }

      if (!targetTest) {
        setError(
          `No examination found matching Access Code "${cleanCode}". Please verify the code with your institute or test coordinator.`
        );
        setLoading(false);
        return;
      }

      if (targetTest.status === 'draft') {
        setError('This examination is currently in Draft status and has not been launched yet by the institute.');
        setLoading(false);
        return;
      }

      // 2. Verify password (only required for non-released exams)
      if (targetTest.status !== 'released') {
        const cleanInputPass = password.trim();
        const cleanRealPass = (targetTest.accessPassword || '').trim();

        if (cleanInputPass !== cleanRealPass) {
          setError('Incorrect test password. Please enter the exact password provided for this test.');
          setLoading(false);
          return;
        }
      }

      const finalName = studentName.trim() || user?.name || 'Candidate';
      if (typeof window !== 'undefined') {
        localStorage.setItem('pariksha_candidate_name', finalName);
      }

      const candidateUid = user?.uid || (typeof window !== 'undefined' ? localStorage.getItem('pariksha_candidate_uid') || '' : '');

      // Special handling for Released Tests (Reattempt available anytime for signed-in students):
      if (targetTest.status === 'released') {
        if (!user) {
          setError(
            'This examination is a Released Test available exclusively for signed-in students. Please log in or register your account to attempt and reattempt this test anytime.'
          );
          setLoading(false);
          return;
        }

        const existingAttempt = await findStudentAttempt(targetTest.id, finalName, candidateUid);
        if (existingAttempt && activeIntent === 'result') {
          if (onViewResult) {
            onViewResult(existingAttempt, targetTest);
          }
          setLoading(false);
          return;
        }

        // Start fresh reattempt: clear any cached unfinished answers for this test
        if (typeof window !== 'undefined' && candidateUid) {
          localStorage.removeItem(`pariksha_answers_${targetTest.id}_${candidateUid}`);
          localStorage.removeItem(`pariksha_reviews_${targetTest.id}_${candidateUid}`);
          localStorage.removeItem(`pariksha_visited_${targetTest.id}_${candidateUid}`);
          localStorage.removeItem(`pariksha_tab_switches_${targetTest.id}_${candidateUid}`);
        }
        onAccessGranted(targetTest, finalName);
        setLoading(false);
        return;
      }

      // 3. For standard live exams: check if candidate already has an existing attempt (submitted result)
      const existingAttempt = await findStudentAttempt(targetTest.id, finalName, candidateUid);

      if (existingAttempt) {
        // If this test is scheduled and currently live, check if the attempt was from BEFORE the current scheduled window
        const sched = getTestScheduleInfo(targetTest);
        const attemptDate = existingAttempt.submittedAt ? new Date(existingAttempt.submittedAt).getTime() : 0;
        const sessionStartDate = sched.startDateTime ? sched.startDateTime.getTime() : 0;
        const isPastAttemptBeforeSchedule =
          sched.isScheduled &&
          sched.scheduleStatus === 'live' &&
          sessionStartDate > 0 &&
          attemptDate < sessionStartDate &&
          activeIntent !== 'result';

        if (!isPastAttemptBeforeSchedule) {
          // Candidate has already submitted this examination in current session or requested result!
          // Route to result page and never allow rejoining!
          if (onViewResult) {
            onViewResult(existingAttempt, targetTest);
          }
          setLoading(false);
          return;
        }
      }

      // If exam is completed/ended and no attempt was found for this candidate
      if (targetTest.status === 'completed' || targetTest.status === 'result_published') {
        setError(
          `This examination has ended. No submission was found for candidate "${finalName}". If you completed this exam, please check the exact Name or Candidate ID you used during submission.`
        );
        setLoading(false);
        return;
      }

      // If user explicitly selected "Check My Result" mode but no attempt found
      if (activeIntent === 'result') {
        setError(
          `No completed examination record was found for Candidate "${finalName}". If you have not taken this examination yet, click "Take Examination" above.`
        );
        setLoading(false);
        return;
      }

      // Check if this test is scheduled and not yet startable
      const sched = getTestScheduleInfo(targetTest);
      if (sched.isScheduled && sched.scheduleStatus === 'upcoming') {
        setError(
          `This examination is scheduled for ${sched.formattedDate} at ${sched.formattedStartTime}. You cannot start this exam early. Please return at the scheduled time.`
        );
        setLoading(false);
        return;
      }
      if (sched.isScheduled && sched.scheduleStatus === 'expired') {
        setError(
          `The scheduled examination window for "${targetTest.title}" concluded at ${sched.formattedEndTime} on ${sched.formattedDate}. Access is now closed.`
        );
        setLoading(false);
        return;
      }

      // Only if exam is active and candidate has NOT submitted: proceed to exam
      onAccessGranted(targetTest, finalName);
    } catch (err: any) {
      setError(err.message || 'Verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="relative bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className={`px-6 py-5 text-white flex items-center justify-between ${
          isExamEnded
            ? 'bg-linear-to-r from-slate-800 via-indigo-900 to-slate-900'
            : 'bg-linear-to-r from-indigo-700 via-indigo-600 to-blue-700'
        }`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shadow-xs">
              {isExamEnded ? <Award className="w-5 h-5 text-amber-300" /> : <Lock className="w-5 h-5 text-white" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-base leading-tight">
                  {isExamEnded ? 'Check Exam Result' : 'Protected Exam Access'}
                </h3>
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider ${
                  isExamEnded ? 'bg-amber-400/20 text-amber-200 border border-amber-400/30' : 'bg-white/20 text-indigo-100'
                }`}>
                  {isExamEnded ? 'Result View' : 'Direct Join'}
                </span>
              </div>
              <p className="text-xs text-indigo-100 mt-0.5">{settings.instituteName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/20 text-white/80 hover:text-white transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Exam Details Box if resolved */}
          {resolvedTest ? (
            <div className={`p-4 rounded-xl border space-y-2 ${
              isExamEnded
                ? 'bg-slate-50 border-slate-200'
                : 'bg-emerald-50/70 border-emerald-200'
            }`}>
              <div className="flex items-center justify-between">
                <span className={`text-[11px] font-extrabold uppercase tracking-wider ${
                  isExamEnded ? 'text-slate-700' : 'text-emerald-800'
                }`}>
                  {resolvedTest.examCategory} &bull; {resolvedTest.seriesTitle}
                </span>
                <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${
                  resolvedTest ? (() => {
                    const sched = getTestScheduleInfo(resolvedTest);
                    if (sched.isScheduled && sched.scheduleStatus === 'upcoming') {
                      return 'text-purple-800 bg-purple-100 border border-purple-300';
                    }
                    return resolvedTest.status === 'released'
                      ? 'text-emerald-800 bg-emerald-100 border border-emerald-300'
                      : isExamEnded
                      ? 'text-amber-800 bg-amber-100 border border-amber-200'
                      : 'text-emerald-700 bg-emerald-100/80';
                  })() : ''
                }`}>
                  {resolvedTest ? (() => {
                    const sched = getTestScheduleInfo(resolvedTest);
                    if (sched.isScheduled && sched.scheduleStatus === 'upcoming') {
                      return (
                        <>
                          <Calendar className="w-3.5 h-3.5 text-purple-600" />
                          <span>Scheduled &bull; Upcoming</span>
                        </>
                      );
                    }
                    if (resolvedTest.status === 'released') {
                      return (
                        <>
                          <RotateCw className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Released &bull; Reattempt Mode</span>
                        </>
                      );
                    }
                    if (isExamEnded) {
                      return (
                        <>
                          <Award className="w-3.5 h-3.5 text-amber-600" />
                          <span>Exam Completed</span>
                        </>
                      );
                    }
                    return (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Verified Paper</span>
                      </>
                    );
                  })() : null}
                </span>
              </div>
              <div className="text-sm font-bold text-slate-900 leading-snug">{resolvedTest.title}</div>
              {resolvedTest && (() => {
                const sched = getTestScheduleInfo(resolvedTest);
                if (sched.isScheduled && sched.scheduleStatus === 'upcoming') {
                  return (
                    <div className="text-xs font-semibold text-purple-900 bg-purple-50 p-2 rounded-lg border border-purple-200">
                      Starts on <strong>{sched.formattedDate}</strong> at <strong>{sched.formattedStartTime}</strong> ({sched.timeRemainingText})
                    </div>
                  );
                }
                return null;
              })()}
              <div className="flex items-center gap-3 text-xs text-slate-600 font-medium pt-1 border-t border-slate-200/70">
                <span>Duration: <strong>{resolvedTest.durationMinutes} Mins</strong></span>
                <span>&bull;</span>
                <span>Questions: <strong>{resolvedTest.totalQuestions}</strong></span>
                <span>&bull;</span>
                <span className="font-mono text-[11px] text-indigo-700">Code: <strong>{resolvedTest.accessCode}</strong></span>
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                <span>Examination Access Code *</span>
                {isVerifyingCode && (
                  <span className="text-[11px] font-normal text-indigo-600 flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" /> Verifying code...
                  </span>
                )}
              </label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    required
                    value={accessCode}
                    onChange={(e) => handleAccessCodeChange(e.target.value)}
                    placeholder="e.g. MPP1001 or Test ID"
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm font-mono uppercase font-semibold text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleManualVerifyCode}
                  disabled={isVerifyingCode || !accessCode.trim()}
                  className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 font-bold text-xs rounded-xl border border-slate-200 transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isVerifyingCode ? 'animate-spin' : ''}`} />
                  <span>Verify</span>
                </button>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Enter the Exam Access Code provided on your examination link or invitation.
              </p>
            </div>
          )}

          {/* Notice for Released Test if not signed in */}
          {resolvedTest?.status === 'released' && !user && (
            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl space-y-2 text-xs text-amber-900">
              <div className="font-bold flex items-center gap-1.5 text-amber-950">
                <Lock className="w-4 h-4 text-amber-700 shrink-0" />
                <span>Signed-in Student Access Required</span>
              </div>
              <p className="text-[11px] text-amber-800 leading-relaxed">
                This examination is a <strong>Release Test</strong> available exclusively for signed-in students for unlimited practice and reattempts anytime.
              </p>
              {onRequireSignIn && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onRequireSignIn();
                  }}
                  className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-xs flex items-center justify-center gap-1 cursor-pointer transition-colors shadow-xs"
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                  <span>Go to Student Sign In / Register &rarr;</span>
                </button>
              )}
            </div>
          )}

          {/* Mode Switcher when exam is still open */}
          {!isExamEnded && resolvedTest && (
            <div className="flex rounded-xl bg-slate-100 p-1 border border-slate-200">
              <button
                type="button"
                onClick={() => setActiveIntent('join')}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  activeIntent === 'join'
                    ? 'bg-white text-indigo-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Play className="w-3.5 h-3.5" />
                <span>Take Examination</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveIntent('result')}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  activeIntent === 'result'
                    ? 'bg-white text-indigo-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Award className="w-3.5 h-3.5" />
                <span>Check My Result</span>
              </button>
            </div>
          )}

          {/* Candidate Name or ID Input */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-slate-500" />
              <span>Candidate Name or ID *</span>
            </label>
            <input
              type="text"
              required
              value={studentName}
              onChange={(e) => setStudentName(e.target.value)}
              placeholder="e.g. Rahul Sharma or Candidate ID"
              className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              {isExamEnded || activeIntent === 'result'
                ? 'Enter the same Name or Candidate ID you used when submitting this examination.'
                : 'Your score card and ranking will be recorded under this name. No registration needed.'}
            </p>
          </div>

          {/* Test Password Input (Only for non-released exams) */}
          {resolvedTest?.status !== 'released' ? (
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-slate-500" />
                  <span>Test Password *</span>
                </span>
              </label>
              <div className="relative">
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password provided by test coordinator"
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none pr-10"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                <span>Security verification: enter the password associated with this examination</span>
              </div>
            </div>
          ) : (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 space-y-1">
              <div className="font-bold flex items-center gap-1.5 text-emerald-950">
                <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Released Test &bull; No Password or Code Required</span>
              </div>
              <p className="text-[11px] text-emerald-800">
                This test is released for open practice and unlimited reattempts. You will proceed directly to the test overview and syllabus page.
              </p>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl space-y-1 text-xs text-red-700 font-medium">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span className="font-semibold">{error}</span>
              </div>
              {error.includes('No examination found') && (
                <div className="pl-6 pt-1 text-[11px] text-slate-600 space-y-1">
                  <p>&bull; Make sure the Exam Access Code matches the invitation exactly.</p>
                  <p>&bull; If the examination was just published, please click <strong>Retry Verification</strong> below.</p>
                  <button
                    type="button"
                    onClick={() => fetchTest(accessCode)}
                    className="inline-flex items-center gap-1 text-indigo-700 font-bold hover:underline cursor-pointer pt-1"
                  >
                    <RefreshCw className="w-3 h-3" /> Retry Verification
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="pt-2 flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 px-4 border border-slate-300 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || isVerifyingCode}
              className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-bold shadow-xs transition-colors cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2 ${
                isExamEnded || activeIntent === 'result'
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white'
              }`}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Checking...</span>
                </>
              ) : isExamEnded || activeIntent === 'result' ? (
                <>
                  <Award className="w-4 h-4" />
                  <span>View My Result</span>
                </>
              ) : resolvedTest?.status === 'released' ? (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Continue to Test Details &rarr;</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  <span>Enter Exam</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
