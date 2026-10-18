/**
 * Centralized Cloudinary Media Storage Service for ParikshaSetu
 *
 * Handles unsigned uploads to Cloudinary for:
 * - Student profile pictures (parikshasetu/students/profiles/)
 * - Question images (parikshasetu/questions/images/)
 * - Course images (parikshasetu/courses/images/)
 * - Course videos (parikshasetu/courses/videos/)
 * - Test images (parikshasetu/tests/images/)
 * - Study material (parikshasetu/study-material/)
 *
 * Firebase remains the primary database (Firestore) and authentication layer.
 * Cloudinary acts exclusively as the media storage layer.
 * No Cloudinary API Secret is exposed in frontend code.
 */

import { doc, updateDoc, setDoc, deleteDoc, getDocs, collection, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase/config';
import { CourseItem } from '../types/exam';

export const CLOUDINARY_CLOUD_NAME =
  (import.meta.env?.VITE_CLOUDINARY_CLOUD_NAME as string) || 'pcxadkyk';

export const CLOUDINARY_UPLOAD_PRESET =
  (import.meta.env?.VITE_CLOUDINARY_UPLOAD_PRESET as string) || 'parikshasetu_upload';

export const CLOUDINARY_FOLDERS = {
  STUDENT_PROFILE: 'parikshasetu/students/profiles',
  QUESTION_IMAGES: 'parikshasetu/questions/images',
  COURSE_IMAGES: 'parikshasetu/courses/images',
  COURSE_VIDEOS: 'parikshasetu/courses/videos',
  TEST_IMAGES: 'parikshasetu/tests/images',
  STUDY_MATERIAL: 'parikshasetu/study-material',
  BRANDING: 'parikshasetu/branding',
} as const;

export interface CloudinaryUploadOptions {
  folder?: string;
  resourceType?: 'auto' | 'image' | 'video' | 'raw';
  onProgress?: (progressPercent: number) => void;
}

export interface CloudinaryUploadResult {
  secure_url: string;
  public_id: string;
  resource_type: string;
  format?: string;
  width?: number;
  height?: number;
  duration?: number;
  bytes?: number;
  original_filename?: string;
  created_at?: string;
}

/**
 * Validate media file format and maximum size
 */
export function validateMediaFile(
  file: File,
  expectedType: 'image' | 'video' | 'any' = 'any',
  maxSizeMB?: number
): { valid: boolean; error?: string } {
  if (!file) {
    return { valid: false, error: 'No file provided for upload.' };
  }

  const imageMimes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/svg+xml',
  ];

  const videoMimes = [
    'video/mp4',
    'video/webm',
    'video/ogg',
    'video/quicktime',
    'video/x-matroska',
  ];

  if (expectedType === 'image') {
    if (!imageMimes.includes(file.type.toLowerCase())) {
      return {
        valid: false,
        error: 'Please upload a valid image file (JPG, PNG, WebP, GIF, or SVG).',
      };
    }
    const limit = (maxSizeMB || 10) * 1024 * 1024;
    if (file.size > limit) {
      return {
        valid: false,
        error: `Image size exceeds the ${maxSizeMB || 10}MB limit.`,
      };
    }
  } else if (expectedType === 'video') {
    if (!videoMimes.includes(file.type.toLowerCase()) && !file.type.startsWith('video/')) {
      return {
        valid: false,
        error: 'Please upload a valid video file (MP4, WebM, OGG, or MOV).',
      };
    }
    const limit = (maxSizeMB || 100) * 1024 * 1024;
    if (file.size > limit) {
      return {
        valid: false,
        error: `Video size exceeds the ${maxSizeMB || 100}MB limit.`,
      };
    }
  } else {
    // any media
    const isImage = imageMimes.includes(file.type.toLowerCase()) || file.type.startsWith('image/');
    const isVideo = videoMimes.includes(file.type.toLowerCase()) || file.type.startsWith('video/');
    const isPdf = file.type === 'application/pdf';

    if (!isImage && !isVideo && !isPdf) {
      return {
        valid: false,
        error: 'Unsupported file type. Please upload an image, video, or PDF document.',
      };
    }
    const limit = (maxSizeMB || 100) * 1024 * 1024;
    if (file.size > limit) {
      return {
        valid: false,
        error: `File size exceeds the ${maxSizeMB || 100}MB limit.`,
      };
    }
  }

  return { valid: true };
}

