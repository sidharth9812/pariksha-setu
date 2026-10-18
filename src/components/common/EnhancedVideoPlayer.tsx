import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Settings,
  Gauge,
  Check,
  Loader2,
  Sparkles,
} from 'lucide-react';
import {
  VideoQuality,
  VIDEO_QUALITY_OPTIONS,
  getVideoQualityUrl,
} from '../../services/cloudinaryService';

interface EnhancedVideoPlayerProps {
  src: string;
  title?: string;
  poster?: string;
  autoPlay?: boolean;
  onEnded?: () => void;
  className?: string;
}

const SPEED_OPTIONS = [0.75, 1, 1.25, 1.5, 2];

export const EnhancedVideoPlayer: React.FC<EnhancedVideoPlayerProps> = ({
  src,
  title,
  poster,
  autoPlay = true,
  onEnded,
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hideControlsTimerRef = useRef<number | null>(null);

  // Playback states
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [isBuffering, setIsBuffering] = useState(false);
  const [showControls, setShowControls] = useState(true);

  // Quality state
  const [currentQuality, setCurrentQuality] = useState<VideoQuality>('auto');
  const [isQualityMenuOpen, setIsQualityMenuOpen] = useState(false);
  const [isSpeedMenuOpen, setIsSpeedMenuOpen] = useState(false);

  // Derived video URL based on active quality
  const activeVideoUrl = getVideoQualityUrl(src, currentQuality);

  // Format seconds to mm:ss or hh:mm:ss
  const formatTime = (seconds: number): string => {
    if (isNaN(seconds) || seconds < 0) return '00:00';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hrs > 0) {
      return `${hrs}:${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
    }
    return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // Play / Pause toggle
  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused || video.ended) {
      video.play().catch(() => {});
      setIsPlaying(true);
    } else {
      video.pause();
      setIsPlaying(false);
    }
  };

  // Seek handler
  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video) return;
    const seekTo = parseFloat(e.target.value);
    video.currentTime = seekTo;
    setCurrentTime(seekTo);
  };

  // Skip relative seconds
  const skipTime = (seconds: number) => {
    const video = videoRef.current;
    if (!video) return;
    const target = Math.min(Math.max(video.currentTime + seconds, 0), duration || video.duration);
    video.currentTime = target;
    setCurrentTime(target);
  };

  // Volume handler
  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video) return;
    const val = parseFloat(e.target.value);
    video.volume = val;
    setVolume(val);
    if (val === 0) {
      video.muted = true;
      setIsMuted(true);
    } else if (isMuted) {
      video.muted = false;
      setIsMuted(false);
    }
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    if (isMuted) {
      video.muted = false;
      setIsMuted(false);
      video.volume = volume || 0.5;
    } else {
      video.muted = true;
      setIsMuted(true);
    }
  };

  // Speed change
  const handleSpeedChange = (speed: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = speed;
    setPlaybackSpeed(speed);
    setIsSpeedMenuOpen(false);
  };

  // SEAMLESS Quality Change with Timestamp & Playback State Preservation
  const handleQualityChange = (newQuality: VideoQuality) => {
    if (newQuality === currentQuality) {
      setIsQualityMenuOpen(false);
      return;
    }

    const video = videoRef.current;
    if (!video) return;

    // Capture exact current playback timestamp and playing status
    const savedTime = video.currentTime;
    const wasPlaying = !video.paused;

    setIsBuffering(true);
    setCurrentQuality(newQuality);
    setIsQualityMenuOpen(false);

    // One-time listener to restore position as soon as metadata/frames are loaded
    const onReadyToRestore = () => {
      try {
        video.currentTime = savedTime;
        video.playbackRate = playbackSpeed;
        if (wasPlaying) {
          video.play().catch(() => {});
        }
      } catch (err) {
        console.warn('Quality switch restoration notice:', err);
      } finally {
        setIsBuffering(false);
        video.removeEventListener('loadeddata', onReadyToRestore);
        video.removeEventListener('canplay', onReadyToRestore);
      }
    };

    video.addEventListener('loadeddata', onReadyToRestore, { once: true });
    video.addEventListener('canplay', onReadyToRestore, { once: true });
  };

  // Fullscreen toggle
  const toggleFullscreen = () => {
    const container = containerRef.current;
    if (!container) return;

    if (!document.fullscreenElement) {
      container.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  // Listen to fullscreen changes from browser (ESC key etc.)
  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  // Controls auto-hide on inactivity
  const handleMouseMove = useCallback(() => {
    setShowControls(true);
    if (hideControlsTimerRef.current) {
      window.clearTimeout(hideControlsTimerRef.current);
    }
    hideControlsTimerRef.current = window.setTimeout(() => {
      if (isPlaying && !isQualityMenuOpen && !isSpeedMenuOpen) {
        setShowControls(false);
      }
    }, 3000);
  }, [isPlaying, isQualityMenuOpen, isSpeedMenuOpen]);

  // Keyboard navigation shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if focus is inside an input, textarea, or contentEditable
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        skipTime(-10);
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        skipTime(10);
      } else if (e.code === 'KeyF') {
        e.preventDefault();
        toggleFullscreen();
      } else if (e.code === 'KeyM') {
        e.preventDefault();
        toggleMute();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, duration, volume, isMuted]);

  // Video event handlers
  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (video) {
      setCurrentTime(video.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    const video = videoRef.current;
    if (video) {
      setDuration(video.duration);
      video.playbackRate = playbackSpeed;
    }
  };

  const currentQualityMeta =
    VIDEO_QUALITY_OPTIONS.find((q) => q.id === currentQuality) || VIDEO_QUALITY_OPTIONS[0];

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => {
        if (isPlaying && !isQualityMenuOpen && !isSpeedMenuOpen) {
          setShowControls(false);
        }
      }}
      className={`relative group bg-black overflow-hidden select-none flex items-center justify-center ${className}`}
    >
      {/* HTML5 Video Element */}
      <video
        ref={videoRef}
        src={activeVideoUrl}
        poster={poster}
        autoPlay={autoPlay}
        playsInline
        onClick={togglePlay}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onWaiting={() => setIsBuffering(true)}
        onPlaying={() => setIsBuffering(false)}
        onEnded={() => {
          setIsPlaying(false);
          if (onEnded) onEnded();
        }}
        className="w-full h-full object-contain cursor-pointer"
      />

      {/* Buffering Spinner */}
      {isBuffering && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-2xs z-20 pointer-events-none">
          <Loader2 className="w-12 h-12 text-indigo-400 animate-spin mb-2" />
          <span className="text-white text-xs font-semibold tracking-wider bg-black/70 px-3 py-1 rounded-full border border-white/10">
            Loading {currentQualityMeta.label}...
          </span>
        </div>
      )}

      {/* Center Big Play Icon overlay when paused and not buffering */}
      {!isPlaying && !isBuffering && (
        <button
          type="button"
          onClick={togglePlay}
          className="absolute inset-0 m-auto w-16 h-16 rounded-full bg-indigo-600/90 hover:bg-indigo-600 text-white flex items-center justify-center shadow-2xl transition-transform transform hover:scale-110 z-10 cursor-pointer"
          aria-label="Play Video"
        >
          <Play className="w-8 h-8 fill-current ml-1" />
        </button>
      )}

      {/* Top Title Overlay */}
      {title && (
        <div
          className={`absolute top-0 inset-x-0 p-4 bg-linear-to-b from-black/80 via-black/40 to-transparent text-white flex items-center justify-between transition-opacity duration-300 z-20 pointer-events-none ${
            showControls ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <div className="font-bold text-sm sm:text-base truncate max-w-xl flex items-center gap-2 drop-shadow-sm">
            <span className="truncate">{title}</span>
            <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-indigo-600/80 text-white border border-indigo-400/30">
              {currentQualityMeta.badge || currentQualityMeta.label}
            </span>
          </div>
        </div>
      )}

      {/* Bottom Controls Overlay */}
      <div
        className={`absolute bottom-0 inset-x-0 pt-10 pb-3 px-4 bg-linear-to-t from-black/95 via-black/60 to-transparent transition-opacity duration-300 z-30 ${
          showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Seek Bar / Progress Slider */}
        <div className="relative mb-3 flex items-center group/scrubber cursor-pointer">
          <input
            type="range"
            min={0}
            max={duration || 100}
            step={0.1}
            value={currentTime}
            onChange={handleSeek}
            className="w-full h-1.5 hover:h-2.5 bg-white/20 accent-indigo-500 rounded-lg appearance-none cursor-pointer transition-all"
            style={{
              background: `linear-gradient(to right, #6366f1 ${progressPercent}%, rgba(255,255,255,0.2) ${progressPercent}%)`,
            }}
          />
        </div>

        {/* Control Buttons Row */}
        <div className="flex items-center justify-between gap-2 text-white text-xs">
          {/* Left Controls: Play, Rewind, Forward, Volume, Time */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Play / Pause button */}
            <button
              type="button"
              onClick={togglePlay}
              className="p-1.5 hover:bg-white/15 rounded-lg transition-colors cursor-pointer"
              title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
            >
              {isPlaying ? (
                <Pause className="w-5 h-5 fill-current" />
              ) : (
                <Play className="w-5 h-5 fill-current" />
              )}
            </button>

            {/* 10s Backward */}
            <button
              type="button"
              onClick={() => skipTime(-10)}
              className="p-1.5 hover:bg-white/15 rounded-lg transition-colors cursor-pointer hidden sm:flex items-center gap-0.5"
              title="Rewind 10 seconds (Left Arrow)"
            >
              <RotateCcw className="w-4 h-4" />
              <span className="text-[10px] font-bold">10</span>
            </button>

            {/* 10s Forward */}
            <button
              type="button"
              onClick={() => skipTime(10)}
              className="p-1.5 hover:bg-white/15 rounded-lg transition-colors cursor-pointer hidden sm:flex items-center gap-0.5"
              title="Forward 10 seconds (Right Arrow)"
            >
              <RotateCw className="w-4 h-4" />
              <span className="text-[10px] font-bold">10</span>
            </button>

            {/* Volume Control */}
            <div className="flex items-center gap-1.5 group/volume">
              <button
                type="button"
                onClick={toggleMute}
                className="p-1.5 hover:bg-white/15 rounded-lg transition-colors cursor-pointer"
                title={isMuted ? 'Unmute (M)' : 'Mute (M)'}
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="w-4 h-4 text-red-400" />
                ) : (
                  <Volume2 className="w-4 h-4" />
                )}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                className="w-14 sm:w-20 h-1 bg-white/20 accent-indigo-400 rounded cursor-pointer transition-all"
              />
            </div>

            {/* Time Stamp */}
            <div className="text-[11px] font-mono text-slate-300 ml-1">
              <span>{formatTime(currentTime)}</span>
              <span className="text-white/40 mx-1">/</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          {/* Right Controls: Quality, Playback Speed, Fullscreen */}
          <div className="flex items-center gap-1.5 sm:gap-2 relative">
            {/* Playback Speed Selector */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setIsSpeedMenuOpen(!isSpeedMenuOpen);
                  setIsQualityMenuOpen(false);
                }}
                className={`px-2 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1 ${
                  isSpeedMenuOpen
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white/10 hover:bg-white/20 text-white'
                }`}
                title="Playback Speed"
              >
                <Gauge className="w-3.5 h-3.5" />
                <span>{playbackSpeed}x</span>
              </button>

              {/* Speed Popover Menu */}
              {isSpeedMenuOpen && (
                <div className="absolute right-0 bottom-full mb-2 bg-slate-900/95 backdrop-blur-md border border-white/15 rounded-2xl shadow-2xl p-1.5 w-32 z-50 animate-in fade-in zoom-in-95">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2.5 py-1 border-b border-white/10 mb-1">
                    Speed
                  </div>
                  {SPEED_OPTIONS.map((speed) => (
                    <button
                      key={speed}
                      type="button"
                      onClick={() => handleSpeedChange(speed)}
                      className={`w-full px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center justify-between cursor-pointer transition-colors ${
                        playbackSpeed === speed
                          ? 'bg-indigo-600 text-white'
                          : 'text-slate-200 hover:bg-white/10'
                      }`}
                    >
                      <span>{speed}x</span>
                      {playbackSpeed === speed && <Check className="w-3.5 h-3.5" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* VIDEO QUALITY SELECTOR */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setIsQualityMenuOpen(!isQualityMenuOpen);
                  setIsSpeedMenuOpen(false);
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 border ${
                  isQualityMenuOpen
                    ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg'
                    : 'bg-white/10 hover:bg-white/20 border-white/10 text-white'
                }`}
                title="Change Video Quality"
              >
                <Settings className="w-3.5 h-3.5" />
                <span>{currentQualityMeta.label}</span>
                {currentQualityMeta.badge && (
                  <span className="text-[9px] font-extrabold uppercase bg-white/20 px-1 py-0.2 rounded">
                    {currentQualityMeta.badge}
                  </span>
                )}
              </button>

              {/* Quality Popover Menu */}
              {isQualityMenuOpen && (
                <div className="absolute right-0 bottom-full mb-2 bg-slate-900/95 backdrop-blur-md border border-white/15 rounded-2xl shadow-2xl p-2 w-64 z-50 animate-in fade-in zoom-in-95">
                  <div className="flex items-center justify-between px-2.5 py-1 border-b border-white/10 mb-1.5">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                      <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Video Quality</span>
                    </div>
                    <span className="text-[10px] text-slate-400">Resolution</span>
                  </div>

                  <div className="space-y-1">
                    {VIDEO_QUALITY_OPTIONS.map((opt) => {
                      const isSelected = currentQuality === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => handleQualityChange(opt.id)}
                          className={`w-full px-2.5 py-2 rounded-xl text-left cursor-pointer transition-all flex items-center justify-between group ${
                            isSelected
                              ? 'bg-indigo-600 text-white shadow-md'
                              : 'text-slate-200 hover:bg-white/10'
                          }`}
                        >
                          <div className="flex flex-col">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-bold">{opt.label}</span>
                              {opt.badge && (
                                <span
                                  className={`text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded ${
                                    isSelected
                                      ? 'bg-white/25 text-white'
                                      : 'bg-indigo-500/30 text-indigo-300'
                                  }`}
                                >
                                  {opt.badge}
                                </span>
                              )}
                            </div>
                            <span
                              className={`text-[10px] leading-tight ${
                                isSelected ? 'text-indigo-100' : 'text-slate-400'
                              }`}
                            >
                              {opt.description}
                            </span>
                          </div>

                          <div className="flex items-center gap-1 pl-2 shrink-0">
                            <span
                              className={`text-[10px] font-mono ${
                                isSelected ? 'text-white' : 'text-slate-400'
                              }`}
                            >
                              {opt.resolution}
                            </span>
                            {isSelected && <Check className="w-4 h-4 ml-1 shrink-0" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-2 pt-1.5 border-t border-white/10 px-2 text-[10px] text-slate-400 flex items-center justify-between">
                    <span>Retains playback time</span>
                    <span className="text-emerald-400 font-semibold">&bull; Seamless</span>
                  </div>
                </div>
              )}
            </div>

            {/* Fullscreen Toggle */}
            <button
              type="button"
              onClick={toggleFullscreen}
              className="p-1.5 hover:bg-white/15 rounded-lg transition-colors cursor-pointer"
              title={isFullscreen ? 'Exit Fullscreen (F)' : 'Fullscreen (F)'}
            >
              {isFullscreen ? (
                <Minimize className="w-4 h-4" />
              ) : (
                <Maximize className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
