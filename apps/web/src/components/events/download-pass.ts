/**
 * Client-side high-resolution pass image generator and downloader.
 * Generates an official, market-standard PNG pass directly on canvas with zero external dependencies.
 * Supports multi-pass generation in a single combined ticket sheet (max 4 passes).
 */

import QRCode from 'qrcode';

import { BRAND_COLOURS as C } from '@/lib/brand-colours';

export interface DownloadPassOptions {
  passNumber: string;
  eventTitle: string;
  startsAt: string;
  endsAt?: string | null;
  venueName?: string | null;
  city?: string | null;
  fullName: string;
  email?: string | null;
  phone?: string | null;
  isPaid?: boolean;
  feeAmount?: number | null;
  registeredAt?: string | null;
  supportEmail?: string | null;
  supportPhone?: string | null;
  functionName?: string | null;
  attendees?: { fullName: string; passNumber?: string }[] | null;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

interface PassRenderItem {
  fullName: string;
  passNumber: string;
  seatIndex: number;
}

function renderSinglePassCard(
  ctx: CanvasRenderingContext2D,
  yOffset: number,
  item: PassRenderItem,
  totalPasses: number,
  options: DownloadPassOptions,
  logoImg: HTMLImageElement | null,
  formattedDate: string,
  timeRange: string,
  issueDateStr: string,
) {
  const {
    eventTitle,
    venueName,
    city,
    email,
    phone,
    isPaid = false,
    feeAmount = null,
    functionName,
    supportEmail = 'hello@sailentfoundation.org',
    supportPhone = '+91 98765 43210',
  } = options;

  const cardX = 16;
  const cardY = yOffset + 16;
  const cardW = 768;
  const cardH = 556;

  // Card Outer Container
  ctx.fillStyle = C.surface;
  roundRect(ctx, cardX, cardY, cardW, cardH, 20);
  ctx.fill();
  ctx.strokeStyle = C.borderStrong;
  ctx.lineWidth = 2;
  ctx.stroke();

  // Logo / Branding
  if (logoImg && logoImg.naturalWidth > 0) {
    ctx.drawImage(logoImg, 40, cardY + 20, 140, 36);
  } else {
    ctx.fillStyle = C.text;
    ctx.font = 'bold 20px system-ui, -apple-system, sans-serif';
    ctx.fillText('Sailent Foundation', 40, cardY + 44);
  }

  // Statutory subtitle
  ctx.fillStyle = C.textMuted;
  ctx.font = 'bold 10px system-ui, -apple-system, sans-serif';
  ctx.fillText('SAILENT FOUNDATION', 196, cardY + 32);
  ctx.fillStyle = C.textSubtle;
  ctx.font = '9.5px system-ui, -apple-system, sans-serif';
  ctx.fillText('Section 12A & 80G Registered NGO', 196, cardY + 48);

  // Top right badge: CONFIRMED ADMISSION
  roundRect(ctx, 552, cardY + 18, 200, 32, 16);
  ctx.fillStyle = C.successTint;
  ctx.fill();
  ctx.strokeStyle = C.successBorder;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = C.success;
  ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
  ctx.fillText('✓ CONFIRMED ADMISSION', 574, cardY + 38);

  ctx.fillStyle = C.textMuted;
  ctx.font = 'bold 9.5px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('OFFICIAL EVENT ENTRY PASS', 752, cardY + 64);
  ctx.textAlign = 'left';

  // Perforated Dashed Line with Ticket Notches
  const lineY = cardY + 80;
  ctx.save();
  ctx.setLineDash([6, 6]);
  ctx.strokeStyle = C.borderStrong;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cardX, lineY);
  ctx.lineTo(cardX + cardW, lineY);
  ctx.stroke();
  ctx.restore();

  // Left & Right Notches
  ctx.fillStyle = C.page;
  ctx.beginPath();
  ctx.arc(cardX, lineY, 10, -Math.PI / 2, Math.PI / 2);
  ctx.fill();
  ctx.strokeStyle = C.borderStrong;
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(cardX + cardW, lineY, 10, Math.PI / 2, -Math.PI / 2);
  ctx.fill();
  ctx.stroke();

