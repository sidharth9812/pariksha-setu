import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { InstituteProvider, useInstitute } from './context/InstituteContext';
import { Navbar } from './components/common/Navbar';
import { LoginView } from './features/auth/LoginView';
import { AccessExamModal } from './features/student/AccessExamModal';
import { WaitingRoom } from './features/student/WaitingRoom';
import { LiveExamScreen } from './features/student/LiveExamScreen';
import { StudentResultView } from './features/student/StudentResultView';
import { StudentHome } from './features/student/StudentHome';

import { AdminLayout } from './features/admin/AdminLayout';
import { AdminDashboard } from './features/admin/AdminDashboard';
import { TestSeriesManager } from './features/admin/TestSeriesManager';
import { TestManager } from './features/admin/TestManager';
import { QuestionManager } from './features/admin/QuestionManager';
import { LiveExamMonitor } from './features/admin/LiveExamMonitor';
import { ResultsDashboard } from './features/admin/ResultsDashboard';
import { StudentManager } from './features/admin/StudentManager';
import { SettingsManager } from './features/admin/SettingsManager';
import { TestPreviewModal } from './features/admin/TestPreviewModal';
import { ReattemptInstructionsView } from './features/student/ReattemptInstructionsView';

import { TestItem, StudentAttempt, UserRole } from './types/exam';
import { getTestByAccessCode, joinExamSession, findStudentAttempt } from './services/examService';
import { recordUserExamJoin } from './services/authService';
import { getTestScheduleInfo } from './utils/scheduleHelper';

