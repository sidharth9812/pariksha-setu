import React, { useEffect, useState, useMemo } from 'react';
import {
  LayoutDashboard,
  BookOpen,
  Award,
  TrendingUp,
  GraduationCap,
  Bell,
  User,
  Settings,
  LogOut,
  Clock,
  PlayCircle,
  CheckCircle2,
  Calendar,
  Lock,
  ArrowRight,
  Shield,
  Search,
  RotateCw,
  FolderKanban,
  Sparkles,
  Menu,
  X,
  ChevronRight,
  Wifi,
  WifiOff,
  ExternalLink,
  FileText,
  AlertCircle,
  Filter,
  BarChart2,
  Phone,
  Mail,
  Layers,
  HelpCircle,
  Camera,
  Upload,
  Loader2,
  Image as ImageIcon,
  Video,
  Play,
  Film,
  HardDrive,
  Download,
} from 'lucide-react';
import { TestItem, TestSeries, StudentAttempt, CourseItem, OfflineTestRecord, OfflineDownloadProgress } from '../../types/exam';
import {
  getTests,
  getSeriesList,
  getAllAttempts,
  subscribeToTestsList,
} from '../../services/examService';
import { useAuth } from '../../context/AuthContext';
import { useInstitute } from '../../context/InstituteContext';
import { getTestScheduleInfo, TestScheduleInfo } from '../../utils/scheduleHelper';
import {
  uploadStudentProfilePhoto,
  saveStudentProfileImageToFirestore,
  getAllCoursesFromFirestore,
} from '../../services/cloudinaryService';
import { EnhancedVideoPlayer } from '../../components/common/EnhancedVideoPlayer';
import { OfflinePracticeTab } from './OfflinePracticeTab';
import {
  getDownloadedTests,
  downloadPracticeTestForOffline,
  deleteDownloadedTest,
  subscribeToDownloadProgress,
  getPendingOfflineAttempts,
  syncPendingOfflineAttempts,
} from '../../services/offlineStorageService';
import {
  checkForAppUpdate,
  getInstalledAppVersion,
  ANDROID_PACKAGE_ID,
  DEFAULT_APP_VERSION,
  DEFAULT_APP_VERSION_CODE,
  AppUpdateCheckResult,
} from '../../services/nativeAppService';
import { InAppUpdateActionPanel } from '../../components/PWAInstallButton';

interface StudentHomeProps {
  onSelectTest: (test: TestItem) => void;
  onOpenJoinModalWithTest?: (test: TestItem) => void;
  onViewAttempt: (attempt: StudentAttempt) => void;
  onReattemptTest?: (test: TestItem) => void;
  onOpenJoinModal?: () => void;
  onNavigateToAdmin?: () => void;
}

type StudentTab =
  | 'home'
  | 'exams'
  | 'offline'
  | 'results'
  | 'performance'
  | 'material'
  | 'notifications'
  | 'profile'
  | 'settings';

