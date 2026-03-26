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
        <header style={{ display: 'flex', alignItems: 'center', padding: '16px 24px', background: 'var(--bg-main)', borderBottom: '1px solid var(--border-color)' }}>
          <h1 style={{ fontSize: '22px', margin: 0, fontWeight: 700, color: 'var(--text-main)', letterSpacing: '-0.5px' }}>VG Recorder</h1>
        </header>
        {children}
      </body>
    </html>
  );
}
