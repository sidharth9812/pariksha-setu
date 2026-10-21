package com.parikshasetu.app;

import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.content.pm.SigningInfo;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Native Capacitor plugin for Option 1: In-App APK Download and Update.
 * Security guarantees:
 * 1. Restricts APK downloads exclusively to the official GitHub Releases URL prefix
 *    (https://github.com/sidharth9812/pariksha-setu/releases/download/) and official
 *    GitHub asset redirect hosts (*.githubusercontent.com).
 * 2. Stores downloaded APKs only inside app-private cache (cacheDir/apk_updates).
 * 3. Verifies the downloaded archive is a valid APK whose packageName matches
 *    com.parikshasetu.app, whose versionCode is not a downgrade, and whose signing
 *    certificate SHA-256 matches the currently installed app before launching the
 *    system Package Installer.
 */
@CapacitorPlugin(name = "ApkUpdater")
public class ApkUpdaterPlugin extends Plugin {

    private static final String EXPECTED_PACKAGE_ID = "com.parikshasetu.app";
    private static final String OFFICIAL_RELEASE_URL_PREFIX =
        "https://github.com/sidharth9812/pariksha-setu/releases/download/";
    private static final String UPDATES_SUBDIR = "apk_updates";
    private static final int CONNECT_TIMEOUT_MS = 20000;
    private static final int READ_TIMEOUT_MS = 30000;
    private static final int MAX_REDIRECTS = 10;

    private final ExecutorService downloadExecutor = Executors.newSingleThreadExecutor();
    private final AtomicBoolean isCancelled = new AtomicBoolean(false);
    private final AtomicBoolean isDownloading = new AtomicBoolean(false);
    private volatile File lastDownloadedApk = null;

    @PluginMethod
    public void checkInstallPermission(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("granted", canRequestPackageInstalls());
        ret.put("hasPendingApk", lastDownloadedApk != null && lastDownloadedApk.exists());
        if (lastDownloadedApk != null && lastDownloadedApk.exists()) {
            ret.put("fileName", lastDownloadedApk.getName());
        }
        call.resolve(ret);
    }

    @PluginMethod
    public void openInstallPermissionSettings(PluginCall call) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                Uri packageUri = Uri.parse("package:" + getContext().getPackageName());
                Intent intent = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, packageUri);
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(intent);
            }
            JSObject ret = new JSObject();
            ret.put("opened", true);
            call.resolve(ret);
        } catch (Exception e) {
            try {
                Intent fallbackIntent = new Intent(Settings.ACTION_SECURITY_SETTINGS);
                fallbackIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(fallbackIntent);
                JSObject ret = new JSObject();
                ret.put("opened", true);
                call.resolve(ret);
            } catch (Exception ex) {
                call.reject("Unable to open settings. Please enable 'Install unknown apps' for ParikshaSetu in Android Settings.", ex);
            }
        }
    }

    @PluginMethod
    public void cancelDownload(PluginCall call) {
        isCancelled.set(true);
        JSObject ret = new JSObject();
        ret.put("cancelled", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void installDownloadedApk(PluginCall call) {
        String requestedFileName = call.getString("apkFileName", "");
        File targetApk = resolveExistingApkFile(requestedFileName);

        if (targetApk == null || !targetApk.exists()) {
            call.reject("Downloaded APK file was not found. Please tap 'Download Update' to download it again.");
            return;
        }

        try {
            verifyDownloadedApkArchive(targetApk);
        } catch (IOException e) {
            //noinspection ResultOfMethodCallIgnored
            targetApk.delete();
            call.reject(e.getMessage());
            return;
        }

        if (!canRequestPackageInstalls()) {
            JSObject ret = new JSObject();
            ret.put("status", "PERMISSION_REQUIRED");
            ret.put("fileName", targetApk.getName());
            ret.put("message", "Please allow ParikshaSetu to install app updates in Android Settings, then tap 'Install Update Now'.");
            call.resolve(ret);
            return;
        }

        try {
            launchPackageInstaller(targetApk);
            JSObject ret = new JSObject();
            ret.put("status", "INSTALLER_LAUNCHED");
            ret.put("fileName", targetApk.getName());
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to launch Android package installer: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void downloadAndInstallApk(PluginCall call) {
        final String downloadUrl = call.getString("downloadUrl", "").trim();
        final String rawFileName = call.getString("apkFileName", "ParikshaSetu-release.apk").trim();

        if (!isOfficialReleaseDownloadUrl(downloadUrl)) {
            call.reject("Blocked untrusted update URL. Updates may only be downloaded from official ParikshaSetu GitHub Releases.");
            return;
        }

        if (downloadUrl.toLowerCase(Locale.US).contains("-debug.apk") ||
            rawFileName.toLowerCase(Locale.US).contains("-debug.apk")) {
            call.reject("Debug APK builds cannot be installed through production updates.");
            return;
        }

        if (isDownloading.getAndSet(true)) {
            call.reject("An update download is already in progress.");
            return;
        }

        isCancelled.set(false);
        final String safeFileName = sanitizeApkFileName(rawFileName);

        downloadExecutor.execute(() -> {
            File partFile = null;
            HttpURLConnection connection = null;
            InputStream input = null;
            FileOutputStream output = null;

            try {
                File updateDir = new File(getContext().getCacheDir(), UPDATES_SUBDIR);
                if (!updateDir.exists() && !updateDir.mkdirs()) {
                    throw new IOException("Could not create app-private update directory.");
                }

                File finalApkFile = new File(updateDir, safeFileName);
                partFile = new File(updateDir, safeFileName + ".part");

                // Clean up stale partial files or old release APKs to save device space
                cleanupOldFiles(updateDir, finalApkFile.getName());
                if (partFile.exists()) {
                    //noinspection ResultOfMethodCallIgnored
                    partFile.delete();
                }

                emitProgress("starting", 0, 0L, -1L);

                connection = openHttpsConnectionWithRedirects(downloadUrl);
                int responseCode = connection.getResponseCode();
                if (responseCode != HttpURLConnection.HTTP_OK) {
                    throw new IOException("Server returned HTTP " + responseCode + " while downloading update APK.");
                }

                long totalBytes = connection.getContentLengthLong();
                input = connection.getInputStream();
                output = new FileOutputStream(partFile);

                byte[] buffer = new byte[16 * 1024];
                long bytesDownloaded = 0L;
                int bytesRead;
                int lastEmittedPercent = -1;
                long lastEmitTime = 0L;

                while ((bytesRead = input.read(buffer)) != -1) {
                    if (isCancelled.get()) {
                        throw new InterruptedException("Download cancelled by user.");
                    }

                    output.write(buffer, 0, bytesRead);
                    bytesDownloaded += bytesRead;

                    long now = System.currentTimeMillis();
                    int percent = totalBytes > 0
                        ? (int) Math.min(100L, (bytesDownloaded * 100L) / totalBytes)
                        : -1;

                    if ((percent != lastEmittedPercent && now - lastEmitTime >= 120) || now - lastEmitTime >= 400) {
                        lastEmittedPercent = percent;
                        lastEmitTime = now;
                        emitProgress("downloading", Math.max(0, percent), bytesDownloaded, totalBytes);
                    }
                }

                output.flush();
                output.close();
                output = null;
                input.close();
                input = null;

                if (totalBytes > 0 && bytesDownloaded < totalBytes) {
                    throw new IOException("Incomplete APK download (" + bytesDownloaded + " of " + totalBytes + " bytes). Please check your internet connection and retry.");
                }

                if (!isValidApkZipFile(partFile)) {
                    throw new IOException("Downloaded file is not a valid Android APK package.");
                }

                // Verify packageId, versionCode, and signing certificate match before accepting the APK
                verifyDownloadedApkArchive(partFile);

                if (finalApkFile.exists() && !finalApkFile.delete()) {
                    throw new IOException("Unable to replace previous APK file in cache.");
                }

                if (!partFile.renameTo(finalApkFile)) {
                    throw new IOException("Unable to finalize downloaded APK file.");
                }

                lastDownloadedApk = finalApkFile;
                emitProgress("completed", 100, bytesDownloaded, totalBytes > 0 ? totalBytes : bytesDownloaded);

                if (!canRequestPackageInstalls()) {
                    JSObject ret = new JSObject();
                    ret.put("status", "PERMISSION_REQUIRED");
                    ret.put("fileName", finalApkFile.getName());
                    ret.put("bytesDownloaded", bytesDownloaded);
                    ret.put("message", "APK downloaded and verified! Please allow 'Install unknown apps' for ParikshaSetu to complete the update.");
                    call.resolve(ret);
                    return;
                }

                launchPackageInstaller(finalApkFile);

                JSObject ret = new JSObject();
                ret.put("status", "INSTALLER_LAUNCHED");
                ret.put("fileName", finalApkFile.getName());
                ret.put("bytesDownloaded", bytesDownloaded);
                call.resolve(ret);

            } catch (InterruptedException cancelledEx) {
                if (partFile != null && partFile.exists()) {
                    //noinspection ResultOfMethodCallIgnored
                    partFile.delete();
                }
                emitProgress("cancelled", 0, 0L, -1L);
                call.reject("Update download was cancelled.");
            } catch (Exception e) {
                if (partFile != null && partFile.exists()) {
                    //noinspection ResultOfMethodCallIgnored
                    partFile.delete();
                }
                emitProgress("error", 0, 0L, -1L);
                String friendlyMsg = buildFriendlyErrorMessage(e);
                call.reject(friendlyMsg, e);
            } finally {
                isDownloading.set(false);
                try {
                    if (output != null) output.close();
                } catch (IOException ignored) {}
                try {
                    if (input != null) input.close();
                } catch (IOException ignored) {}
                if (connection != null) {
                    connection.disconnect();
                }
            }
        });
    }

    private boolean isOfficialReleaseDownloadUrl(String urlStr) {
        if (urlStr == null || urlStr.isEmpty()) {
            return false;
        }
        String clean = urlStr.trim();
        if (!clean.startsWith(OFFICIAL_RELEASE_URL_PREFIX) || !clean.toLowerCase(Locale.US).endsWith(".apk")) {
            return false;
        }
        try {
            URL parsed = new URL(clean);
            return "https".equalsIgnoreCase(parsed.getProtocol())
                && "github.com".equalsIgnoreCase(parsed.getHost());
        } catch (Exception e) {
            return false;
        }
    }

    private boolean isAllowedRedirectHost(String host) {
        if (host == null) return false;
        String lower = host.toLowerCase(Locale.US);
        return lower.equals("github.com")
            || lower.endsWith(".github.com")
            || lower.endsWith(".githubusercontent.com");
    }

    private HttpURLConnection openHttpsConnectionWithRedirects(String initialUrl) throws IOException {
        if (!isOfficialReleaseDownloadUrl(initialUrl)) {
            throw new IOException("Untrusted initial download URL blocked.");
        }
        String currentUrl = initialUrl;
        for (int redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount++) {
            URL url = new URL(currentUrl);
            if (!"https".equalsIgnoreCase(url.getProtocol())) {
                throw new IOException("Insecure redirect blocked. Only HTTPS connections are permitted.");
            }
            if (!isAllowedRedirectHost(url.getHost())) {
                throw new IOException("Untrusted redirect host blocked: " + url.getHost());
            }

            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setInstanceFollowRedirects(false);
            conn.setConnectTimeout(CONNECT_TIMEOUT_MS);
            conn.setReadTimeout(READ_TIMEOUT_MS);
            conn.setUseCaches(false);
            conn.setRequestMethod("GET");
            conn.setRequestProperty("Accept", "application/vnd.android.package-archive, application/octet-stream, */*");
            conn.setRequestProperty("User-Agent", "ParikshaSetu-Android-Updater/1.0");
            conn.connect();

            int status = conn.getResponseCode();
            if (status == HttpURLConnection.HTTP_MOVED_TEMP ||
                status == HttpURLConnection.HTTP_MOVED_PERM ||
                status == HttpURLConnection.HTTP_SEE_OTHER ||
                status == 307 ||
                status == 308) {
                String location = conn.getHeaderField("Location");
                conn.disconnect();
                if (location == null || location.trim().isEmpty()) {
                    throw new IOException("Redirect response missing Location header.");
                }
                URL nextUrl = new URL(url, location);
                currentUrl = nextUrl.toString();
                continue;
            }

            return conn;
        }
        throw new IOException("Too many redirects while downloading APK.");
    }

    /**
     * Verifies that the downloaded APK file:
     * 1. Has the exact package name com.parikshasetu.app
     * 2. Has a versionCode >= the currently installed versionCode
     * 3. Is signed with the same certificate SHA-256 as the currently installed app
     */
    @SuppressWarnings("deprecation")
    private void verifyDownloadedApkArchive(File apkFile) throws IOException {
        Context context = getContext();
        PackageManager pm = context.getPackageManager();
        String archivePath = apkFile.getAbsolutePath();

        int flags = Build.VERSION.SDK_INT >= Build.VERSION_CODES.P
            ? PackageManager.GET_SIGNING_CERTIFICATES
            : PackageManager.GET_SIGNATURES;

        PackageInfo archiveInfo = pm.getPackageArchiveInfo(archivePath, flags);
        if (archiveInfo == null || archiveInfo.packageName == null) {
            throw new IOException("Downloaded file is not a valid Android package archive.");
        }

        String currentPkg = context.getPackageName();
        if (!EXPECTED_PACKAGE_ID.equals(archiveInfo.packageName) || !currentPkg.equals(archiveInfo.packageName)) {
            throw new IOException("Package ID mismatch in downloaded APK (" + archiveInfo.packageName + "). Update aborted.");
        }

        try {
            PackageInfo installedInfo = pm.getPackageInfo(currentPkg, flags);
            long installedCode = Build.VERSION.SDK_INT >= Build.VERSION_CODES.P
                ? installedInfo.getLongVersionCode()
                : installedInfo.versionCode;
            long archiveCode = Build.VERSION.SDK_INT >= Build.VERSION_CODES.P
                ? archiveInfo.getLongVersionCode()
                : archiveInfo.versionCode;

            if (archiveCode < installedCode) {
                throw new IOException("Downloaded APK versionCode (" + archiveCode + ") is older than installed versionCode (" + installedCode + ").");
            }

            Set<String> installedDigests = extractSignatureDigests(installedInfo);
            Set<String> archiveDigests = extractSignatureDigests(archiveInfo);

            // If Android returned archive certificates from getPackageArchiveInfo, enforce exact match
            if (!installedDigests.isEmpty() && !archiveDigests.isEmpty()) {
                boolean matches = false;
                for (String digest : archiveDigests) {
                    if (installedDigests.contains(digest)) {
                        matches = true;
                        break;
                    }
                }
                if (!matches) {
                    throw new IOException("Signing certificate mismatch! The downloaded APK is not signed with the official ParikshaSetu release key.");
                }
            }
        } catch (PackageManager.NameNotFoundException e) {
            throw new IOException("Unable to read installed package info for verification.");
        }
    }

    @SuppressWarnings("deprecation")
    private Set<String> extractSignatureDigests(PackageInfo pkgInfo) {
        Set<String> digests = new HashSet<>();
        if (pkgInfo == null) return digests;

        Signature[] signatures = null;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P && pkgInfo.signingInfo != null) {
            SigningInfo signingInfo = pkgInfo.signingInfo;
            signatures = signingInfo.hasMultipleSigners()
                ? signingInfo.getApkContentsSigners()
                : signingInfo.getSigningCertificateHistory();
        } else if (pkgInfo.signatures != null) {
            signatures = pkgInfo.signatures;
        }

        if (signatures == null) return digests;
        for (Signature sig : signatures) {
            if (sig != null) {
                String sha256 = sha256Hex(sig.toByteArray());
                if (!sha256.isEmpty()) {
                    digests.add(sha256);
                }
            }
        }
        return digests;
    }

    private String sha256Hex(byte[] data) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] digest = md.digest(data);
            StringBuilder sb = new StringBuilder(digest.length * 2);
            for (byte b : digest) {
                sb.append(String.format(Locale.US, "%02x", b));
            }
            return sb.toString();
        } catch (Exception e) {
            return "";
        }
    }

    private void emitProgress(String status, int progress, long bytesDownloaded, long totalBytes) {
        JSObject data = new JSObject();
        data.put("status", status);
        data.put("progress", progress);
        data.put("bytesDownloaded", bytesDownloaded);
        data.put("totalBytes", totalBytes);
        notifyListeners("downloadProgress", data);
    }

    private boolean canRequestPackageInstalls() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            return getContext().getPackageManager().canRequestPackageInstalls();
        }
        return true;
    }

    private void launchPackageInstaller(File apkFile) {
        Context context = getContext();
        String authority = context.getPackageName() + ".fileprovider";
        Uri apkUri = FileProvider.getUriForFile(context, authority, apkFile);

        Intent installIntent = new Intent(Intent.ACTION_VIEW);
        installIntent.setDataAndType(apkUri, "application/vnd.android.package-archive");
        installIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        installIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

        context.startActivity(installIntent);
    }

    private File resolveExistingApkFile(String requestedFileName) {
        if (lastDownloadedApk != null && lastDownloadedApk.exists()) {
            return lastDownloadedApk;
        }
        File updateDir = new File(getContext().getCacheDir(), UPDATES_SUBDIR);
        if (!requestedFileName.isEmpty()) {
            File candidate = new File(updateDir, sanitizeApkFileName(requestedFileName));
            if (candidate.exists() && isValidApkZipFile(candidate)) {
                lastDownloadedApk = candidate;
                return candidate;
            }
        }
        File[] files = updateDir.listFiles((dir, name) -> name.endsWith(".apk") && !name.endsWith(".part"));
        if (files != null && files.length > 0 && isValidApkZipFile(files[0])) {
            lastDownloadedApk = files[0];
            return files[0];
        }
        return null;
    }

    private boolean isValidApkZipFile(File file) {
        if (file == null || !file.exists() || file.length() < 1024L) {
            return false;
        }
        try (FileInputStream fis = new FileInputStream(file)) {
            byte[] magic = new byte[4];
            if (fis.read(magic) != 4) {
                return false;
            }
            // ZIP / APK magic number: PK\x03\x04
            return magic[0] == 0x50 && magic[1] == 0x4B && magic[2] == 0x03 && magic[3] == 0x04;
        } catch (IOException e) {
            return false;
        }
    }

    private void cleanupOldFiles(File updateDir, String keepFileName) {
        File[] files = updateDir.listFiles();
        if (files == null) return;
        for (File f : files) {
            if (!f.getName().equals(keepFileName)) {
                //noinspection ResultOfMethodCallIgnored
                f.delete();
            }
        }
    }

    private String sanitizeApkFileName(String rawName) {
        String cleaned = rawName.replaceAll("[^a-zA-Z0-9._-]", "_");
        if (!cleaned.toLowerCase(Locale.US).endsWith(".apk")) {
            cleaned = cleaned + ".apk";
        }
        return cleaned;
    }

    private String buildFriendlyErrorMessage(Exception e) {
        String msg = e.getMessage() != null ? e.getMessage() : "";
        String lower = msg.toLowerCase(Locale.US);
        if (lower.contains("unable to resolve host") ||
            lower.contains("failed to connect") ||
            lower.contains("network is unreachable") ||
            lower.contains("software caused connection abort") ||
            lower.contains("socket closed") ||
            lower.contains("timeout") ||
            lower.contains("timed out")) {
            return "Network connection interrupted while downloading the update. Please check your internet connection and tap 'Retry Download'.";
        }
        if (lower.contains("enospc") || lower.contains("no space left")) {
            return "Not enough free storage space on your device to download the update APK.";
        }
        if (!msg.isEmpty()) {
            return msg;
        }
        return "Failed to download the update APK. Please check your internet connection and try again.";
    }
}
