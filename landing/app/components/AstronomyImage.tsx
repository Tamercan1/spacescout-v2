'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';

interface AstronomyImageProps {
  src: string;
  alt: string;
  fallbackSrc?: string;
}

export function AstronomyImage({
  src,
  alt,
  fallbackSrc = '/carina-nebula.jpg',
}: AstronomyImageProps) {
  const [currentSrc, setCurrentSrc] = useState(src);

  // Sync if parent passes a new src (e.g. date navigation)
  useEffect(() => {
    setCurrentSrc(src);
  }, [src]);

  return (
    <Image
      src={currentSrc}
      alt={alt}
      width={900}
      height={600}
      priority
      unoptimized
      className="astronomy-img"
      onError={() => {
        if (currentSrc !== fallbackSrc) {
          setCurrentSrc(fallbackSrc);
        }
      }}
    />
  );
}
