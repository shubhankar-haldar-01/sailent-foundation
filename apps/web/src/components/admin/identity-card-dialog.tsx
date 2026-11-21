'use client';

import * as React from 'react';
import { IdCard, Download, Edit3, RotateCcw, Check, Sparkles } from 'lucide-react';

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
  Label,
  cn,
  Spinner,
} from '@sailent/ui';

export interface IdentityCardData {
  id: string;
  name: string;
  designation: string;
  department?: string | null;
  email?: string | null;
  phone?: string | null;
  photoUrl?: string | null;
  logoUrl?: string | null;
  idNumber?: string;
  dob?: string;
  companyName?: string;
}

/*
  Colours: the identity card is printed artwork in its own approved navy
  design, drawn on a canvas, so its hex values stay here rather than in the
  site tokens (visual polish Phase 2, 2026-11-21: no orange in it, nothing to
  swap). Its text is set in Inter, the site's only typeface.
*/

/**
 * Generate a deterministic numeric ID from a string if none is supplied.
 * E.g. "0000060816" matching the 10-digit ID format in the approved design.
 */
export function generateIdNumber(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash << 5) - hash + id.charCodeAt(i);
    hash |= 0;
  }
  const positive = Math.abs(hash);
  const padded = String(positive).padStart(10, '0').slice(-10);
  return padded;
}

/**
 * Derives a professional default email if none is stored for the staff member.
 */
export function defaultEmailFor(name?: string, explicitEmail?: string | null): string {
  if (explicitEmail && explicitEmail.trim()) {
    return explicitEmail.trim();
  }
  if (!name || !name.trim() || name.toLowerCase().includes('austin')) {
    return 'austinortiz@gmail.com';
  }
  const clean = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '');
  return `${clean || 'staff'}@sailent.org`;
}

/**
 * Generates an official ISO/IEC 7810 ID-1 standard PDF file (54 × 85.6 mm).
 * Uses pure PDF 1.4 binary structure with DCTDecode image stream.
 */
export function createIdCardPdfBlob(
  jpegBytes: Uint8Array,
  imageWidth: number,
  imageHeight: number,
): Blob {
  // Page size: 54mm x 85.6mm in PDF points (1 in = 72 pt, 1 in = 25.4 mm)
  const wPt = (54.0 * 72.0) / 25.4; // 153.0709 pt
  const hPt = (85.6 * 72.0) / 25.4; // 242.6457 pt

  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [];

  function addObj(textBeforeStream: string, streamBytes?: Uint8Array, textAfterStream?: string) {
    let currentOffset = 0;
    for (const c of chunks) {
      currentOffset += c.byteLength;
    }
    offsets.push(currentOffset);

    chunks.push(encoder.encode(textBeforeStream));
    if (streamBytes) {
      chunks.push(streamBytes);
    }
    if (textAfterStream) {
      chunks.push(encoder.encode(textAfterStream));
    }
  }

  // Header
  chunks.push(encoder.encode('%PDF-1.4\n'));

  // 1 0 obj: Catalog
  addObj('1 0 obj\n<</Type/Catalog/Pages 2 0 R>>\nendobj\n');

  // 2 0 obj: Pages
  addObj('2 0 obj\n<</Type/Pages/Kids[3 0 R]/Count 1>>\nendobj\n');

  // 3 0 obj: Page (54 x 85.6 mm)
  addObj(
    `3 0 obj\n<</Type/Page/Parent 2 0 R/MediaBox[0 0 ${wPt.toFixed(4)} ${hPt.toFixed(4)}]/Resources<</XObject<</Im1 4 0 R>>>>/Contents 5 0 R>>\nendobj\n`,
  );

  // 4 0 obj: Image XObject (JPEG stream)
  const imgHdr = `4 0 obj\n<</Type/XObject/Subtype/Image/Width ${imageWidth}/Height ${imageHeight}/ColorSpace/DeviceRGB/BitsPerComponent 8/Filter/DCTDecode/Length ${jpegBytes.length}>>\nstream\n`;
  const imgEnd = '\nendstream\nendobj\n';
  addObj(imgHdr, jpegBytes, imgEnd);

  // 5 0 obj: Page Content Stream
  const contentStr = `q\n${wPt.toFixed(4)} 0 0 ${hPt.toFixed(4)} 0 0 cm\n/Im1 Do\nQ\n`;
  const contentBytes = encoder.encode(contentStr);
  const cntHdr = `5 0 obj\n<</Length ${contentBytes.length}>>\nstream\n`;
  const cntEnd = 'endstream\nendobj\n';
  addObj(cntHdr, contentBytes, cntEnd);

  // Cross-reference table (xref)
  let startXref = 0;
  for (const c of chunks) {
    startXref += c.byteLength;
  }

  let xref = 'xref\n0 6\n0000000000 65535 f \n';
  for (const off of offsets) {
    xref += String(off).padStart(10, '0') + ' 00000 n \n';
  }
  const trailer = `trailer\n<</Size 6/Root 1 0 R>>\nstartxref\n${startXref}\n%%EOF\n`;
  chunks.push(encoder.encode(xref + trailer));

  return new Blob(chunks as BlobPart[], { type: 'application/pdf' });
}