/**
 * Reusable Media Upload Function for Cloudinary (Unsigned Preset)
 *
 * 1. Accepts a File.
 * 2. Validates the file.
 * 3. Uploads to Cloudinary unsigned endpoint with progress tracking.
 * 4. Waits for Cloudinary's response.
 * 5. Returns secure_url, public_id, resource_type, format, width, height, duration.
 * 6. Handles errors properly.
 */
export async function uploadToCloudinary(
  file: File,
  options: CloudinaryUploadOptions = {}
): Promise<CloudinaryUploadResult> {
  const resourceType = options.resourceType || (file.type.startsWith('video/') ? 'video' : 'auto');

  // 1 & 2. Validate file
  const expectedType =
    resourceType === 'image'
      ? 'image'
      : resourceType === 'video'
      ? 'video'
      : file.type.startsWith('video/')
      ? 'video'
      : 'any';

  const validation = validateMediaFile(file, expectedType);
  if (!validation.valid) {
    throw new Error(validation.error || 'Invalid file format or size');
  }

  // 3. Build FormData with unsigned upload preset
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

  if (options.folder) {
    formData.append('folder', options.folder);
  }

  const endpoint = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/${resourceType}/upload`;

  return new Promise<CloudinaryUploadResult>((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    if (options.onProgress) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && options.onProgress) {
          const percent = Math.round((event.loaded / event.total) * 100);
          options.onProgress(percent);
        }
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText);

          if (!data.secure_url || !data.public_id) {
            reject(new Error('Cloudinary response did not contain a valid secure URL'));
            return;
          }

          resolve({
            secure_url: data.secure_url,
            public_id: data.public_id,
            resource_type: data.resource_type || (file.type.startsWith('video/') ? 'video' : 'image'),
            format: data.format,
            width: data.width,
            height: data.height,
            duration: data.duration,
            bytes: data.bytes,
            original_filename: data.original_filename,
            created_at: data.created_at,
          });
        } catch {
          reject(new Error('Media upload failed. Please try again.'));
        }
      } else {
        try {
          const errorData = JSON.parse(xhr.responseText);
          console.warn('Cloudinary upload error:', errorData);
          reject(new Error(errorData?.error?.message || 'Media upload failed. Please try again.'));
        } catch {
          reject(new Error('Media upload failed. Please try again.'));
        }
      }
    };

    xhr.onerror = () => {
      reject(new Error('Media upload failed. Please try again.'));
    };

    xhr.onabort = () => {
      reject(new Error('Media upload was cancelled.'));
    };

    xhr.open('POST', endpoint);
    xhr.send(formData);
  });
}

/**
 * Upload Student Profile Picture to Cloudinary
 * Folder: parikshasetu/students/profiles/
 */
export async function uploadStudentProfilePhoto(
  file: File,
  onProgress?: (progressPercent: number) => void
): Promise<CloudinaryUploadResult> {
  return uploadToCloudinary(file, {
    folder: CLOUDINARY_FOLDERS.STUDENT_PROFILE,
    resourceType: 'image',
    onProgress,
  });
}

/**
 * Upload Question Diagram or Image to Cloudinary
 * Folder: parikshasetu/questions/images/
 */
export async function uploadQuestionImageToCloudinary(
  file: File,
  onProgress?: (progressPercent: number) => void
): Promise<CloudinaryUploadResult> {
  return uploadToCloudinary(file, {
    folder: CLOUDINARY_FOLDERS.QUESTION_IMAGES,
    resourceType: 'image',
    onProgress,
  });
}

/**
 * Upload Question Option Image to Cloudinary
 * Folder: parikshasetu/questions/images/
 */
export async function uploadOptionImageToCloudinary(
  file: File,
  onProgress?: (progressPercent: number) => void
): Promise<CloudinaryUploadResult> {
  return uploadToCloudinary(file, {
    folder: CLOUDINARY_FOLDERS.QUESTION_IMAGES,
    resourceType: 'image',
    onProgress,
  });
}

/**
 * Upload Course Thumbnail Image to Cloudinary
 * Folder: parikshasetu/courses/images/
 */
export async function uploadCourseThumbnail(
  file: File,
  onProgress?: (progressPercent: number) => void
): Promise<CloudinaryUploadResult> {
  return uploadToCloudinary(file, {
    folder: CLOUDINARY_FOLDERS.COURSE_IMAGES,
    resourceType: 'image',
    onProgress,
  });
}

/**
 * Upload Course Recorded Video to Cloudinary
 * Folder: parikshasetu/courses/videos/
 */
export async function uploadCourseVideo(
  file: File,
  onProgress?: (progressPercent: number) => void
): Promise<CloudinaryUploadResult> {
  return uploadToCloudinary(file, {
    folder: CLOUDINARY_FOLDERS.COURSE_VIDEOS,
    resourceType: 'video',
    onProgress,
  });
}

/**
 * Upload Test Series / Exam Header Image to Cloudinary
 * Folder: parikshasetu/tests/images/
 */
export async function uploadTestImage(
  file: File,
  onProgress?: (progressPercent: number) => void
): Promise<CloudinaryUploadResult> {
  return uploadToCloudinary(file, {
    folder: CLOUDINARY_FOLDERS.TEST_IMAGES,
    resourceType: 'image',
    onProgress,
  });
}

/**
 * Upload Institute Branding Logo to Cloudinary
 * Folder: parikshasetu/branding/
 */
export async function uploadBrandingLogo(
  file: File,
  onProgress?: (progressPercent: number) => void
): Promise<CloudinaryUploadResult> {
  return uploadToCloudinary(file, {
    folder: CLOUDINARY_FOLDERS.BRANDING,
    resourceType: 'image',
    onProgress,
  });
}

// ============================================================================
// FIRESTORE SYNC HELPERS (Strict error isolation)
// ============================================================================

/**
 * Update Student Profile Image in Firestore:
 * 1. Uploads to Cloudinary (handled before calling this or inside)
 * 2. Saves profileImageUrl, profileImagePublicId, and photoUrl in Firestore
 * 3. Does not store image binary in Firestore
 */
export async function saveStudentProfileImageToFirestore(
  userId: string,
  uploadResult: CloudinaryUploadResult
): Promise<void> {
  if (!userId) {
    throw new Error('User ID is missing');
  }
  if (!uploadResult?.secure_url) {
    throw new Error('Media upload failed. Please try again.');
  }

  try {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      profileImageUrl: uploadResult.secure_url,
      profileImagePublicId: uploadResult.public_id,
      photoUrl: uploadResult.secure_url, // Backward compatibility
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Firestore student profile update error:', err);
    throw new Error('Media uploaded, but saving the data failed. Please try again.');
  }
}

/**
 * Save Course with Cloudinary Video & Thumbnail References to Firestore
 */
export async function saveCourseToFirestore(
  courseData: Omit<CourseItem, 'id' | 'createdAt'>,
  existingId?: string
): Promise<CourseItem> {
  const now = new Date().toISOString();
  const id = existingId || `course_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  const courseItem: CourseItem = {
    ...courseData,
    id,
    createdAt: now,
    updatedAt: now,
  };

  try {
    await setDoc(doc(db, 'courses', id), courseItem, { merge: true });
    return courseItem;
  } catch (err) {
    console.error('Firestore saveCourse error:', err);
    throw new Error('Media uploaded, but saving the data failed. Please try again.');
  }
}