  // Pass ID Hero Bar
  const heroY = cardY + 96;
  roundRect(ctx, 40, heroY, 720, 68, 14);
  const grad = ctx.createLinearGradient(40, heroY, 760, heroY + 68);
  grad.addColorStop(0, C.brandTint);
  grad.addColorStop(1, C.brandTint);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.strokeStyle = C.brandTintStrong;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = C.textSubtle;
  ctx.font = 'bold 10px system-ui, -apple-system, sans-serif';
  ctx.fillText('★ UNIQUE PASS ID / ENTRY CODE', 58, heroY + 22);

  ctx.fillStyle = C.brand;
  ctx.font = '900 22px monospace, monospace';
  ctx.fillText(item.passNumber, 58, heroY + 50);

  // Seat / Pass badge inside hero bar
  const seatPillText =
    totalPasses > 1 ? `Pass ${item.seatIndex} of ${totalPasses}` : '1 Seat Reserved';
  roundRect(ctx, 592, heroY + 18, 152, 32, 8);
  ctx.fillStyle = C.surface;
  ctx.fill();
  ctx.strokeStyle = C.brandTintStrong;
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = C.textStrong;
  ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(seatPillText, 668, heroY + 38);
  ctx.textAlign = 'left';

  // Event Title & Function / Activity Section
  const titleY = cardY + 188;
  ctx.fillStyle = C.brand;
  ctx.font = 'bold 10px system-ui, -apple-system, sans-serif';
  if (functionName) {
    ctx.fillText(`EVENT TITLE • ACTIVITY: ${functionName.toUpperCase()}`, 40, titleY);
  } else {
    ctx.fillText('EVENT TITLE', 40, titleY);
  }

  ctx.fillStyle = C.text;
  ctx.font = 'bold 17px system-ui, -apple-system, sans-serif';
  ctx.fillText(eventTitle, 40, titleY + 22);

  // 4 Detail Cards (Left 2x2 grid)
  const drawCard = (
    x: number,
    y: number,
    w: number,
    h: number,
    label: string,
    val1: string,
    val2: string,
    val2Color = C.textMuted,
  ) => {
    roundRect(ctx, x, y, w, h, 10);
    ctx.fillStyle = C.page;
    ctx.fill();
    ctx.strokeStyle = C.border;
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = C.textSubtle;
    ctx.font = 'bold 10px system-ui, -apple-system, sans-serif';
    ctx.fillText(label, x + 12, y + 20);

    ctx.fillStyle = C.text;
    ctx.font = 'bold 12.5px system-ui, -apple-system, sans-serif';
    ctx.fillText(val1, x + 12, y + 42);

    ctx.fillStyle = val2Color;
    ctx.font = '11px system-ui, -apple-system, sans-serif';
    ctx.fillText(val2, x + 12, y + 60);
  };

  const gridY = cardY + 228;

  // Card 1: Date & Time
  drawCard(40, gridY, 230, 74, '📅 Date & Schedule', formattedDate, `${timeRange} (IST)`);

  // Card 2: Venue & Location
  drawCard(
    280,
    gridY,
    230,
    74,
    '📍 Venue & Location',
    venueName || city || 'Venue to be confirmed',
    city ? `${city}, India` : 'Physical Event',
  );

  // Card 3: Attendee Name
  const attendeeSubtext = functionName
    ? `${functionName} • Seat ${item.seatIndex} of ${totalPasses}`
    : email || phone || '1 Person (Single Entry)';
  drawCard(
    40,
    gridY + 82,
    230,
    74,
    '👤 Registered Attendee',
    item.fullName || 'Guest Attendee',
    attendeeSubtext,
    C.textSubtle,
  );

  // Card 4: Fee & Status
  const feeLabel = isPaid && feeAmount ? `Paid ₹${Math.round(feeAmount / 100)}` : 'Free Entry Pass';
  drawCard(
    280,
    gridY + 82,
    230,
    74,
    '🛡 Admission Fee',
    feeLabel,
    isPaid ? '✓ Payment Verified (Online)' : '✓ Complimentary NGO Entry',
    C.success,
  );