function drawAvatar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();

  // Background
  ctx.fillStyle = '#f4f5f8';
  ctx.fillRect(x, y, w, h);

  const cx = x + w / 2;

  // Neck
  ctx.fillStyle = '#e5beaa';
  ctx.fillRect(cx - 9, y + 68, 18, 26);

  // Head
  ctx.beginPath();
  ctx.fillStyle = '#e5beaa';
  ctx.ellipse(cx, y + 48, 24, 30, 0, 0, Math.PI * 2);
  ctx.fill();

  // Hair & Beard
  ctx.fillStyle = '#2b1d16';
  ctx.beginPath();
  ctx.ellipse(cx, y + 36, 25, 20, 0, Math.PI, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx, y + 54, 20, 0, Math.PI);
  ctx.fill();

  // White Shirt Collar
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(cx - 18, y + 88);
  ctx.lineTo(cx, y + 104);
  ctx.lineTo(cx - 8, y + 116);
  ctx.lineTo(cx - 24, y + 100);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(cx + 18, y + 88);
  ctx.lineTo(cx, y + 104);
  ctx.lineTo(cx + 8, y + 116);
  ctx.lineTo(cx + 24, y + 100);
  ctx.closePath();
  ctx.fill();

  // Tie
  ctx.fillStyle = '#071630';
  ctx.beginPath();
  ctx.moveTo(cx - 3, y + 102);
  ctx.lineTo(cx + 3, y + 102);
  ctx.lineTo(cx + 6, y + 134);
  ctx.lineTo(cx, y + 140);
  ctx.lineTo(cx - 6, y + 134);
  ctx.closePath();
  ctx.fill();

  // Suit Jacket
  ctx.beginPath();
  ctx.moveTo(x, y + h);
  ctx.lineTo(x + 22, y + 96);
  ctx.lineTo(cx - 10, y + 96);
  ctx.lineTo(cx - 4, y + 124);
  ctx.lineTo(x + 36, y + h);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(x + w, y + h);
  ctx.lineTo(x + w - 22, y + 96);
  ctx.lineTo(cx + 10, y + 96);
  ctx.lineTo(cx + 4, y + 124);
  ctx.lineTo(x + w - 36, y + h);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

/**
 * Downloads the Identity Card as a standard 54 × 85.6 mm PDF document.
 */
