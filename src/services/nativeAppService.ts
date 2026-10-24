import { Capacitor, registerPlugin, PluginListenerHandle } from '@capacitor/core';
import { App } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';

export const ANDROID_PACKAGE_ID = 'com.parikshasetu.app';
export const DEFAULT_GITHUB_REPO = 'sidharth9812/pariksha-setu';
export const STABLE_VERSION_MANIFEST_URL =
  'https://raw.githubusercontent.com/sidharth9812/pariksha-setu/main/public/version.json';
export const DEFAULT_APP_VERSION = (import.meta as any).env?.VITE_APP_VERSION || '1.1.8';
export const DEFAULT_APP_VERSION_CODE = Number((import.meta as any).env?.VITE_APP_VERSION_CODE) || 10;
export const BUILD_MODE = (import.meta as any).env?.VITE_BUILD_MODE || 'release';

export interface AppVersionManifest {
  appId: string;
  versionName: string;
  versionCode: number;
  apkFileName?: string;
  downloadUrl: string;
  releaseNotes?: string;
  publishedAt?: string;
}

export interface InstalledAppVersion {
  appId: string;
  versionName: string;
  versionCode: number;
  isNativeAndroid: boolean;
}

export interface AppUpdateCheckResult {
  updateAvailable: boolean;
  currentVersionName: string;
  currentVersionCode: number;
  latestManifest?: AppVersionManifest;
  checkedAt: string;
  source?: string;
  statusMessage?: string;
}

export interface ApkDownloadProgressEvent {
  status: 'starting' | 'downloading' | 'completed' | 'cancelled' | 'error';
  progress: number;
  bytesDownloaded: number;
  totalBytes: number;
}

export interface ApkInstallResult {
  status: 'INSTALLER_LAUNCHED' | 'PERMISSION_REQUIRED';
  fileName?: string;
  bytesDownloaded?: number;
  message?: string;
}

interface ApkUpdaterPluginInterface {
  checkInstallPermission(): Promise<{
    granted: boolean;
    hasPendingApk: boolean;
    fileName?: string;
  }>;
  openInstallPermissionSettings(): Promise<{ opened: boolean }>;
  downloadAndInstallApk(options: {
    downloadUrl: string;
    apkFileName: string;
  }): Promise<ApkInstallResult>;
  installDownloadedApk(options?: { apkFileName?: string }): Promise<ApkInstallResult>;
  cancelDownload(): Promise<{ cancelled: boolean }>;
  addListener(
    eventName: 'downloadProgress',
    listenerFunc: (event: ApkDownloadProgressEvent) => void
  ): Promise<PluginListenerHandle>;
}

const ApkUpdater = registerPlugin<ApkUpdaterPluginInterface>('ApkUpdater');

/**
 * Initializes native Android / Capacitor specific behaviors:
 * 1. Status bar styling (dark slate background matching ParikshaSetu theme)
 * 2. Hardware back button handling:
 *    - Respects browser/app navigation history
 *    - Prevents sudden accidental app exit during active operations
 */
export async function initializeNativeApp() {
  if (!Capacitor.isNativePlatform()) {
    return;
  }

  try {
    // 1. Configure Status Bar
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setBackgroundColor({ color: '#1e293b' });
  } catch (err) {
    console.warn('Status bar configuration error:', err);
  }

  try {
    // 2. Hardware Back Button Listener
    await App.addListener('backButton', ({ canGoBack }) => {
      // If modal or full-screen overlay is open, custom handlers can capture it
      const hasActiveModal = document.querySelector('[role="dialog"], .modal-open, #confirm-modal');
      if (hasActiveModal) {
        const closeBtn = hasActiveModal.querySelector('button[aria-label="Close"], button.close-modal') as HTMLButtonElement | null;
        if (closeBtn) {
          closeBtn.click();
          return;
        }
      }

      // Check if browser navigation history has entries
      if (canGoBack && window.history.length > 1) {
        window.history.back();
      } else {
        // Double-tap or exit confirmation at root screen
        const shouldExit = window.confirm('Do you want to exit ParikshaSetu?');
        if (shouldExit) {
          App.exitApp();
        }
      }
    });
  } catch (err) {
    console.warn('Back button listener registration error:', err);
  }
}

/**
 * Retrieves the currently installed app version and package ID.
 * On Android Capacitor, queries native PackageInfo via @capacitor/app.
 * Falls back to build-time version metadata from android/app/build.gradle & package.json.
 */
