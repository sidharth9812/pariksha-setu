import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
} from 'firebase/storage';
import { storage } from '../firebase/config';

export interface UploadProgressCallback {
  (progress: number): void;
}

/**
 * Convert a File to base64 Data URL (Used as graceful fallback if Storage bucket is not yet initialized)
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
}

/**
 * Validate image file size and type
 */
export function validateImageFile(file: File, maxSizeMB = 5): { valid: boolean; error?: string } {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'];
  if (!allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: 'Please upload a valid image file (JPG, PNG, WebP, GIF, or SVG).',
    };
  }

  const maxBytes = maxSizeMB * 1024 * 1024;
  if (file.size > maxBytes) {
    return {
      valid: false,
      error: `File size exceeds the ${maxSizeMB}MB limit.`,
    };
  }

  return { valid: true };
}

/**
 * Upload a file to Firebase Storage with progress tracking and fallback
 */
export async function uploadFile(
  destinationPath: string,
  file: File,
  onProgress?: UploadProgressCallback
): Promise<string> {
  const validation = validateImageFile(file);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  try {
    const storageRef = ref(storage, destinationPath);
    const uploadTask = uploadBytesResumable(storageRef, file, {
      contentType: file.type,
    });

    return await new Promise<string>((resolve, reject) => {
      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const progress = Math.round(
            (snapshot.bytesTransferred / snapshot.totalBytes) * 100
          );
          if (onProgress) onProgress(progress);
        },
        (error) => {
          // If storage bucket isn't initialized or permissions/CORS error in dev, log warning and use data URL
          console.warn('Firebase Storage upload error, falling back to local data URL:', error);
          fileToBase64(file).then(resolve).catch(reject);
        },
        async () => {
          try {
            const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
            resolve(downloadUrl);
          } catch (err) {
            console.warn('Error obtaining download URL, falling back to data URL:', err);
            const dataUrl = await fileToBase64(file);
            resolve(dataUrl);
          }
        }
      );
    });
  } catch (err) {
    console.warn('Firebase Storage upload exception, falling back:', err);
    return await fileToBase64(file);
  }
}

/**
 * Upload Institute Logo
 */
export async function uploadInstituteLogo(
  file: File,
  onProgress?: UploadProgressCallback
): Promise<string> {
  const ext = file.name.split('.').pop() || 'png';
  const path = `branding/institute_logo_${Date.now()}.${ext}`;
  return uploadFile(path, file, onProgress);
}

/**
 * Upload Question Diagram/Image
 */
export async function uploadQuestionImage(
  testId: string,
  file: File,
  onProgress?: UploadProgressCallback
): Promise<string> {
  const ext = file.name.split('.').pop() || 'png';
  const path = `questions/${testId}/q_${Date.now()}.${ext}`;
  return uploadFile(path, file, onProgress);
}

/**
 * Upload Candidate / User Profile Photo
 */
export async function uploadProfilePhoto(
  userId: string,
  file: File,
  onProgress?: UploadProgressCallback
): Promise<string> {
  const ext = file.name.split('.').pop() || 'png';
  const path = `profiles/${userId}/avatar_${Date.now()}.${ext}`;
  return uploadFile(path, file, onProgress);
}
