export type ApodMediaType = 'image' | 'video' | 'other';

export interface FeaturedAstronomy {
  title: string;
  date: string;
  explanation: string;
  mediaType: ApodMediaType;
  url: string;
  hdUrl?: string;
  copyright?: string;
  isFallback: boolean;
  statusNotice?: string;
}

export interface RawApodResponse {
  title?: string;
  date?: string;
  explanation?: string;
  media_type?: string;
  url?: string;
  hdurl?: string;
  copyright?: string;
  code?: number;
  msg?: string;
  error?: {
    code?: string;
    message?: string;
  };
}
