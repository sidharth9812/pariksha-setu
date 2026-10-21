import React, { useState, useEffect } from 'react';
import { Download, Share, X, Smartphone, Sparkles, ShieldCheck, ExternalLink } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import {
  checkForAppUpdate,
  openOfficialApkDownload,
  AppUpdateCheckResult,
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
                    Tap the <strong className="text-slate-900 dark:text-white inline-flex items-center gap-1">Share <Share className="w-3 h-3 inline" /></strong> button in Safari's bottom toolbar.
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
      <span>Offline Mode — Cached exams & data active</span>
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
          Your offline practice tests, saved answers, and account data are preserved during in-place updates.
        </span>
      </div>

      <div className="mt-3.5 flex items-center gap-2">
        <a
          href={latestManifest.downloadUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => {
            e.preventDefault();
            openOfficialApkDownload(latestManifest.downloadUrl);
          }}
          className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 px-3.5 py-2 text-xs font-bold text-white shadow-sm transition-colors cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Download Update</span>
          <ExternalLink className="w-3 h-3 opacity-80" />
        </a>
        <button
          onClick={handleDismiss}
          className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
        >
          Later
        </button>
      </div>
    </div>
  );
};

