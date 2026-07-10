import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AI SAT Prep Coach',
  description: 'Personalized Digital SAT preparation and tutoring system.',
  manifest: '/manifest.json',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body>
        <main className="max-w-4xl mx-auto px-4 py-6 md:py-12">
          {children}
        </main>
      </body>
    </html>
  );
}
