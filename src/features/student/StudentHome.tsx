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
  BarChart2,
  Phone,
  Mail,
  Layers,
  Camera,
  Loader2,
  Video,
  Play,
  Film,
  HardDrive,
  Download,
  CheckCheck,
  Target,
  KeyRound,
  Quote,
} from 'lucide-react';
import {
  TestItem,
  TestSeries,
  StudentAttempt,
  CourseItem,
  OfflineTestRecord,
  OfflineDownloadProgress,
} from '../../types/exam';
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
  subscribeToDownloadProgress,
  getPendingOfflineAttempts,
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
  onOpenAnswerKey?: (attempt: StudentAttempt) => void;
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
  onViewAttempt,
  onOpenAnswerKey,
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
  const [installedVersionCode, setInstalledVersionCode] =
    useState<number>(DEFAULT_APP_VERSION_CODE);
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
      const res = await uploadStudentProfilePhoto(file, (progress) => {
        setPhotoUploadProgress(progress);
      });

      await saveStudentProfileImageToFirestore(user.uid, res);

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
  const [, setLoading] = useState(true);
  const [downloadedTests, setDownloadedTests] = useState<OfflineTestRecord[]>([]);
  const [, setPendingAttempts] = useState<StudentAttempt[]>([]);
  const [activeDownloadMap, setActiveDownloadMap] = useState<
    Record<string, OfflineDownloadProgress>
  >({});

  const refreshOfflineRecords = async () => {
    try {
      const [dl, p] = await Promise.all([getDownloadedTests(), getPendingOfflineAttempts()]);
      setDownloadedTests(dl);
      setPendingAttempts(p);
    } catch {
      // ignore
    }
  };

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
          (typeof window !== 'undefined'
            ? localStorage.getItem('pariksha_candidate_name') || ''
            : '');
        const candEmail = user?.email || '';

        const mine = allAtt.filter((a) => {
          if (!a) return false;
          if (
            candUid &&
            (a.studentId === candUid || a.studentId?.toLowerCase() === candUid.toLowerCase())
          )
            return true;
          if (candEmail && a.studentEmail?.toLowerCase() === candEmail.toLowerCase()) return true;
          if (candName && a.studentName?.toLowerCase().trim() === candName.toLowerCase().trim())
            return true;
          return false;
        });

        mine.sort(
          (a, b) => new Date(b.submittedAt || 0).getTime() - new Date(a.submittedAt || 0).getTime()
        );
        setMyAttempts(mine);
      } catch (err) {
        console.error('Failed to load student portal data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();

    const unsub = subscribeToTestsList((updatedTests) => {
      setTests(updatedTests);
    });

    return () => unsub();
  }, [user]);

  const categories = ['all', 'MP Police', 'MP SI', 'SSC', 'General Knowledge'];

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

  const scheduledTests = useMemo(() => {
    return tests
      .filter((t) => t.status !== 'draft')
      .map((t) => {
        const linkedSeries = series.find((s) => s.id === t.seriesId);
        const effectiveTest = {
          ...t,
          startDate:
            t.startDate || (t.status === 'scheduled' ? undefined : linkedSeries?.startDate),
          startTime:
            t.startTime || (t.status === 'scheduled' ? undefined : linkedSeries?.startTime),
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

  const upcomingScheduledTests = useMemo(() => {
    return scheduledTests.filter(
      ({ schedule }) =>
        schedule.scheduleStatus === 'upcoming' || schedule.scheduleStatus === 'live'
    );
  }, [scheduledTests]);

  // Check if student has any unfinished in-progress test in localStorage
  const resumableExam = useMemo(() => {
    if (typeof window === 'undefined') return null;
    const candUid = user?.uid || localStorage.getItem('pariksha_candidate_uid') || '';
    if (!candUid) return null;

    for (const t of availableTests) {
      try {
        const rawAnswers = localStorage.getItem(`pariksha_answers_${t.id}_${candUid}`);
        if (rawAnswers) {
          const parsed = JSON.parse(rawAnswers) as Record<string, string>;
          const answeredCount = Object.keys(parsed).length;
          if (answeredCount > 0) {
            return {
              test: t,
              answeredCount,
              totalQuestions: t.totalQuestions || 100,
              pct: Math.min(
                100,
                Math.round((answeredCount / Math.max(1, t.totalQuestions || 1)) * 100)
              ),
            };
          }
        }
      } catch {
        // ignore
      }
    }
    return null;
  }, [availableTests, user?.uid]);

  // Real statistics calculated purely from actual attempts
  const stats = useMemo(() => {
    const totalAttempted = myAttempts.length;
    const completedAttempts = myAttempts.filter(
      (a) =>
        a.status === 'submitted' || a.status === 'evaluated' || a.status === 'auto_submitted'
    );

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

    const avgScore =
      completedAttempts.length > 0 ? (totalScore / completedAttempts.length).toFixed(1) : '0';
    const avgAccuracy =
      completedAttempts.length > 0 ? Math.round(totalAccuracy / completedAttempts.length) : 0;

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

  const navItems = [
    { id: 'home' as StudentTab, label: 'Home', icon: LayoutDashboard },
    {
      id: 'exams' as StudentTab,
      label: 'Tests',
      icon: BookOpen,
      badge: availableTests.length > 0 ? `${availableTests.length}` : undefined,
    },
    {
      id: 'offline' as StudentTab,
      label: 'Offline Practice',
      icon: HardDrive,
      badge: downloadedTests.length > 0 ? `${downloadedTests.length}` : undefined,
    },
    {
      id: 'results' as StudentTab,
      label: 'Results',
      icon: Award,
      badge: myAttempts.length > 0 ? `${myAttempts.length}` : undefined,
    },
    { id: 'performance' as StudentTab, label: 'Performance', icon: TrendingUp },
    { id: 'material' as StudentTab, label: 'Study Material', icon: GraduationCap },
    {
      id: 'notifications' as StudentTab,
      label: 'Notifications',
      icon: Bell,
      badge: upcomingScheduledTests.length > 0 ? `${upcomingScheduledTests.length}` : undefined,
    },
    { id: 'profile' as StudentTab, label: 'My Profile', icon: User },
    { id: 'settings' as StudentTab, label: 'Settings', icon: Settings },
  ];

  // Render Test Action Button with full scheduling and offline logic in Aspirant Neo style
  const renderTestActionButton = (t: TestItem, schedule: TestScheduleInfo) => {
    const myAttemptsForThis = myAttempts.filter((a) => a.testId === t.id);
    const latestAttempt = myAttemptsForThis[0];
    const isDownloaded = downloadedTests.some((d) => d.id === t.id);
    const dlProgress = activeDownloadMap[t.id];
    const isDownloading = dlProgress?.isDownloading;

    if (schedule.isScheduled) {
      if (schedule.scheduleStatus === 'upcoming') {
        return (
          <button
            type="button"
            disabled
            className="w-full py-2.5 px-4 rounded-xl bg-surface-container text-on-surface-variant font-headline font-bold text-xs flex items-center justify-center gap-1.5 cursor-not-allowed"
            title={`Scheduled for ${schedule.formattedDate} at ${schedule.formattedStartTime}`}
          >
            <Lock className="w-3.5 h-3.5 text-outline" />
            <span>Upcoming • {schedule.formattedStartTime}</span>
          </button>
        );
      }

      if (schedule.scheduleStatus === 'live') {
        if (!isOnline) {
          return (
            <button
              type="button"
              disabled
              className="w-full py-2.5 px-4 rounded-xl bg-surface-container text-on-surface-variant font-headline font-bold text-xs flex items-center justify-center gap-1.5 cursor-not-allowed"
            >
              <WifiOff className="w-3.5 h-3.5 text-outline" />
              <span>Live Exam • Connect to Internet</span>
            </button>
          );
        }

        return (
          <button
            type="button"
            onClick={() => onSelectTest(t)}
            className="w-full py-3 px-4 rounded-xl bg-linear-to-r from-primary to-primary-container text-on-primary font-headline font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-sm active:scale-[0.98] transition-all"
          >
            <span>Start Live Exam</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        );
      }

      if (latestAttempt) {
        return (
          <div className="flex items-center gap-2 w-full">
            <button
              type="button"
              onClick={() => onViewAttempt(latestAttempt)}
              className="flex-1 py-2.5 px-3 rounded-xl bg-primary-fixed text-on-primary-fixed font-headline font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
            >
              <Award className="w-3.5 h-3.5 text-primary" />
              <span>View Result</span>
            </button>
            <span className="text-[10px] font-headline font-bold text-on-surface-variant py-1.5 px-2.5 rounded-lg bg-surface-container">
              Completed
            </span>
          </div>
        );
      }

      return (
        <button
          type="button"
          disabled
          className="w-full py-2.5 px-3 rounded-xl bg-surface-container text-on-surface-variant font-headline font-bold text-xs flex items-center justify-center gap-1.5 cursor-not-allowed"
        >
          <Clock className="w-3.5 h-3.5 text-outline" />
          <span>Session Concluded</span>
        </button>
      );
    }

    // Released or Standard Practice Test
    return (
      <div className="space-y-2.5 w-full pt-1 border-t border-outline-variant/15">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-on-surface-variant font-medium">
            {t.status === 'released' ? 'Open Practice • Bilingual' : `Code: ${t.accessCode}`}
          </span>

          {isDownloaded ? (
            <span className="inline-flex items-center gap-1 text-emerald-700 font-headline font-bold">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Offline Ready</span>
            </span>
          ) : isDownloading ? (
            <span className="text-primary font-headline font-bold flex items-center gap-1 animate-pulse">
              <RotateCw className="w-3 h-3 animate-spin" />
              <span>{dlProgress?.percent}%</span>
            </span>
          ) : isOnline ? (
            <button
              type="button"
              onClick={(e) => handleDownloadPracticeTest(t, e)}
              className="text-primary hover:underline font-headline font-bold flex items-center gap-1 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Save Offline</span>
            </button>
          ) : null}
        </div>

        <div className="flex items-center gap-2 w-full">
          <button
            type="button"
            onClick={() =>
              t.status === 'released' && onReattemptTest
                ? onReattemptTest(t)
                : onSelectTest(t)
            }
            className="flex-1 py-2.5 px-4 rounded-xl bg-primary hover:bg-primary-container text-on-primary font-headline font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all shadow-2xs active:scale-[0.98]"
          >
            {myAttemptsForThis.length > 0 && t.status === 'released' ? (
              <>
                <RotateCw className="w-3.5 h-3.5" />
                <span>Reattempt</span>
              </>
            ) : (
              <>
                <span>Start Test</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>

          {latestAttempt && (
            <button
              type="button"
              onClick={() => onViewAttempt(latestAttempt)}
              className="py-2.5 px-3.5 bg-primary-fixed hover:bg-primary-fixed-dim text-on-primary-fixed rounded-xl font-headline font-bold text-xs flex items-center justify-center gap-1 cursor-pointer transition-colors"
              title="View Result Summary"
            >
              <Award className="w-3.5 h-3.5 text-primary" />
              <span>Result</span>
            </button>
          )}
        </div>
      </div>
    );
  };

  // Reusable Aspirant Neo Test Card
  const renderAspirantTestCard = (t: TestItem) => {
    const schedule = getTestScheduleInfo(t, now);
    const maxMarks = t.totalQuestions * (t.marksPerQuestion || 1);
    const isLive = schedule.isScheduled && schedule.scheduleStatus === 'live';
    const isUpcoming = schedule.isScheduled && schedule.scheduleStatus === 'upcoming';

    return (
      <div
        key={t.id}
        className={`bg-surface-container-lowest rounded-2xl p-4 sm:p-5 border transition-all flex flex-col justify-between space-y-3.5 shadow-2xs hover:shadow-md ${
          isLive
            ? 'border-2 border-primary/30'
            : isUpcoming
            ? 'border-tertiary/25'
            : 'border-outline-variant/20'
        }`}
      >
        <div className="space-y-3">
          {/* Top Status Row */}
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-primary-fixed text-on-primary-fixed text-[10px] font-headline font-extrabold uppercase tracking-wider">
              {t.examCategory || 'Full Test'}
            </span>

            {isLive ? (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-headline font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-md border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-ping" />
                <span>Live Now</span>
              </span>
            ) : isUpcoming ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-headline font-bold text-tertiary bg-tertiary-fixed/70 px-2.5 py-0.5 rounded-md">
                <Calendar className="w-3 h-3" />
                <span>{schedule.formattedDate}</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                <span>Available</span>
              </span>
            )}
          </div>

          {/* Title & Subtitle */}
          <div>
            <h4 className="font-headline text-base font-bold text-on-surface leading-snug line-clamp-1">
              {t.title}
            </h4>
            <p className="text-xs text-on-surface-variant mt-0.5 line-clamp-1">
              {t.seriesTitle ||
                t.description ||
                'Bilingual (Hindi / English) • Instant Evaluation'}
            </p>
          </div>

          {/* 2x2 Exam Meta Grid (Aspirant Neo Blueprint) */}
          <div className="grid grid-cols-2 gap-y-2 gap-x-4 bg-surface-container-low rounded-xl p-3">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary shrink-0" />
              <div>
                <p className="text-[10px] text-on-surface-variant font-medium">Questions</p>
                <p className="font-headline text-xs font-bold text-on-surface tabular-nums">
                  {t.totalQuestions} Qs
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Award className="w-4 h-4 text-primary shrink-0" />
              <div>
                <p className="text-[10px] text-on-surface-variant font-medium">Max Marks</p>
                <p className="font-headline text-xs font-bold text-on-surface tabular-nums">
                  {maxMarks} Marks
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary shrink-0" />
              <div>
                <p className="text-[10px] text-on-surface-variant font-medium">Duration</p>
                <p className="font-headline text-xs font-bold text-on-surface tabular-nums">
                  {t.durationMinutes} Mins
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <AlertCircle
                className={`w-4 h-4 shrink-0 ${
                  t.negativeMarks > 0 ? 'text-error' : 'text-emerald-600'
                }`}
              />
              <div>
                <p className="text-[10px] text-on-surface-variant font-medium">Negative Marking</p>
                <p
                  className={`font-headline text-xs font-bold tabular-nums ${
                    t.negativeMarks > 0 ? 'text-error' : 'text-emerald-700'
                  }`}
                >
                  {t.negativeMarks > 0 ? `-${t.negativeMarks} Mark` : 'No Penalty'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {renderTestActionButton(t, schedule)}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-surface flex flex-col md:flex-row text-on-surface antialiased font-body pb-20 md:pb-0">
      {/* Backdrop for mobile drawer */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-on-surface/50 backdrop-blur-xs z-50 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Left Sidebar (Desktop & Mobile Slide-Out Drawer) */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 bg-surface-container-lowest border-r border-outline-variant/20 flex flex-col justify-between transition-transform duration-200 ease-in-out md:static md:translate-x-0 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full overflow-y-auto no-scrollbar">
          {/* Sidebar Branding Header */}
          <div className="p-5 border-b border-outline-variant/15 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-linear-to-br from-primary to-primary-container flex items-center justify-center text-on-primary shadow-xs shrink-0 overflow-hidden">
                {settings.logoUrl ? (
                  <img
                    src={settings.logoUrl}
                    alt={settings.instituteName}
                    className="w-full h-full object-contain p-0.5 bg-white"
                  />
                ) : (
                  <GraduationCap className="w-6 h-6" />
                )}
              </div>
              <div className="min-w-0">
                <h2 className="font-headline text-base font-extrabold truncate text-primary leading-tight">
                  {settings.instituteName || 'ParikshaSetu'}
                </h2>
                <span className="inline-block mt-0.5 px-2 py-0.5 rounded text-[10px] font-headline font-bold bg-primary-fixed text-on-primary-fixed">
                  Aspirant Portal
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              className="md:hidden text-on-surface-variant hover:text-on-surface p-1 rounded-lg cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Student Profile Card in Sidebar */}
          <div
            onClick={() => {
              setActiveTab('profile');
              setMobileMenuOpen(false);
            }}
            className="p-3.5 mx-3 my-3 rounded-2xl bg-surface-container-low border border-outline-variant/20 flex items-center gap-3 cursor-pointer hover:bg-surface-container transition-colors"
          >
            <div className="w-11 h-11 rounded-full bg-primary-fixed flex items-center justify-center text-on-primary-fixed font-headline font-extrabold text-base shrink-0 overflow-hidden border-2 border-primary/20">
              {user?.photoUrl ? (
                <img src={user.photoUrl} alt={user.name} className="w-full h-full object-cover" />
              ) : (
                (user?.name || 'Candidate').charAt(0).toUpperCase()
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-headline text-xs font-bold text-on-surface truncate">
                {user?.name || 'Candidate'}
              </div>
              <div className="text-[11px] text-on-surface-variant truncate">
                {user?.email || 'Verified Aspirant'}
              </div>
              <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-emerald-700 font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                <span>Active Aspirant</span>
              </div>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-3 space-y-1 flex-1">
            <div className="px-3 pb-2 text-[10px] font-headline font-bold uppercase tracking-wider text-outline">
              Aspirant Menu
            </div>
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(item.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-headline font-bold transition-all cursor-pointer ${
                    isActive
                      ? 'bg-primary text-on-primary shadow-xs'
                      : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon
                      className={`w-4 h-4 ${isActive ? 'text-on-primary' : 'text-on-surface-variant'}`}
                    />
                    <span>{item.label}</span>
                  </div>

                  {item.badge && (
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full tabular-nums ${
                        isActive
                          ? 'bg-white/20 text-white'
                          : 'bg-primary-fixed text-on-primary-fixed'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Sidebar Footer */}
          <div className="p-4 border-t border-outline-variant/15 space-y-2">
            {role === 'admin' && onNavigateToAdmin && (
              <button
                type="button"
                onClick={onNavigateToAdmin}
                className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-headline font-bold text-on-tertiary-fixed bg-tertiary-fixed hover:opacity-90 transition-opacity cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-tertiary" />
                  <span>Admin Control Panel</span>
                </div>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            )}

            <button
              type="button"
              onClick={logout}
              className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-headline font-bold text-error hover:bg-error-container/40 transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Wrapper */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top AppBar (Aspirant Neo Glassmorphic Header) */}
        <header className="sticky top-0 z-40 bg-surface/90 backdrop-blur-md border-b border-outline-variant/20">
          <div className="flex items-center justify-between px-4 sm:px-6 h-16 max-w-5xl mx-auto">
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                className="md:hidden w-9 h-9 rounded-lg bg-surface-container-low flex items-center justify-center text-on-surface hover:bg-surface-container cursor-pointer"
                aria-label="Open menu"
              >
                <Menu className="w-5 h-5" />
              </button>

              <div
                onClick={() => setActiveTab('home')}
                className="flex items-center gap-2.5 cursor-pointer select-none"
              >
                <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center text-on-primary shadow-xs">
                  {settings.logoUrl ? (
                    <img
                      src={settings.logoUrl}
                      alt={settings.instituteName}
                      className="w-full h-full object-contain p-0.5 rounded-xl bg-white"
                    />
                  ) : (
                    <GraduationCap className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-headline text-base sm:text-lg font-extrabold text-primary tracking-tight leading-none">
                      {settings.instituteName || 'ParikshaSetu'}
                    </span>
                    {isOnline ? (
                      <span title="Connected & Synced" className="inline-flex">
                        <Wifi className="w-3.5 h-3.5 text-emerald-600" />
                      </span>
                    ) : (
                      <span title="Offline Mode" className="inline-flex">
                        <WifiOff className="w-3.5 h-3.5 text-error" />
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] font-medium text-on-surface-variant tracking-wider uppercase mt-0.5">
                    Aspirant Portal
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Target Exam Category Pill */}
              <button
                type="button"
                onClick={() => setActiveTab('exams')}
                className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-primary-fixed text-on-primary-fixed text-[11px] font-headline font-bold uppercase tracking-wider cursor-pointer"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                <span>{selectedCategory === 'all' ? 'All Exams' : selectedCategory}</span>
              </button>

              {/* Enter Exam Code Button */}
              {onOpenJoinModal && (
                <button
                  type="button"
                  onClick={onOpenJoinModal}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary text-on-primary font-headline font-bold text-xs shadow-2xs active:scale-95 transition-all cursor-pointer"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>Enter Code</span>
                </button>
              )}

              {/* Notifications Button */}
              <button
                type="button"
                onClick={() => setActiveTab('notifications')}
                className="w-9 h-9 rounded-full bg-surface-container-low flex items-center justify-center text-on-surface-variant hover:bg-surface-container transition-colors relative cursor-pointer"
                aria-label="Notifications"
              >
                <Bell className="w-4 h-4" />
                {upcomingScheduledTests.length > 0 && (
                  <span className="absolute top-1.5 right-2 w-2 h-2 rounded-full bg-tertiary-container" />
                )}
              </button>

              {/* Profile Avatar */}
              <div
                onClick={() => setActiveTab('profile')}
                className="w-9 h-9 rounded-full overflow-hidden border-2 border-primary-fixed bg-primary-fixed flex items-center justify-center text-on-primary-fixed font-headline font-bold text-xs cursor-pointer shrink-0"
                title="Student Profile"
              >
                {user?.photoUrl ? (
                  <img src={user.photoUrl} alt={user.name} className="w-full h-full object-cover" />
                ) : (
                  (user?.name || 'C').charAt(0).toUpperCase()
                )}
              </div>
            </div>
          </div>

          {/* Live / Scheduled Notice Ticker Strip */}
          <div className="bg-surface-container-low border-t border-outline-variant/15 px-4 py-1.5">
            <div className="max-w-5xl mx-auto flex items-center gap-2 overflow-hidden">
              <span className="shrink-0 px-1.5 py-0.5 rounded bg-tertiary-fixed text-on-tertiary-fixed text-[10px] font-headline font-extrabold uppercase tracking-wider">
                {upcomingScheduledTests.length > 0 ? 'Live Schedule' : 'Notice'}
              </span>
              <p className="text-xs text-on-surface-variant font-medium truncate">
                {upcomingScheduledTests.length > 0
                  ? `${upcomingScheduledTests[0].test.title} • ${upcomingScheduledTests[0].schedule.formattedDate} at ${upcomingScheduledTests[0].schedule.formattedStartTime} (${upcomingScheduledTests[0].schedule.timeRemainingText})`
                  : settings.tagline ||
                    `${availableTests.length} competitive mock tests & practice papers active for preparation.`}
              </p>
            </div>
          </div>
        </header>

        {/* Main Viewport Content */}
        <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 pt-5 pb-10 space-y-6">
          {/* ========================================================
              TAB 1: HOME / ASPIRANT NEO DASHBOARD
             ======================================================== */}
          {activeTab === 'home' && (
            <div className="space-y-6">
              {/* Hero Greeting & Target Exam Card */}
              <section className="relative overflow-hidden rounded-2xl bg-linear-to-br from-primary via-primary-container to-surface-tint p-5 sm:p-6 text-on-primary shadow-md">
                <div className="absolute -right-8 -top-8 w-36 h-36 rounded-full bg-white/10 blur-2xl pointer-events-none" />
                <div className="relative z-10 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-medium text-on-primary-container uppercase tracking-widest">
                        Active Goal
                      </p>
                      <h1 className="font-headline text-xl sm:text-2xl font-extrabold tracking-tight mt-0.5">
                        Hello, {user?.name || 'Aspirant'} 👋
                      </h1>
                    </div>
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white/15 backdrop-blur-md text-[11px] font-headline font-semibold">
                      <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                      <span>{stats.totalAttempted} Attempts</span>
                    </span>
                  </div>

                  {/* Target Exam Switcher Box */}
                  <div className="bg-white/10 backdrop-blur-md rounded-xl p-3.5 border border-white/15 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
                          <Shield className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <p className="text-[11px] text-on-primary-container font-medium">
                            Target Examination
                          </p>
                          <p className="font-headline text-sm font-bold text-white">
                            {selectedCategory === 'all'
                              ? 'MP Police, MP SI & State Exams'
                              : `${selectedCategory} Examination Series`}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setActiveTab('exams')}
                          className="px-3 py-1.5 rounded-lg bg-white text-primary font-headline text-xs font-bold shadow-xs active:scale-95 transition-transform cursor-pointer"
                        >
                          Browse All ({availableTests.length})
                        </button>
                      </div>
                    </div>

                    {/* Quick Target Category Pills */}
                    <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1 border-t border-white/10">
                      {categories.map((cat) => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setSelectedCategory(cat)}
                          className={`px-2.5 py-1 rounded-md text-[11px] font-headline font-bold whitespace-nowrap transition-colors cursor-pointer ${
                            selectedCategory === cat
                              ? 'bg-white text-primary'
                              : 'bg-white/10 text-white/85 hover:bg-white/20'
                          }`}
                        >
                          {cat === 'all' ? 'All Exams' : cat}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </section>

              {/* In-Progress Exam Resume Card (Real local draft answers if any) */}
              {resumableExam && (
                <section aria-label="Resume In-Progress Test">
                  <div className="bg-surface-container-lowest rounded-2xl p-4 sm:p-5 border-2 border-primary/20 shadow-xs space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-tertiary-fixed text-on-tertiary-fixed text-[11px] font-headline font-bold uppercase tracking-wider">
                        <span className="w-1.5 h-1.5 rounded-full bg-tertiary-container animate-pulse" />
                        <span>In Progress • Saved on Device</span>
                      </span>
                      <span className="text-xs font-headline font-bold text-on-surface-variant tabular-nums">
                        {resumableExam.test.durationMinutes} Mins Total
                      </span>
                    </div>

                    <div>
                      <h2 className="font-headline text-base font-bold text-on-surface">
                        {resumableExam.test.title}
                      </h2>
                      <p className="text-xs text-on-surface-variant mt-0.5">
                        {resumableExam.test.examCategory} &bull; Unfinished attempt ready to resume
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-on-surface-variant font-medium">
                          Progress:{' '}
                          <strong className="text-on-surface tabular-nums">
                            {resumableExam.answeredCount} / {resumableExam.totalQuestions}
                          </strong>{' '}
                          Questions Answered
                        </span>
                        <span className="font-headline font-bold text-primary tabular-nums">
                          {resumableExam.pct}%
                        </span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-surface-container overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all"
                          style={{ width: `${resumableExam.pct}%` }}
                        />
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => onSelectTest(resumableExam.test)}
                      className="w-full py-3 rounded-xl bg-linear-to-r from-primary to-primary-container text-on-primary font-headline text-sm font-bold shadow-xs active:scale-[0.99] transition-transform flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <PlayCircle className="w-4 h-4" />
                      <span>Resume Test</span>
                    </button>
                  </div>
                </section>
              )}

              {/* Live / Upcoming Scheduled Exam Alert Banner (Real scheduled tests) */}
              {upcomingScheduledTests.length > 0 && (
                <section aria-label="Upcoming Live Exam">
                  {upcomingScheduledTests.slice(0, 2).map(({ test: t, schedule }) => (
                    <div
                      key={t.id}
                      className="bg-tertiary-fixed/60 border border-tertiary/20 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-tertiary-container text-on-tertiary flex items-center justify-center shrink-0">
                          <Calendar className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-headline font-extrabold uppercase tracking-wider text-tertiary">
                              {schedule.scheduleStatus === 'live'
                                ? 'Live Official Exam'
                                : 'Scheduled Exam'}
                            </span>
                            <span className="text-[10px] text-on-tertiary-fixed">
                              &bull; {schedule.formattedDate}, {schedule.formattedStartTime}
                            </span>
                          </div>
                          <h3 className="font-headline text-xs sm:text-sm font-bold text-on-surface mt-0.5">
                            {t.title}
                          </h3>
                          <p className="text-[11px] text-on-surface-variant">
                            {schedule.timeRemainingText} &bull; {t.durationMinutes} Mins &bull;{' '}
                            {t.totalQuestions} Qs
                          </p>
                        </div>
                      </div>

                      {schedule.scheduleStatus === 'live' ? (
                        <button
                          type="button"
                          onClick={() => onSelectTest(t)}
                          className="shrink-0 px-4 py-2 rounded-lg bg-primary text-on-primary font-headline text-xs font-bold cursor-pointer shadow-2xs"
                        >
                          Join Live Now
                        </button>
                      ) : (
                        <span className="shrink-0 px-3 py-1.5 rounded-lg bg-surface-container-lowest text-tertiary border border-tertiary/25 font-headline text-xs font-bold">
                          Starts {schedule.formattedStartTime}
                        </span>
                      )}
                    </div>
                  ))}
                </section>
              )}

              {/* Performance Snapshot (2x2 Bento Grid) */}
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="font-headline text-base font-bold text-on-surface tracking-tight">
                    Performance Snapshot
                  </h2>
                  <button
                    type="button"
                    onClick={() => setActiveTab('performance')}
                    className="text-xs font-headline font-bold text-primary flex items-center gap-0.5 cursor-pointer"
                  >
                    <span>Detailed Analytics</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  {/* Stat 1: Tests Attempted */}
                  <div className="bg-surface-container-lowest p-4 rounded-2xl border border-outline-variant/20 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-on-surface-variant">
                        Tests Attempted
                      </span>
                      <div className="w-7 h-7 rounded-lg bg-primary-fixed flex items-center justify-center text-primary">
                        <BookOpen className="w-4 h-4" />
                      </div>
                    </div>
                    <p className="font-headline text-2xl font-extrabold text-on-surface tabular-nums">
                      {stats.totalAttempted}
                    </p>
                    <p className="text-[11px] text-emerald-700 font-semibold">
                      {stats.completedCount} Evaluated Submissions
                    </p>
                  </div>

                  {/* Stat 2: Average Score */}
                  <div className="bg-surface-container-lowest p-4 rounded-2xl border border-outline-variant/20 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-on-surface-variant">
                        Average Score
                      </span>
                      <div className="w-7 h-7 rounded-lg bg-secondary-fixed flex items-center justify-center text-secondary">
                        <BarChart2 className="w-4 h-4" />
                      </div>
                    </div>
                    <div className="flex items-baseline gap-1 tabular-nums">
                      <p className="font-headline text-2xl font-extrabold text-on-surface">
                        {stats.avgScore}
                      </p>
                      <span className="text-xs font-semibold text-on-surface-variant">Marks</span>
                    </div>
                    <p className="text-[11px] text-on-surface-variant font-medium">
                      Across completed papers
                    </p>
                  </div>

                  {/* Stat 3: Accuracy */}
                  <div className="bg-surface-container-lowest p-4 rounded-2xl border border-outline-variant/20 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-on-surface-variant">
                        Overall Accuracy
                      </span>
                      <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700">
                        <Target className="w-4 h-4" />
                      </div>
                    </div>
                    <p className="font-headline text-2xl font-extrabold text-on-surface tabular-nums">
                      {stats.avgAccuracy}%
                    </p>
                    <p className="text-[11px] text-emerald-700 font-semibold">
                      {stats.totalCorrect} Correct Answers
                    </p>
                  </div>

                  {/* Stat 4: Best Score */}
                  <div className="bg-surface-container-lowest p-4 rounded-2xl border border-outline-variant/20 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-on-surface-variant">
                        Best Score
                      </span>
                      <div className="w-7 h-7 rounded-lg bg-tertiary-fixed flex items-center justify-center text-tertiary">
                        <Award className="w-4 h-4" />
                      </div>
                    </div>
                    <div className="flex items-baseline gap-1 tabular-nums">
                      <p className="font-headline text-2xl font-extrabold text-primary">
                        {stats.bestScore}
                      </p>
                      <span className="text-xs font-semibold text-on-surface-variant">Marks</span>
                    </div>
                    <p className="text-[11px] text-on-surface-variant font-medium">
                      Highest recorded score
                    </p>
                  </div>
                </div>
              </section>

              {/* Recommended / Available Test Series Section */}
              <section className="space-y-3.5">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-headline text-base font-bold text-on-surface tracking-tight">
                      Recommended Test Series
                    </h2>
                    <p className="text-xs text-on-surface-variant">
                      Based on latest examination pattern &amp; syllabus
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('exams')}
                    className="text-xs font-headline font-bold text-primary cursor-pointer flex items-center gap-0.5"
                  >
                    <span>See All ({availableTests.length})</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                {availableTests.length === 0 ? (
                  <div className="bg-surface-container-lowest p-8 rounded-2xl border border-outline-variant/20 text-center space-y-2">
                    <BookOpen className="w-8 h-8 text-outline mx-auto" />
                    <p className="font-headline text-sm font-bold text-on-surface">
                      No Examinations Found
                    </p>
                    <p className="text-xs text-on-surface-variant">
                      Select &ldquo;All Exams&rdquo; above or use an Exam Access Code to join directly.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {availableTests.slice(0, 6).map((t) => renderAspirantTestCard(t))}
                  </div>
                )}
              </section>

              {/* Recent Performance & Answer Key Preview (Real Latest Attempt) */}
              {myAttempts.length > 0 && (
                <section className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="font-headline text-base font-bold text-on-surface tracking-tight">
                      Latest Test Evaluation
                    </h2>
                    <button
                      type="button"
                      onClick={() => setActiveTab('results')}
                      className="text-xs font-headline font-bold text-primary cursor-pointer"
                    >
                      All Results ({myAttempts.length})
                    </button>
                  </div>

                  {(() => {
                    const latestAtt = myAttempts[0];
                    const relatedTest = tests.find((t) => t.id === latestAtt.testId);
                    const maxMarks =
                      (latestAtt.totalQuestions || relatedTest?.totalQuestions || 100) *
                      (latestAtt.positiveMarks || relatedTest?.marksPerQuestion || 1);

                    return (
                      <div className="bg-surface-container-lowest rounded-2xl p-4 sm:p-5 border border-outline-variant/25 shadow-2xs space-y-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[10px] font-headline font-bold uppercase tracking-wider">
                              Completed &bull; Attempt #{latestAtt.attemptNumber || 1} &bull;{' '}
                              {latestAtt.submittedAt
                                ? new Date(latestAtt.submittedAt).toLocaleDateString()
                                : 'Recent'}
                            </span>
                            <h3 className="font-headline text-sm sm:text-base font-bold text-on-surface">
                              {latestAtt.testTitle}
                            </h3>
                          </div>
                          <div className="text-right shrink-0 tabular-nums">
                            <span className="font-headline text-xl font-extrabold text-primary">
                              {latestAtt.finalScore}
                            </span>
                            <span className="text-xs font-semibold text-on-surface-variant">
                              /{maxMarks}
                            </span>
                            <p className="text-[10px] text-on-surface-variant">Final Score</p>
                          </div>
                        </div>

                        {/* Mini KPI Row */}
                        <div className="grid grid-cols-3 divide-x divide-outline-variant/25 bg-surface-container-low rounded-xl p-3 text-center tabular-nums">
                          <div>
                            <p className="text-[10px] text-on-surface-variant font-medium">
                              Accuracy
                            </p>
                            <p className="font-headline text-xs font-bold text-emerald-700 mt-0.5">
                              {latestAtt.accuracy}%
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] text-on-surface-variant font-medium">
                              Percentage
                            </p>
                            <p className="font-headline text-xs font-bold text-on-surface mt-0.5">
                              {latestAtt.percentage}%
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] text-on-surface-variant font-medium">
                              Correct
                            </p>
                            <p className="font-headline text-xs font-bold text-primary mt-0.5">
                              {latestAtt.correctCount}/{latestAtt.totalQuestions}
                            </p>
                          </div>
                        </div>

                        {/* Dual Action Buttons: Separate Answer Key vs Result Summary */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          <button
                            type="button"
                            onClick={() =>
                              onOpenAnswerKey
                                ? onOpenAnswerKey(latestAtt)
                                : onViewAttempt(latestAtt)
                            }
                            className="py-2.5 px-3 rounded-xl bg-primary-fixed text-on-primary-fixed font-headline text-xs font-bold flex items-center justify-center gap-1.5 active:scale-95 transition-transform cursor-pointer"
                          >
                            <CheckCheck className="w-4 h-4 text-primary" />
                            <span>View Answer Key</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => onViewAttempt(latestAtt)}
                            className="py-2.5 px-3 rounded-xl bg-surface-container-high text-on-surface font-headline text-xs font-bold flex items-center justify-center gap-1.5 active:scale-95 transition-transform cursor-pointer"
                          >
                            <BarChart2 className="w-4 h-4 text-primary" />
                            <span>View Result Summary</span>
                          </button>
                        </div>
                      </div>
                    );
                  })()}
                </section>
              )}

              {/* Aspirant Motivation Card */}
              <section className="bg-surface-container-low rounded-2xl p-5 border-l-4 border-primary space-y-2">
                <div className="flex items-center gap-2 text-primary">
                  <Quote className="w-4 h-4" />
                  <span className="text-[11px] font-headline font-bold uppercase tracking-wider">
                    Aspirant Focus
                  </span>
                </div>
                <p className="font-body text-xs sm:text-sm font-medium text-on-surface leading-relaxed italic">
                  &ldquo;Success in competitive exams is not about studying 16 hours a day once; it
                  is about analyzing every mock test mistake and improving 1% daily.&rdquo;
                </p>
              </section>
            </div>
          )}

          {/* ========================================================
              TAB 2: EXAMINATIONS / TESTS CATALOG
             ======================================================== */}
          {activeTab === 'exams' && (
            <div className="space-y-6">
              {/* Category Pills & Search */}
              <div className="bg-surface-container-lowest p-4 rounded-2xl border border-outline-variant/20 shadow-2xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 no-scrollbar">
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-headline font-bold whitespace-nowrap cursor-pointer transition-all ${
                        selectedCategory === cat
                          ? 'bg-primary text-on-primary shadow-2xs'
                          : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'
                      }`}
                    >
                      {cat === 'all' ? 'All Categories' : cat}
                    </button>
                  ))}
                </div>

                <div className="relative w-full sm:w-72">
                  <Search className="w-4 h-4 text-outline absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Search test name or access code..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 border border-outline-variant/30 rounded-xl text-xs bg-surface-container-low focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary outline-none transition-all"
                  />
                </div>
              </div>

              {/* Test Series Programs */}
              {series.length > 0 && selectedCategory === 'all' && (
                <div className="space-y-3">
                  <h3 className="font-headline text-sm font-bold text-on-surface flex items-center gap-2">
                    <FolderKanban className="w-4 h-4 text-primary" />
                    <span>Examination Programs &amp; Series</span>
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {series.map((s) => {
                      const seriesTests = tests.filter(
                        (t) => t.seriesId === s.id && t.status !== 'draft'
                      );
                      return (
                        <div
                          key={s.id}
                          onClick={() => setSelectedCategory(s.category)}
                          className="bg-surface-container-lowest rounded-2xl p-4 border border-outline-variant/20 shadow-2xs hover:shadow-md transition-all cursor-pointer space-y-2"
                        >
                          <div className="flex items-center justify-between text-[11px] font-headline font-bold">
                            <span className="text-on-primary-fixed bg-primary-fixed px-2 py-0.5 rounded">
                              {s.category}
                            </span>
                            <span className="text-on-surface-variant tabular-nums">
                              {seriesTests.length} Tests
                            </span>
                          </div>
                          <h4 className="font-headline font-bold text-on-surface text-sm">
                            {s.title}
                          </h4>
                          {s.description && (
                            <p className="text-xs text-on-surface-variant line-clamp-2">
                              {s.description}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* All Available Examinations */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-headline text-base font-bold text-on-surface flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-primary" />
                    <span>All Available Examinations ({availableTests.length})</span>
                  </h3>
                  <span className="text-xs text-on-surface-variant">
                    Live, Scheduled &amp; Released Tests
                  </span>
                </div>

                {availableTests.length === 0 ? (
                  <div className="bg-surface-container-lowest p-12 rounded-2xl border border-outline-variant/20 text-center space-y-3">
                    <BookOpen className="w-10 h-10 text-outline mx-auto" />
                    <h4 className="font-headline font-bold text-on-surface text-base">
                      No examinations found
                    </h4>
                    <p className="text-xs text-on-surface-variant max-w-sm mx-auto">
                      Try selecting another category or clear your search query to see active
                      examinations.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {availableTests.map((t) => renderAspirantTestCard(t))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ========================================================
              TAB 3: OFFLINE PRACTICE
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
              TAB 4: MY RESULTS
             ======================================================== */}
          {activeTab === 'results' && (
            <div className="space-y-5">
              <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/20 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="font-headline text-base font-bold text-on-surface">
                    Submitted Attempts &amp; Scorecards
                  </h3>
                  <p className="text-xs text-on-surface-variant">
                    Every submission is independently recorded with its own Result Summary and Answer Key
                  </p>
                </div>
                <div className="text-xs font-headline font-bold px-3 py-1.5 rounded-full bg-primary-fixed text-on-primary-fixed self-start sm:self-auto tabular-nums">
                  {myAttempts.length} Completed Attempts
                </div>
              </div>

              {myAttempts.length === 0 ? (
                <div className="bg-surface-container-lowest p-12 rounded-2xl border border-outline-variant/20 text-center space-y-3">
                  <Award className="w-12 h-12 text-outline mx-auto" />
                  <h4 className="font-headline font-bold text-on-surface text-base">
                    No examination results yet
                  </h4>
                  <p className="text-xs text-on-surface-variant max-w-sm mx-auto">
                    Once you complete and submit an examination, your Result Summary and Answer Key
                    will appear here.
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('exams')}
                    className="px-4 py-2.5 bg-primary text-on-primary text-xs font-headline font-bold rounded-xl cursor-pointer"
                  >
                    Browse Tests
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {myAttempts.map((att) => {
                    const relatedTest = tests.find((t) => t.id === att.testId);
                    const isPublished =
                      Boolean(relatedTest?.instantResult) ||
                      relatedTest?.status === 'completed' ||
                      relatedTest?.status === 'result_published' ||
                      relatedTest?.status === 'released' ||
                      Boolean(att.isOffline);
                    const maxMarks =
                      (att.totalQuestions || relatedTest?.totalQuestions || 100) *
                      (att.positiveMarks || relatedTest?.marksPerQuestion || 1);

                    return (
                      <div
                        key={att.id}
                        className="bg-surface-container-lowest rounded-2xl p-5 border border-outline-variant/20 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between space-y-4"
                      >
                        <div className="space-y-3">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-headline font-bold text-primary bg-primary-fixed px-2.5 py-0.5 rounded-md">
                              Attempt #{att.attemptNumber || 1}
                            </span>
                            <span
                              className={`text-[10px] font-headline font-bold px-2.5 py-0.5 rounded-md ${
                                isPublished
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : 'bg-tertiary-fixed text-on-tertiary-fixed'
                              }`}
                            >
                              {isPublished ? 'Evaluated' : 'Result Pending'}
                            </span>
                          </div>

                          <div>
                            <h4 className="font-headline font-bold text-on-surface text-base leading-snug line-clamp-1">
                              {att.testTitle}
                            </h4>
                            <p className="text-[11px] text-on-surface-variant mt-0.5 tabular-nums">
                              Submitted:{' '}
                              {att.submittedAt
                                ? new Date(att.submittedAt).toLocaleString()
                                : 'Recent'}
                            </p>
                          </div>

                          {isPublished ? (
                            <div className="bg-surface-container-low p-3 rounded-xl grid grid-cols-3 divide-x divide-outline-variant/20 text-center tabular-nums">
                              <div>
                                <span className="text-[10px] text-on-surface-variant block">
                                  Score
                                </span>
                                <span className="font-headline text-sm font-extrabold text-primary">
                                  {att.finalScore}/{maxMarks}
                                </span>
                              </div>
                              <div>
                                <span className="text-[10px] text-on-surface-variant block">
                                  Percentage
                                </span>
                                <span className="font-headline text-sm font-extrabold text-on-surface">
                                  {att.percentage}%
                                </span>
                              </div>
                              <div>
                                <span className="text-[10px] text-on-surface-variant block">
                                  Accuracy
                                </span>
                                <span className="font-headline text-sm font-extrabold text-emerald-700">
                                  {att.accuracy}%
                                </span>
                              </div>
                            </div>
                          ) : (
                            <div className="p-3 bg-tertiary-fixed/40 rounded-xl text-xs text-on-tertiary-fixed">
                              Scorecard will unlock once the administrator concludes this session.
                            </div>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-2.5 pt-1">
                          <button
                            type="button"
                            onClick={() => onViewAttempt(att)}
                            className="py-2.5 px-3 rounded-xl bg-primary text-on-primary font-headline font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                          >
                            <Award className="w-3.5 h-3.5" />
                            <span>Result Summary</span>
                          </button>

                          <button
                            type="button"
                            disabled={!isPublished}
                            onClick={() =>
                              onOpenAnswerKey ? onOpenAnswerKey(att) : onViewAttempt(att)
                            }
                            className="py-2.5 px-3 rounded-xl bg-primary-fixed text-on-primary-fixed font-headline font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40"
                          >
                            <CheckCheck className="w-3.5 h-3.5 text-primary" />
                            <span>Answer Key</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ========================================================
              TAB 5: PERFORMANCE ANALYTICS
             ======================================================== */}
          {activeTab === 'performance' && (
            <div className="space-y-6">
              <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/20 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="font-headline text-base font-bold text-on-surface">
                    Candidate Performance Overview
                  </h3>
                  <p className="text-xs text-on-surface-variant">
                    Continuous accuracy, precision, and scoring analytics
                  </p>
                </div>
                <div className="text-xs font-headline font-bold text-on-primary-fixed bg-primary-fixed px-3 py-1.5 rounded-full tabular-nums">
                  Tracked across {stats.totalAttempted} attempts
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 tabular-nums">
                <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/20 space-y-2">
                  <div className="flex items-center justify-between text-on-surface-variant text-xs font-headline font-bold">
                    <span>Average Accuracy</span>
                    <TrendingUp className="w-4 h-4 text-primary" />
                  </div>
                  <div className="font-headline text-3xl font-extrabold text-on-surface">
                    {stats.avgAccuracy}%
                  </div>
                  <div className="w-full bg-surface-container h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-primary h-full rounded-full transition-all"
                      style={{ width: `${stats.avgAccuracy}%` }}
                    />
                  </div>
                </div>

                <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/20 space-y-2">
                  <div className="flex items-center justify-between text-on-surface-variant text-xs font-headline font-bold">
                    <span>Average Score</span>
                    <Award className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div className="font-headline text-3xl font-extrabold text-on-surface">
                    {stats.avgScore}
                  </div>
                  <p className="text-[11px] text-on-surface-variant">
                    Average marks scored per attempt
                  </p>
                </div>

                <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/20 space-y-2">
                  <div className="flex items-center justify-between text-on-surface-variant text-xs font-headline font-bold">
                    <span>Top Score</span>
                    <Award className="w-4 h-4 text-tertiary" />
                  </div>
                  <div className="font-headline text-3xl font-extrabold text-primary">
                    {stats.bestScore}
                  </div>
                  <p className="text-[11px] text-on-surface-variant">
                    Highest score achieved across any test
                  </p>
                </div>
              </div>

              <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/20 space-y-4">
                <h4 className="font-headline text-sm font-bold text-on-surface">
                  Score Progression by Attempt
                </h4>
                {myAttempts.length === 0 ? (
                  <p className="text-xs text-on-surface-variant">No attempts recorded yet.</p>
                ) : (
                  <div className="space-y-2.5">
                    {myAttempts.map((att) => (
                      <div
                        key={att.id}
                        className="p-4 rounded-xl bg-surface-container-low flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div>
                          <div className="font-headline text-xs font-bold text-on-surface">
                            {att.testTitle}
                          </div>
                          <div className="text-[11px] text-on-surface-variant tabular-nums">
                            Attempt #{att.attemptNumber || 1} &bull;{' '}
                            {att.submittedAt
                              ? new Date(att.submittedAt).toLocaleDateString()
                              : 'Recent'}
                          </div>
                        </div>

                        <div className="flex items-center gap-4 text-xs font-headline font-bold tabular-nums">
                          <span className="text-on-surface">Score: {att.finalScore}</span>
                          <span className="text-emerald-700">{att.percentage}%</span>
                          <span className="text-primary">Acc: {att.accuracy}%</span>
                          <button
                            type="button"
                            onClick={() => onViewAttempt(att)}
                            className="px-2.5 py-1 rounded-lg bg-primary text-on-primary text-xs cursor-pointer"
                          >
                            Summary &rarr;
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
              TAB 6: STUDY MATERIAL & SYLLABUS
             ======================================================== */}
          {activeTab === 'material' && (
            <div className="space-y-6">
              <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/20">
                <h3 className="font-headline text-base font-bold text-on-surface">
                  Curriculum &amp; Examination Syllabus
                </h3>
                <p className="text-xs text-on-surface-variant">
                  Subject domain, question distribution, and recorded video classes
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/20 space-y-2.5">
                  <div className="p-2.5 w-fit rounded-xl bg-primary-fixed text-primary">
                    <BookOpen className="w-5 h-5" />
                  </div>
                  <h4 className="font-headline font-bold text-on-surface text-sm">
                    General Knowledge &amp; Current Affairs
                  </h4>
                  <p className="text-xs text-on-surface-variant leading-relaxed">
                    National &amp; state history, geography, Indian constitution, polity,
                    scientific inventions, and current national/international events.
                  </p>
                </div>

                <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/20 space-y-2.5">
                  <div className="p-2.5 w-fit rounded-xl bg-secondary-fixed text-secondary">
                    <Layers className="w-5 h-5" />
                  </div>
                  <h4 className="font-headline font-bold text-on-surface text-sm">
                    Reasoning &amp; Analytical Ability
                  </h4>
                  <p className="text-xs text-on-surface-variant leading-relaxed">
                    Analogies, logical sequences, coding-decoding, blood relations, syllogisms,
                    directional sense, spatial orientation, and visual deduction.
                  </p>
                </div>

                <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/20 space-y-2.5">
                  <div className="p-2.5 w-fit rounded-xl bg-tertiary-fixed text-tertiary">
                    <BarChart2 className="w-5 h-5" />
                  </div>
                  <h4 className="font-headline font-bold text-on-surface text-sm">
                    Numerical Ability &amp; Mathematics
                  </h4>
                  <p className="text-xs text-on-surface-variant leading-relaxed">
                    Number systems, percentages, profit &amp; loss, ratio &amp; proportion, simple
                    and compound interest, time &amp; work, speed, distance, and algebra.
                  </p>
                </div>

                <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/20 space-y-2.5">
                  <div className="p-2.5 w-fit rounded-xl bg-emerald-100 text-emerald-700">
                    <Shield className="w-5 h-5" />
                  </div>
                  <h4 className="font-headline font-bold text-on-surface text-sm">
                    General Science &amp; Daily Ecology
                  </h4>
                  <p className="text-xs text-on-surface-variant leading-relaxed">
                    Core principles of physics, everyday chemistry, human biology, physiological
                    processes, environmental ecology, and technology advancements.
                  </p>
                </div>
              </div>

              {/* Recorded Course Video Lectures */}
              <div className="space-y-4 pt-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Video className="w-5 h-5 text-primary" />
                    <h3 className="font-headline text-base font-bold text-on-surface">
                      Recorded Course Video Lectures
                    </h3>
                  </div>
                  <span className="text-xs font-headline font-bold text-on-primary-fixed bg-primary-fixed px-2.5 py-0.5 rounded-full">
                    {courses.length} Available
                  </span>
                </div>

                {courses.length === 0 ? (
                  <div className="p-8 bg-surface-container-lowest rounded-2xl border border-outline-variant/20 text-center space-y-2">
                    <Film className="w-8 h-8 text-outline mx-auto" />
                    <div className="font-headline text-xs font-bold text-on-surface">
                      No recorded lectures uploaded yet
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {courses.map((course) => (
                      <div
                        key={course.id}
                        className="bg-surface-container-lowest rounded-2xl border border-outline-variant/20 overflow-hidden shadow-2xs flex flex-col justify-between"
                      >
                        <div>
                          <div className="relative aspect-video bg-inverse-surface overflow-hidden group">
                            {course.thumbnailUrl ? (
                              <img
                                src={course.thumbnailUrl}
                                alt={course.title}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex flex-col items-center justify-center text-inverse-on-surface gap-1">
                                <Film className="w-8 h-8 opacity-60" />
                                <span className="text-[10px] font-semibold">{course.category}</span>
                              </div>
                            )}

                            {course.videoUrl && (
                              <button
                                type="button"
                                onClick={() => {
                                  setPreviewVideoUrl(course.videoUrl || null);
                                  setPreviewVideoTitle(course.title);
                                }}
                                className="absolute inset-0 bg-black/40 hover:bg-black/25 flex items-center justify-center transition-colors cursor-pointer"
                              >
                                <div className="w-12 h-12 rounded-full bg-primary text-on-primary flex items-center justify-center shadow-lg">
                                  <Play className="w-5 h-5 ml-0.5 fill-current" />
                                </div>
                              </button>
                            )}
                          </div>

                          <div className="p-4 space-y-1">
                            <h4 className="font-headline font-bold text-on-surface text-sm line-clamp-1">
                              {course.title}
                            </h4>
                            <p className="text-xs text-on-surface-variant line-clamp-2">
                              {course.description || 'Recorded lecture for exam preparation.'}
                            </p>
                          </div>
                        </div>

                        <div className="p-4 pt-2 border-t border-outline-variant/15 flex items-center justify-between text-xs">
                          <span className="text-on-surface-variant text-[11px]">
                            By <strong>{course.instructor || 'ParikshaSetu'}</strong>
                          </span>
                          {course.videoUrl && (
                            <button
                              type="button"
                              onClick={() => {
                                setPreviewVideoUrl(course.videoUrl || null);
                                setPreviewVideoTitle(course.title);
                              }}
                              className="px-3 py-1 rounded-lg bg-primary text-on-primary font-headline font-bold text-[11px] flex items-center gap-1 cursor-pointer"
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
              TAB 7: NOTIFICATIONS
             ======================================================== */}
          {activeTab === 'notifications' && (
            <div className="space-y-4">
              <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/20 flex items-center justify-between">
                <div>
                  <h3 className="font-headline text-base font-bold text-on-surface">
                    Announcements &amp; Scheduled Notices
                  </h3>
                  <p className="text-xs text-on-surface-variant">
                    Live examination alerts and schedule broadcasts
                  </p>
                </div>
                <span className="text-xs font-headline font-bold px-2.5 py-1 rounded-full bg-primary-fixed text-on-primary-fixed">
                  {upcomingScheduledTests.length} Active
                </span>
              </div>

              <div className="space-y-3">
                {scheduledTests.map(({ test: t, schedule }) => (
                  <div
                    key={`notif-${t.id}`}
                    className="p-4 rounded-2xl bg-surface-container-lowest border border-outline-variant/20 flex items-start gap-3"
                  >
                    <Calendar className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center justify-between">
                        <h4 className="font-headline font-bold text-xs sm:text-sm text-on-surface">
                          {schedule.scheduleStatus === 'live'
                            ? `LIVE NOW: ${t.title}`
                            : `Scheduled Exam: ${t.title}`}
                        </h4>
                        <span className="text-[10px] font-headline font-bold px-2 py-0.5 rounded bg-primary-fixed text-on-primary-fixed">
                          {schedule.statusBadgeText}
                        </span>
                      </div>
                      <p className="text-xs text-on-surface-variant">
                        Date: <strong>{schedule.formattedDate}</strong> &bull; Starts:{' '}
                        <strong>{schedule.formattedStartTime}</strong> &bull; Duration:{' '}
                        <strong>{t.durationMinutes} Mins</strong>
                      </p>
                      <div className="text-[11px] font-semibold text-primary">
                        {schedule.timeRemainingText}
                      </div>
                    </div>
                  </div>
                ))}

                <div className="bg-surface-container-lowest border border-outline-variant/20 p-4 rounded-2xl flex items-start gap-3">
                  <Shield className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                  <div className="space-y-1">
                    <h4 className="font-headline font-bold text-on-surface text-xs sm:text-sm">
                      Proctoring &amp; Assessment Guidelines
                    </h4>
                    <p className="text-xs text-on-surface-variant">
                      Tab switches and window minimizations are actively logged during live tests.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================
              TAB 8: MY PROFILE
             ======================================================== */}
          {activeTab === 'profile' && (
            <div className="space-y-6 max-w-3xl">
              <div className="bg-surface-container-lowest p-6 sm:p-8 rounded-2xl border border-outline-variant/20 shadow-2xs space-y-6">
                <div className="flex flex-col sm:flex-row items-center gap-5 pb-6 border-b border-outline-variant/15">
                  <div className="relative group shrink-0">
                    <div className="w-24 h-24 rounded-2xl bg-primary-fixed text-on-primary-fixed font-headline font-extrabold text-3xl flex items-center justify-center shadow-xs overflow-hidden border-2 border-primary/20">
                      {user?.photoUrl ? (
                        <img
                          src={user.photoUrl}
                          alt={user.name}
                          className="w-full h-full object-cover"
                        />
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
                    <div>
                      <h3 className="font-headline text-xl font-bold text-on-surface">
                        {user?.name || 'Candidate'}
                      </h3>
                      <p className="text-xs text-on-surface-variant">
                        {user?.email || 'Student Account'}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                      <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary text-on-primary hover:bg-primary-container text-xs font-headline font-bold cursor-pointer transition-colors">
                        <Camera className="w-3.5 h-3.5" />
                        <span>
                          {user?.photoUrl ? 'Change Profile Photo' : 'Upload Profile Photo'}
                        </span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleProfilePhotoUpload}
                          disabled={isUploadingPhoto}
                        />
                      </label>
                      <span className="inline-block text-[11px] font-headline font-bold px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700">
                        Verified Candidate
                      </span>
                    </div>

                    {photoSuccess && (
                      <div className="text-xs font-semibold text-emerald-700 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>{photoSuccess}</span>
                      </div>
                    )}

                    {photoError && (
                      <div className="text-xs font-semibold text-error flex items-center gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5" />
                        <span>{photoError}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div className="p-4 rounded-xl bg-surface-container-low space-y-1">
                    <span className="text-on-surface-variant font-bold uppercase tracking-wider text-[10px]">
                      Student Name
                    </span>
                    <div className="font-headline font-bold text-on-surface text-sm">
                      {user?.name || 'Candidate'}
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-surface-container-low space-y-1">
                    <span className="text-on-surface-variant font-bold uppercase tracking-wider text-[10px]">
                      Email Address
                    </span>
                    <div className="font-headline font-bold text-on-surface text-sm truncate">
                      {user?.email || 'N/A'}
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-surface-container-low space-y-1">
                    <span className="text-on-surface-variant font-bold uppercase tracking-wider text-[10px]">
                      Candidate ID
                    </span>
                    <div className="font-mono text-on-surface text-xs truncate">
                      {user?.uid || 'Active Session'}
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-surface-container-low space-y-1">
                    <span className="text-on-surface-variant font-bold uppercase tracking-wider text-[10px]">
                      Account Role
                    </span>
                    <div className="font-headline font-bold text-primary capitalize text-sm">
                      {user?.role || 'Student'}
                    </div>
                  </div>
                </div>

                {/* Quick Link to App Updates & Settings */}
                <div className="pt-4 border-t border-outline-variant/15 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setActiveTab('settings')}
                    className="inline-flex items-center gap-1.5 text-xs font-headline font-bold text-primary cursor-pointer"
                  >
                    <Settings className="w-4 h-4" />
                    <span>App Settings &amp; Check for Updates</span>
                  </button>

                  <button
                    type="button"
                    onClick={logout}
                    className="px-4 py-2 rounded-xl bg-error-container/50 text-error font-headline font-bold text-xs cursor-pointer"
                  >
                    Sign Out
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================
              TAB 9: SETTINGS & IN-APP APK UPDATES
             ======================================================== */}
          {activeTab === 'settings' && (
            <div className="space-y-6 max-w-3xl">
              <div className="bg-surface-container-lowest p-6 sm:p-8 rounded-2xl border border-outline-variant/20 space-y-6">
                <div>
                  <h3 className="font-headline text-base font-bold text-on-surface">
                    Institute &amp; Support Information
                  </h3>
                  <p className="text-xs text-on-surface-variant">
                    Contact details and technical support
                  </p>
                </div>

                <div className="space-y-3 text-xs">
                  <div className="flex items-center gap-3 p-3.5 rounded-xl bg-surface-container-low">
                    <GraduationCap className="w-5 h-5 text-primary shrink-0" />
                    <div>
                      <div className="font-headline font-bold text-on-surface">
                        {settings.instituteName}
                      </div>
                      <div className="text-on-surface-variant">{settings.tagline}</div>
                    </div>
                  </div>

                  {settings.contactEmail && (
                    <div className="flex items-center gap-3 p-3.5 rounded-xl bg-surface-container-low">
                      <Mail className="w-5 h-5 text-primary shrink-0" />
                      <div>
                        <div className="text-on-surface-variant text-[10px] uppercase font-bold">
                          Contact Email
                        </div>
                        <div className="font-headline font-bold text-on-surface">
                          {settings.contactEmail}
                        </div>
                      </div>
                    </div>
                  )}

                  {settings.contactPhone && (
                    <div className="flex items-center gap-3 p-3.5 rounded-xl bg-surface-container-low">
                      <Phone className="w-5 h-5 text-primary shrink-0" />
                      <div>
                        <div className="text-on-surface-variant text-[10px] uppercase font-bold">
                          Helpdesk Phone
                        </div>
                        <div className="font-headline font-bold text-on-surface">
                          {settings.contactPhone}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Application Version & APK Update Check Card */}
              <div className="bg-surface-container-lowest p-6 sm:p-8 rounded-2xl border border-outline-variant/20 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="font-headline text-base font-bold text-on-surface">
                      Application Version &amp; Updates
                    </h3>
                    <p className="text-xs text-on-surface-variant">
                      Package ID: <span className="font-mono text-on-surface">{ANDROID_PACKAGE_ID}</span>{' '}
                      &bull; Installed:{' '}
                      <strong className="text-on-surface tabular-nums">
                        v{installedVersion} (Build {installedVersionCode})
                      </strong>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleManualUpdateCheck}
                    disabled={isCheckingUpdate}
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-primary text-on-primary font-headline text-xs font-bold cursor-pointer shrink-0 disabled:opacity-60"
                  >
                    <RotateCw className={`w-3.5 h-3.5 ${isCheckingUpdate ? 'animate-spin' : ''}`} />
                    <span>{isCheckingUpdate ? 'Checking...' : 'Check for Updates'}</span>
                  </button>
                </div>

                {manualUpdateCheck && (
                  <div
                    className={`p-4 rounded-xl border text-xs space-y-3 ${
                      manualUpdateCheck.updateAvailable
                        ? 'bg-primary-fixed/50 border-primary/25 text-on-primary-fixed'
                        : 'bg-surface-container-low border-outline-variant/20 text-on-surface'
                    }`}
                  >
                    {manualUpdateCheck.updateAvailable && manualUpdateCheck.latestManifest ? (
                      <>
                        <div className="space-y-3">
                          <div>
                            <div className="font-headline font-bold text-sm text-on-surface flex items-center gap-2">
                              <span>
                                New Version Available: v
                                {manualUpdateCheck.latestManifest.versionName}
                              </span>
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                Signed Release APK
                              </span>
                            </div>
                            {manualUpdateCheck.latestManifest.releaseNotes && (
                              <p className="text-xs text-on-surface-variant mt-1">
                                {manualUpdateCheck.latestManifest.releaseNotes}
                              </p>
                            )}
                          </div>
                          <InAppUpdateActionPanel
                            manifest={manualUpdateCheck.latestManifest}
                            theme="light"
                          />
                        </div>
                        <p className="text-[11px] text-on-surface-variant">
                          Downloads the signed APK directly inside ParikshaSetu and launches
                          Android&apos;s package installer via FileProvider without clearing your
                          offline tests or account data.
                        </p>
                      </>
                    ) : (
                      <div className="flex items-center gap-2 font-semibold text-on-surface">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>
                          {manualUpdateCheck.statusMessage ||
                            `ParikshaSetu v${installedVersion} is up to date.`}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Bottom Navigation Bar (Mobile Aspirant Neo Navigation) */}
      <nav
        aria-label="Primary Mobile Navigation"
        className="fixed bottom-0 left-0 right-0 z-40 bg-surface-container-lowest/95 backdrop-blur-lg border-t border-outline-variant/25 md:hidden"
      >
        <div className="max-w-md mx-auto grid grid-cols-5 h-16 px-2">
          <button
            type="button"
            onClick={() => setActiveTab('home')}
            className={`flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer ${
              activeTab === 'home' ? 'text-primary' : 'text-on-surface-variant hover:text-primary'
            }`}
          >
            <div
              className={`px-3 py-0.5 rounded-full flex items-center justify-center ${
                activeTab === 'home' ? 'bg-primary-fixed' : ''
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
            </div>
            <span className="font-headline text-[10px] font-bold">Home</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('exams')}
            className={`flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer ${
              activeTab === 'exams' ? 'text-primary' : 'text-on-surface-variant hover:text-primary'
            }`}
          >
            <div
              className={`px-3 py-0.5 rounded-full flex items-center justify-center ${
                activeTab === 'exams' ? 'bg-primary-fixed' : ''
              }`}
            >
              <BookOpen className="w-4 h-4" />
            </div>
            <span className="font-headline text-[10px] font-bold">Tests</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('offline')}
            className={`flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer ${
              activeTab === 'offline'
                ? 'text-primary'
                : 'text-on-surface-variant hover:text-primary'
            }`}
          >
            <div
              className={`px-3 py-0.5 rounded-full flex items-center justify-center ${
                activeTab === 'offline' ? 'bg-primary-fixed' : ''
              }`}
            >
              <HardDrive className="w-4 h-4" />
            </div>
            <span className="font-headline text-[10px] font-bold">Offline</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('results')}
            className={`flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer ${
              activeTab === 'results'
                ? 'text-primary'
                : 'text-on-surface-variant hover:text-primary'
            }`}
          >
            <div
              className={`px-3 py-0.5 rounded-full flex items-center justify-center ${
                activeTab === 'results' ? 'bg-primary-fixed' : ''
              }`}
            >
              <Award className="w-4 h-4" />
            </div>
            <span className="font-headline text-[10px] font-bold">Results</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className={`flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer ${
              activeTab === 'profile' || activeTab === 'settings'
                ? 'text-primary'
                : 'text-on-surface-variant hover:text-primary'
            }`}
          >
            <div
              className={`px-3 py-0.5 rounded-full flex items-center justify-center ${
                activeTab === 'profile' || activeTab === 'settings' ? 'bg-primary-fixed' : ''
              }`}
            >
              <User className="w-4 h-4" />
            </div>
            <span className="font-headline text-[10px] font-bold">Profile</span>
          </button>
        </div>
      </nav>

      {/* Video Player Modal */}
      {previewVideoUrl && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-inverse-surface rounded-3xl max-w-3xl w-full overflow-hidden shadow-2xl border border-outline-variant/20">
            <div className="px-5 py-3.5 bg-on-surface text-inverse-on-surface flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Video className="w-4 h-4 text-primary-fixed-dim" />
                <span className="font-headline font-bold text-sm truncate max-w-md">
                  {previewVideoTitle}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setPreviewVideoUrl(null)}
                className="text-inverse-on-surface/70 hover:text-white font-bold text-lg cursor-pointer"
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