  // Right Column: Security Verification Box (QR + Seal + Pass ID)
  const secBoxX = 524;
  const secBoxY = cardY + 180;
  const secBoxW = 236;
  const secBoxH = 204;
  roundRect(ctx, secBoxX, secBoxY, secBoxW, secBoxH, 12);
  ctx.fillStyle = C.page;
  ctx.fill();
  ctx.strokeStyle = C.border;
  ctx.lineWidth = 1;
  ctx.stroke();

  // --- Upper Tier: Left (QR Code) & Right (Official Seal + Badge) ---
  const plateX = 538;
  const plateY = secBoxY + 10;
  const plateW = 88;
  const plateH = 88;
  const qrPlateCenterX = plateX + plateW / 2;

  roundRect(ctx, plateX, plateY, plateW, plateH, 8);
  ctx.fillStyle = C.surface;
  ctx.fill();
  ctx.strokeStyle = C.border;
  ctx.lineWidth = 1;
  ctx.stroke();

  // Optical corner reticle brackets
  ctx.strokeStyle = C.brand;
  ctx.lineWidth = 1.5;
  ctx.lineCap = 'round';
  const cLen = 6;
  // Top-left
  ctx.beginPath();
  ctx.moveTo(plateX + 3, plateY + 3 + cLen);
  ctx.lineTo(plateX + 3, plateY + 3);
  ctx.lineTo(plateX + 3 + cLen, plateY + 3);
  ctx.stroke();
  // Top-right
  ctx.beginPath();
  ctx.moveTo(plateX + plateW - 3 - cLen, plateY + 3);
  ctx.lineTo(plateX + plateW - 3, plateY + 3);
  ctx.lineTo(plateX + plateW - 3, plateY + 3 + cLen);
  ctx.stroke();
  // Bottom-left
  ctx.beginPath();
  ctx.moveTo(plateX + 3, plateY + plateH - 3 - cLen);
  ctx.lineTo(plateX + 3, plateY + plateH - 3);
  ctx.lineTo(plateX + 3 + cLen, plateY + plateH - 3);
  ctx.stroke();
  // Bottom-right
  ctx.beginPath();
  ctx.moveTo(plateX + plateW - 3 - cLen, plateY + plateH - 3);
  ctx.lineTo(plateX + plateW - 3, plateY + plateH - 3);
  ctx.lineTo(plateX + plateW - 3, plateY + plateH - 3 - cLen);
  ctx.stroke();

  // QR Code Pattern
  try {
    const qrData = QRCode.create(item.passNumber, { errorCorrectionLevel: 'M' });
    const qrSize = qrData.modules.size;
    const qrPixelSize = 70 / qrSize;
    const qrTotalDim = qrSize * qrPixelSize;
    const qrStartX = qrPlateCenterX - qrTotalDim / 2;
    const qrStartY = plateY + plateH / 2 - qrTotalDim / 2;

    ctx.fillStyle = C.text;
    for (let r = 0; r < qrSize; r++) {
      for (let c = 0; c < qrSize; c++) {
        if (qrData.modules.get(r, c)) {
          ctx.fillRect(
            qrStartX + c * qrPixelSize,
            qrStartY + r * qrPixelSize,
            qrPixelSize,
            qrPixelSize,
          );
        }
      }
    }
  } catch {
    // fallback if error generating QR
  }

  // Scan text under QR Plate
  ctx.fillStyle = C.textSubtle;
  ctx.font = 'bold 7.5px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('SCAN AT ENTRANCE', qrPlateCenterX, secBoxY + 109);

  // Right: Official Circular Seal Stamp
  const sealX = 696;
  const sealY = secBoxY + 50;
  const sealR = 27;

