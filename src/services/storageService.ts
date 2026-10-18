import {
  uploadToCloudinary,
  uploadStudentProfilePhoto,
  uploadQuestionImageToCloudinary,
  uploadBrandingLogo,
  validateMediaFile,
} from './cloudinaryService';

export interface UploadProgressCallback {
  (progress: number): void;
}

/**
 * Convert a File to base64 Data URL (Used as graceful fallback)
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
  return validateMediaFile(file, 'image', maxSizeMB);
}

/**
 * Upload a file to Cloudinary with progress tracking and fallback
 */
export async function uploadFile(
  destinationPath: string,
  file: File,
  onProgress?: UploadProgressCallback
): Promise<string> {
  try {
    const res = await uploadToCloudinary(file, {
      folder: destinationPath || 'parikshasetu/uploads',
      onProgress,
    });
    return res.secure_url;
  } catch (err: any) {
    console.warn('Cloudinary upload error:', err);
    throw new Error('Media upload failed. Please try again.');
  }
}

/**
 * Upload Institute Logo to Cloudinary
 * Folder: parikshasetu/branding/
 */
export async function uploadInstituteLogo(
  file: File,
  onProgress?: UploadProgressCallback
): Promise<string> {
  try {
    const res = await uploadBrandingLogo(file, onProgress);
    return res.secure_url;
  } catch (err: any) {
    console.warn('Cloudinary logo upload error:', err);
    throw new Error('Media upload failed. Please try again.');
  }
}

/**
 * Upload Question Diagram/Image to Cloudinary
 * Folder: parikshasetu/questions/images/
 */
export async function uploadQuestionImage(
  _testId: string,
  file: File,
  onProgress?: UploadProgressCallback
): Promise<string> {
  try {
    const res = await uploadQuestionImageToCloudinary(file, onProgress);
    return res.secure_url;
  } catch (err: any) {
    console.warn('Cloudinary question image upload error:', err);
    throw new Error('Media upload failed. Please try again.');
  }
}

/**
 * Upload Candidate / User Profile Photo to Cloudinary
 * Folder: parikshasetu/students/profiles/
 */
export async function uploadProfilePhoto(
  _userId: string,
  file: File,
  onProgress?: UploadProgressCallback
): Promise<string> {
  try {
    const res = await uploadStudentProfilePhoto(file, onProgress);
    return res.secure_url;
  } catch (err: any) {
    console.warn('Cloudinary profile photo upload error:', err);
    throw new Error('Media upload failed. Please try again.');
  }
}
