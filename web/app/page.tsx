
import Link from 'next/link';
import { SignedIn, SignedOut, SignInButton, SignOutButton } from '@asgardeo/nextjs';

export default function Home() {

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-6 p-6 text-center">
      <h1 className="text-3xl font-bold">HealthBridge LK</h1>
      <p className="text-slate-600">One PHN, one record, across every hospital. You decide who sees it.</p>

      <SignedOut>
        <SignInButton className="rounded-lg bg-teal-700 px-6 py-3 font-medium text-white" />
      </SignedOut>

      <SignedIn>
        <Link href="/doctor" className="rounded-lg border border-teal-700 px-6 py-3 font-medium text-teal-700">
          Doctor portal
        </Link>
        <div className="flex flex-col gap-3">
          <Link href="/timeline" className="rounded-lg bg-teal-700 px-6 py-3 font-medium text-white">
            View my health timeline
          </Link>
          <SignOutButton className="rounded-lg border border-slate-300 px-6 py-3" />
        </div>
      </SignedIn>

      <p className="text-xs text-slate-400">Demo project. All data is fake.</p>
    </main>
  );
}