export async function getInstalledAppVersion(): Promise<InstalledAppVersion> {
  const isNative = Capacitor.isNativePlatform();
  if (isNative) {
    try {
      const info = await App.getInfo();
      const parsedCode = parseInt(String(info.build || ''), 10);
      return {
        appId: info.id || ANDROID_PACKAGE_ID,
        versionName: (info.version || DEFAULT_APP_VERSION).trim(),
        versionCode: !Number.isNaN(parsedCode) && parsedCode > 0 ? parsedCode : DEFAULT_APP_VERSION_CODE,
        isNativeAndroid: true,
      };
    } catch (err) {
      console.warn('Could not read native app info, using build defaults:', err);
    }
  }

  return {
    appId: ANDROID_PACKAGE_ID,
    versionName: String(DEFAULT_APP_VERSION).trim(),
    versionCode: DEFAULT_APP_VERSION_CODE,
    isNativeAndroid: isNative,
  };
}

/**
 * Compares two semantic version strings (e.g. "1.1.0" vs "1.0.0" or "v1.0.1" vs "1.0.0").
 * Returns:
 *   1 if remoteVer > currentVer
 *  -1 if remoteVer < currentVer
 *   0 if equal
 */
export function compareSemanticVersions(remoteVer: string, currentVer: string): number {
  const cleanRemote = String(remoteVer || '')
    .trim()
    .replace(/^[vV]/, '')
    .split('+')[0];
  const cleanCurrent = String(currentVer || '')
    .trim()
    .replace(/^[vV]/, '')
    .split('+')[0];

  if (!cleanRemote || !cleanCurrent) return 0;
  if (cleanRemote === cleanCurrent) return 0;

  const [remoteCore, remotePre] = cleanRemote.split('-', 2);
  const [currentCore, currentPre] = cleanCurrent.split('-', 2);

  const remoteParts = remoteCore.split('.').map((n) => parseInt(n, 10) || 0);
  const currentParts = currentCore.split('.').map((n) => parseInt(n, 10) || 0);

  const maxLen = Math.max(remoteParts.length, currentParts.length, 3);
  for (let i = 0; i < maxLen; i++) {
    const r = remoteParts[i] ?? 0;
    const c = currentParts[i] ?? 0;
    if (r > c) return 1;
    if (r < c) return -1;
  }

  // Stable release is newer than a pre-release of the same core version (e.g., 1.0.0 > 1.0.0-beta.1)
  if (!remotePre && currentPre) return 1;
  if (remotePre && !currentPre) return -1;
  if (remotePre && currentPre) {
    return remotePre.localeCompare(currentPre);
  }

  return 0;
}

/**
 * Validates that a candidate release manifest is:
 * 1. Targeted for the exact package ID (com.parikshasetu.app)
 * 2. Pointing to a valid HTTPS official release APK URL (never a debug APK)
 * 3. Genuinely newer than the currently installed versionName / versionCode
 */
export function isGenuinelyNewerRelease(
  manifest: Partial<AppVersionManifest> | null | undefined,
  currentVersionName: string,
  currentVersionCode: number
): manifest is AppVersionManifest {
  if (!manifest || !manifest.versionName || !manifest.downloadUrl) {
    return false;
  }

  // 1. Enforce exact Android package ID
  if (manifest.appId !== ANDROID_PACKAGE_ID) {
    return false;
  }

  // 2. Require valid HTTPS download URL pointing exclusively to official GitHub Releases APK and exclude debug builds
  const downloadUrl = String(manifest.downloadUrl).trim();
  const officialReleasePrefix = `https://github.com/${DEFAULT_GITHUB_REPO}/releases/download/`;
  try {
    const parsedUrl = new URL(downloadUrl);
    if (
      parsedUrl.protocol !== 'https:' ||
      parsedUrl.hostname.toLowerCase() !== 'github.com' ||
      !downloadUrl.startsWith(officialReleasePrefix)
    ) {
      return false;
    }
  } catch {
    return false;
  }

  const lowerUrl = downloadUrl.toLowerCase();
  const lowerFile = String(manifest.apkFileName || '').toLowerCase();
  if (
    !lowerUrl.endsWith('.apk') ||
    lowerUrl.includes('-debug.apk') ||
    lowerUrl.includes('/debug/') ||
    lowerFile.includes('-debug.apk')
  ) {
    return false;
  }

  const remoteCode = typeof manifest.versionCode === 'number' ? manifest.versionCode : Number(manifest.versionCode) || 0;

  // 3. Prevent Android versionCode downgrade (which would fail in-place installation)
  if (remoteCode > 0 && currentVersionCode > 0 && remoteCode < currentVersionCode) {
    return false;
  }

  // 4. Compare semantic version and versionCode
  const semverDiff = compareSemanticVersions(manifest.versionName, currentVersionName);
  if (semverDiff > 0) {
    return true;
  }
  if (semverDiff === 0 && remoteCode > 0 && currentVersionCode > 0 && remoteCode > currentVersionCode) {
    return true;
  }

  return false;
}

