import React, { useEffect, useState } from 'react';
import {
  Video,
  Upload,
  Plus,
  Play,
  Trash2,
  Edit2,
  FileText,
  Clock,
  Layers,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles,
  ExternalLink,
  Film,
  Image as ImageIcon,
} from 'lucide-react';
import { CourseItem } from '../../types/exam';
import {
  uploadCourseThumbnail,
  uploadCourseVideo,
  saveCourseToFirestore,
  getAllCoursesFromFirestore,
  deleteCourseFromFirestore,
} from '../../services/cloudinaryService';
import { EnhancedVideoPlayer } from '../../components/common/EnhancedVideoPlayer';

export const CourseVideoManager: React.FC = () => {
  const [courses, setCourses] = useState<CourseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<CourseItem | null>(null);

  // Form states
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('MP Police');
  const [instructor, setInstructor] = useState('Senior Faculty');
  const [status, setStatus] = useState<'published' | 'draft'>('published');

  // Media states
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [thumbnailPublicId, setThumbnailPublicId] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [videoPublicId, setVideoPublicId] = useState('');
  const [videoDuration, setVideoDuration] = useState<number | undefined>(undefined);
  const [videoFormat, setVideoFormat] = useState<string | undefined>(undefined);

  // Upload status
  const [isUploadingThumb, setIsUploadingThumb] = useState(false);
  const [thumbProgress, setThumbProgress] = useState(0);
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);
  const [videoProgress, setVideoProgress] = useState(0);

  // Status & error banners
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Active video player modal
  const [previewVideoUrl, setPreviewVideoUrl] = useState<string | null>(null);
  const [previewVideoTitle, setPreviewVideoTitle] = useState<string>('');

  const loadCourses = async () => {
    setLoading(true);
    try {
      const data = await getAllCoursesFromFirestore();
      setCourses(data);
    } catch (err) {
      console.error('Failed to load courses:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCourses();
  }, []);

  const handleOpenAddModal = () => {
    setEditingCourse(null);
    setTitle('');
    setDescription('');
    setCategory('MP Police');
    setInstructor('Senior Faculty');
    setStatus('published');
    setThumbnailUrl('');
    setThumbnailPublicId('');
    setVideoUrl('');
    setVideoPublicId('');
    setVideoDuration(undefined);
    setVideoFormat(undefined);
    setFormError(null);
    setFormSuccess(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (c: CourseItem) => {
    setEditingCourse(c);
    setTitle(c.title);
    setDescription(c.description);
    setCategory(c.category);
    setInstructor(c.instructor || '');
    setStatus(c.status);
    setThumbnailUrl(c.thumbnailUrl || '');
    setThumbnailPublicId(c.thumbnailPublicId || '');
    setVideoUrl(c.videoUrl || '');
    setVideoPublicId(c.videoPublicId || '');
    setVideoDuration(c.videoDuration);
    setVideoFormat(c.videoFormat);
    setFormError(null);
    setFormSuccess(null);
    setIsModalOpen(true);
  };

  // Thumbnail upload to Cloudinary (folder: parikshasetu/courses/images/)
  const handleThumbnailUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingThumb(true);
    setThumbProgress(0);
    setFormError(null);

    try {
      const res = await uploadCourseThumbnail(file, (progress) => {
        setThumbProgress(progress);
      });
      setThumbnailUrl(res.secure_url);
      setThumbnailPublicId(res.public_id);
    } catch (err: any) {
      console.error('Course thumbnail upload error:', err);
      setFormError(err.message || 'Media upload failed. Please try again.');
    } finally {
      setIsUploadingThumb(false);
      e.target.value = '';
    }
  };

  // Video upload to Cloudinary (folder: parikshasetu/courses/videos/)
  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingVideo(true);
    setVideoProgress(0);
    setFormError(null);

    try {
      const res = await uploadCourseVideo(file, (progress) => {
        setVideoProgress(progress);
      });
      setVideoUrl(res.secure_url);
      setVideoPublicId(res.public_id);
      if (res.duration) setVideoDuration(Math.round(res.duration));
      if (res.format) setVideoFormat(res.format);
    } catch (err: any) {
      console.error('Course video upload error:', err);
      setFormError(err.message || 'Media upload failed. Please try again.');
    } finally {
      setIsUploadingVideo(false);
      e.target.value = '';
    }
  };

  const handleSaveCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setFormError('Please enter a course title.');
      return;
    }

    setIsSaving(true);
    setFormError(null);

    try {
      await saveCourseToFirestore(
        {
          title: title.trim(),
          description: description.trim(),
          category,
          instructor: instructor.trim() || undefined,
          thumbnailUrl: thumbnailUrl || undefined,
          thumbnailPublicId: thumbnailPublicId || undefined,
          videoUrl: videoUrl || undefined,
          videoPublicId: videoPublicId || undefined,
          videoDuration,
          videoFormat,
          status,
        },
        editingCourse?.id
      );

      setFormSuccess('Course and Cloudinary media saved successfully!');
      setTimeout(() => {
        setIsModalOpen(false);
        loadCourses();
      }, 1000);
    } catch (err: any) {
      console.error('Save course error:', err);
      // Strictly isolate Firestore save failure message
      if (videoUrl || thumbnailUrl) {
        setFormError('Media uploaded, but saving the data failed. Please try again.');
      } else {
        setFormError(err.message || 'Failed to save course. Please try again.');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteCourse = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) return;
    try {
      await deleteCourseFromFirestore(id);
      setCourses((prev) => prev.filter((c) => c.id !== id));
    } catch (err: any) {
      alert(err.message || 'Failed to delete course.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Course Videos & Media Management
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
              Cloudinary Powered
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Upload recorded lecture videos, syllabus previews, and course thumbnails to Cloudinary.
          </p>
        </div>

        <button
          onClick={handleOpenAddModal}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs sm:text-sm shadow-xs transition-colors cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Add Course Video</span>
        </button>
      </div>

      {/* Grid of Courses */}
      {loading ? (
        <div className="py-20 text-center space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mx-auto" />
          <p className="text-xs font-semibold text-slate-500">Loading course media library...</p>
        </div>
      ) : courses.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center space-y-4 max-w-lg mx-auto">
          <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
            <Video className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h3 className="font-bold text-slate-900 text-base">No Recorded Course Videos Yet</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Upload your coaching lecture videos and lecture thumbnails directly to Cloudinary.
            </p>
          </div>
          <button
            onClick={handleOpenAddModal}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Upload First Lecture Video</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {courses.map((c) => {
            const hasVideo = !!c.videoUrl;
            const hasThumbnail = !!c.thumbnailUrl;

            return (
              <div
                key={c.id}
                className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between"
              >
                <div>
                  {/* Thumbnail / Video Preview Area */}
                  <div className="relative aspect-video bg-slate-900 flex items-center justify-center overflow-hidden group">
                    {hasThumbnail ? (
                      <img
                        src={c.thumbnailUrl}
                        alt={c.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="flex flex-col items-center gap-1.5 text-slate-400">
                        <Film className="w-8 h-8 text-slate-500" />
                        <span className="text-[11px] font-semibold">{c.category}</span>
                      </div>
                    )}

                    {hasVideo && (
                      <button
                        onClick={() => {
                          setPreviewVideoUrl(c.videoUrl || null);
                          setPreviewVideoTitle(c.title);
                        }}
                        className="absolute inset-0 bg-black/40 hover:bg-black/20 flex items-center justify-center transition-colors cursor-pointer"
                        title="Play Video"
                      >
                        <div className="w-12 h-12 rounded-full bg-indigo-600/90 text-white flex items-center justify-center shadow-lg hover:scale-110 transition-transform">
                          <Play className="w-5 h-5 ml-0.5 fill-current" />
                        </div>
                      </button>
                    )}

                    <div className="absolute top-2.5 left-2.5">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-900/80 backdrop-blur-xs text-white border border-white/20">
                        {c.category}
                      </span>
                    </div>

                    {c.videoDuration && (
                      <div className="absolute bottom-2.5 right-2.5">
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-black/75 text-white flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>{Math.floor(c.videoDuration / 60)}:{(c.videoDuration % 60).toString().padStart(2, '0')}</span>
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Content Info */}
                  <div className="p-4 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-bold text-slate-900 text-sm line-clamp-1">{c.title}</h3>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          c.status === 'published'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {c.status}
                      </span>
                    </div>

                    <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                      {c.description || 'No description provided.'}
                    </p>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[11px] text-slate-500 font-medium">
                      <span>Faculty: <strong>{c.instructor || 'ParikshaSetu'}</strong></span>
                      {c.videoFormat && <span className="uppercase font-mono text-[10px]">{c.videoFormat}</span>}
                    </div>
                  </div>
                </div>

                {/* Card Actions */}
                <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleOpenEditModal(c)}
                      className="p-1.5 rounded-lg text-slate-600 hover:text-indigo-600 hover:bg-white transition-colors cursor-pointer text-xs flex items-center gap-1 font-semibold"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>Edit</span>
                    </button>
                    {hasVideo && (
                      <a
                        href={c.videoUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 rounded-lg text-slate-600 hover:text-indigo-600 hover:bg-white transition-colors cursor-pointer text-xs flex items-center gap-1 font-semibold"
                        title="Open Cloudinary URL"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Link</span>
                      </a>
                    )}
                  </div>

                  <button
                    onClick={() => handleDeleteCourse(c.id, c.title)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                    title="Delete course"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Course Add / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden my-6">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Video className="w-5 h-5 text-indigo-400" />
                <h3 className="font-bold text-base">
                  {editingCourse ? 'Edit Course Video & Details' : 'Add Course Video Lecture'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveCourse} className="p-6 space-y-5">
              {formError && (
                <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {formSuccess && (
                <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{formSuccess}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Course / Lecture Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. MP Police Constable 2026 - Reasoning Quick Tricks"
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Target Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                  >
                    <option value="MP Police">MP Police Constable</option>
                    <option value="MP SI">MP Sub-Inspector (SI)</option>
                    <option value="SSC">Staff Selection Commission (SSC)</option>
                    <option value="General Studies">General Studies & MP GK</option>
                    <option value="Mathematics">Quantitative Aptitude</option>
                    <option value="Reasoning">Logical Reasoning</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Instructor / Faculty
                  </label>
                  <input
                    type="text"
                    value={instructor}
                    onChange={(e) => setInstructor(e.target.value)}
                    placeholder="e.g. Anand Sharma Sir"
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Description & Syllabus Highlights
                  </label>
                  <textarea
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Brief description of the lecture topic, key concepts covered, and important formulas."
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
              </div>

              {/* MEDIA UPLOADS SECTION (Cloudinary) */}
              <div className="space-y-4 pt-3 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Cloudinary Media Uploads
                  </span>
                  <span className="text-[11px] text-indigo-600 font-semibold">Unsigned Preset Upload</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* 1. Thumbnail Image Upload */}
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800">Thumbnail Image</span>
                      {thumbnailUrl && (
                        <button
                          type="button"
                          onClick={() => {
                            setThumbnailUrl('');
                            setThumbnailPublicId('');
                          }}
                          className="text-[11px] text-rose-600 font-bold hover:underline"
                        >
                          Remove
                        </button>
                      )}
                    </div>

                    {thumbnailUrl ? (
                      <div className="relative aspect-video rounded-xl overflow-hidden border border-slate-300 bg-white">
                        <img src={thumbnailUrl} alt="Preview" className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="aspect-video rounded-xl border-2 border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400 gap-1">
                        <ImageIcon className="w-6 h-6" />
                        <span className="text-[10px]">JPG, PNG, WebP (Max 10MB)</span>
                      </div>
                    )}

                    {isUploadingThumb && (
                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px] text-slate-500 font-semibold">
                          <span>Uploading image...</span>
                          <span>{thumbProgress}%</span>
                        </div>
                        <div className="w-full bg-slate-200 h-1 rounded-full overflow-hidden">
                          <div className="bg-indigo-600 h-full" style={{ width: `${thumbProgress}%` }} />
                        </div>
                      </div>
                    )}

                    <label className="w-full py-2 px-3 rounded-xl bg-white border border-slate-300 hover:border-indigo-500 text-slate-700 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs">
                      <Upload className="w-3.5 h-3.5" />
                      <span>{thumbnailUrl ? 'Replace Thumbnail' : 'Upload Thumbnail'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleThumbnailUpload}
                        disabled={isUploadingThumb}
                      />
                    </label>
                  </div>

                  {/* 2. Video Upload */}
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800">Recorded Lecture Video</span>
                      {videoUrl && (
                        <button
                          type="button"
                          onClick={() => {
                            setVideoUrl('');
                            setVideoPublicId('');
                            setVideoDuration(undefined);
                          }}
                          className="text-[11px] text-rose-600 font-bold hover:underline"
                        >
                          Remove
                        </button>
                      )}
                    </div>

                    {videoUrl ? (
                      <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-900 space-y-1 text-xs">
                        <div className="flex items-center gap-2 font-bold">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>Video Uploaded</span>
                        </div>
                        <div className="text-[11px] text-slate-600 font-mono truncate">{videoUrl}</div>
                        {videoDuration && (
                          <div className="text-[11px] text-slate-500">
                            Duration: {Math.floor(videoDuration / 60)} min {videoDuration % 60} sec
                          </div>
                        )}
                        <div className="pt-1 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setPreviewVideoUrl(videoUrl);
                              setPreviewVideoTitle(title || 'Course Lecture Video');
                            }}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[11px] transition cursor-pointer shadow-xs"
                          >
                            <Play className="w-3 h-3 fill-current" />
                            <span>Test Playback & Quality</span>
                          </button>
                          <span className="text-[10px] text-slate-500">Includes 1080p, 720p, 480p, 360p, 240p</span>
                        </div>
                      </div>
                    ) : (
                      <div className="aspect-video rounded-xl border-2 border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400 gap-1">
                        <Video className="w-6 h-6" />
                        <span className="text-[10px]">MP4, WebM, MOV (Max 100MB)</span>
                      </div>
                    )}

                    {isUploadingVideo && (
                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px] text-slate-500 font-semibold">
                          <span>Uploading video...</span>
                          <span>{videoProgress}%</span>
                        </div>
                        <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                          <div className="bg-indigo-600 h-full" style={{ width: `${videoProgress}%` }} />
                        </div>
                      </div>
                    )}

                    <label className="w-full py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs">
                      <Upload className="w-3.5 h-3.5" />
                      <span>{videoUrl ? 'Replace Video' : 'Upload Video'}</span>
                      <input
                        type="file"
                        accept="video/*"
                        className="hidden"
                        onChange={handleVideoUpload}
                        disabled={isUploadingVideo}
                      />
                    </label>
                  </div>
                </div>
              </div>

              {/* Status and Submission */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-200">
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={status === 'published'}
                    onChange={(e) => setStatus(e.target.checked ? 'published' : 'draft')}
                    className="rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>Publish immediately to Student Study Material</span>
                </label>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving || isUploadingThumb || isUploadingVideo}
                    className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold cursor-pointer shadow-xs flex items-center gap-1.5"
                  >
                    {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>{editingCourse ? 'Save Changes' : 'Create Course'}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Video Player Modal */}
      {previewVideoUrl && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-slate-900 rounded-3xl max-w-3xl w-full overflow-hidden shadow-2xl border border-slate-800">
            <div className="px-5 py-3.5 bg-slate-950 text-white flex items-center justify-between">
              <span className="font-bold text-sm truncate">{previewVideoTitle}</span>
              <button
                onClick={() => setPreviewVideoUrl(null)}
                className="text-slate-400 hover:text-white font-bold text-lg cursor-pointer"
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
