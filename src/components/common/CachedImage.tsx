import React, { useState, useEffect } from 'react';
import { getCachedMediaUrl } from '../../services/offlineStorageService';
import { Image as ImageIcon } from 'lucide-react';

interface CachedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src?: string;
  alt: string;
  fallbackClassName?: string;
}

export const CachedImage: React.FC<CachedImageProps> = ({
  src,
  alt,
  className = '',
  fallbackClassName = '',
  ...props
}) => {
  const [resolvedSrc, setResolvedSrc] = useState<string | undefined>(src);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let isCancelled = false;
    if (!src) {
      setResolvedSrc(undefined);
      return;
    }

    // Try resolving from offline cache
    getCachedMediaUrl(src)
      .then((url) => {
        if (!isCancelled) {
          setResolvedSrc(url);
          setHasError(false);
        }
      })
      .catch(() => {
        if (!isCancelled) setResolvedSrc(src);
      });

    return () => {
      isCancelled = true;
    };
  }, [src]);

  if (!src || hasError) {
    return (
      <div
        className={`flex items-center justify-center bg-slate-100 text-slate-400 p-4 rounded-lg text-xs font-medium ${fallbackClassName}`}
      >
        <ImageIcon className="w-5 h-5 mr-1.5 opacity-60" />
        <span>Diagram unavailable offline</span>
      </div>
    );
  }

  return (
    <img
      src={resolvedSrc || src}
      alt={alt}
      className={className}
      onError={() => {
        // If image failed to load and was a remote URL, see if we can resolve offline
        if (resolvedSrc === src) {
          getCachedMediaUrl(src).then((cached) => {
            if (cached && cached !== src) {
              setResolvedSrc(cached);
            } else {
              setHasError(true);
            }
          });
        } else {
          setHasError(true);
        }
      }}
      {...props}
    />
  );
};
