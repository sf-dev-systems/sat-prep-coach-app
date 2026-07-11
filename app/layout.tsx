import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import './globals.css';
import { getSupabaseServerClient } from '@/lib/db';
import SignOutButton from '@/components/SignOutButton';

export const metadata: Metadata = {
  title: 'AI SAT Prep Coach',
  description: 'Personalized Digital SAT preparation and tutoring system.',
  manifest: '/manifest.json',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Read-only lookup for the header — no setAll needed since Server
  // Components can't write response cookies; middleware.ts already
  // handles session refresh on every request.
  const cookieStore = cookies();
  const supabase = getSupabaseServerClient({ getAll: () => cookieStore.getAll() });
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body>
        <main className="max-w-4xl mx-auto px-4 py-6 md:py-12">
          {user && (
            <div className="flex items-center justify-end gap-3 mb-4 text-xs text-gray-500">
              <span>{user.email}</span>
              <SignOutButton />
            </div>
          )}
          {children}
        </main>
      </body>
    </html>
  );
}
