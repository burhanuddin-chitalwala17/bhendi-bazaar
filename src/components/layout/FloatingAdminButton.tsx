'use client';

import { useSession } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Shield, X } from 'lucide-react';
import { useState } from 'react';

export function FloatingAdminButton() {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const [isMinimized, setIsMinimized] = useState(false);

  // Don't show while loading, if not admin, or already on admin pages
  if (status === 'loading') return null;
  if (!session?.user || session.user.platformRole !== 'ADMIN') return null;
  if (pathname?.startsWith('/admin')) return null;

  if (isMinimized) {
    return (
      <button
        onClick={() => setIsMinimized(false)}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-info text-primary-foreground shadow-overlay hover:bg-info/90 transition-all hover:scale-110"
        aria-label="Show admin access"
      >
        <Shield className="h-6 w-6" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-full bg-info px-6 py-3 text-primary-foreground shadow-overlay transition-all hover:shadow-overlay">
      <Shield className="h-5 w-5" />
      <Link
        prefetch={false}
        href="/admin"
        className="text-sm font-semibold uppercase tracking-wider hover:underline"
      >
        Admin Dashboard
      </Link>
      <button
        onClick={() => setIsMinimized(true)}
        className="ml-2 rounded-full p-1 hover:bg-info/90 transition-colors"
        aria-label="Minimize"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}