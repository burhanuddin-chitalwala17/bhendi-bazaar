'use client';

import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Shield } from 'lucide-react';

export function AdminAccessButton() {
  const { data: session, status } = useSession();

  // Don't show while loading or if not admin
  if (status === 'loading') return null;
  if (!session?.user || session.user.platformRole !== 'ADMIN') return null;

  return (
    <Button
      asChild
      className="rounded-full bg-info px-6 text-xs font-semibold uppercase tracking-[0.2em] text-primary-foreground hover:bg-info/90"
    >
      <Link href="/admin" className="flex items-center gap-2">
        <Shield className="h-4 w-4" />
        Admin Dashboard
      </Link>
    </Button>
  );
}