import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Acoustic Chronometer',
  description:
    'A daily ambient audio deduction puzzle. Hear a 5-second clip. Identify the era. No speech — just mechanical resonance.',
  keywords: ['audio puzzle', 'daily game', 'sound archaeology', 'spectrogram', 'era guessing'],
  openGraph: {
    title: 'Acoustic Chronometer',
    description: 'Can you identify the decade from 5 seconds of ambient sound?',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen antialiased">
        {children}
      </body>
    </html>
  );
}
