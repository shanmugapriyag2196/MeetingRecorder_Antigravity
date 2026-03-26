import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'VG Recorder',
  description: 'Pro screen & audio recorder with real-time meeting transcription powered by Vercel Blob and Supabase.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <header style={{ display: 'flex', alignItems: 'center', padding: '12px 24px', background: 'var(--bg-main)', borderBottom: '1px solid var(--border-color)' }}>
          <img src="/vg-logo.png" alt="Value Global Logo" style={{ height: '48px', objectFit: 'contain' }} />
        </header>
        {children}
      </body>
    </html>
  );
}
