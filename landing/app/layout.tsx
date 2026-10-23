import type { Metadata } from 'next';
import './globals.css';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

export const metadata: Metadata = {
  title: 'SpaceScout — AI-Powered Space Exploration with NASA Data',
  description:
    'Explore the cosmos with natural language. SpaceScout uses AI reasoning and live NASA data to retrieve real astronomical discoveries, track near-Earth objects, and monitor solar activity.',
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
    ...(siteUrl !== 'http://localhost:3000' ? { url: siteUrl } : {}),
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SpaceScout — AI-Powered Space Exploration',
    description:
      'Explore the cosmos with natural language, live NASA data, and AI reasoning.',
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
    <html lang="en">
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
      <body>{children}</body>
    </html>
  );
}