  ctx.save();
  ctx.beginPath();
  ctx.arc(sealX, sealY, sealR, 0, Math.PI * 2);
  ctx.fillStyle = C.brandTint;
  ctx.fill();
  ctx.strokeStyle = C.brand;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 3]);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(sealX, sealY, sealR - 4.5, 0, Math.PI * 2);
  ctx.setLineDash([]);
  ctx.strokeStyle = C.brandTintStrong;
  ctx.lineWidth = 1;
  ctx.stroke();

  // Checkmark
  ctx.beginPath();
  ctx.moveTo(sealX - 5.5, sealY - 8);
  ctx.lineTo(sealX - 1.5, sealY - 4);
  ctx.lineTo(sealX + 6.5, sealY - 12);
  ctx.strokeStyle = C.brand;
  ctx.lineWidth = 2.2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke();

  ctx.fillStyle = C.brand;
  ctx.font = '900 8px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('VERIFIED', sealX, sealY + 2);

  ctx.fillStyle = C.textStrong;
  ctx.font = 'bold 6.5px system-ui, -apple-system, sans-serif';
  ctx.fillText('SAILENT PASS', sealX, sealY + 12);
  ctx.restore();

  // Valid Entry Badge Pill below seal
  roundRect(ctx, 656, secBoxY + 86, 80, 18, 9);
  ctx.fillStyle = C.successTint;
  ctx.fill();
  ctx.strokeStyle = C.successBorder;
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = C.success;
  ctx.font = 'bold 7.5px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('✓ VALID ENTRY', sealX, secBoxY + 98);

  // --- Divider between Upper and Lower Tiers ---
  ctx.save();
  ctx.strokeStyle = C.border;
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(536, secBoxY + 120);
  ctx.lineTo(748, secBoxY + 120);
  ctx.stroke();
  ctx.restore();

  // --- Lower Tier: the pass ID, centred between the divider (+120) and the
  // box's foot (+204); typed in at the gate if the QR cannot be read ---
  ctx.fillStyle = C.text;
  ctx.font = 'bold 12px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(item.passNumber, 642, secBoxY + 161);

  ctx.fillStyle = C.textFaint;
  ctx.font = 'bold 6.5px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('PASS ID • NON-TRANSFERABLE', 642, secBoxY + 174);
  ctx.textAlign = 'left';

  // Important Check-In Guidelines & Entry Terms Box
  const guideY = cardY + 396;
  roundRect(ctx, 40, guideY, 720, 102, 10);
  ctx.fillStyle = C.page;
  ctx.fill();
  ctx.strokeStyle = C.border;
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = C.text;
  ctx.font = 'bold 10.5px system-ui, -apple-system, sans-serif';
  ctx.fillText('⚠ IMPORTANT CHECK-IN GUIDELINES & ENTRY TERMS', 54, guideY + 18);

  ctx.font = '9.5px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = C.textMuted;
  ctx.fillText(
    '1. Photo ID Required: Carry valid Govt. photo ID matching attendee name.',
    54,
    guideY + 40,
  );
  ctx.fillText(
    '3. Check-in Desk: Present this digital pass or physical printout at entrance.',
    54,
    guideY + 62,
  );
  ctx.fillText(
    '2. Non-Transferable: Admits 1 person only; cannot be exchanged or resold.',
    410,
    guideY + 40,
  );
  ctx.fillText(
    '4. Reporting Time: Arrive 20 mins before start; right of admission reserved.',
    410,
    guideY + 62,
  );

  // Footer Strip
  const footerY = cardY + 510;
  ctx.strokeStyle = C.border;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(40, footerY);
  ctx.lineTo(760, footerY);
  ctx.stroke();

  ctx.fillStyle = C.textSubtle;
  ctx.font = '9.5px system-ui, -apple-system, sans-serif';
  ctx.fillText(`Sailent Foundation • Support: ${supportEmail} | ${supportPhone}`, 40, footerY + 20);

  ctx.textAlign = 'right';
  ctx.fillStyle = C.textFaint;
  ctx.font = '9px system-ui, -apple-system, sans-serif';
  ctx.fillText(
    `Issued on ${issueDateStr} • Computer-generated valid entry document`,
    760,
    footerY + 20,
  );
  ctx.textAlign = 'left';
}