export const StudentHome: React.FC<StudentHomeProps> = ({
  onSelectTest,
  onOpenJoinModalWithTest,
  onViewAttempt,
  onReattemptTest,
  onOpenJoinModal,
  onNavigateToAdmin,
}) => {
  const { user, role, logout, updateUserProfileState } = useAuth();
  const { settings } = useInstitute();

  // Profile photo upload states
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [photoUploadProgress, setPhotoUploadProgress] = useState(0);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [photoSuccess, setPhotoSuccess] = useState<string | null>(null);

  // App Version & Update Check State
  const [installedVersion, setInstalledVersion] = useState<string>(DEFAULT_APP_VERSION);
  const [installedVersionCode, setInstalledVersionCode] = useState<number>(DEFAULT_APP_VERSION_CODE);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [manualUpdateCheck, setManualUpdateCheck] = useState<AppUpdateCheckResult | null>(null);

  useEffect(() => {
    getInstalledAppVersion().then((info) => {
      setInstalledVersion(info.versionName);
      setInstalledVersionCode(info.versionCode);
    });
  }, []);

  const handleManualUpdateCheck = async () => {
    setIsCheckingUpdate(true);
    try {
      const result = await checkForAppUpdate({ isManualCheck: true });
      setManualUpdateCheck(result);
    } finally {
      setIsCheckingUpdate(false);
    }
  };

  const handleProfilePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.uid) return;

    setIsUploadingPhoto(true);
    setPhotoUploadProgress(0);
    setPhotoError(null);
    setPhotoSuccess(null);

    try {
      // 1. Upload to Cloudinary (folder: parikshasetu/students/profiles/)
      const res = await uploadStudentProfilePhoto(file, (progress) => {
        setPhotoUploadProgress(progress);
      });

      // 2. Save secure_url and public_id to Firestore student document
      await saveStudentProfileImageToFirestore(user.uid, res);

      // 3. Update active auth session state
      updateUserProfileState({
        photoUrl: res.secure_url,
        profileImageUrl: res.secure_url,
        profileImagePublicId: res.public_id,
      });

      setPhotoSuccess('Profile picture updated successfully!');
    } catch (err: any) {
      console.error('Student profile photo upload error:', err);
      setPhotoError(err.message || 'Media upload failed. Please try again.');
    } finally {
      setIsUploadingPhoto(false);
      e.target.value = '';
    }
  };

  // Navigation State
  const [activeTab, setActiveTab] = useState<StudentTab>('home');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Real-time ticking clock for exact schedule synchronization
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 10000);
    return () => clearInterval(timer);
  }, []);

  // Data State
  const [tests, setTests] = useState<TestItem[]>([]);
  const [series, setSeries] = useState<TestSeries[]>([]);
  const [myAttempts, setMyAttempts] = useState<StudentAttempt[]>([]);
  const [courses, setCourses] = useState<CourseItem[]>([]);
  const [previewVideoUrl, setPreviewVideoUrl] = useState<string | null>(null);
  const [previewVideoTitle, setPreviewVideoTitle] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [downloadedTests, setDownloadedTests] = useState<OfflineTestRecord[]>([]);
  const [pendingAttempts, setPendingAttempts] = useState<StudentAttempt[]>([]);
  const [activeDownloadMap, setActiveDownloadMap] = useState<Record<string, OfflineDownloadProgress>>({});

  const refreshOfflineRecords = async () => {
    try {
      const [dl, p] = await Promise.all([
        getDownloadedTests(),
        getPendingOfflineAttempts(),
      ]);
      setDownloadedTests(dl);
      setPendingAttempts(p);
    } catch {
      // ignore
    }
  };

  // Online status monitoring
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      refreshOfflineRecords();
    };
    const handleOffline = () => {
      setIsOnline(false);
      refreshOfflineRecords();
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Offline download progress and custom event subscriptions
  useEffect(() => {
    const unsubProgress = subscribeToDownloadProgress((p) => {
      setActiveDownloadMap((prev) => ({
        ...prev,
        [p.testId]: p,
      }));
      if (p.percent === 100) {
        refreshOfflineRecords();
      }
    });

    const onOfflineTests = () => refreshOfflineRecords();
    const onOfflineAttempts = () => refreshOfflineRecords();

    window.addEventListener('pariksha_offline_tests_updated', onOfflineTests);
    window.addEventListener('pariksha_offline_attempts_changed', onOfflineAttempts);
    window.addEventListener('pariksha_offline_attempts_synced', onOfflineAttempts);

    return () => {
      unsubProgress();
      window.removeEventListener('pariksha_offline_tests_updated', onOfflineTests);
      window.removeEventListener('pariksha_offline_attempts_changed', onOfflineAttempts);
      window.removeEventListener('pariksha_offline_attempts_synced', onOfflineAttempts);
    };
  }, []);

  const handleDownloadPracticeTest = async (testToDl: TestItem, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      await downloadPracticeTestForOffline(testToDl);
      await refreshOfflineRecords();
    } catch (err: any) {
      console.warn('Practice test download error:', err);
    }
  };

  // Initial load
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const [tList, sList, allAtt, cList, dlTests, pAtts] = await Promise.all([
          getTests(),
          getSeriesList(),
          getAllAttempts(),
          getAllCoursesFromFirestore(),
          getDownloadedTests(),
          getPendingOfflineAttempts(),
        ]);
        setDownloadedTests(dlTests);
        setPendingAttempts(pAtts);

        // If offline or tList is empty, supplement tList with downloaded tests
        if (tList.length === 0 && dlTests.length > 0) {
          const offlineConverted: TestItem[] = dlTests.map((dt) => ({
            id: dt.id,
            seriesId: '',
            title: dt.title,
            description: dt.instructions || '',
            examCategory: dt.examCategory,
            totalQuestions: dt.totalQuestions,
            durationMinutes: dt.durationMinutes,
            marksPerQuestion: dt.marksPerQuestion,
            negativeMarks: dt.negativeMarks,
            instantResult: true,
            status: dt.status || 'released',
            accessCode: dt.accessCode || '',
            accessPassword: '',
            instructions: dt.instructions,
            syllabus: dt.syllabus,
            createdAt: dt.downloadedAt,
          }));
          setTests(offlineConverted);
        } else {
          setTests(tList);
        }

        setSeries(sList);
        setCourses(cList.filter((c) => c.status === 'published'));

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

        // Sort attempts newest first
        mine.sort((a, b) => new Date(b.submittedAt || 0).getTime() - new Date(a.submittedAt || 0).getTime());
        setMyAttempts(mine);
      } catch (err) {
        console.error('Failed to load student portal data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();

    // Real-time synchronization for tests catalog
    const unsub = subscribeToTestsList((updatedTests) => {
      setTests(updatedTests);
    });

    return () => unsub();
  }, [user]);

  // Categories
  const categories = ['all', 'MP Police', 'MP SI', 'SSC', 'General Knowledge'];

  // Filtered available examinations
  const availableTests = useMemo(() => {
    return tests.filter((t) => {
      if (t.status === 'draft') return false;
      const matchCategory =
        selectedCategory === 'all' ||
        t.examCategory?.toLowerCase() === selectedCategory.toLowerCase();
      const matchQuery =
        t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.accessCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (t.seriesTitle && t.seriesTitle.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchCategory && matchQuery;
    });
  }, [tests, selectedCategory, searchQuery]);

  // Scheduled tests (Upcoming, Live, or Expired)
  const scheduledTests = useMemo(() => {
    return tests
      .filter((t) => t.status !== 'draft')
      .map((t) => {
        // If test is linked to a series that has scheduling, inherit series schedule if test has none
        const linkedSeries = series.find((s) => s.id === t.seriesId);
        const effectiveTest = {
          ...t,
          startDate: t.startDate || (t.status === 'scheduled' ? undefined : linkedSeries?.startDate),
          startTime: t.startTime || (t.status === 'scheduled' ? undefined : linkedSeries?.startTime),
        };
        return {
          test: t,
          schedule: getTestScheduleInfo(effectiveTest, now),
        };
      })
      .filter(({ schedule }) => schedule.isScheduled)
      .sort((a, b) => {
        const aTime = a.schedule.startDateTime ? a.schedule.startDateTime.getTime() : 0;
        const bTime = b.schedule.startDateTime ? b.schedule.startDateTime.getTime() : 0;
        return aTime - bTime;
      });
  }, [tests, series, now]);

  // Upcoming scheduled tests (active or upcoming)
  const upcomingScheduledTests = useMemo(() => {
    return scheduledTests.filter(
      ({ schedule }) => schedule.scheduleStatus === 'upcoming' || schedule.scheduleStatus === 'live'
    );
  }, [scheduledTests]);

  // Real statistics calculated purely from actual attempts
  const stats = useMemo(() => {
    const totalAttempted = myAttempts.length;
    const completedAttempts = myAttempts.filter((a) => a.status === 'submitted' || a.status === 'evaluated' || a.status === 'auto_submitted');
    
    let totalScore = 0;
    let bestScore = 0;
    let totalAccuracy = 0;
    let totalCorrect = 0;
    let totalIncorrect = 0;

    completedAttempts.forEach((a) => {
      const score = Number(a.finalScore) || 0;
      totalScore += score;
      if (score > bestScore) bestScore = score;
      totalAccuracy += Number(a.accuracy) || 0;
      totalCorrect += Number(a.correctCount) || 0;
      totalIncorrect += Number(a.incorrectCount) || 0;
    });

    const avgScore = completedAttempts.length > 0 ? (totalScore / completedAttempts.length).toFixed(1) : '0';
    const avgAccuracy = completedAttempts.length > 0 ? Math.round(totalAccuracy / completedAttempts.length) : 0;

    return {
      totalAttempted,
      completedCount: completedAttempts.length,
      avgScore,
      bestScore,
      avgAccuracy,
      totalCorrect,
      totalIncorrect,
    };
  }, [myAttempts]);

  // Navigation Items
  const navItems = [
    { id: 'home' as StudentTab, label: 'Home', icon: LayoutDashboard },
    { id: 'exams' as StudentTab, label: 'Examinations', icon: BookOpen, badge: availableTests.length > 0 ? `${availableTests.length}` : undefined },
    { id: 'offline' as StudentTab, label: 'Offline Practice', icon: HardDrive, badge: downloadedTests.length > 0 ? `${downloadedTests.length}` : undefined },
    { id: 'results' as StudentTab, label: 'My Results', icon: Award, badge: myAttempts.length > 0 ? `${myAttempts.length}` : undefined },
    { id: 'performance' as StudentTab, label: 'Performance', icon: TrendingUp },
    { id: 'material' as StudentTab, label: 'Study Material', icon: GraduationCap },
    { id: 'notifications' as StudentTab, label: 'Notifications', icon: Bell, badge: upcomingScheduledTests.length > 0 ? `${upcomingScheduledTests.length}` : undefined },
    { id: 'profile' as StudentTab, label: 'My Profile', icon: User },
    { id: 'settings' as StudentTab, label: 'Settings', icon: Settings },
  ];

  // Helper for Section Titles in Top Header
  const getTabTitle = (tab: StudentTab) => {
    switch (tab) {
      case 'home':
        return { title: 'Student Dashboard', subtitle: 'Overview, quick metrics, and scheduled tests' };
      case 'exams':
        return { title: 'Available Examinations', subtitle: 'Scheduled examinations, competitive papers, and practice series' };
      case 'offline':
        return { title: 'Offline Practice Tests', subtitle: 'Manage downloaded practice tests and synchronized attempts' };
      case 'results':
        return { title: 'My Exam Results', subtitle: 'Submitted test evaluation history and scorecards' };
      case 'performance':
        return { title: 'Performance Analytics', subtitle: 'Accuracy tracking, score progression, and test insights' };
      case 'material':
        return { title: 'Study Material & Syllabus', subtitle: 'Curriculum coverage, test blueprints, and subject guides' };
      case 'notifications':
        return { title: 'Announcements & Alerts', subtitle: 'Live examination updates and scheduled test notices' };
      case 'profile':
        return { title: 'Student Profile', subtitle: 'Candidate identity, credentials, and participation records' };
      case 'settings':
        return { title: 'Portal Settings', subtitle: 'Institute information and candidate preferences' };
    }
  };

  const currentTabInfo = getTabTitle(activeTab);

  // Render Test Action Button with full scheduling and offline logic
  const renderTestActionButton = (t: TestItem, schedule: TestScheduleInfo) => {
    const myAttemptsForThis = myAttempts.filter((a) => a.testId === t.id);
    const latestAttempt = myAttemptsForThis[0];
    const isDownloaded = downloadedTests.some((d) => d.id === t.id);
    const dlProgress = activeDownloadMap[t.id];
    const isDownloading = dlProgress?.isDownloading;

    // Case 1: Scheduled Official Test
    if (schedule.isScheduled) {
      if (schedule.scheduleStatus === 'upcoming') {
        return (
          <button
            type="button"
            disabled
            className="w-full py-2.5 px-3 rounded-xl bg-purple-50 text-purple-700 border border-purple-200 font-bold text-xs flex items-center justify-center gap-1.5 cursor-not-allowed opacity-85"
            title={`This test is scheduled for ${schedule.formattedDate} at ${schedule.formattedStartTime}. Early start is not permitted.`}
          >
            <Lock className="w-3.5 h-3.5 text-purple-600" />
            <span>Upcoming • Available at {schedule.formattedStartTime}</span>
          </button>
        );
      }

      if (schedule.scheduleStatus === 'live') {
        if (!isOnline) {
          return (
            <button
              type="button"
              disabled
              className="w-full py-2.5 px-3 rounded-xl bg-slate-100 text-slate-500 font-bold text-xs flex items-center justify-center gap-1.5 cursor-not-allowed border border-slate-200"
              title="Official live examinations require an active internet connection for anti-cheat verification and server-synchronized timers. Please connect to internet."
            >
              <WifiOff className="w-3.5 h-3.5 text-slate-400" />
              <span>Live Exam • Connect to Internet</span>
            </button>
          );
        }

        return (
          <button
            type="button"
            onClick={() => onSelectTest(t)}
            className="w-full py-2.5 px-3 rounded-xl bg-linear-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all shadow-xs"
          >
            <PlayCircle className="w-4 h-4" />
            <span>Start Live Exam</span>
          </button>
        );
      }

      // Expired / Concluded
      if (latestAttempt) {
        return (
          <div className="flex items-center gap-2 w-full">
            <button
              type="button"
              onClick={() => onViewAttempt(latestAttempt)}
              className="flex-1 py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
            >
              <Award className="w-3.5 h-3.5 text-emerald-600" />
              <span>View Result</span>
            </button>
            <span className="text-[11px] font-bold text-slate-600 py-1 px-2.5 rounded-lg bg-slate-100 border border-slate-200">
              Completed
            </span>
          </div>
        );
      }

      return (
        <button
          type="button"
          disabled
          className="w-full py-2.5 px-3 rounded-xl bg-slate-100 text-slate-500 font-bold text-xs flex items-center justify-center gap-1.5 cursor-not-allowed border border-slate-200"
        >
          <Clock className="w-3.5 h-3.5 text-slate-400" />
          <span>Completed / Expired</span>
        </button>
      );
    }

    // Case 2: Released Practice Test (Unlimited Reattempts & Downloadable)
    if (t.status === 'released') {
      return (
        <div className="space-y-2 w-full">
          {/* Download status / button row */}
          <div className="flex items-center justify-between text-[11px]">
            {isDownloaded ? (
              <span className="inline-flex items-center gap-1 text-emerald-700 font-bold">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Available Offline</span>
              </span>
            ) : isDownloading ? (
              <span className="text-indigo-600 font-bold flex items-center gap-1 animate-pulse">
                <RotateCw className="w-3 h-3 animate-spin" />
                <span>Downloading {dlProgress?.percent}%</span>
              </span>
            ) : isOnline ? (
              <button
                type="button"
                onClick={(e) => handleDownloadPracticeTest(t, e)}
                className="text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 cursor-pointer transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download for Offline</span>
              </button>
            ) : null}
          </div>

          <div className="flex items-center gap-2 w-full">
            <button
              type="button"
              onClick={() => (onReattemptTest ? onReattemptTest(t) : onSelectTest(t))}
              className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors shadow-xs"
              title="Start practice test"
            >
              {myAttemptsForThis.length > 0 ? (
                <>
                  <RotateCw className="w-3.5 h-3.5" />
                  <span>Reattempt</span>
                </>
              ) : (
                <>
                  <PlayCircle className="w-4 h-4" />
                  <span>Start Practice</span>
                </>
              )}
            </button>
            {latestAttempt && (
              <button
                type="button"
                onClick={() => onViewAttempt(latestAttempt)}
                className="py-2 px-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors"
                title="View past scorecard"
              >
                <Award className="w-3.5 h-3.5" />
                <span>Result</span>
              </button>
            )}
          </div>
        </div>
      );
    }

    // Case 3: Standard Published Practice Test
    return (
      <div className="space-y-2 w-full">
        <div className="flex items-center justify-between text-[11px]">
          {isDownloaded ? (
            <span className="inline-flex items-center gap-1 text-emerald-700 font-bold">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Available Offline</span>
            </span>
          ) : isDownloading ? (
            <span className="text-indigo-600 font-bold flex items-center gap-1 animate-pulse">
              <RotateCw className="w-3 h-3 animate-spin" />
              <span>Downloading {dlProgress?.percent}%</span>
            </span>
          ) : isOnline ? (
            <button
              type="button"
              onClick={(e) => handleDownloadPracticeTest(t, e)}
              className="text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 cursor-pointer transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download for Offline</span>
            </button>
          ) : null}
        </div>

        <div className="flex items-center gap-2 w-full">
          <button
            type="button"
            onClick={() => onSelectTest(t)}
            className="flex-1 py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors shadow-xs"
          >
            <PlayCircle className="w-4 h-4" />
            <span>Start Test</span>
          </button>
          {latestAttempt && (
            <button
              type="button"
              onClick={() => onViewAttempt(latestAttempt)}
              className="py-2 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors"
              title="View past scorecard"
            >
              <Award className="w-3.5 h-3.5" />
              <span>Result</span>
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row text-slate-800 antialiased font-sans">
      {/* Mobile Top Header */}
      <header className="md:hidden bg-slate-900 text-white px-4 py-3 flex items-center justify-between shadow-xs sticky top-0 z-40">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-linear-to-br from-indigo-500 to-blue-600 flex items-center justify-center font-bold text-white shadow-xs">
            {settings.logoUrl ? (
              <img src={settings.logoUrl} alt={settings.instituteName} className="w-full h-full object-contain p-0.5 rounded-lg bg-white" />
            ) : (
              <GraduationCap className="w-5 h-5" />
            )}
          </div>
          <div>
            <div className="text-sm font-bold truncate max-w-[170px]">{settings.instituteName || 'ParikshaSetu'}</div>
            <div className="text-[10px] text-indigo-300 font-medium">Student Examination Portal</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onOpenJoinModal && (
            <button
              onClick={onOpenJoinModal}
              className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors shadow-xs"
            >
              <PlayCircle className="w-3.5 h-3.5" />
              <span>Join</span>
            </button>
          )}

          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 cursor-pointer"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </header>

      {/* Backdrop for mobile drawer */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-40 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Left Sidebar (Desktop & Mobile Drawer) */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 bg-slate-900 text-white flex flex-col justify-between transition-transform duration-200 ease-in-out md:static md:translate-x-0 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700">
          {/* Sidebar Branding Header */}
          <div className="p-5 border-b border-slate-800 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-linear-to-br from-indigo-500 to-blue-600 flex items-center justify-center text-white shadow-md shrink-0 overflow-hidden">
                {settings.logoUrl ? (
                  <img src={settings.logoUrl} alt={settings.instituteName} className="w-full h-full object-contain p-0.5 bg-white" />
                ) : (
                  <GraduationCap className="w-6 h-6" />
                )}
              </div>
              <div className="min-w-0">
                <h2 className="text-sm font-black truncate text-white leading-tight">
                  {settings.instituteName || 'ParikshaSetu'}
                </h2>
                <span className="inline-block mt-0.5 px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  Student Portal
                </span>
              </div>
            </div>

            <button
              onClick={() => setMobileMenuOpen(false)}
              className="md:hidden text-slate-400 hover:text-white p-1 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Student Profile Snapshot in Sidebar */}
          <div className="p-4 mx-3 my-3 rounded-2xl bg-slate-800/80 border border-slate-700/80 flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-linear-to-br from-indigo-600 to-blue-600 flex items-center justify-center text-white font-black text-base shadow-sm shrink-0 overflow-hidden border border-indigo-400/30">
              {user?.photoUrl ? (
                <img src={user.photoUrl} alt={user.name} className="w-full h-full object-cover" />
              ) : (
                (user?.name || 'Candidate').charAt(0).toUpperCase()
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold text-white truncate">
                {user?.name || 'Candidate'}
              </div>
              <div className="text-[11px] text-slate-400 truncate">
                {user?.email || 'Logged In'}
              </div>
              <div className="flex items-center gap-1.5 mt-1 text-[10px] text-emerald-400 font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>Active Candidate</span>
              </div>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-3 space-y-1 flex-1">
            <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Navigation Menu
            </div>
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    isActive
                      ? 'bg-linear-to-r from-indigo-600 to-blue-600 text-white shadow-md'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                    <span>{item.label}</span>
                  </div>

                  {item.badge && (
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        isActive
                          ? 'bg-white/20 text-white'
                          : 'bg-slate-800 text-slate-300 border border-slate-700'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Sidebar Footer & Logout */}
          <div className="p-4 border-t border-slate-800 space-y-2">
            {role === 'admin' && onNavigateToAdmin && (
              <button
                onClick={onNavigateToAdmin}
                className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-amber-400" />
                  <span>Admin Control Panel</span>
                </div>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            )}

            <button
              onClick={logout}
              className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-bold text-slate-300 hover:text-red-300 hover:bg-red-500/10 transition-colors cursor-pointer border border-transparent hover:border-red-500/20"
              title="Sign out of your account"
            >
              <LogOut className="w-4 h-4 text-slate-400" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Desktop Top Header Bar */}
        <header className="hidden md:flex bg-white border-b border-slate-200 px-6 py-3.5 items-center justify-between sticky top-0 z-30 shadow-xs">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
              <span>Student Portal</span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-indigo-600 font-bold capitalize">{activeTab}</span>
            </div>
            <h1 className="text-lg font-black text-slate-900 tracking-tight leading-tight">
              {currentTabInfo.title}
            </h1>
          </div>

          <div className="flex items-center gap-3">
            {/* Network status */}
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                isOnline ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'
              }`}
            >
              {isOnline ? (
                <>
                  <Wifi className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Online</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3.5 h-3.5 text-red-600 animate-pulse" />
                  <span>Offline</span>
                </>
              )}
            </div>

            {/* Quick Action: Join Exam / Enter Code */}
            {onOpenJoinModal && (
              <button
                onClick={onOpenJoinModal}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-linear-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-bold text-xs shadow-xs transition-all cursor-pointer active:scale-98"
                title="Enter access code and password"
              >
                <PlayCircle className="w-4 h-4" />
                <span>Join Exam / Enter Code</span>
              </button>
            )}

            {/* User Mini Avatar */}
            <div
              onClick={() => setActiveTab('profile')}
              className="flex items-center gap-2 pl-3 border-l border-slate-200 cursor-pointer select-none group"
              title="View Profile"
            >
              <div className="w-9 h-9 rounded-xl bg-slate-100 border border-slate-200 group-hover:border-indigo-400 flex items-center justify-center text-slate-800 font-black text-sm overflow-hidden transition-colors">
                {user?.photoUrl ? (
                  <img src={user.photoUrl} alt={user.name} className="w-full h-full object-cover" />
                ) : (
                  (user?.name || 'Candidate').charAt(0).toUpperCase()
                )}
              </div>
              <div className="text-left hidden lg:block">
                <div className="text-xs font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                  {user?.name || 'Candidate'}
                </div>
                <div className="text-[10px] text-slate-500">Student Account</div>
              </div>
            </div>
          </div>
        </header>

        {/* Tab View Container */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-6">
          {/* ========================================================
              TAB 1: HOME / DASHBOARD
             ======================================================== */}
          {activeTab === 'home' && (
            <div className="space-y-6">
              {/* Welcome Section Banner */}
              <div className="bg-linear-to-r from-indigo-900 via-slate-900 to-indigo-950 rounded-3xl p-6 sm:p-8 text-white shadow-md relative overflow-hidden">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
                  <div className="max-w-2xl space-y-3">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-white/10 text-emerald-300 border border-white/10">
                      <Shield className="w-3.5 h-3.5 text-emerald-400" />
                      <span>{settings.instituteName || 'Official Competitive Examination Portal'}</span>
                    </div>

                    <h2 className="text-2xl sm:text-3xl font-black tracking-tight leading-tight text-white">
                      Welcome, {user?.name || 'Candidate'}!
                    </h2>

                    <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-2xl">
                      {settings.tagline || 'Prepare for MP Police Constable, MP Sub-Inspector (SI), SSC, and state competitive exams with proctored mock examinations, real-time analytics, and instant scorecards.'}
                    </p>
                  </div>

                  <div className="shrink-0 flex items-center gap-2.5">
                    <button
                      onClick={() => setActiveTab('exams')}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-sm cursor-pointer"
                    >
                      <BookOpen className="w-4 h-4" />
                      <span>Browse Tests</span>
                    </button>

                    {onOpenJoinModal && (
                      <button
                        onClick={onOpenJoinModal}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/20 text-xs font-bold transition-all shadow-xs cursor-pointer"
                      >
                        <PlayCircle className="w-4 h-4" />
                        <span>Enter Code</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Quick Statistics (Derived purely from existing attempt data) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">
                    Quick Statistics
                  </h3>
                  <span className="text-xs text-slate-400">Based on your test participation</span>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                  {/* Metric 1 */}
                  <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-500">Tests Attempted</span>
                      <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
                        <BookOpen className="w-4 h-4" />
                      </div>
                    </div>
                    <div>
                      <div className="text-2xl sm:text-3xl font-black text-slate-900">{stats.totalAttempted}</div>
                      <p className="text-[11px] text-slate-500 mt-0.5">Total examinations taken</p>
                    </div>
                  </div>

                  {/* Metric 2 */}
                  <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-500">Tests Completed</span>
                      <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                    </div>
                    <div>
                      <div className="text-2xl sm:text-3xl font-black text-slate-900">{stats.completedCount}</div>
                      <p className="text-[11px] text-slate-500 mt-0.5">Submitted & evaluated</p>
                    </div>
                  </div>

                  {/* Metric 3 */}
                  <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-500">Best Score</span>
                      <div className="p-2 rounded-xl bg-purple-50 text-purple-600">
                        <Award className="w-4 h-4" />
                      </div>
                    </div>
                    <div>
                      <div className="text-2xl sm:text-3xl font-black text-slate-900">{stats.bestScore}</div>
                      <p className="text-[11px] text-slate-500 mt-0.5">Highest marks scored</p>
                    </div>
                  </div>

                  {/* Metric 4 */}
                  <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-500">Overall Accuracy</span>
                      <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
                        <TrendingUp className="w-4 h-4" />
                      </div>
                    </div>
                    <div>
                      <div className="text-2xl sm:text-3xl font-black text-slate-900">{stats.avgAccuracy}%</div>
                      <p className="text-[11px] text-slate-500 mt-0.5">Average precision rate</p>
                    </div>
                  </div>
                </div>
              </div>



              {/* DEDICATED: UPCOMING & SCHEDULED TESTS SECTION */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-xl bg-purple-50 text-purple-700 border border-purple-200">
                      <Calendar className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                        Upcoming & Scheduled Tests
                      </h3>
                      <p className="text-xs text-slate-500">
                        Examinations scheduled by your administrator with assigned dates and start times
                      </p>
                    </div>
                  </div>

                  <span className="text-xs font-bold px-3 py-1 rounded-full bg-purple-100 text-purple-800 border border-purple-200">
                    {scheduledTests.length} Scheduled
                  </span>
                </div>

                {scheduledTests.length === 0 ? (
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 text-center space-y-2">
                    <Calendar className="w-8 h-8 text-slate-300 mx-auto" />
                    <p className="text-xs sm:text-sm font-semibold text-slate-700">No scheduled tests right now.</p>
                    <p className="text-xs text-slate-400">
                      Any test scheduled by your administrator will automatically appear here with its start time and duration.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {scheduledTests.map(({ test: t, schedule }) => (
                      <div
                        key={t.id}
                        className={`bg-white rounded-2xl border shadow-xs hover:shadow-md transition-all overflow-hidden flex flex-col justify-between ${
                          schedule.scheduleStatus === 'live'
                            ? 'border-emerald-300 ring-2 ring-emerald-200/60'
                            : schedule.scheduleStatus === 'upcoming'
                            ? 'border-purple-200 hover:border-purple-300'
                            : 'border-slate-200 opacity-90'
                        }`}
                      >
                        <div className="p-5 space-y-3.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                              {t.examCategory}
                            </span>
                            <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${schedule.statusBadgeClass}`}>
                              {schedule.scheduleStatus === 'live' && (
                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                              )}
                              <span>{schedule.statusBadgeText}</span>
                            </span>
                          </div>

                          <div>
                            <h4 className="font-bold text-base text-slate-900 leading-snug line-clamp-1">
                              {t.title}
                            </h4>
                            {t.seriesTitle && (
                              <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">{t.seriesTitle}</p>
                            )}
                          </div>

                          {/* Scheduled Date, Time & Window */}
                          <div className="p-3 bg-purple-50/60 rounded-xl border border-purple-100 space-y-2 text-xs">
                            <div className="flex items-center justify-between text-slate-700 font-semibold">
                              <span className="flex items-center gap-1.5 text-purple-900">
                                <Calendar className="w-3.5 h-3.5 text-purple-600" />
                                <span>Date: <strong>{schedule.formattedDate}</strong></span>
                              </span>
                              <span className="flex items-center gap-1.5 text-purple-900">
                                <Clock className="w-3.5 h-3.5 text-purple-600" />
                                <span>Starts: <strong>{schedule.formattedStartTime}</strong></span>
                              </span>
                            </div>

                            <div className="flex items-center justify-between text-[11px] text-slate-600 pt-1 border-t border-purple-200/60">
                              <span>Duration: <strong>{t.durationMinutes} Mins</strong></span>
                              <span>Window Ends: <strong>{schedule.formattedEndTime}</strong></span>
                            </div>

                            <div className="text-[11px] font-bold text-purple-700">
                              {schedule.timeRemainingText}
                            </div>
                          </div>

                          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                            <span>Questions: <strong>{t.totalQuestions}</strong></span>
                            <span>Marks: <strong>+{t.marksPerQuestion} / -{t.negativeMarks}</strong></span>
                          </div>
                        </div>

                        <div className="p-4 bg-slate-50 border-t border-slate-100">
                          {renderTestActionButton(t, schedule)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Ongoing / Featured Examinations Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-indigo-600" />
                    <span>Practice & Regular Examinations</span>
                  </h3>
                  <button
                    onClick={() => setActiveTab('exams')}
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
                  >
                    <span>View Catalog ({availableTests.length})</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {availableTests.filter((t) => !getTestScheduleInfo(t, now).isScheduled).length === 0 ? (
                  <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-xs text-slate-500">
                    No general examinations available right now.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {availableTests
                      .filter((t) => !getTestScheduleInfo(t, now).isScheduled)
                      .slice(0, 3)
                      .map((t) => {
                        const sched = getTestScheduleInfo(t, now);
                        const isReleased = t.status === 'released';

                        return (
                          <div
                            key={t.id}
                            className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs hover:shadow-md transition-all flex flex-col justify-between space-y-4"
                          >
                            <div className="space-y-2.5">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-indigo-50 text-indigo-700">
                                  {t.examCategory}
                                </span>
                                {isReleased ? (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                                    Released Test
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-semibold text-slate-400 capitalize">
                                    {t.status}
                                  </span>
                                )}
                              </div>

                              <h4 className="font-bold text-slate-900 text-sm line-clamp-1">{t.title}</h4>

                              <div className="flex items-center gap-3 text-xs text-slate-500">
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                                  {t.durationMinutes} Mins
                                </span>
                                <span>&bull;</span>
                                <span className="flex items-center gap-1">
                                  <Award className="w-3.5 h-3.5 text-slate-400" />
                                  {t.totalQuestions} Questions
                                </span>
                              </div>
                            </div>

                            <div>
                              {renderTestActionButton(t, sched)}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>

              {/* Recent Results Preview */}
              {myAttempts.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                      <Award className="w-5 h-5 text-emerald-600" />
                      <span>Recent Results & Scorecards</span>
                    </h3>
                    <button
                      onClick={() => setActiveTab('results')}
                      className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
                    >
                      <span>View All Results ({myAttempts.length})</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    {myAttempts.slice(0, 2).map((att) => (
                      <div
                        key={att.id}
                        className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between gap-4"
                      >
                        <div className="min-w-0 space-y-1">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                            Attempt #{att.attemptNumber || 1} &bull; {att.submittedAt ? new Date(att.submittedAt).toLocaleDateString() : 'Recent'}
                          </span>
                          <h4 className="font-bold text-slate-900 text-sm truncate">{att.testTitle}</h4>
                          <div className="text-xs font-bold text-emerald-600">
                            Score: {att.finalScore} Marks ({att.percentage}%) &bull; Accuracy: {att.accuracy}%
                          </div>
                        </div>

                        <button
                          onClick={() => onViewAttempt(att)}
                          className="px-3 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold shrink-0 cursor-pointer transition-colors"
                        >
                          View Scorecard
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ========================================================
              TAB 2: EXAMINATIONS
             ======================================================== */}
          {activeTab === 'exams' && (
            <div className="space-y-6">
              {/* Category Pills & Search */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer transition-all ${
                        selectedCategory === cat
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {cat === 'all' ? 'All Categories' : cat}
                    </button>
                  ))}
                </div>

                <div className="relative w-full sm:w-72">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Search test name or access code..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl text-xs bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  />
                </div>
              </div>

              {/* Highlighted Upcoming & Scheduled Section inside Examinations tab */}
              {scheduledTests.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-purple-600" />
                      <span>Upcoming & Scheduled Examination Sessions</span>
                    </h3>
                    <span className="text-xs font-bold text-purple-700 bg-purple-100 px-2.5 py-0.5 rounded-full">
                      {scheduledTests.length} Tests
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {scheduledTests.map(({ test: t, schedule }) => (
                      <div
                        key={`sched-${t.id}`}
                        className={`bg-white rounded-2xl border shadow-xs hover:shadow-md transition-all overflow-hidden flex flex-col justify-between ${
                          schedule.scheduleStatus === 'live'
                            ? 'border-emerald-300 ring-2 ring-emerald-200/60'
                            : 'border-purple-200'
                        }`}
                      >
                        <div className="p-5 space-y-3">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-indigo-50 text-indigo-700">
                              {t.examCategory}
                            </span>
                            <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2 py-0.5 rounded-full border ${schedule.statusBadgeClass}`}>
                              {schedule.scheduleStatus === 'live' && (
                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                              )}
                              <span>{schedule.statusBadgeText}</span>
                            </span>
                          </div>

                          <h4 className="font-bold text-base text-slate-900 leading-snug line-clamp-1">{t.title}</h4>

                          <div className="p-3 bg-purple-50/60 rounded-xl border border-purple-100 space-y-1.5 text-xs">
                            <div className="flex items-center justify-between text-purple-900 font-semibold">
                              <span>Date: <strong>{schedule.formattedDate}</strong></span>
                              <span>Starts: <strong>{schedule.formattedStartTime}</strong></span>
                            </div>
                            <div className="flex items-center justify-between text-slate-600 text-[11px]">
                              <span>Duration: <strong>{t.durationMinutes} Mins</strong></span>
                              <span>Ends: <strong>{schedule.formattedEndTime}</strong></span>
                            </div>
                            <div className="text-[11px] font-bold text-purple-700">
                              {schedule.timeRemainingText}
                            </div>
                          </div>
                        </div>

                        <div className="p-4 bg-slate-50 border-t border-slate-100">
                          {renderTestActionButton(t, schedule)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Test Series Programs (if available) */}
              {series.length > 0 && selectedCategory === 'all' && (
                <div className="space-y-3">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <FolderKanban className="w-4 h-4 text-indigo-600" />
                    <span>Examination Programs & Series</span>
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {series.map((s) => {
                      const seriesTests = tests.filter((t) => t.seriesId === s.id && t.status !== 'draft');
                      return (
                        <div
                          key={s.id}
                          onClick={() => setSelectedCategory(s.category)}
                          className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs hover:shadow-md transition-all cursor-pointer space-y-2"
                        >
                          <div className="flex items-center justify-between text-[11px] font-bold">
                            <span className="text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                              {s.category}
                            </span>
                            <span className="text-slate-500">{seriesTests.length} Tests</span>
                          </div>
                          <h4 className="font-bold text-slate-900 text-sm">{s.title}</h4>
                          {s.description && (
                            <p className="text-xs text-slate-500 line-clamp-2">{s.description}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Full Examinations Catalog List */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-indigo-600" />
                    <span>All Available Examinations ({availableTests.length})</span>
                  </h3>
                  <span className="text-xs text-slate-500">Live, Scheduled & Released Tests</span>
                </div>

                {availableTests.length === 0 ? (
                  <div className="bg-white p-12 rounded-3xl border border-slate-200 text-center space-y-3">
                    <BookOpen className="w-12 h-12 text-slate-300 mx-auto" />
                    <h4 className="font-bold text-slate-800 text-base">No examinations found</h4>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto">
                      Try selecting another category or clear your search query to see active examinations.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {availableTests.map((t) => {
                      const schedule = getTestScheduleInfo(t, now);
                      const isReleased = t.status === 'released';

                      return (
                        <div
                          key={t.id}
                          className={`bg-white rounded-2xl border shadow-xs hover:shadow-md transition-all overflow-hidden flex flex-col justify-between ${
                            schedule.scheduleStatus === 'live'
                              ? 'border-emerald-300 ring-2 ring-emerald-200/50'
                              : schedule.isScheduled
                              ? 'border-purple-200'
                              : isReleased
                              ? 'border-emerald-200'
                              : 'border-slate-200'
                          }`}
                        >
                          <div className="p-5 space-y-3">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200">
                                {t.examCategory}
                              </span>
                              <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full border ${schedule.statusBadgeClass}`}>
                                {schedule.scheduleStatus === 'live' && (
                                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                                )}
                                <span>{schedule.statusBadgeText}</span>
                              </span>
                            </div>

                            <div>
                              <h4 className="font-bold text-base text-slate-900 leading-snug line-clamp-1">
                                {t.title}
                              </h4>
                              {t.seriesTitle && (
                                <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">{t.seriesTitle}</p>
                              )}
                            </div>

                            {/* Schedule info if scheduled */}
                            {schedule.isScheduled ? (
                              <div className="p-2.5 bg-purple-50/70 rounded-xl border border-purple-100 text-xs space-y-1">
                                <div className="flex items-center justify-between text-purple-900 font-bold">
                                  <span>Date: {schedule.formattedDate}</span>
                                  <span>Starts: {schedule.formattedStartTime}</span>
                                </div>
                                <div className="text-[11px] text-purple-700">
                                  {schedule.timeRemainingText}
                                </div>
                              </div>
                            ) : (
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
                                  +{t.marksPerQuestion} mark &bull; Negative: -{t.negativeMarks}
                                </div>
                              </div>
                            )}
                          </div>

                          <div className="p-4 bg-slate-50 border-t border-slate-100 flex flex-col gap-2">
                            {isReleased ? (
                              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                                <span>No Password Required &bull; Open Practice</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1 text-xs font-mono font-bold text-slate-600">
                                <Lock className="w-3.5 h-3.5 text-slate-400" />
                                <span>Code: {t.accessCode}</span>
                              </div>
                            )}

                            {renderTestActionButton(t, schedule)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ========================================================
              TAB: OFFLINE PRACTICE
             ======================================================== */}
          {activeTab === 'offline' && (
            <OfflinePracticeTab
              availableTests={availableTests}
              onStartTest={(testToStart) => {
                if (testToStart.status === 'released') {
                  if (onReattemptTest) onReattemptTest(testToStart);
                  else onSelectTest(testToStart);
                } else {
                  onSelectTest(testToStart);
                }
              }}
              onViewAttempt={onViewAttempt}
            />
          )}

          {/* ========================================================
              TAB 3: MY RESULTS
             ======================================================== */}
          {activeTab === 'results' && (
            <div className="space-y-6">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Submitted Attempts & Scorecards</h3>
                  <p className="text-xs text-slate-500">Every submission is independently recorded and evaluated</p>
                </div>
                <div className="text-xs font-bold px-3 py-1.5 rounded-full bg-emerald-100 text-emerald-800 self-start sm:self-auto">
                  {myAttempts.length} Completed Attempts
                </div>
              </div>

              {myAttempts.length === 0 ? (
                <div className="bg-white p-12 rounded-3xl border border-slate-200 text-center space-y-3">
                  <Award className="w-12 h-12 text-slate-300 mx-auto" />
                  <h4 className="font-bold text-slate-800 text-base">No examination results yet</h4>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    Once you complete and submit an examination, your scores, detailed answers, and performance analytics will appear here.
                  </p>
                  <button
                    onClick={() => setActiveTab('exams')}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
                  >
                    Take Your First Test
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
                        className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs hover:shadow-md transition-all flex flex-col justify-between space-y-4"
                      >
                        <div className="space-y-2.5">
                          <div className="flex items-center justify-between text-xs text-slate-500">
                            <span className="font-bold text-slate-700">
                              Attempt #{att.attemptNumber || 1}
                            </span>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                isPublished
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {isPublished ? 'Published' : 'Result Pending'}
                            </span>
                          </div>

                          <h4 className="font-bold text-slate-900 text-sm leading-snug line-clamp-2">
                            {att.testTitle}
                          </h4>

                          <div className="text-xs text-slate-400">
                            Submitted: {att.submittedAt ? new Date(att.submittedAt).toLocaleString() : 'Recent'}
                          </div>

                          {isPublished ? (
                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-1">
                              <div className="flex items-baseline justify-between">
                                <span className="text-xs text-slate-500">Score</span>
                                <span className="text-xl font-black text-slate-900">{att.finalScore} Marks</span>
                              </div>
                              <div className="flex items-center justify-between text-xs text-slate-600">
                                <span>Percentage: <strong>{att.percentage}%</strong></span>
                                <span>Accuracy: <strong>{att.accuracy}%</strong></span>
                              </div>
                            </div>
                          ) : (
                            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200/70 text-xs text-amber-800">
                              Evaluation will be declared once the administrator concludes this test.
                            </div>
                          )}
                        </div>

                        <button
                          onClick={() => onViewAttempt(att)}
                          className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                        >
                          <Award className="w-4 h-4" />
                          <span>View Full Scorecard</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ========================================================
              TAB 4: PERFORMANCE
             ======================================================== */}
          {activeTab === 'performance' && (
            <div className="space-y-6">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Candidate Performance Overview</h3>
                  <p className="text-xs text-slate-500">Continuous accuracy, precision, and scoring analytics</p>
                </div>
                <div className="text-xs font-bold text-indigo-700 bg-indigo-50 px-3 py-1.5 rounded-full border border-indigo-200">
                  Tracked across {stats.totalAttempted} attempts
                </div>
              </div>

              {/* Performance Metrics Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
                  <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
                    <span>Average Accuracy</span>
                    <TrendingUp className="w-4 h-4 text-indigo-600" />
                  </div>
                  <div className="text-3xl font-black text-slate-900">{stats.avgAccuracy}%</div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div className="bg-indigo-600 h-full rounded-full transition-all" style={{ width: `${stats.avgAccuracy}%` }} />
                  </div>
                  <p className="text-[11px] text-slate-500">Correct answers ratio over all answered questions</p>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
                  <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
                    <span>Average Score</span>
                    <Award className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div className="text-3xl font-black text-slate-900">{stats.avgScore}</div>
                  <p className="text-[11px] text-slate-500">Average marks scored per test attempt</p>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
                  <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
                    <span>Top Score</span>
                    <Award className="w-4 h-4 text-purple-600" />
                  </div>
                  <div className="text-3xl font-black text-slate-900">{stats.bestScore}</div>
                  <p className="text-[11px] text-slate-500">Highest score achieved across any examination</p>
                </div>
              </div>

              {/* Attempts Timeline History */}
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
                <h4 className="text-sm font-bold text-slate-900">Score History by Attempt</h4>
                {myAttempts.length === 0 ? (
                  <p className="text-xs text-slate-500">No attempts to analyze yet.</p>
                ) : (
                  <div className="space-y-3">
                    {myAttempts.map((att) => (
                      <div
                        key={att.id}
                        className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="space-y-0.5">
                          <div className="text-xs font-bold text-slate-900">{att.testTitle}</div>
                          <div className="text-[11px] text-slate-500">
                            Attempt #{att.attemptNumber || 1} &bull; {att.submittedAt ? new Date(att.submittedAt).toLocaleDateString() : 'Recent'}
                          </div>
                        </div>

                        <div className="flex items-center gap-4 text-xs font-semibold">
                          <span className="text-slate-700">Score: <strong className="text-slate-900">{att.finalScore}</strong></span>
                          <span className="text-emerald-700">Percentage: <strong>{att.percentage}%</strong></span>
                          <span className="text-blue-700">Accuracy: <strong>{att.accuracy}%</strong></span>
                          <button
                            onClick={() => onViewAttempt(att)}
                            className="px-2.5 py-1 text-xs font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer"
                          >
                            Details &rarr;
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ========================================================
              TAB 5: STUDY MATERIAL & SYLLABUS
             ======================================================== */}
          {activeTab === 'material' && (
            <div className="space-y-6">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                <h3 className="text-base font-bold text-slate-900">Curriculum & Examination Syllabus</h3>
                <p className="text-xs text-slate-500">Subject domain, question distribution, and marking structure</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-3">
                  <div className="p-2.5 w-fit rounded-xl bg-indigo-50 text-indigo-700">
                    <BookOpen className="w-5 h-5" />
                  </div>
                  <h4 className="font-bold text-slate-900 text-sm">General Knowledge & Current Affairs</h4>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    National & state history, geography, Indian constitution, government policies, scientific inventions, and current national/international events.
                  </p>
                </div>

                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-3">
                  <div className="p-2.5 w-fit rounded-xl bg-blue-50 text-blue-700">
                    <Layers className="w-5 h-5" />
                  </div>
                  <h4 className="font-bold text-slate-900 text-sm">Reasoning & Analytical Ability</h4>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Analogies, logical sequences, coding-decoding, blood relations, syllogisms, directional sense, spatial orientation, and visual pattern deduction.
                  </p>
                </div>

                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-3">
                  <div className="p-2.5 w-fit rounded-xl bg-purple-50 text-purple-700">
                    <BarChart2 className="w-5 h-5" />
                  </div>
                  <h4 className="font-bold text-slate-900 text-sm">Numerical Ability & Mathematics</h4>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Number systems, percentages, profit & loss, ratio & proportion, simple and compound interest, time & work, speed, distance, and basic algebra.
                  </p>
                </div>

                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-3">
                  <div className="p-2.5 w-fit rounded-xl bg-emerald-50 text-emerald-700">
                    <Shield className="w-5 h-5" />
                  </div>
                  <h4 className="font-bold text-slate-900 text-sm">General Science & Daily Ecology</h4>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Core principles of physics, everyday chemistry, human biology, physiological processes, environmental ecology, and technology advancements.
                  </p>
                </div>
              </div>

              {/* Recorded Course Lectures & Video Classes (Cloudinary Media) */}
              <div className="space-y-4 pt-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Video className="w-5 h-5 text-indigo-600" />
                    <h3 className="text-base font-bold text-slate-900">Recorded Course Video Lectures</h3>
                  </div>
                  <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-200">
                    {courses.length} Available Lectures
                  </span>
                </div>

                {courses.length === 0 ? (
                  <div className="p-8 bg-white rounded-3xl border border-slate-200 text-center space-y-2">
                    <Film className="w-8 h-8 text-slate-300 mx-auto" />
                    <div className="text-xs font-bold text-slate-700">No recorded lectures uploaded yet</div>
                    <p className="text-[11px] text-slate-400">
                      When your institute admin uploads recorded lectures to Cloudinary, they will appear here.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {courses.map((course) => (
                      <div
                        key={course.id}
                        className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between"
                      >
                        <div>
                          {/* Thumbnail / Video Preview */}
                          <div className="relative aspect-video bg-slate-900 overflow-hidden group">
                            {course.thumbnailUrl ? (
                              <img
                                src={course.thumbnailUrl}
                                alt={course.title}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              />
                            ) : (
                              <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 gap-1">
                                <Film className="w-8 h-8 text-slate-500" />
                                <span className="text-[10px] font-semibold">{course.category}</span>
                              </div>
                            )}

                            {course.videoUrl && (
                              <button
                                onClick={() => {
                                  setPreviewVideoUrl(course.videoUrl || null);
                                  setPreviewVideoTitle(course.title);
                                }}
                                className="absolute inset-0 bg-black/40 hover:bg-black/20 flex items-center justify-center transition-colors cursor-pointer"
                                title="Play Lecture"
                              >
                                <div className="w-12 h-12 rounded-full bg-indigo-600/90 text-white flex items-center justify-center shadow-lg hover:scale-110 transition-transform">
                                  <Play className="w-5 h-5 ml-0.5 fill-current" />
                                </div>
                              </button>
                            )}

                            <div className="absolute top-2.5 left-2.5">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-900/80 backdrop-blur-xs text-white border border-white/20">
                                {course.category}
                              </span>
                            </div>

                            {course.videoDuration && (
                              <div className="absolute bottom-2.5 right-2.5">
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-black/75 text-white flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  <span>{Math.floor(course.videoDuration / 60)}:{(course.videoDuration % 60).toString().padStart(2, '0')}</span>
                                </span>
                              </div>
                            )}
                          </div>

                          <div className="p-4 space-y-1.5">
                            <h4 className="font-bold text-slate-900 text-sm line-clamp-1">{course.title}</h4>
                            <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                              {course.description || 'Recorded lecture material for examination preparation.'}
                            </p>
                          </div>
                        </div>

                        <div className="p-4 pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                          <span className="text-slate-500 text-[11px]">
                            By <strong>{course.instructor || 'ParikshaSetu'}</strong>
                          </span>
                          {course.videoUrl && (
                            <button
                              onClick={() => {
                                setPreviewVideoUrl(course.videoUrl || null);
                                setPreviewVideoTitle(course.title);
                              }}
                              className="px-3 py-1 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[11px] flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                            >
                              <Play className="w-3 h-3 fill-current" />
                              <span>Watch</span>
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ========================================================
              TAB 6: NOTIFICATIONS & ANNOUNCEMENTS
             ======================================================== */}
          {activeTab === 'notifications' && (
            <div className="space-y-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Announcements & Scheduled Notices</h3>
                  <p className="text-xs text-slate-500">Live examination alerts and schedule broadcasts</p>
                </div>
                <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-purple-100 text-purple-800">
                  {upcomingScheduledTests.length} Active / Upcoming
                </span>
              </div>

              <div className="space-y-3">
                {/* Scheduled Tests Notifications */}
                {scheduledTests.map(({ test: t, schedule }) => (
                  <div
                    key={`notif-${t.id}`}
                    className={`p-4 rounded-2xl border flex items-start gap-3 ${
                      schedule.scheduleStatus === 'live'
                        ? 'bg-emerald-50 border-emerald-200'
                        : schedule.scheduleStatus === 'upcoming'
                        ? 'bg-purple-50 border-purple-200'
                        : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    {schedule.scheduleStatus === 'live' ? (
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 mt-1 shrink-0 animate-ping" />
                    ) : (
                      <Calendar className="w-4 h-4 text-purple-700 mt-0.5 shrink-0" />
                    )}

                    <div className="space-y-1 flex-1">
                      <div className="flex items-center justify-between">
                        <h4 className={`font-bold text-xs sm:text-sm ${
                          schedule.scheduleStatus === 'live' ? 'text-emerald-950' : 'text-purple-950'
                        }`}>
                          {schedule.scheduleStatus === 'live' ? `LIVE NOW: ${t.title}` : `Scheduled Exam: ${t.title}`}
                        </h4>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${schedule.statusBadgeClass}`}>
                          {schedule.statusBadgeText}
                        </span>
                      </div>

                      <p className="text-xs text-slate-600">
                        Date: <strong>{schedule.formattedDate}</strong> &bull; Starts: <strong>{schedule.formattedStartTime}</strong> &bull; Duration: <strong>{t.durationMinutes} Minutes</strong>
                      </p>

                      <div className="text-[11px] font-semibold text-purple-800">
                        {schedule.timeRemainingText}
                      </div>
                    </div>
                  </div>
                ))}

                <div className="bg-white border border-slate-200 p-4 rounded-2xl flex items-start gap-3">
                  <Shield className="w-4 h-4 text-indigo-600 mt-0.5 shrink-0" />
                  <div className="space-y-1">
                    <h4 className="font-bold text-slate-900 text-xs sm:text-sm">Proctoring & Assessment Rules</h4>
                    <p className="text-xs text-slate-600">
                      Tab switches, window minimizations, and screen blur events are actively logged during tests. Keep full screen mode enabled throughout the test.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================
              TAB 7: MY PROFILE
             ======================================================== */}
          {activeTab === 'profile' && (
            <div className="space-y-6 max-w-3xl">
              <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-xs space-y-6">
                <div className="flex flex-col sm:flex-row items-center gap-5 pb-6 border-b border-slate-100">
                  <div className="relative group shrink-0">
                    <div className="w-24 h-24 rounded-2xl bg-linear-to-br from-indigo-600 to-blue-600 text-white font-black text-3xl flex items-center justify-center shadow-md overflow-hidden border-2 border-indigo-100">
                      {user?.photoUrl ? (
                        <img src={user.photoUrl} alt={user.name} className="w-full h-full object-cover" />
                      ) : (
                        (user?.name || 'C').charAt(0).toUpperCase()
                      )}
                    </div>
                    {isUploadingPhoto && (
                      <div className="absolute inset-0 bg-black/60 rounded-2xl flex flex-col items-center justify-center text-white">
                        <Loader2 className="w-6 h-6 animate-spin text-white mb-1" />
                        <span className="text-[10px] font-bold">{photoUploadProgress}%</span>
                      </div>
                    )}
                  </div>

                  <div className="text-center sm:text-left space-y-2 flex-1 min-w-0">
                    <div className="space-y-0.5">
                      <h3 className="text-xl font-bold text-slate-900">{user?.name || 'Candidate'}</h3>
                      <p className="text-xs text-slate-500">{user?.email || 'Student Account'}</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 text-xs font-semibold cursor-pointer shadow-xs transition-colors">
                        <Camera className="w-3.5 h-3.5" />
                        <span>{user?.photoUrl ? 'Change Profile Picture' : 'Upload Profile Picture'}</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleProfilePhotoUpload}
                          disabled={isUploadingPhoto}
                        />
                      </label>
                      <span className="inline-block text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800">
                        Registered Student &bull; Verified Candidate
                      </span>
                    </div>

                    {isUploadingPhoto && (
                      <div className="w-full max-w-xs space-y-1 pt-1">
                        <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium">
                          <span>Uploading to Cloudinary...</span>
                          <span>{photoUploadProgress}%</span>
                        </div>
                        <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                          <div
                            className="bg-indigo-600 h-full transition-all duration-150"
                            style={{ width: `${photoUploadProgress}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {photoSuccess && (
                      <div className="text-xs font-semibold text-emerald-600 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>{photoSuccess}</span>
                      </div>
                    )}

                    {photoError && (
                      <div className="text-xs font-semibold text-rose-600 flex items-center gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5" />
                        <span>{photoError}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
                    <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Student Name</span>
                    <div className="font-bold text-slate-900 text-sm">{user?.name || 'Candidate'}</div>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
                    <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Email Address</span>
                    <div className="font-bold text-slate-900 text-sm truncate">{user?.email || 'N/A'}</div>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
                    <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Candidate Identifier</span>
                    <div className="font-mono text-slate-900 text-xs truncate">{user?.uid || 'Session Active'}</div>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
                    <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Account Role</span>
                    <div className="font-bold text-indigo-600 capitalize text-sm">{user?.role || 'Student'}</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================
              TAB 8: SETTINGS
             ======================================================== */}
          {activeTab === 'settings' && (
            <div className="space-y-6 max-w-3xl">
              <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-xs space-y-6">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Institute & Support Information</h3>
                  <p className="text-xs text-slate-500">Contact details and technical support</p>
                </div>

                <div className="space-y-3 text-xs">
                  <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80">
                    <GraduationCap className="w-5 h-5 text-indigo-600 shrink-0" />
                    <div>
                      <div className="font-bold text-slate-900">{settings.instituteName}</div>
                      <div className="text-slate-500">{settings.tagline}</div>
                    </div>
                  </div>

                  {settings.contactEmail && (
                    <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80">
                      <Mail className="w-5 h-5 text-indigo-600 shrink-0" />
                      <div>
                        <div className="text-slate-400 text-[10px] uppercase font-bold">Contact Email</div>
                        <div className="font-bold text-slate-900">{settings.contactEmail}</div>
                      </div>
                    </div>
                  )}

                  {settings.contactPhone && (
                    <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80">
                      <Phone className="w-5 h-5 text-indigo-600 shrink-0" />
                      <div>
                        <div className="text-slate-400 text-[10px] uppercase font-bold">Helpdesk Phone</div>
                        <div className="font-bold text-slate-900">{settings.contactPhone}</div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-xs text-slate-500">Candidate Session</span>
                  <button
                    onClick={logout}
                    className="px-4 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold transition-colors cursor-pointer"
                  >
                    Sign Out Now
                  </button>
                </div>
              </div>

              {/* Application Version & APK Update Check Card */}
              <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Application Version &amp; Updates</h3>
                    <p className="text-xs text-slate-500">
                      Package ID: <span className="font-mono text-slate-700">{ANDROID_PACKAGE_ID}</span> &bull; Installed: <strong className="text-slate-800">v{installedVersion} (Build {installedVersionCode})</strong>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleManualUpdateCheck}
                    disabled={isCheckingUpdate}
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white text-xs font-bold transition-colors cursor-pointer shrink-0"
                  >
                    <RotateCw className={`w-3.5 h-3.5 ${isCheckingUpdate ? 'animate-spin' : ''}`} />
                    <span>{isCheckingUpdate ? 'Checking...' : 'Check for Updates'}</span>
                  </button>
                </div>

                {manualUpdateCheck && (
                  <div
                    className={`p-4 rounded-2xl border text-xs space-y-3 ${
                      manualUpdateCheck.updateAvailable
                        ? 'bg-indigo-50/80 border-indigo-200 text-indigo-950'
                        : 'bg-slate-50 border-slate-200 text-slate-700'
                    }`}
                  >
                    {manualUpdateCheck.updateAvailable && manualUpdateCheck.latestManifest ? (
                      <>
                        <div className="space-y-3">
                          <div>
                            <div className="font-bold text-sm text-indigo-950 flex items-center gap-2">
                              <span>New Version Available: v{manualUpdateCheck.latestManifest.versionName}</span>
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                Signed Release APK
                              </span>
                            </div>
                            {manualUpdateCheck.latestManifest.releaseNotes && (
                              <p className="text-xs text-slate-600 mt-1">
                                {manualUpdateCheck.latestManifest.releaseNotes}
                              </p>
                            )}
                          </div>
                          <InAppUpdateActionPanel
                            manifest={manualUpdateCheck.latestManifest}
                            theme="light"
                          />
                        </div>
                        <p className="text-[11px] text-slate-500">
                          Downloads the signed APK directly inside ParikshaSetu and launches Android&apos;s package installer via FileProvider without clearing your offline tests or account data.
                        </p>
                      </>
                    ) : (
                      <div className="flex items-center gap-2 font-semibold text-slate-700">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>{manualUpdateCheck.statusMessage || `ParikshaSetu v${installedVersion} is up to date.`}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Video Player Modal (Cloudinary Media) */}
      {previewVideoUrl && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-slate-900 rounded-3xl max-w-3xl w-full overflow-hidden shadow-2xl border border-slate-800">
            <div className="px-5 py-3.5 bg-slate-950 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Video className="w-4 h-4 text-indigo-400" />
                <span className="font-bold text-sm truncate max-w-md">{previewVideoTitle}</span>
              </div>
              <button
                onClick={() => setPreviewVideoUrl(null)}
                className="text-slate-400 hover:text-white font-bold text-lg cursor-pointer"
              >
                &times;
              </button>
            </div>
            <div className="aspect-video bg-black flex items-center justify-center">
              <EnhancedVideoPlayer
                src={previewVideoUrl}
                title={previewVideoTitle}
                autoPlay
                className="w-full h-full"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