/**
 * Fetch all Courses from Firestore
 */
export async function getAllCoursesFromFirestore(): Promise<CourseItem[]> {
  try {
    const q = query(collection(db, 'courses'), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    if (!snap.empty) {
      return snap.docs.map((d) => d.data() as CourseItem);
    }
  } catch (err) {
    console.warn('Firestore getAllCourses error:', err);
    // Fallback: fetch without orderBy if index is still propagating
    try {
      const snap = await getDocs(collection(db, 'courses'));
      return snap.docs.map((d) => d.data() as CourseItem);
    } catch {
      return [];
    }
  }
  return [];
}

/**
 * Delete Course from Firestore
 */
export async function deleteCourseFromFirestore(courseId: string): Promise<void> {
  if (!courseId) return;
  try {
    await deleteDoc(doc(db, 'courses', courseId));
  } catch (err) {
    console.error('Firestore deleteCourse error:', err);
    throw new Error('Failed to delete course record.');
  }
}

export type VideoQuality = 'auto' | '1080p' | '720p' | '480p' | '360p' | '240p';

export interface VideoQualityOption {
  id: VideoQuality;
  label: string;
  resolution: string;
  description: string;
  badge?: string;
}

export const VIDEO_QUALITY_OPTIONS: VideoQualityOption[] = [
  { id: 'auto', label: 'Auto', resolution: 'Adaptive', description: 'Automatically adjusts to connection speed', badge: 'Adaptive' },
  { id: '1080p', label: '1080p', resolution: '1920x1080', description: 'Full HD & clearest whiteboard notes', badge: 'FHD' },
  { id: '720p', label: '720p', resolution: '1280x720', description: 'Crisp HD recommended for lectures', badge: 'HD' },
  { id: '480p', label: '480p', resolution: '854x480', description: 'Standard clarity, smooth streaming', badge: 'SD' },
  { id: '360p', label: '360p', resolution: '640x360', description: 'Mobile data saver for on-the-go revision', badge: 'Saver' },
  { id: '240p', label: '240p', resolution: '426x240', description: 'Ultra-low bandwidth for 2G / weak signals', badge: 'Eco' },
];

/**
 * Returns transformed Cloudinary video URL matching requested resolution/quality preset.
 * Works seamlessly by inserting Cloudinary dynamic video transformations into URL path.
 * If URL is not a Cloudinary URL, gracefully falls back to the original source.
 */
export function getVideoQualityUrl(originalUrl: string, quality: VideoQuality): string {
  if (!originalUrl) return '';

  if (!originalUrl.includes('res.cloudinary.com')) {
    return originalUrl;
  }

  if (quality === 'auto') {
    // For auto adaptive streaming
    const uploadRegex = /\/video\/upload\/(?:[a-zA-Z0-9_,:]+\/)?/;
    if (uploadRegex.test(originalUrl)) {
      return originalUrl.replace(uploadRegex, '/video/upload/q_auto,vc_auto/');
    }
    return originalUrl.replace('/video/upload/', '/video/upload/q_auto,vc_auto/');
  }

  // Cloudinary resolution and quality transformation presets:
  const transformMap: Record<Exclude<VideoQuality, 'auto'>, string> = {
    '1080p': 'w_1920,h_1080,c_limit,q_auto:best',
    '720p': 'w_1280,h_720,c_limit,q_auto:good',
    '480p': 'w_854,h_480,c_limit,q_auto',
    '360p': 'w_640,h_360,c_limit,q_auto:eco',
    '240p': 'w_426,h_240,c_limit,q_auto:low',
  };

  const transform = transformMap[quality];
  if (!transform) return originalUrl;

  const uploadRegex = /\/video\/upload\/(?:[a-zA-Z0-9_,:]+\/)?/;
  if (uploadRegex.test(originalUrl)) {
    return originalUrl.replace(uploadRegex, `/video/upload/${transform}/`);
  }

  return originalUrl.replace('/video/upload/', `/video/upload/${transform}/`);
}