export async function downloadPassImage(options: DownloadPassOptions): Promise<void> {
  const { passNumber, startsAt, endsAt, registeredAt, fullName, attendees } = options;

  const formattedDate = new Intl.DateTimeFormat('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  }).format(new Date(startsAt));

  const startTimeStr = new Intl.DateTimeFormat('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata',
  }).format(new Date(startsAt));

  const endTimeStr = endsAt
    ? new Intl.DateTimeFormat('en-IN', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZone: 'Asia/Kolkata',
      }).format(new Date(endsAt))
    : null;

  const timeRange = endTimeStr ? `${startTimeStr} – ${endTimeStr}` : startTimeStr;

  const issueDateStr = registeredAt
    ? new Intl.DateTimeFormat('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: 'Asia/Kolkata',
      }).format(new Date(registeredAt))
    : new Intl.DateTimeFormat('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: 'Asia/Kolkata',
      }).format(new Date());

  // Determine list of passes to generate in the single image file
  const passList: PassRenderItem[] = [];
  if (attendees && attendees.length > 0) {
    attendees.forEach((att, idx) => {
      passList.push({
        fullName: att.fullName?.trim() || (idx === 0 ? fullName : `Attendee ${idx + 1}`),
        passNumber:
          att.passNumber || (attendees.length > 1 ? `${passNumber}-${idx + 1}` : passNumber),
        seatIndex: idx + 1,
      });
    });
  } else {
    passList.push({
      fullName: fullName || 'Guest Attendee',
      passNumber,
      seatIndex: 1,
    });
  }

  const totalPasses = Math.min(4, Math.max(1, passList.length));
  const passesToRender = passList.slice(0, totalPasses);

  // Setup 2x high-resolution canvas
  const scale = 2;
  const width = 800;
  const cardHeight = 588;
  const gap = 44;
  const height =
    totalPasses === 1 ? cardHeight : totalPasses * cardHeight + (totalPasses - 1) * gap;

  const canvas = document.createElement('canvas');
  canvas.width = width * scale;
  canvas.height = height * scale;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.scale(scale, scale);

  // Background canvas fill
  ctx.fillStyle = C.surface;
  ctx.fillRect(0, 0, width, height);

  // Pre-load logo once
  let logoImg: HTMLImageElement | null = null;
  try {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = '/images/sailent-logo.png';
    await new Promise<void>((resolve) => {
      img.onload = () => {
        logoImg = img;
        resolve();
      };
      img.onerror = () => resolve();
    });
  } catch {
    logoImg = null;
  }

  // Render each pass stacked vertically
  for (let i = 0; i < passesToRender.length; i++) {
    const yOffset = i * (cardHeight + gap);

    // If subsequent pass, render clear perforated tear/cut guideline
    if (i > 0) {
      const cutY = yOffset - gap / 2;
      ctx.save();
      ctx.setLineDash([6, 6]);
      ctx.strokeStyle = C.textFaint;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(30, cutY);
      ctx.lineTo(770, cutY);
      ctx.stroke();
      ctx.restore();

      const cutBadgeW = 340;
      const cutBadgeH = 22;
      roundRect(ctx, (width - cutBadgeW) / 2, cutY - cutBadgeH / 2, cutBadgeW, cutBadgeH, 11);
      ctx.fillStyle = C.surface;
      ctx.fill();
      ctx.strokeStyle = C.borderStrong;
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = C.textSubtle;
      ctx.font = 'bold 9px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('✂  TEAR / CUT ALONG LINE TO SEPARATE PASSES  ✂', width / 2, cutY + 3.5);
      ctx.textAlign = 'left';
    }

    const currentPass = passesToRender[i];
    if (!currentPass) continue;

    renderSinglePassCard(
      ctx,
      yOffset,
      currentPass,
      totalPasses,
      options,
      logoImg,
      formattedDate,
      timeRange,
      issueDateStr,
    );
  }

  // Convert canvas to Blob and download single image file
  const downloadFileName =
    totalPasses > 1 ? `Sailent-Passes-${passNumber}.png` : `Sailent-Pass-${passNumber}.png`;

  return new Promise<void>((resolve) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          resolve();
          return;
        }
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = downloadFileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => {
          URL.revokeObjectURL(url);
          resolve();
        }, 500);
      },
      'image/png',
      1.0,
    );
  });
}