function MainApp() {
  const { user, role, loading } = useAuth();
  const { settings } = useInstitute();

  // Navigation State
  const [currentView, setCurrentView] = useState<string>('student-home');
  const [adminTab, setAdminTab] = useState<string>('dashboard');

  // Exam Workflow State
  const [activeTest, setActiveTest] = useState<TestItem | null>(null);
  const [candidateName, setCandidateName] = useState<string>('');
  const [activeAttempt, setActiveAttempt] = useState<StudentAttempt | null>(null);
  const [pendingReattemptTest, setPendingReattemptTest] = useState<TestItem | null>(null);

  // Modals & Sub-controllers
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [preselectedTestForJoin, setPreselectedTestForJoin] = useState<TestItem | null>(null);
  const [managingQuestionTest, setManagingQuestionTest] = useState<TestItem | null>(null);
  const [previewTest, setPreviewTest] = useState<TestItem | null>(null);
  const [selectedSeriesFilterForTests, setSelectedSeriesFilterForTests] = useState<string | undefined>();
  const [selectedTestIdForResults, setSelectedTestIdForResults] = useState<string | undefined>();
  const [urlExamCode, setUrlExamCode] = useState<string>('');

  // Check URL parameters for direct exam link (e.g. ?exam=MPP2026 or ?test=... or hash)
  useEffect(() => {
    let rawExamCode = '';
    const searchParams = new URLSearchParams(window.location.search);
    rawExamCode =
      searchParams.get('exam') ||
      searchParams.get('test') ||
      searchParams.get('code') ||
      searchParams.get('accessCode') ||
      '';

    if (!rawExamCode && window.location.hash) {
      const hash = window.location.hash;
      const qIdx = hash.indexOf('?');
      if (qIdx !== -1) {
        const hashParams = new URLSearchParams(hash.slice(qIdx));
        rawExamCode =
          hashParams.get('exam') ||
          hashParams.get('test') ||
          hashParams.get('code') ||
          hashParams.get('accessCode') ||
          '';
      } else if (hash.startsWith('#exam=')) {
        rawExamCode = hash.slice(6);
      }
    }

    if (rawExamCode) {
      const cleanCode = decodeURIComponent(rawExamCode).trim();
      setUrlExamCode(cleanCode);
      setIsJoinModalOpen(true);

      const fetchDirect = async () => {
        const t = await getTestByAccessCode(cleanCode);
        if (t) {
          setPreselectedTestForJoin(t);
        } else {
          // Retry to allow Firestore connection
          setTimeout(async () => {
            const retryTest = await getTestByAccessCode(cleanCode);
            if (retryTest) {
              setPreselectedTestForJoin(retryTest);
            }
          }, 800);
        }
      };
      fetchDirect();
    }
  }, []);

  // When user logs in or role changes, redirect to the dashboard
  useEffect(() => {
    if (user) {
      if (role === 'admin') {
        setCurrentView('admin');
        setAdminTab('dashboard');
      } else {
        setCurrentView('student-home');
      }
    }
  }, [role, user?.uid]);

  // Handlers for Student Exam Workflow
  const handleOpenReattemptInstructions = (test: TestItem, studentName?: string) => {
    setPendingReattemptTest(test);
    if (studentName) {
      setCandidateName(studentName);
      localStorage.setItem('pariksha_candidate_name', studentName);
    }
    setIsJoinModalOpen(false);
    setPreselectedTestForJoin(null);
    setCurrentView('reattempt-instructions');
  };

  const handleAccessGranted = async (
    test: TestItem,
    studentName: string,
    isConfirmedStart: boolean = false
  ) => {
    setActiveTest(test);
    setCandidateName(studentName);
    setIsJoinModalOpen(false);
    setPreselectedTestForJoin(null);

    // Get or create persistent candidate UID (works for both logged-in and direct guest students)
    let candidateUid = user?.uid;
    if (!candidateUid) {
      let guestId = localStorage.getItem('pariksha_candidate_uid');
      if (!guestId) {
        guestId = `cand_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
        localStorage.setItem('pariksha_candidate_uid', guestId);
      }
      candidateUid = guestId;
    }
    localStorage.setItem('pariksha_candidate_name', studentName);

    // 1. Check if test is a "released" test (available exclusively for signed-in students for unlimited reattempts)
    if (test.status === 'released') {
      if (!user) {
        setPreselectedTestForJoin(test);
        setCurrentView('login');
        return;
      }

      // If user has not yet confirmed on the pre-exam instructions page, show all test details & syllabus first!
      if (!isConfirmedStart) {
        handleOpenReattemptInstructions(test, studentName);
        return;
      }

      // Confirmed reattempt start:
      // Clear draft answers cache for this test and student so reattempt starts fresh
      if (typeof window !== 'undefined' && candidateUid) {
        localStorage.setItem(`pariksha_is_reattempt_${test.id}_${candidateUid}`, 'true');
        localStorage.removeItem(`pariksha_answers_${test.id}_${candidateUid}`);
        localStorage.removeItem(`pariksha_reviews_${test.id}_${candidateUid}`);
        localStorage.removeItem(`pariksha_visited_${test.id}_${candidateUid}`);
        localStorage.removeItem(`pariksha_tab_switches_${test.id}_${candidateUid}`);
      }
    } else {
      // 2. Normal live/waiting exam: check if already submitted
      const existingAttempt = await findStudentAttempt(test.id, studentName, candidateUid);
      if (existingAttempt) {
        // If this test is scheduled and currently live, check if the attempt was from BEFORE the current scheduled window
        const sched = getTestScheduleInfo(test);
        const attemptDate = existingAttempt.submittedAt ? new Date(existingAttempt.submittedAt).getTime() : 0;
        const sessionStartDate = sched.startDateTime ? sched.startDateTime.getTime() : 0;
        const isPastAttemptBeforeSchedule =
          sched.isScheduled &&
          sched.scheduleStatus === 'live' &&
          sessionStartDate > 0 &&
          attemptDate < sessionStartDate;

        if (!isPastAttemptBeforeSchedule && !isConfirmedStart) {
          // Candidate already submitted this test in this session! Cannot rejoin - redirect directly to result!
          setActiveAttempt(existingAttempt);
          setCurrentView('student-result');
          return;
        } else {
          // Fresh start for scheduled live session or confirmed reattempt
          if (typeof window !== 'undefined' && candidateUid) {
            localStorage.setItem(`pariksha_is_reattempt_${test.id}_${candidateUid}`, 'true');
            localStorage.removeItem(`pariksha_answers_${test.id}_${candidateUid}`);
            localStorage.removeItem(`pariksha_reviews_${test.id}_${candidateUid}`);
            localStorage.removeItem(`pariksha_visited_${test.id}_${candidateUid}`);
            localStorage.removeItem(`pariksha_tab_switches_${test.id}_${candidateUid}`);
          }
        }
      }

      // If test has already ended (completed or result_published) and not confirmed reattempt:
      if (!isConfirmedStart && (test.status === 'completed' || test.status === 'result_published')) {
        setCurrentView(user ? (role === 'admin' ? 'admin' : 'student-home') : 'student-home');
        return;
      }
    }

    const candidateEmail = user?.email || `${candidateUid}@candidate.pariksha`;

    // 1. Record / update participant in Firestore 'users' collection
    try {
      await recordUserExamJoin({
        userId: candidateUid,
        name: studentName,
        email: candidateEmail,
        phone: user?.phone,
        role: (user?.role as UserRole) || 'student',
        testId: test.id,
        testTitle: test.title,
        accessCode: test.accessCode,
      });
    } catch (err) {
      console.warn('User exam join record warning:', err);
    }

    // 2. Register presence in real-time exam session
    try {
      await joinExamSession(test.id, {
        uid: candidateUid,
        name: studentName,
        email: candidateEmail,
      });
    } catch (err) {
      console.warn('Session join warning:', err);
    }

    setPendingReattemptTest(null);

    // If test is already live, released, or confirmed reattempt, jump directly to live exam; otherwise go to waiting room
    if (test.status === 'live' || test.status === 'released' || isConfirmedStart) {
      setCurrentView('live-exam');
    } else {
      setCurrentView('waiting-room');
    }
  };

  const handleExamStarted = (liveTest: TestItem) => {
    setActiveTest(liveTest);
    setCurrentView('live-exam');
  };

  const handleExamSubmitted = (attempt: StudentAttempt) => {
    setActiveAttempt(attempt);
    setCurrentView('student-result');
  };

  // Loading spinner
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs sm:text-sm font-semibold text-slate-700">Initializing ParikshaSetu...</p>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // RENDER: Reattempt Instructions & Test Details Screen
  // First page showing negative marking, time, no of questions, syllabus box, and language dropdown
  // -------------------------------------------------------------
  if (currentView === 'reattempt-instructions' && pendingReattemptTest) {
    return (
      <ReattemptInstructionsView
        test={pendingReattemptTest}
        candidateName={candidateName || user?.name || 'Candidate'}
        onStartExam={(testToStart) => {
          handleAccessGranted(testToStart, candidateName || user?.name || 'Candidate', true);
        }}
        onCancel={() => {
          setPendingReattemptTest(null);
          setCurrentView(activeAttempt ? 'student-result' : (user ? (role === 'admin' ? 'admin' : 'student-home') : 'student-home'));
        }}
      />
    );
  }

  // -------------------------------------------------------------
  // RENDER: Live Exam Screen (Full screen mobile-first, no navbar)
  // Accessible without login for direct exam link candidates
  // -------------------------------------------------------------
  if (currentView === 'live-exam' && activeTest) {
    const candidateUid =
      user?.uid ||
      (typeof window !== 'undefined' ? localStorage.getItem('pariksha_candidate_uid') : '') ||
      `cand_${(candidateName || 'guest').replace(/\s+/g, '_')}`;
    return (
      <LiveExamScreen
        test={activeTest}
        studentId={candidateUid}
        studentName={candidateName || user?.name || 'Candidate'}
        onSubmitted={handleExamSubmitted}
      />
    );
  }

  // -------------------------------------------------------------
  // RENDER: Waiting Room (Full screen focused view)
  // Accessible without login for direct exam link candidates
  // -------------------------------------------------------------
  if (currentView === 'waiting-room' && activeTest) {
    return (
      <WaitingRoom
        test={activeTest}
        studentName={candidateName || user?.name || 'Candidate'}
        onExamStarted={handleExamStarted}
        onViewResult={(attempt) => {
          setActiveAttempt(attempt);
          setCurrentView('student-result');
        }}
        onExit={() => {
          setActiveTest(null);
          setCurrentView(user ? (role === 'admin' ? 'admin' : 'student-home') : 'student-home');
        }}
      />
    );
  }

  // -------------------------------------------------------------
  // RENDER: Student Result Screen
  // Accessible without login for direct exam link candidates
  // -------------------------------------------------------------
  if (currentView === 'student-result' && activeAttempt) {
    return (
      <>
        {user && (
          <Navbar
            currentView={currentView}
            onNavigate={(view) => setCurrentView(view)}
            onOpenJoinModal={() => {
              setPreselectedTestForJoin(null);
              setIsJoinModalOpen(true);
            }}
          />
        )}
        <StudentResultView
          attempt={activeAttempt}
          onBackToPortal={() => {
            setActiveAttempt(null);
            setActiveTest(null);
            setCurrentView(user ? (role === 'admin' ? 'admin' : 'student-home') : 'student-home');
          }}
          onReattempt={(testToReattempt) => {
            handleOpenReattemptInstructions(testToReattempt, candidateName || user?.name || 'Candidate');
          }}
        />
      </>
    );
  }

  // -------------------------------------------------------------
  // RENDER: Unauthenticated view
  // Shows direct exam entry modal if exam link clicked or requested; otherwise shows LoginView
  // -------------------------------------------------------------
  if (!user) {
    return (
      <>
        <LoginView
          onSuccess={() => {
            if (preselectedTestForJoin) {
              setIsJoinModalOpen(true);
            }
          }}
          onOpenDirectExam={() => {
            setPreselectedTestForJoin(null);
            setIsJoinModalOpen(true);
          }}
        />

        {isJoinModalOpen && (
          <AccessExamModal
            isOpen={isJoinModalOpen}
            onClose={() => {
              setIsJoinModalOpen(false);
              setPreselectedTestForJoin(null);
              setUrlExamCode('');
            }}
            onAccessGranted={handleAccessGranted}
            onRequireSignIn={() => {
              setIsJoinModalOpen(false);
              setCurrentView('login');
            }}
            onViewResult={(attempt) => {
              setActiveAttempt(attempt);
              setIsJoinModalOpen(false);
              setPreselectedTestForJoin(null);
              setUrlExamCode('');
              setCurrentView('student-result');
            }}
            preselectedTest={preselectedTestForJoin}
            initialAccessCode={urlExamCode}
          />
        )}
      </>
    );
  }

  // -------------------------------------------------------------
  // RENDER: Admin Portal View
  // -------------------------------------------------------------
  if (role === 'admin' && currentView === 'admin') {
    return (
      <AdminLayout
        currentTab={adminTab}
        onSelectTab={(tab) => {
          setAdminTab(tab);
          setManagingQuestionTest(null);
        }}
        onExitToStudentPortal={() => setCurrentView('student-home')}
      >
        {/* If Question Manager is active for a test */}
        {managingQuestionTest ? (
          <QuestionManager
            test={managingQuestionTest}
            onBack={() => setManagingQuestionTest(null)}
          />
        ) : (
          <>
            {adminTab === 'dashboard' && (
              <AdminDashboard
                onNavigate={(tab, contextId) => {
                  setAdminTab(tab);
                  if (contextId && tab === 'results') setSelectedTestIdForResults(contextId);
                }}
              />
            )}

            {adminTab === 'series' && (
              <TestSeriesManager
                onOpenTestManagerForSeries={(seriesId) => {
                  setSelectedSeriesFilterForTests(seriesId);
                  setAdminTab('tests');
                }}
              />
            )}

            {adminTab === 'tests' && (
              <TestManager
                initialSeriesId={selectedSeriesFilterForTests}
                onManageQuestions={(t) => setManagingQuestionTest(t)}
                onPreviewTest={(t) => setPreviewTest(t)}
                onLaunchLive={(t) => {
                  setSelectedTestIdForResults(t.id);
                  setAdminTab('live');
                }}
              />
            )}

            {adminTab === 'live' && (
              <LiveExamMonitor
                initialTestId={selectedTestIdForResults}
                onViewResults={(tId) => {
                  setSelectedTestIdForResults(tId);
                  setAdminTab('results');
                }}
                onTestAsCandidate={(test) => {
                  setPreselectedTestForJoin(test);
                  setUrlExamCode(test.accessCode);
                  setIsJoinModalOpen(true);
                }}
              />
            )}

            {adminTab === 'results' && (
              <ResultsDashboard initialTestId={selectedTestIdForResults} />
            )}

            {adminTab === 'students' && <StudentManager />}

            {adminTab === 'settings' && <SettingsManager />}
          </>
        )}

        {/* Admin Test Preview Modal */}
        {previewTest && (
          <TestPreviewModal
            test={previewTest}
            onClose={() => setPreviewTest(null)}
          />
        )}
      </AdminLayout>
    );
  }

  // -------------------------------------------------------------
  // RENDER: Student Portal View (Default)
  // -------------------------------------------------------------
  return (
    <>
      <StudentHome
        onSelectTest={(t) => {
          if (t.status === 'released') {
            handleOpenReattemptInstructions(t, candidateName || user?.name || 'Candidate');
          } else {
            setPreselectedTestForJoin(t);
            setIsJoinModalOpen(true);
          }
        }}
        onOpenJoinModalWithTest={(t) => {
          if (t.status === 'released') {
            handleOpenReattemptInstructions(t, candidateName || user?.name || 'Candidate');
          } else {
            setPreselectedTestForJoin(t);
            setIsJoinModalOpen(true);
          }
        }}
        onReattemptTest={(testToReattempt) => {
          handleOpenReattemptInstructions(testToReattempt, candidateName || user?.name || 'Candidate');
        }}
        onViewAttempt={(att) => {
          setActiveAttempt(att);
          setCurrentView('student-result');
        }}
        onOpenJoinModal={() => {
          setPreselectedTestForJoin(null);
          setIsJoinModalOpen(true);
        }}
        onNavigateToAdmin={() => {
          setCurrentView('admin');
          setAdminTab('dashboard');
        }}
      />

      {/* Protected Test Link & Password Entry Modal */}
      <AccessExamModal
        isOpen={isJoinModalOpen}
        onClose={() => {
          setIsJoinModalOpen(false);
          setPreselectedTestForJoin(null);
          setUrlExamCode('');
        }}
        preselectedTest={preselectedTestForJoin}
        initialAccessCode={urlExamCode}
        onAccessGranted={handleAccessGranted}
        onRequireSignIn={() => {
          setIsJoinModalOpen(false);
          setCurrentView('login');
        }}
        onViewResult={(attempt) => {
          setActiveAttempt(attempt);
          setIsJoinModalOpen(false);
          setPreselectedTestForJoin(null);
          setUrlExamCode('');
          setCurrentView('student-result');
        }}
      />
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <InstituteProvider>
        <MainApp />
      </InstituteProvider>
    </AuthProvider>
  );
}