export async function downloadIdentityCardPdf(card: IdentityCardData): Promise<void> {
  // Target 300 DPI high resolution for standard 54 × 85.6 mm card
  const widthPx = 638;
  const heightPx = 1011;
  const baseW = 360;
  const baseH = 570.67;
  const scale = widthPx / baseW;

  const canvas = document.createElement('canvas');
  canvas.width = widthPx;
  canvas.height = heightPx;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.scale(scale, scale);

  // 1. Draw rounded card background
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(0, 0, baseW, baseH, 28);
  } else {
    ctx.rect(0, 0, baseW, baseH);
  }
  ctx.fill();
  ctx.save();
  ctx.clip();

  // 2. Top Header Graphic
  // Accent Blue wedge at top right
  ctx.fillStyle = '#2e63ad';
  ctx.beginPath();
  ctx.moveTo(292, 0);
  ctx.lineTo(360, 0);
  ctx.lineTo(326, 38);
  ctx.lineTo(258, 38);
  ctx.closePath();
  ctx.fill();

  // Dark Navy primary block
  ctx.fillStyle = '#071630';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(292, 0);
  ctx.lineTo(258, 38);
  ctx.lineTo(230, 68);
  ctx.bezierCurveTo(224, 75, 216, 78, 204, 78);
  ctx.lineTo(0, 78);
  ctx.closePath();
  ctx.fill();

  // 2.1 Transparent Logo in Top Header (Using sailent-logo.png)
  const logoImgElement = document.querySelector<HTMLImageElement>(
    '#identity-card-to-print img[data-card-logo]',
  );
  let logoDrawn = false;
  if (logoImgElement && logoImgElement.complete && logoImgElement.naturalWidth > 0) {
    try {
      const logoAspect = logoImgElement.naturalWidth / logoImgElement.naturalHeight;
      const targetLogoH = 36;
      const targetLogoW = Math.min(160, targetLogoH * logoAspect);
      const drawX = 22;
      const drawY = 21; // Centered vertically in 78px navy block (21 + 36/2 = 39)
      ctx.drawImage(logoImgElement, drawX, drawY, targetLogoW, targetLogoH);
      logoDrawn = true;
    } catch {
      logoDrawn = false;
    }
  }

  if (!logoDrawn) {
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px Inter, ui-sans-serif, system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('SAILENT', 24, 39);
  }

  // 3. Photo Box (with balanced top padding below header)
  const photoX = 108;
  const photoY = 116;
  const photoW = 144;
  const photoH = 162;

  // White border & shadow
  ctx.save();
  ctx.shadowColor = 'rgba(7, 22, 48, 0.16)';
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 4;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(photoX - 4, photoY - 4, photoW + 8, photoH + 8);
  ctx.restore();

  // Check if rendered img in DOM is loaded and available
  const imgElement = document.querySelector<HTMLImageElement>('#identity-card-to-print img');
  let photoDrawn = false;
  if (imgElement && imgElement.complete && imgElement.naturalWidth > 0) {
    try {
      ctx.save();
      ctx.beginPath();
      ctx.rect(photoX, photoY, photoW, photoH);
      ctx.clip();
      const imgRatio = imgElement.naturalWidth / imgElement.naturalHeight;
      const targetRatio = photoW / photoH;
      let sw = imgElement.naturalWidth;
      let sh = imgElement.naturalHeight;
      let sx = 0;
      let sy = 0;
      if (imgRatio > targetRatio) {
        sw = sh * targetRatio;
        sx = (imgElement.naturalWidth - sw) / 2;
      } else {
        sh = sw / targetRatio;
        sy = 0;
      }
      ctx.drawImage(imgElement, sx, sy, sw, sh, photoX, photoY, photoW, photoH);
      ctx.restore();
      photoDrawn = true;
    } catch {
      photoDrawn = false;
    }
  }

  if (!photoDrawn) {
    drawAvatar(ctx, photoX, photoY, photoW, photoH);
  }

  // 4. Name & Designation (vertically balanced)
  ctx.fillStyle = '#071630';
  ctx.font = 'bold 24px Inter, ui-sans-serif, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(card.name || 'Austin Ortiz', 180, 312);

  ctx.font = '600 11px Inter, ui-sans-serif, system-ui, sans-serif';
  if ('letterSpacing' in ctx) {
    (ctx as unknown as { letterSpacing: string }).letterSpacing = '2.4px';
  }
  ctx.fillText((card.designation || 'MARKETING MANAGER').toUpperCase(), 180, 332);
  if ('letterSpacing' in ctx) {
    (ctx as unknown as { letterSpacing: string }).letterSpacing = '0px';
  }

  // 5. Details Table
  const idNo = card.idNumber || generateIdNumber(card.id);
  const dob = card.dob || '06/08/16';
  const email = card.email || defaultEmailFor(card.name, card.email);
  const phone = card.phone || '946 385 921';

  const rows = [
    { label: 'ID No', value: idNo },
    { label: 'DOB', value: dob },
    { label: 'Email', value: email },
    { label: 'Phone', value: phone },
  ];

  const tableStartY = 368;
  const rowSpacing = 24;
  rows.forEach((row, i) => {
    const y = tableStartY + i * rowSpacing;
    ctx.textAlign = 'left';
    ctx.font = 'bold 13px Inter, ui-sans-serif, system-ui, sans-serif';
    ctx.fillStyle = '#071630';
    ctx.fillText(row.label, 42, y);

    ctx.textAlign = 'center';
    ctx.fillText(':', 108, y);

    ctx.textAlign = 'left';
    if (row.label === 'Email' && row.value.length > 24) {
      ctx.font = '600 11.5px Inter, ui-sans-serif, system-ui, sans-serif';
    } else {
      ctx.font = '600 13px Inter, ui-sans-serif, system-ui, sans-serif';
    }
    ctx.fillText(row.value, 122, y);
  });

  // 6. Bottom Footer Graphic (Matching top border design)
  const footerY = baseH - 52;
  // Blue wedge
  ctx.fillStyle = '#2e63ad';
  ctx.beginPath();
  ctx.moveTo(0, footerY + 4);
  ctx.lineTo(104, footerY + 4);
  ctx.lineTo(68, baseH);
  ctx.lineTo(0, baseH);
  ctx.closePath();
  ctx.fill();

  // Dark Navy block matching top geometry
  ctx.fillStyle = '#071630';
  ctx.beginPath();
  ctx.moveTo(96, baseH);
  ctx.lineTo(126, footerY + 12);
  ctx.bezierCurveTo(128, footerY + 6, 134, footerY + 4, 144, footerY + 4);
  ctx.lineTo(360, footerY + 4);
  ctx.lineTo(360, baseH);
  ctx.closePath();
  ctx.fill();

  ctx.restore();

  // Convert canvas to JPEG blob
  const jpegBlob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.96);
  });
  if (!jpegBlob) return;

  const jpegBytes = new Uint8Array(await jpegBlob.arrayBuffer());
  const pdfBlob = createIdCardPdfBlob(jpegBytes, widthPx, heightPx);

  // Trigger instant direct PDF download
  const url = URL.createObjectURL(pdfBlob);
  const link = document.createElement('a');
  const safeName = (card.name || 'staff')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-');
  link.href = url;
  link.download = `identity-card-${safeName}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function IdentityCardPreview({
  card,
  printableId = 'identity-card-to-print',
}: {
  card: IdentityCardData;
  printableId?: string;
}) {
  const idNo = card.idNumber || generateIdNumber(card.id);
  const dob = card.dob || '06/08/16';
  const email = card.email || defaultEmailFor(card.name, card.email);
  const phone = card.phone || '946 385 921';
  const name = card.name || 'Austin Ortiz';
  const designation = (card.designation || 'MARKETING MANAGER').toUpperCase();

  const logoSrc = card.logoUrl && card.logoUrl.trim() ? card.logoUrl : '/images/sailent-logo.png';

  return (
    <div
      id={printableId}
      className="identity-card-container relative mx-auto flex h-[571px] w-[360px] select-none flex-col justify-between overflow-hidden rounded-[28px] border border-slate-200/90 bg-white text-[#071630] shadow-2xl"
      style={{
        fontFamily:
          'var(--font-manrope), ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      {/* ──────────────────────────────────────────────────────────────────────── */}
      {/* Top Header Graphic */}
      {/* ──────────────────────────────────────────────────────────────────────── */}
      <div className="relative h-[92px] w-full shrink-0">
        <svg
          viewBox="0 0 360 92"
          className="pointer-events-none absolute inset-0 h-full w-full"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          {/* Accent Blue wedge at top right */}
          <polygon points="292,0 360,0 326,38 258,38" fill="#2e63ad" />

          {/* Dark Navy primary header block covering left 82% at top, angling down, rounding smoothly at bottom right */}
          <path
            d="M 0,0 L 292,0 L 258,38 L 230,68 C 224,75 216,78 204,78 L 0,78 Z"
            fill="#071630"
          />
        </svg>

        {/* Official Brand Logo in dark navy header (transparent) */}
        <div className="absolute left-[22px] top-[21px] z-10 flex h-[36px] max-w-[160px] items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logoSrc}
            alt="Sailent Foundation"
            className="drop-shadow-xs h-full w-auto max-w-full object-contain"
            crossOrigin="anonymous"
            data-card-logo
          />
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────────────────────── */}
      {/* Center Section: Photo, Name, Designation, Key-Value List */}
      {/* ──────────────────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col items-center px-6 pb-2 pt-7">
        {/* Photo Container */}
        <div className="relative h-[162px] w-[144px] shrink-0 overflow-hidden rounded-[3px] border-[4px] border-white bg-slate-100 shadow-[0_4px_14px_rgba(7,22,48,0.14)]">
          {card.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={card.photoUrl}
              alt={name}
              className="h-full w-full object-cover object-top"
              crossOrigin="anonymous"
              data-card-photo
            />
          ) : (
            /* Professional vector avatar matching the suit-and-tie style in sample */
            <div className="flex h-full w-full flex-col items-center justify-end bg-[#f1f3f7]">
              <svg
                viewBox="0 0 100 115"
                className="h-full w-full text-[#071630]"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                {/* Background light gradient */}
                <rect width="100" height="115" fill="#f4f5f8" />
                {/* Neck */}
                <path d="M 44,48 L 56,48 L 56,66 L 44,66 Z" fill="#e5beaa" />
                {/* Head */}
                <ellipse cx="50" cy="34" rx="17" ry="21" fill="#e5beaa" />
                {/* Hair & Beard */}
                <path
                  d="M 33,32 C 33,18 40,14 50,14 C 60,14 67,18 67,32 C 67,32 64,24 50,24 C 36,24 33,32 33,32 Z"
                  fill="#2b1d16"
                />
                <path
                  d="M 37,38 C 37,48 43,53 50,53 C 57,53 63,48 63,38 C 63,44 57,50 50,50 C 43,50 37,44 37,38 Z"
                  fill="#2b1d16"
                  opacity="0.9"
                />
                {/* White Shirt Collar */}
                <polygon points="38,62 50,72 44,80 34,70" fill="#ffffff" />
                <polygon points="62,62 50,72 56,80 66,70" fill="#ffffff" />
                {/* Dark Tie */}
                <polygon points="48,71 52,71 54,92 50,96 46,92" fill="#071630" />
                {/* Dark Suit Jacket */}
                <path d="M 12,115 L 28,68 C 33,64 38,62 44,62 L 48,82 L 36,115 Z" fill="#071630" />
                <path d="M 88,115 L 72,68 C 67,64 62,62 56,62 L 52,82 L 64,115 Z" fill="#071630" />
              </svg>
            </div>
          )}
        </div>

        {/* Full Name */}
        <h2 className="mt-4 max-w-[320px] truncate text-center text-[26px] font-bold leading-[30px] tracking-tight text-[#071630]">
          {name}
        </h2>

        {/* Designation */}
        <p className="mt-1 max-w-[320px] truncate text-center text-[11px] font-semibold uppercase leading-[15px] tracking-[0.24em] text-[#071630]">
          {designation}
        </p>

        {/* Key-Value Details Table */}
        <div className="mt-5 w-[285px] space-y-2 text-[13px] text-[#071630]">
          {/* Row 1: ID No */}
          <div className="flex items-baseline">
            <span className="w-[64px] shrink-0 font-bold">ID No</span>
            <span className="w-[18px] shrink-0 text-center font-bold">:</span>
            <span className="truncate font-semibold tabular-nums tracking-wide">{idNo}</span>
          </div>

          {/* Row 2: DOB */}
          <div className="flex items-baseline">
            <span className="w-[64px] shrink-0 font-bold">DOB</span>
            <span className="w-[18px] shrink-0 text-center font-bold">:</span>
            <span className="truncate font-semibold tabular-nums tracking-wide">{dob}</span>
          </div>

          {/* Row 3: Email */}
          <div className="flex items-baseline">
            <span className="w-[64px] shrink-0 font-bold">Email</span>
            <span className="w-[18px] shrink-0 text-center font-bold">:</span>
            <span
              className={`truncate font-semibold ${
                email.length > 24 ? 'text-[11.5px]' : 'text-[12.5px]'
              }`}
            >
              {email}
            </span>
          </div>

          {/* Row 4: Phone */}
          <div className="flex items-baseline">
            <span className="w-[64px] shrink-0 font-bold">Phone</span>
            <span className="w-[18px] shrink-0 text-center font-bold">:</span>
            <span className="truncate font-semibold tabular-nums tracking-wide">{phone}</span>
          </div>
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────────────────────── */}
      {/* Bottom Footer Graphic (Matching Top Border Design) */}
      {/* ──────────────────────────────────────────────────────────────────────── */}
      <div className="relative h-[52px] w-full shrink-0">
        <svg
          viewBox="0 0 360 52"
          className="pointer-events-none absolute inset-0 h-full w-full"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          {/* Accent Blue wedge at bottom left */}
          <polygon points="0,4 104,4 68,52 0,52" fill="#2e63ad" />

          {/* Dark Navy block at bottom right matching the top header geometry */}
          <path d="M 96,52 L 126,12 C 128,6 134,4 144,4 L 360,4 L 360,52 Z" fill="#071630" />
        </svg>
      </div>
    </div>
  );
}

export function IssueIdentityCardDialog({
  initialData,
  trigger,
}: {
  initialData: IdentityCardData;
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const [isEditing, setIsEditing] = React.useState(false);
  const [isDownloading, setIsDownloading] = React.useState(false);

  // Editable state
  const [name, setName] = React.useState(initialData.name);
  const [designation, setDesignation] = React.useState(initialData.designation);
  const [idNumber, setIdNumber] = React.useState(
    initialData.idNumber || generateIdNumber(initialData.id),
  );
  const [dob, setDob] = React.useState(initialData.dob || '06/08/16');
  const [email, setEmail] = React.useState(defaultEmailFor(initialData.name, initialData.email));
  const [phone, setPhone] = React.useState(initialData.phone || '946 385 921');
  const [companyName, setCompanyName] = React.useState(
    initialData.companyName || 'SAILENT FOUNDATION',
  );
  const [photoUrl, setPhotoUrl] = React.useState(initialData.photoUrl || '');
  const [logoUrl, setLogoUrl] = React.useState(initialData.logoUrl || '/images/sailent-logo.png');

  // Reset to initial
  const handleReset = () => {
    setName(initialData.name);
    setDesignation(initialData.designation);
    setIdNumber(initialData.idNumber || generateIdNumber(initialData.id));
    setDob(initialData.dob || '06/08/16');
    setEmail(defaultEmailFor(initialData.name, initialData.email));
    setPhone(initialData.phone || '946 385 921');
    setCompanyName(initialData.companyName || 'SAILENT FOUNDATION');
    setPhotoUrl(initialData.photoUrl || '');
    setLogoUrl(initialData.logoUrl || '/images/sailent-logo.png');
    setIsEditing(false);
  };

  const currentCard: IdentityCardData = {
    id: initialData.id,
    name,
    designation,
    idNumber,
    dob,
    email,
    phone,
    companyName,
    photoUrl: photoUrl.trim() ? photoUrl : null,
    logoUrl: logoUrl.trim() ? logoUrl : null,
  };

  const handleDownload = async () => {
    try {
      setIsDownloading(true);
      await downloadIdentityCardPdf(currentCard);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button
            variant="ghost"
            size="sm"
            className="hover:bg-primary/10 hover:text-primary text-foreground gap-1.5 text-xs font-medium"
          >
            <IdCard className="text-primary size-3.5" aria-hidden="true" />
            <span>ID Card</span>
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="flex max-w-4xl flex-col overflow-hidden p-0 sm:max-h-[92vh]">
        <DialogHeader className="border-border bg-surface shrink-0 border-b p-5">
          <div className="flex flex-col gap-3.5 pr-14 sm:flex-row sm:items-center sm:justify-between sm:pr-16">
            <div className="flex min-w-0 items-center gap-3">
              <div className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-xl">
                <IdCard className="size-5" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-foreground text-base font-bold tracking-tight">
                  Official Staff Identity Card
                </DialogTitle>
                <DialogDescription className="text-muted-foreground truncate text-xs sm:text-clip">
                  Approved 100% exact CR80 standard identity card (54 × 85.6 mm PDF) for {name}.
                </DialogDescription>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2.5">
              <button
                type="button"
                onClick={() => setIsEditing(!isEditing)}
                className={cn(
                  'inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-full px-4 text-xs font-semibold transition-colors',
                  isEditing
                    ? 'border-primary/30 bg-primary/10 text-primary hover:bg-primary/15 border'
                    : 'border-border bg-surface text-foreground hover:bg-muted hover:text-foreground shadow-xs border',
                )}
              >
                <Edit3 className="size-3.5" />
                <span>{isEditing ? 'Preview Mode' : 'Edit Details'}</span>
              </button>

              <Button
                variant="primary"
                size="sm"
                onClick={handleDownload}
                disabled={isDownloading}
                className="shadow-xs gap-1.5 text-xs font-semibold"
              >
                {isDownloading ? (
                  <Spinner className="size-3.5" />
                ) : (
                  <Download className="size-3.5" />
                )}
                <span>Download PDF</span>
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="flex flex-1 flex-col items-center justify-center gap-8 overflow-y-auto bg-muted/70 p-6 lg:flex-row lg:items-start">
          {/* Card Preview Column */}
          <div className="flex flex-col items-center">
            <div className="rounded-3xl border border-border bg-surface p-3 shadow-sm">
              <IdentityCardPreview card={currentCard} />
            </div>
            <p className="text-muted-foreground mt-3 text-center text-[11px]">
              Standard Physical Dimension: 54 × 85.6 mm (CR80) · PDF Ready
            </p>
          </div>

          {/* Edit Form Sidebar (when toggled or on desktop) */}
          {isEditing ? (
            <div className="bg-surface border-border shadow-xs w-full max-w-sm shrink-0 space-y-4 rounded-2xl border p-5">
              <div className="border-border flex items-center justify-between border-b pb-2">
                <h3 className="text-foreground flex items-center gap-1.5 text-sm font-semibold">
                  <Sparkles className="text-primary size-4" />
                  Customize Card Information
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleReset}
                  className="text-muted-foreground h-7 px-2 text-[11px]"
                >
                  <RotateCcw className="mr-1 size-3" />
                  Reset
                </Button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <Label htmlFor="card-company" className="text-xs font-medium">
                    Organization / Company
                  </Label>
                  <Input
                    id="card-company"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="mt-1 h-8 text-xs"
                    placeholder="SAILENT FOUNDATION"
                  />
                </div>

                <div>
                  <Label htmlFor="card-name" className="text-xs font-medium">
                    Staff Name
                  </Label>
                  <Input
                    id="card-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="mt-1 h-8 text-xs"
                  />
                </div>

                <div>
                  <Label htmlFor="card-designation" className="text-xs font-medium">
                    Designation / Title
                  </Label>
                  <Input
                    id="card-designation"
                    value={designation}
                    onChange={(e) => setDesignation(e.target.value)}
                    className="mt-1 h-8 text-xs"
                  />
                </div>

                <div>
                  <Label htmlFor="card-idno" className="text-xs font-medium">
                    ID Number
                  </Label>
                  <Input
                    id="card-idno"
                    value={idNumber}
                    onChange={(e) => setIdNumber(e.target.value)}
                    className="mt-1 h-8 font-mono text-xs"
                  />
                </div>

                <div>
                  <Label htmlFor="card-dob" className="text-xs font-medium">
                    DOB / Date of Joining
                  </Label>
                  <Input
                    id="card-dob"
                    value={dob}
                    onChange={(e) => setDob(e.target.value)}
                    className="mt-1 h-8 font-mono text-xs"
                    placeholder="DD/MM/YY"
                  />
                </div>

                <div>
                  <Label htmlFor="card-email" className="text-xs font-medium">
                    Official Email
                  </Label>
                  <Input
                    id="card-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="mt-1 h-8 text-xs"
                  />
                </div>

                <div>
                  <Label htmlFor="card-phone" className="text-xs font-medium">
                    Contact Phone
                  </Label>
                  <Input
                    id="card-phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="mt-1 h-8 text-xs"
                  />
                </div>

                <div>
                  <Label htmlFor="card-photo" className="text-xs font-medium">
                    Custom Photo URL
                  </Label>
                  <Input
                    id="card-photo"
                    value={photoUrl}
                    onChange={(e) => setPhotoUrl(e.target.value)}
                    className="mt-1 h-8 text-xs"
                    placeholder="https://..."
                  />
                </div>

                <div>
                  <Label htmlFor="card-logo" className="text-xs font-medium">
                    Organization Logo URL
                  </Label>
                  <Input
                    id="card-logo"
                    value={logoUrl}
                    onChange={(e) => setLogoUrl(e.target.value)}
                    className="mt-1 h-8 text-xs"
                    placeholder="/images/sailent-logo.png"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={() => setIsEditing(false)}
                  className="w-full gap-1.5 text-xs font-semibold"
                >
                  <Check className="size-3.5" />
                  <span>Done Editing</span>
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
