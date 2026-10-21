import React, { useState, useEffect } from 'react';
import {
  Download,
  Share,
  X,
  Smartphone,
  Sparkles,
  ShieldCheck,
  AlertCircle,
  Settings,
  CheckCircle2,
  RotateCw,
} from 'lucide-react';
import { App } from '@capacitor/app';
import { usePWAInstall } from '../hooks/usePWAInstall';
import {
  checkForAppUpdate,
  downloadAndInstallOfficialApk,
  checkUnknownSourcesPermission,
  openUnknownSourcesSettings,
  installPendingDownloadedApk,
  cancelInAppApkDownload,
  formatByteSize,
  AppUpdateCheckResult,
  AppVersionManifest,
  ApkDownloadProgressEvent,
} from '../services/nativeAppService';

export const PWAInstallButton: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // If already running in standalone/installed mode, don't show prompt
  if (isInstalled) {
    return null;
  }

  // Chromium / Android / Desktop flow
  if (isInstallable) {
    return (
      <button
        onClick={install}
        title="Install ParikshaSetu App"
        className={`inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-md shadow-blue-500/20 hover:from-blue-500 hover:to-indigo-500 transition-all active:scale-95 ${className}`}
      >
        <Download className="w-3.5 h-3.5" />
        <span>Install App</span>
      </button>
    );
  }

  // iOS Safari flow
  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSGuide(true)}
          title="Install on iPhone / iPad"
          className={`inline-flex items-center gap-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white/80 dark:bg-slate-800/80 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 shadow-sm hover:bg-slate-100 dark:hover:bg-slate-700 transition-all ${className}`}
        >
          <Smartphone className="w-3.5 h-3.5 text-indigo-500" />
          <span>Install App</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="relative w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl text-slate-800 dark:text-slate-100">
              <button
                onClick={() => setShowIOSGuide(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 dark:bg-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                  <Smartphone className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">Install ParikshaSetu</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Add to iPhone or iPad Home Screen</p>
                </div>
              </div>

              <div className="space-y-3 text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-xl border border-slate-100 dark:border-slate-800">
                <div className="flex items-start gap-2.5">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center text-[10px]">1</span>
                  <p>
                    Tap the <strong className="text-slate-900 dark:text-white inline-flex items-center gap-1">Share <Share className="w-3 h-3 inline" /></strong> button in Safari&apos;s bottom toolbar.
                  </p>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center text-[10px]">2</span>
                  <p>
                    Scroll down and select <strong className="text-slate-900 dark:text-white">Add to Home Screen</strong>.
                  </p>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center text-[10px]">3</span>
                  <p>
                    Tap <strong className="text-slate-900 dark:text-white">Add</strong> in the top-right corner to launch fullscreen anytime!
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowIOSGuide(false)}
                className="mt-5 w-full rounded-xl bg-slate-900 dark:bg-slate-100 py-2.5 text-xs font-semibold text-white dark:text-slate-900 hover:opacity-90 transition-opacity"
              >
                Got it
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};

export const OfflineIndicator: React.FC = () => {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-xl bg-amber-600 px-3.5 py-2 text-xs font-medium text-white shadow-xl animate-bounce">
      <span className="h-2 w-2 rounded-full bg-white animate-ping" />
      <span>Offline Mode — Cached exams &amp; data active</span>
    </div>
  );
};

interface InAppUpdateActionPanelProps {
  manifest: AppVersionManifest;
  theme?: 'dark' | 'light';
  onDismiss?: () => void;
}

/**
 * Shared controller UI for Option 1: In-App APK Download and Update.
 * Handles:
 * - Direct in-app APK download with real-time progress bar, percentage, and byte counter
 * - Safe network interruption recovery and retry
 * - Android "Install unknown apps" permission explanation and direct settings shortcut
 * - Automatic resumption of Android Package Installer via FileProvider (content:// URI)
 */