/**
 * Helper to fetch the public JSON manifest without authentication, tokens, or cookies,
 * using a strict timeout and cache: 'no-store' so network errors never block app startup.
 */
async function fetchPublicJsonManifest<T>(url: string, timeoutMs = 8000): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: 'GET',
      cache: 'no-store',
      credentials: 'omit',
      signal: controller.signal,
    });
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Parses a raw JSON manifest object into a normalized AppVersionManifest.
 */
export function parseManifestObject(raw: any): AppVersionManifest | null {
  if (!raw || typeof raw !== 'object') return null;

  const versionName = String(raw.versionName || raw.version || '')
    .trim()
    .replace(/^[vV]/, '');
  if (!versionName) return null;

  const versionCode = Number(raw.versionCode || 0) || 0;
  const appId = String(raw.appId || '').trim();
  const downloadUrl = String(raw.downloadUrl || '').trim();
  if (!appId || !downloadUrl) return null;

  const apkFileName = raw.apkFileName
    ? String(raw.apkFileName).trim()
    : `ParikshaSetu-v${versionName}-release.apk`;
  const releaseNotes = raw.releaseNotes ? String(raw.releaseNotes).trim() : undefined;
  const publishedAt = raw.publishedAt ? String(raw.publishedAt).trim() : undefined;

  return {
    appId,
    versionName,
    versionCode,
    apkFileName,
    downloadUrl,
    releaseNotes,
    publishedAt,
  };
}

/**
 * Checks for a genuinely newer production release APK using the public
 * GitHub-hosted release/version manifest:
 * https://raw.githubusercontent.com/sidharth9812/pariksha-setu/main/public/version.json
 *
 * Uses unauthenticated HTTPS GET (no GitHub token), excludes debug builds from
 * production update notifications, never blocks app startup, and handles
 * offline/network errors gracefully.
 */
export async function checkForAppUpdate(options?: {
  customManifestUrl?: string;
  isManualCheck?: boolean;
}): Promise<AppUpdateCheckResult> {
  const installed = await getInstalledAppVersion();
  const checkedAt = new Date().toISOString();

  // Keep debug builds excluded from automatic production update notifications
  if (!options?.isManualCheck && String(BUILD_MODE).toLowerCase() === 'debug') {
    return {
      updateAvailable: false,
      currentVersionName: installed.versionName,
      currentVersionCode: installed.versionCode,
      checkedAt,
      statusMessage: 'Debug build excluded from production update notifications.',
    };
  }

  // Do not perform network requests when offline
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return {
      updateAvailable: false,
      currentVersionName: installed.versionName,
      currentVersionCode: installed.versionCode,
      checkedAt,
      statusMessage: 'Device is currently offline.',
    };
  }

  const manifestUrl = String(
    options?.customManifestUrl ||
      (import.meta as any).env?.VITE_UPDATE_MANIFEST_URL ||
      STABLE_VERSION_MANIFEST_URL
  ).trim();

  try {
    const rawData = await fetchPublicJsonManifest<any>(manifestUrl);
    const manifest = parseManifestObject(rawData);

    if (manifest) {
      if (isGenuinelyNewerRelease(manifest, installed.versionName, installed.versionCode)) {
        return {
          updateAvailable: true,
          currentVersionName: installed.versionName,
          currentVersionCode: installed.versionCode,
          latestManifest: manifest,
          checkedAt,
          source: manifestUrl,
        };
      }

      return {
        updateAvailable: false,
        currentVersionName: installed.versionName,
        currentVersionCode: installed.versionCode,
        latestManifest: manifest,
        checkedAt,
        source: manifestUrl,
        statusMessage: `You are running the latest version (v${installed.versionName}).`,
      };
    }

    return {
      updateAvailable: false,
      currentVersionName: installed.versionName,
      currentVersionCode: installed.versionCode,
      checkedAt,
      source: manifestUrl,
      statusMessage: `Installed version v${installed.versionName} is up to date.`,
    };
  } catch (err) {
    console.warn('Non-blocking APK version check failed:', err);
    return {
      updateAvailable: false,
      currentVersionName: installed.versionName,
      currentVersionCode: installed.versionCode,
      checkedAt,
      source: manifestUrl,
      statusMessage: 'Could not reach update manifest. Please check your internet connection.',
    };
  }
}

