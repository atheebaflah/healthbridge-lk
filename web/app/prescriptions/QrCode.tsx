'use client';

import { QRCodeSVG } from 'qrcode.react';

export default function QrCode({ value }: { value: string }) {
  return <QRCodeSVG value={value} size={180} />;
}