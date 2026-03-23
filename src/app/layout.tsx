import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Meeting Recorder Pro',
  description: 'OBS-like Meeting Recorder application with transcription',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <div className="header">
          🔴 Meeting Recorder Pro
        </div>
        {children}
      </body>
    </html>
  );
}