export const InAppUpdateActionPanel: React.FC<InAppUpdateActionPanelProps> = ({
  manifest,
  theme = 'dark',
  onDismiss,
}) => {
  const [phase, setPhase] = useState<
    'idle' | 'downloading' | 'permission_required' | 'installer_launched' | 'error'
  >('idle');
  const [progress, setProgress] = useState<number>(0);
  const [bytesDownloaded, setBytesDownloaded] = useState<number>(0);
  const [totalBytes, setTotalBytes] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [downloadedFileName, setDownloadedFileName] = useState<string>(
    manifest.apkFileName || `ParikshaSetu-v${manifest.versionName}-release.apk`
  );

  // Automatically check if user enabled "Install unknown apps" in Android Settings and returned to the app
  useEffect(() => {
    if (phase !== 'permission_required') return;

    let isMounted = true;
    const listenerPromise = App.addListener('appStateChange', async ({ isActive }) => {
      if (!isActive || !isMounted) return;
      try {
        const perm = await checkUnknownSourcesPermission();
        if (perm.granted && isMounted) {
          const result = await installPendingDownloadedApk(downloadedFileName);
          if (isMounted && result.status === 'INSTALLER_LAUNCHED') {
            setPhase('installer_launched');
          }
        }
      } catch (err: any) {
        if (isMounted) {
          setErrorMessage(err?.message || 'Could not launch Android installer.');
          setPhase('error');
        }
      }
    });

    return () => {
      isMounted = false;
      listenerPromise.then((h) => h.remove()).catch(() => {});
    };
  }, [phase, downloadedFileName]);

  const startInAppDownload = async () => {
    setErrorMessage(null);
    setProgress(0);
    setBytesDownloaded(0);
    setTotalBytes(0);
    setPhase('downloading');

    try {
      const result = await downloadAndInstallOfficialApk(
        manifest,
        (event: ApkDownloadProgressEvent) => {
          if (event.status === 'downloading' || event.status === 'completed') {
            setProgress(Math.max(0, Math.min(100, event.progress)));
            setBytesDownloaded(event.bytesDownloaded);
            setTotalBytes(event.totalBytes);
          }
        }
      );

      if (result.fileName) {
        setDownloadedFileName(result.fileName);
      }

      if (result.status === 'PERMISSION_REQUIRED') {
        setPhase('permission_required');
      } else {
        setPhase('installer_launched');
      }
    } catch (err: any) {
      const msg = String(err?.message || 'Download failed.');
      if (msg.toLowerCase().includes('cancelled')) {
        setPhase('idle');
        return;
      }
      setErrorMessage(msg);
      setPhase('error');
    }
  };

  const handleCancelDownload = async () => {
    await cancelInAppApkDownload();
    setPhase('idle');
  };

  const handleInstallAlreadyDownloaded = async () => {
    setErrorMessage(null);
    try {
      const result = await installPendingDownloadedApk(downloadedFileName);
      if (result.status === 'PERMISSION_REQUIRED') {
        setPhase('permission_required');
      } else {
        setPhase('installer_launched');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to launch installer. Please download the update again.');
      setPhase('error');
    }
  };

  const isDark = theme === 'dark';

  return (
    <div className="space-y-3">
      {/* Phase: Downloading with progress bar */}
      {phase === 'downloading' && (
        <div
          className={`rounded-xl p-3 border space-y-2 ${
            isDark
              ? 'bg-slate-800/90 border-indigo-500/40 text-white'
              : 'bg-white border-indigo-200 text-slate-900'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-bold">
            <span className="flex items-center gap-1.5">
              <RotateCw className="w-3.5 h-3.5 animate-spin text-indigo-400" />
              <span>Downloading v{manifest.versionName} APK...</span>
            </span>
            <span className={isDark ? 'text-indigo-300' : 'text-indigo-600'}>
              {totalBytes > 0 ? `${progress}%` : 'Downloading...'}
            </span>
          </div>

          <div
            className={`w-full h-2.5 rounded-full overflow-hidden ${
              isDark ? 'bg-slate-950' : 'bg-slate-100'
            }`}
          >
            <div
              className="h-full bg-gradient-to-r from-indigo-500 to-emerald-500 transition-all duration-200"
              style={{ width: `${totalBytes > 0 ? Math.max(4, progress) : 45}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[11px]">
            <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>
              {totalBytes > 0
                ? `${formatByteSize(bytesDownloaded)} of ${formatByteSize(totalBytes)}`
                : `${formatByteSize(bytesDownloaded)} downloaded`}
            </span>
            <button
              type="button"
              onClick={handleCancelDownload}
              className={`font-semibold underline cursor-pointer ${
                isDark ? 'text-slate-300 hover:text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Phase: Unknown Sources Permission Required */}
      {phase === 'permission_required' && (
        <div
          className={`rounded-xl p-3.5 border space-y-2.5 text-xs ${
            isDark
              ? 'bg-amber-950/60 border-amber-500/50 text-amber-100'
              : 'bg-amber-50 border-amber-300 text-amber-950'
          }`}
        >
          <div className="flex items-start gap-2">
            <Settings className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
            <div className="space-y-1">
              <div className="font-bold">
                Allow &ldquo;Install unknown apps&rdquo; to finish updating
              </div>
              <p className={isDark ? 'text-amber-200/90 text-[11px]' : 'text-amber-900 text-[11px]'}>
                The update APK is downloaded and ready. Android requires your one-time permission for
                ParikshaSetu to launch the system package installer:
              </p>
              <ol
                className={`list-decimal list-inside space-y-0.5 text-[11px] font-medium ${
                  isDark ? 'text-amber-100' : 'text-amber-900'
                }`}
              >
                <li>Tap &ldquo;Open Settings&rdquo; below.</li>
                <li>Turn ON &ldquo;Allow from this source&rdquo; for ParikshaSetu.</li>
                <li>Return here and tap &ldquo;Install Update Now&rdquo;.</li>
              </ol>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => openUnknownSourcesSettings()}
              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-3 py-2 text-xs transition-colors cursor-pointer"
            >
              <Settings className="w-3.5 h-3.5" />
              <span>1. Open Settings</span>
            </button>
            <button
              type="button"
              onClick={handleInstallAlreadyDownloaded}
              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-3 py-2 text-xs transition-colors cursor-pointer"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>2. Install Update Now</span>
            </button>
          </div>
        </div>
      )}

      {/* Phase: Installer Launched */}
      {phase === 'installer_launched' && (
        <div
          className={`rounded-xl p-3 border space-y-2 text-xs ${
            isDark
              ? 'bg-emerald-950/50 border-emerald-500/40 text-emerald-100'
              : 'bg-emerald-50 border-emerald-200 text-emerald-950'
          }`}
        >
          <div className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
            <div>
              <div className="font-bold">Android Package Installer Ready</div>
              <p className="text-[11px] opacity-90 mt-0.5">
                Confirm &ldquo;Update&rdquo; on the Android system prompt to complete the in-place update. Your
                account and offline data will remain intact.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleInstallAlreadyDownloaded}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3 py-1.5 text-xs transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Open Installer Prompt Again</span>
            </button>
          </div>
        </div>
      )}

      {/* Phase: Error */}
      {phase === 'error' && errorMessage && (
        <div
          className={`rounded-xl p-3 border space-y-2 text-xs ${
            isDark
              ? 'bg-red-950/60 border-red-500/50 text-red-100'
              : 'bg-red-50 border-red-200 text-red-900'
          }`}
        >
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
            <div className="space-y-1">
              <div className="font-bold">Update Download Interrupted</div>
              <p className="text-[11px] opacity-90">{errorMessage}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={startInAppDownload}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-3.5 py-2 text-xs transition-colors cursor-pointer"
            >
              <RotateCw className="w-3.5 h-3.5" />
              <span>Retry Download</span>
            </button>
            {onDismiss && (
              <button
                type="button"
                onClick={onDismiss}
                className={`px-3 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                  isDark
                    ? 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                    : 'bg-slate-200 hover:bg-slate-300 text-slate-700'
                }`}
              >
                Later
              </button>
            )}
          </div>
        </div>
      )}

      {/* Phase: Idle action buttons */}
      {phase === 'idle' && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={startInAppDownload}
            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 px-3.5 py-2 text-xs font-bold text-white shadow-sm transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download Update</span>
          </button>
          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              className={`px-3 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                isDark
                  ? 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                  : 'bg-slate-200 hover:bg-slate-300 text-slate-700'
              }`}
            >
              Later
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export const AppUpdateNotification: React.FC = () => {
  const [updateResult, setUpdateResult] = useState<AppUpdateCheckResult | null>(null);
  const [dismissedVersion, setDismissedVersion] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem('pariksha_dismissed_update_version');
    } catch {
      return null;
    }
  });

  useEffect(() => {
    let isMounted = true;

    const runCheck = async () => {
      const result = await checkForAppUpdate();
      if (isMounted && result.updateAvailable && result.latestManifest) {
        setUpdateResult(result);
      }
    };

    // Non-blocking background check after startup
    const timer = setTimeout(runCheck, 1500);

    const handleOnline = () => {
      runCheck();
    };
    window.addEventListener('online', handleOnline);

    return () => {
      isMounted = false;
      clearTimeout(timer);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  if (
    !updateResult ||
    !updateResult.updateAvailable ||
    !updateResult.latestManifest ||
    dismissedVersion === updateResult.latestManifest.versionName
  ) {
    return null;
  }

  const { latestManifest, currentVersionName } = updateResult;

  const handleDismiss = () => {
    setDismissedVersion(latestManifest.versionName);
    try {
      sessionStorage.setItem('pariksha_dismissed_update_version', latestManifest.versionName);
    } catch {
      // Ignore storage error
    }
  };

  return (
    <div
      role="dialog"
      aria-label="App Update Available"
      className="fixed bottom-4 right-4 z-50 w-[calc(100vw-2rem)] max-w-sm rounded-2xl bg-slate-900 text-white border border-indigo-500/40 p-4 shadow-2xl"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-bold text-white">App Update Available</h4>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                v{latestManifest.versionName}
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Installed: v{currentVersionName} &rarr; Latest: v{latestManifest.versionName}
            </p>
          </div>
        </div>
        <button
          onClick={handleDismiss}
          aria-label="Close"
          className="text-slate-400 hover:text-white p-1 cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {latestManifest.releaseNotes && (
        <p className="mt-2.5 text-xs text-slate-300 bg-slate-800/80 rounded-xl p-2.5 border border-slate-700/70 line-clamp-3">
          {latestManifest.releaseNotes}
        </p>
      )}

      <div className="mt-2.5 flex items-start gap-1.5 text-[11px] text-emerald-300/90">
        <ShieldCheck className="w-3.5 h-3.5 shrink-0 mt-0.5 text-emerald-400" />
        <span>
          Downloads directly inside ParikshaSetu and updates in-place without clearing your offline tests or account data.
        </span>
      </div>

      <div className="mt-3.5">
        <InAppUpdateActionPanel
          manifest={latestManifest}
          theme="dark"
          onDismiss={handleDismiss}
        />
      </div>
    </div>
  );
};
