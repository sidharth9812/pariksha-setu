import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';

export const ANDROID_PACKAGE_ID = 'com.parikshasetu.app';
export const DEFAULT_APP_VERSION = (import.meta as any).env?.VITE_APP_VERSION || '1.0.0';
export const DEFAULT_APP_VERSION_CODE = Number((import.meta as any).env?.VITE_APP_VERSION_CODE) || 1;

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
 * Compares two semantic version strings (e.g. "1.2.0" vs "1.0.0" or "v1.0.1" vs "1.0.0").
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
  if (manifest.appId && manifest.appId !== ANDROID_PACKAGE_ID) {
    return false;
  }

  // 2. Require valid HTTPS download URL and strictly exclude debug builds
  const downloadUrl = String(manifest.downloadUrl).trim();
  if (!downloadUrl.startsWith('https://')) {
    return false;
  }
  if (
    downloadUrl.toLowerCase().includes('-debug.apk') ||
    (manifest.apkFileName && manifest.apkFileName.toLowerCase().includes('-debug.apk'))
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
 * Helper to fetch JSON with a strict timeout and cache: 'no-store'
 * so network errors never hang or block app startup.
 */
async function fetchJsonWithTimeout<T>(url: string, timeoutMs = 8000): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const separator = url.includes('?') ? '&' : '?';
    const bustUrl = `${url}${separator}_t=${Date.now()}`;
    const response = await fetch(bustUrl, {
      method: 'GET',
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
      },
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
function parseManifestObject(raw: any): AppVersionManifest | null {
  if (!raw || typeof raw !== 'object') return null;

  const versionName = String(raw.versionName || raw.version || raw.tag_name || '')
    .trim()
    .replace(/^[vV]/, '');
  if (!versionName) return null;

  const versionCode = Number(raw.versionCode || raw.buildNumber || 0) || 0;
  const appId = String(raw.appId || raw.packageId || ANDROID_PACKAGE_ID).trim();
  const downloadUrl = String(raw.downloadUrl || raw.apkUrl || raw.url || '').trim();
  const apkFileName = raw.apkFileName ? String(raw.apkFileName).trim() : `ParikshaSetu-v${versionName}-release.apk`;
  const releaseNotes = raw.releaseNotes || raw.notes || raw.body ? String(raw.releaseNotes || raw.notes || raw.body).trim() : undefined;
  const publishedAt = raw.publishedAt || raw.published_at || raw.releaseDate ? String(raw.publishedAt || raw.published_at || raw.releaseDate) : undefined;

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
 * Checks for a genuinely newer production release APK using the configured
 * GitHub-hosted release/version manifest.
 *
 * Never blocks app startup and handles offline/network errors silently.
 */
export async function checkForAppUpdate(options?: {
  customManifestUrl?: string;
  githubRepo?: string;
}): Promise<AppUpdateCheckResult> {
  const installed = await getInstalledAppVersion();
  const checkedAt = new Date().toISOString();

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

  // Skip update prompts on explicitly marked debug builds unless manually checking
  const envManifestUrl = String(
    options?.customManifestUrl || (import.meta as any).env?.VITE_UPDATE_MANIFEST_URL || ''
  ).trim();
  const envGithubRepo = String(
    options?.githubRepo || (import.meta as any).env?.VITE_GITHUB_REPO || ''
  )
    .trim()
    .replace(/^https?:\/\/github\.com\//i, '')
    .replace(/\.git$/i, '')
    .replace(/^\/+|\/+$/g, '');

  try {
    // 1. Check explicit GitHub-hosted / custom version.json manifest URL if provided
    if (envManifestUrl && envManifestUrl.startsWith('https://')) {
      const rawData = await fetchJsonWithTimeout<any>(envManifestUrl);
      const manifest = parseManifestObject(rawData);
      if (manifest && isGenuinelyNewerRelease(manifest, installed.versionName, installed.versionCode)) {
        return {
          updateAvailable: true,
          currentVersionName: installed.versionName,
          currentVersionCode: installed.versionCode,
          latestManifest: manifest,
          checkedAt,
          source: envManifestUrl,
        };
      }
      if (manifest) {
        return {
          updateAvailable: false,
          currentVersionName: installed.versionName,
          currentVersionCode: installed.versionCode,
          latestManifest: manifest,
          checkedAt,
          source: envManifestUrl,
          statusMessage: `You are running the latest version (v${installed.versionName}).`,
        };
      }
    }

    // 2. Check repository's GitHub Releases API & raw version.json manifest if repository is configured
    if (envGithubRepo && /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(envGithubRepo)) {
      // 2a. Query GitHub Latest Release API (supports CORS in Android WebView and provides official release asset URLs)
      const releaseApiUrl = `https://api.github.com/repos/${envGithubRepo}/releases/latest`;
      const releaseData = await fetchJsonWithTimeout<any>(releaseApiUrl);

      if (releaseData && !releaseData.draft && !releaseData.prerelease) {
        const assets: any[] = Array.isArray(releaseData.assets) ? releaseData.assets : [];

        // Find the signed production release APK asset (ParikshaSetu-v*-release.apk)
        const releaseApkAsset =
          assets.find(
            (a) =>
              typeof a?.name === 'string' &&
              a.name.endsWith('-release.apk') &&
              typeof a?.browser_download_url === 'string'
          ) ||
          assets.find(
            (a) =>
              typeof a?.name === 'string' &&
              a.name.endsWith('.apk') &&
              !a.name.toLowerCase().includes('-debug.apk') &&
              typeof a?.browser_download_url === 'string'
          );

        const releaseVersionName = String(releaseData.tag_name || releaseData.name || '')
          .trim()
          .replace(/^[vV]/, '');

        // Also check raw version.json from the repository if we want exact versionCode metadata
        let manifestVersionCode = 0;
        let manifestAppId = ANDROID_PACKAGE_ID;
        const rawManifestData = await fetchJsonWithTimeout<any>(
          `https://raw.githubusercontent.com/${envGithubRepo}/main/public/version.json`
        );
        const parsedRawManifest = parseManifestObject(rawManifestData);
        if (parsedRawManifest && parsedRawManifest.versionName === releaseVersionName) {
          manifestVersionCode = parsedRawManifest.versionCode;
          manifestAppId = parsedRawManifest.appId;
        }

        if (releaseVersionName && releaseApkAsset?.browser_download_url) {
          const candidateManifest: AppVersionManifest = {
            appId: manifestAppId,
            versionName: releaseVersionName,
            versionCode: manifestVersionCode,
            apkFileName: releaseApkAsset.name,
            downloadUrl: releaseApkAsset.browser_download_url,
            releaseNotes: releaseData.body ? String(releaseData.body).trim() : undefined,
            publishedAt: releaseData.published_at || undefined,
          };

          if (isGenuinelyNewerRelease(candidateManifest, installed.versionName, installed.versionCode)) {
            return {
              updateAvailable: true,
              currentVersionName: installed.versionName,
              currentVersionCode: installed.versionCode,
              latestManifest: candidateManifest,
              checkedAt,
              source: releaseApiUrl,
            };
          }

          return {
            updateAvailable: false,
            currentVersionName: installed.versionName,
            currentVersionCode: installed.versionCode,
            latestManifest: candidateManifest,
            checkedAt,
            source: releaseApiUrl,
            statusMessage: `You are running the latest version (v${installed.versionName}).`,
          };
        }
      }

      // 2b. Fallback: Check raw version.json hosted in the repository's default branch
      const rawBranchManifestUrl = `https://raw.githubusercontent.com/${envGithubRepo}/main/public/version.json`;
      const rawManifest = parseManifestObject(await fetchJsonWithTimeout<any>(rawBranchManifestUrl));
      if (rawManifest) {
        // If downloadUrl wasn't populated in public/version.json, derive the official GitHub Release download URL
        if (!rawManifest.downloadUrl && rawManifest.versionName) {
          const fileName = rawManifest.apkFileName || `ParikshaSetu-v${rawManifest.versionName}-release.apk`;
          rawManifest.downloadUrl = `https://github.com/${envGithubRepo}/releases/download/v${rawManifest.versionName}/${fileName}`;
        }

        if (isGenuinelyNewerRelease(rawManifest, installed.versionName, installed.versionCode)) {
          return {
            updateAvailable: true,
            currentVersionName: installed.versionName,
            currentVersionCode: installed.versionCode,
            latestManifest: rawManifest,
            checkedAt,
            source: rawBranchManifestUrl,
          };
        }

        return {
          updateAvailable: false,
          currentVersionName: installed.versionName,
          currentVersionCode: installed.versionCode,
          latestManifest: rawManifest,
          checkedAt,
          source: rawBranchManifestUrl,
          statusMessage: `You are running the latest version (v${installed.versionName}).`,
        };
      }
    }

    return {
      updateAvailable: false,
      currentVersionName: installed.versionName,
      currentVersionCode: installed.versionCode,
      checkedAt,
      statusMessage: `Installed version v${installed.versionName} is up to date.`,
    };
  } catch (err) {
    console.warn('Non-blocking APK version check failed:', err);
    return {
      updateAvailable: false,
      currentVersionName: installed.versionName,
      currentVersionCode: installed.versionCode,
      checkedAt,
      statusMessage: 'Could not reach update server. Please check your internet connection.',
    };
  }
}

/**
 * Triggers downloading the official signed Release APK via Android's external browser /
 * Download Manager so that Android's normal system Package Installer performs an
 * in-place update without uninstalling or clearing user data.
 */
export function openOfficialApkDownload(downloadUrl: string): void {
  const cleanUrl = String(downloadUrl || '').trim();
  if (!cleanUrl.startsWith('https://') || cleanUrl.toLowerCase().includes('-debug.apk')) {
    return;
  }

  const anchor = document.createElement('a');
  anchor.href = cleanUrl;
  anchor.target = '_blank';
  anchor.rel = 'noopener noreferrer';
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  setTimeout(() => {
    if (anchor.parentNode) {
      anchor.parentNode.removeChild(anchor);
    }
  }, 200);
}
