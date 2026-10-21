import React, { useState, useEffect } from 'react';
import {
  Download,
  Wifi,
  WifiOff,
  RotateCw,
  Trash2,
  PlayCircle,
  CheckCircle2,
  Clock,
  Award,
  HardDrive,
  AlertCircle,
  FileText,
  Search,
  Sparkles,
  Layers,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import { TestItem, OfflineTestRecord, StudentAttempt, OfflineDownloadProgress } from '../../types/exam';
import {
  getDownloadedTests,
  deleteDownloadedTest,
  downloadPracticeTestForOffline,
  syncPendingOfflineAttempts,
  getPendingOfflineAttempts,
  subscribeToDownloadProgress,
} from '../../services/offlineStorageService';

interface OfflinePracticeTabProps {
  availableTests: TestItem[];
  onStartTest: (test: TestItem) => void;
  onViewAttempt?: (attempt: StudentAttempt) => void;
}

export const OfflinePracticeTab: React.FC<OfflinePracticeTabProps> = ({
  availableTests,
  onStartTest,
  onViewAttempt,
}) => {
  const [downloadedTests, setDownloadedTests] = useState<OfflineTestRecord[]>([]);
  const [pendingAttempts, setPendingAttempts] = useState<StudentAttempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeDownloadMap, setActiveDownloadMap] = useState<Record<string, OfflineDownloadProgress>>({});

  const refreshOfflineData = async () => {
    try {
      const [tests, pending] = await Promise.all([
        getDownloadedTests(),
        getPendingOfflineAttempts(),
      ]);
      setDownloadedTests(tests);
      setPendingAttempts(pending);
    } catch (err) {
      console.warn('Error loading offline records:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshOfflineData();

    // Listen to download progress
    const unsubscribeProgress = subscribeToDownloadProgress((p) => {
      setActiveDownloadMap((prev) => ({
        ...prev,
        [p.testId]: p,
      }));
      if (p.percent === 100) {
        refreshOfflineData();
      }
    });

    // Listen to network changes
    const onOnline = () => {
      setIsOnline(true);
      refreshOfflineData();
    };
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    // Custom event listeners
    const onTestsChanged = () => refreshOfflineData();
    const onAttemptsChanged = () => refreshOfflineData();
    window.addEventListener('pariksha_offline_tests_updated', onTestsChanged);
    window.addEventListener('pariksha_offline_attempts_changed', onAttemptsChanged);
    window.addEventListener('pariksha_offline_attempts_synced', onAttemptsChanged);

    return () => {
      unsubscribeProgress();
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('pariksha_offline_tests_updated', onTestsChanged);
      window.removeEventListener('pariksha_offline_attempts_changed', onAttemptsChanged);
      window.removeEventListener('pariksha_offline_attempts_synced', onAttemptsChanged);
    };
  }, []);

  const handleDownload = async (test: TestItem) => {
    try {
      await downloadPracticeTestForOffline(test);
      await refreshOfflineData();
    } catch (err: any) {
      console.error('Download error:', err);
    }
  };

  const handleDelete = async (testId: string) => {
    if (confirm('Delete this downloaded test from local device storage? You can re-download it anytime you are online.')) {
      await deleteDownloadedTest(testId);
      await refreshOfflineData();
    }
  };

  const handleSyncAll = async () => {
    if (!isOnline || isSyncing) return;
    setIsSyncing(true);
    setSyncMessage(null);
    try {
      const res = await syncPendingOfflineAttempts();
      if (res.syncedCount > 0) {
        setSyncMessage(`Successfully synchronized ${res.syncedCount} attempt${res.syncedCount > 1 ? 's' : ''} to server!`);
      } else {
        setSyncMessage('All attempts are already up to date.');
      }
      await refreshOfflineData();
    } catch (err) {
      setSyncMessage('Sync encountered an error. Please try again.');
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncMessage(null), 5000);
    }
  };

  // Tests available to download for practice (e.g. released or practice tests not yet downloaded)
  const downloadedTestIds = new Set(downloadedTests.map((d) => d.id));
  const practiceEligibleTests = availableTests.filter((t) => {
    // Only released tests or tests marked for practice are eligible for offline download
    return t.status === 'released' || t.status === 'published';
  });

  const filteredDownloadedTests = downloadedTests.filter((t) =>
    t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.examCategory.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalStorageKB = downloadedTests.reduce((sum, t) => sum + (t.approxSizeBytes || 50000), 0) / 1024;
  const formattedStorage = totalStorageKB > 1024
    ? `${(totalStorageKB / 1024).toFixed(1)} MB`
    : `${Math.round(totalStorageKB)} KB`;

  return (
    <div className="space-y-6">
      {/* Top Banner / Mode Card */}
      <div className="bg-linear-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-md relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-linear-to-l from-indigo-500/10 to-transparent pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                isOnline ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30' : 'bg-amber-500/20 text-amber-300 border border-amber-400/30'
              }`}>
                {isOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
                <span>{isOnline ? 'Internet Connected' : 'Working Offline Mode'}</span>
              </span>
              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-white/10 text-slate-200">
                Offline Practice Center
              </span>
            </div>

            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Offline Practice Test Library
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Download practice tests when connected to internet, then practice anywhere without data. Questions, diagrams, timers, and scoring work 100% offline.
            </p>
          </div>

          {/* Quick Metrics & Sync Widget */}
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-3">
            <div className="bg-white/10 backdrop-blur-xs px-4 py-3 rounded-2xl border border-white/15 text-center min-w-[110px]">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Downloaded</span>
              <span className="text-2xl font-black text-white">{downloadedTests.length}</span>
              <span className="text-[10px] text-indigo-300 block">{formattedStorage}</span>
            </div>

            <div className="bg-white/10 backdrop-blur-xs px-4 py-3 rounded-2xl border border-white/15 text-center min-w-[110px]">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Pending Sync</span>
              <span className={`text-2xl font-black ${pendingAttempts.length > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                {pendingAttempts.length}
              </span>
              <span className="text-[10px] text-slate-300 block">
                {pendingAttempts.length > 0 ? 'Offline Attempts' : 'All Synced'}
              </span>
            </div>

            {pendingAttempts.length > 0 && (
              <button
                onClick={handleSyncAll}
                disabled={isSyncing || !isOnline}
                className="w-full sm:w-auto px-4 py-3 rounded-2xl bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-md transition-all shrink-0"
              >
                <RotateCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>{isSyncing ? 'Syncing...' : isOnline ? 'Sync Attempts' : 'Connect to Sync'}</span>
              </button>
            )}
          </div>
        </div>

        {syncMessage && (
          <div className="mt-4 p-3 rounded-xl bg-white/15 border border-white/20 text-xs font-semibold text-white flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{syncMessage}</span>
          </div>
        )}
      </div>

      {/* Distinction Note */}
      <div className="p-4 rounded-2xl bg-slate-100 border border-slate-200 text-xs text-slate-600 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <ShieldCheck className="w-5 h-5 text-indigo-600 shrink-0" />
          <span>
            <strong>Exam Security Architecture:</strong> Official live & scheduled examinations require an active internet connection for anti-cheating logs and server timers. Practice tests can be downloaded and taken offline anytime.
          </span>
        </div>
      </div>

      {/* SECTION 1: DOWNLOADED TESTS READY FOR OFFLINE PLAY */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <HardDrive className="w-5 h-5 text-indigo-600" />
            <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
              Downloaded Tests Ready Offline ({downloadedTests.length})
            </h3>
          </div>

          {downloadedTests.length > 0 && (
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search downloaded tests..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 border border-slate-300 rounded-xl text-xs bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
          )}
        </div>

        {loading ? (
          <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center space-y-2">
            <div className="w-6 h-6 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs text-slate-500">Checking offline storage...</p>
          </div>
        ) : downloadedTests.length === 0 ? (
          <div className="bg-white p-8 rounded-3xl border border-dashed border-slate-300 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
              <Download className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-800">No practice tests downloaded yet</h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                Browse available practice tests below and click <strong>Download for Offline</strong> to save questions and diagrams for studying without an internet connection.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredDownloadedTests.map((dt) => {
              const originalTest = availableTests.find((t) => t.id === dt.id) || {
                id: dt.id,
                title: dt.title,
                seriesId: '',
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
              };

              return (
                <div
                  key={dt.id}
                  className="bg-white rounded-2xl p-5 border border-emerald-200 shadow-xs hover:shadow-md transition-all flex flex-col justify-between space-y-4 ring-1 ring-emerald-100"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-indigo-50 text-indigo-700">
                        {dt.examCategory}
                      </span>
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Available Offline</span>
                      </span>
                    </div>

                    <div>
                      <h4 className="font-bold text-slate-900 text-sm line-clamp-1">{dt.title}</h4>
                      {dt.seriesTitle && (
                        <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">{dt.seriesTitle}</p>
                      )}
                    </div>

                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1.5 text-xs text-slate-600">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span>Duration: <strong>{dt.durationMinutes} Mins</strong></span>
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Award className="w-3.5 h-3.5 text-slate-400" />
                          <span>Questions: <strong>{dt.totalQuestions}</strong></span>
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-200/60">
                        <span>Marks: +{dt.marksPerQuestion} / -{dt.negativeMarks}</span>
                        <span>Saved: {new Date(dt.downloadedAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                    <button
                      onClick={() => onStartTest(originalTest as TestItem)}
                      className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors shadow-xs"
                    >
                      <PlayCircle className="w-4 h-4" />
                      <span>Start Practice</span>
                    </button>
                    <button
                      onClick={() => handleDelete(dt.id)}
                      className="p-2 text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-xl border border-rose-200 cursor-pointer transition-colors"
                      title="Remove from offline storage"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* SECTION 2: AVAILABLE TO DOWNLOAD (When online) */}
      <div className="space-y-4 pt-4 border-t border-slate-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Download className="w-5 h-5 text-indigo-600" />
            <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
              Download More Practice Tests for Offline
            </h3>
          </div>
          <span className="text-xs text-slate-500">
            {practiceEligibleTests.length} Eligible
          </span>
        </div>

        {practiceEligibleTests.length === 0 ? (
          <div className="bg-white p-6 rounded-2xl border border-slate-200 text-center text-xs text-slate-500">
            No practice tests currently open for download.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {practiceEligibleTests.map((t) => {
              const isDownloaded = downloadedTestIds.has(t.id);
              const progress = activeDownloadMap[t.id];
              const isDownloading = progress?.isDownloading;

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
                      {isDownloaded ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>Downloaded</span>
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

                    {/* Download Progress Bar */}
                    {isDownloading && (
                      <div className="space-y-1.5 pt-1">
                        <div className="flex items-center justify-between text-[11px] font-bold text-indigo-600">
                          <span>{progress.statusMessage}</span>
                          <span>{progress.percent}%</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="bg-indigo-600 h-1.5 rounded-full transition-all duration-300"
                            style={{ width: `${progress.percent}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <div>
                    {isDownloaded ? (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => onStartTest(t)}
                          className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors shadow-xs"
                        >
                          <PlayCircle className="w-4 h-4" />
                          <span>Start Test</span>
                        </button>
                        <button
                          onClick={() => handleDelete(t.id)}
                          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl border border-slate-200 cursor-pointer transition-colors"
                          title="Delete offline copy"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleDownload(t)}
                        disabled={isDownloading || !isOnline}
                        className="w-full py-2 px-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors disabled:opacity-50"
                      >
                        <Download className={`w-4 h-4 ${isDownloading ? 'animate-bounce' : ''}`} />
                        <span>{isDownloading ? 'Downloading...' : isOnline ? 'Download for Offline' : 'Offline (Cannot Download)'}</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
