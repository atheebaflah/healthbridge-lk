'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function QrScanner() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    let scanner: { clear: () => Promise<void> } | undefined;

    import('html5-qrcode').then(({ Html5QrcodeScanner }) => {
      if (cancelled) return;
      const s = new Html5QrcodeScanner('qr-reader', { fps: 10, qrbox: 250 }, false);
      s.render(
        (text: string) => {
          s.clear().catch(() => {});
          router.push(`/pharmacy?token=${encodeURIComponent(text)}`);
        },
        () => {},
      );
      scanner = s;
    });

    return () => {
      cancelled = true;
      scanner?.clear().catch(() => {});
    };
  }, [router]);

  return <div id="qr-reader" className="overflow-hidden rounded-xl bg-white" />;
}