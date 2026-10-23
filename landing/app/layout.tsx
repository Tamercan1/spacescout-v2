import type { Metadata } from 'next';
import './globals.css';
import { getSiteUrl } from '@/lib/config';

const siteUrl = getSiteUrl();

export const metadata: Metadata = {
  metadataBase: siteUrl ? new URL(siteUrl) : undefined,
  title: 'SpaceScout — AI-Powered Space Exploration with NASA Data',
  description:
    'Explore the cosmos with natural language. SpaceScout uses AI reasoning and live NASA data to retrieve real astronomical discoveries, track near-Earth objects, and monitor solar activity.',
  alternates: siteUrl ? { canonical: siteUrl } : undefined,
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/favicon.png', type: 'image/png' },
    ],
  },
  openGraph: {
    title: 'SpaceScout — AI-Powered Space Exploration',
    description:
      'Ask questions about space in natural language. SpaceScout coordinates NASA data sources, retrieves real observations, and builds structured discoveries you can follow up on.',
    type: 'website',
    siteName: 'SpaceScout',
    ...(siteUrl
      ? {
          url: siteUrl,
          images: [
            {
              url: '/og-image.png',
              width: 1200,
              height: 630,
              alt: 'SpaceScout — AI-Powered Space Exploration with NASA Data',
            },
          ],
        }
      : {}),
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SpaceScout — AI-Powered Space Exploration',
    description:
      'Explore the cosmos with natural language, live NASA data, and AI reasoning.',
    ...(siteUrl ? { images: ['/og-image.png'] } : {}),
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link
          rel="preconnect"
          href="https://fonts.googleapis.com"
          crossOrigin="anonymous"
        />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