/**
 * Formats byte count into a human-readable string (e.g. "14.2 MB").
 */
export function formatByteSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB';
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Checks whether the current Android app has permission to install unknown apps
 * (REQUEST_INSTALL_PACKAGES) and whether an APK is already downloaded in cache.
 */
export async function checkUnknownSourcesPermission(): Promise<{
  granted: boolean;
  hasPendingApk: boolean;
  fileName?: string;
}> {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') {
    return { granted: false, hasPendingApk: false };
  }
  try {
    return await ApkUpdater.checkInstallPermission();
  } catch {
    return { granted: false, hasPendingApk: false };
  }
}

/**
 * Opens the Android system screen "Install unknown apps" specifically for
 * com.parikshasetu.app so the user can toggle "Allow from this source".
 */
export async function openUnknownSourcesSettings(): Promise<void> {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') {
    return;
  }
  await ApkUpdater.openInstallPermissionSettings();
}

/**
 * Launches the Android system Package Installer for an APK that has already been
 * downloaded into the app's private cache directory via FileProvider (content:// URI).
 */
export async function installPendingDownloadedApk(apkFileName?: string): Promise<ApkInstallResult> {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') {
    throw new Error('In-app APK installation is only supported inside the ParikshaSetu Android app.');
  }
  return await ApkUpdater.installDownloadedApk({ apkFileName });
}

/**
 * Cancels an active in-app APK download and removes the partial file.
 */
export async function cancelInAppApkDownload(): Promise<void> {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') {
    return;
  }
  try {
    await ApkUpdater.cancelDownload();
  } catch {
    // Ignore cancel errors
  }
}

/**
 * Downloads the signed production release APK directly inside the Android app
 * (into app-private cache storage) with real-time progress reporting, then launches
 * Android's native Package Installer via FileProvider (content:// URI) without
 * opening Chrome or any external browser.
 */
export async function downloadAndInstallOfficialApk(
  manifest: AppVersionManifest,
  onProgress?: (event: ApkDownloadProgressEvent) => void
): Promise<ApkInstallResult> {
  const cleanUrl = String(manifest.downloadUrl || '').trim();
  const apkFileName = String(
    manifest.apkFileName || `ParikshaSetu-v${manifest.versionName}-release.apk`
  ).trim();

  const officialReleasePrefix = `https://github.com/${DEFAULT_GITHUB_REPO}/releases/download/`;
  if (
    !cleanUrl.startsWith(officialReleasePrefix) ||
    !cleanUrl.toLowerCase().endsWith('.apk') ||
    cleanUrl.toLowerCase().includes('-debug.apk')
  ) {
    throw new Error('Blocked untrusted or non-production APK download URL.');
  }

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    throw new Error('No internet connection. Please connect to the internet and try again.');
  }

  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') {
    throw new Error(
      'In-app APK updates are available inside the installed ParikshaSetu Android app. On web, updates are applied automatically.'
    );
  }

  let listenerHandle: PluginListenerHandle | null = null;
  try {
    if (onProgress) {
      listenerHandle = await ApkUpdater.addListener('downloadProgress', (event) => {
        onProgress(event);
      });
    }

    const result = await ApkUpdater.downloadAndInstallApk({
      downloadUrl: cleanUrl,
      apkFileName,
    });
    return result;
  } catch (err: any) {
    const rawMsg = err?.message || String(err || '');
    throw new Error(
      rawMsg || 'Failed to download update APK. Please check your internet connection and retry.'
    );
  } finally {
    if (listenerHandle) {
      try {
        await listenerHandle.remove();
      } catch {
        // Ignore listener removal error
      }
    }
  }
}
