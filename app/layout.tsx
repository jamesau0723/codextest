import type { Metadata, Viewport } from 'next';
import './site.css';
import './entrance.css';

export const metadata: Metadata = {
  title: 'D Festival',
  description: 'D Festival — Young Pianist Program.'
};

/**
 * Zoom is retained (no maximumScale, no userScalable: false) and
 * viewportFit: 'cover' exposes the safe-area insets the entrance reads.
 */
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-locale="en">
      <body>{children}</body>
    </html>
  );
}
