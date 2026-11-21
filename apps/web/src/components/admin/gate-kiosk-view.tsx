'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  Camera,
  CameraOff,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Search,
  Phone,
  Mail,
  Ticket,
  Clock,
  ArrowLeft,
  Volume2,
  VolumeX,
  History,
  Zap,
  Maximize2,
  Minimize2,
  FlipHorizontal,
  UserCheck,
  ListFilter,
  Check,
} from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';

import { Button, formatDate, Spinner } from '@sailent/ui';
import { passNumberFor } from '@sailent/validation';
import {
  verifyEventPassAction,
  checkInEventAttendeeAction,
  type VerifyPassResponse,
} from '@/lib/admin/actions';
import type { AdminEvent, AdminEventRegistration } from '@/lib/admin/api';
import {
  admitInVerification,
  admittedEntries,
  canAdmitFrom,
  canAutoAdmit,
  guestPasses,
  stampGuestPass,
} from '@/lib/admin/gate';
import { cameraProblem, createRepeatScanGuard, createScannerStopper } from '@/lib/admin/camera';

interface GateKioskViewProps {
  event: AdminEvent;
  initialRegistrations?: AdminEventRegistration[];
}

/**
 * Web Audio API synthesizer for gate check-in audio chimes.
 */
function playGateSound(type: 'success' | 'alert' | 'error') {
  if (typeof window === 'undefined') return;
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    if (type === 'success') {
      const now = ctx.currentTime;
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(587.33, now);
      osc1.frequency.exponentialRampToValueAtTime(880, now + 0.12);
      gain1.gain.setValueAtTime(0.25, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.35);
    } else if (type === 'alert') {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.setValueAtTime(370, now + 0.1);
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.28);
    } else {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(160, now);
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.3);
    }
  } catch {
    // Ignore audio errors
  }
}

const ADMITTED_TIME = new Intl.DateTimeFormat('en-IN', {
  hour: 'numeric',
  minute: '2-digit',
  second: '2-digit',
  timeZone: 'Asia/Kolkata',
});
const ADMITTED_DAY = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  timeZone: 'Asia/Kolkata',
});

/** "10:58:49 pm", or "17 Nov, 10:58:49 pm" when it was not today (India time). */
function admittedTimeLabel(at: string | null): string {
  if (!at) return 'Admitted';
  const when = new Date(at);
  const time = ADMITTED_TIME.format(when);
  return ADMITTED_DAY.format(when) === ADMITTED_DAY.format(new Date())
    ? time
    : `${ADMITTED_DAY.format(when)}, ${time}`;
}

export function GateKioskView({ event, initialRegistrations = [] }: GateKioskViewProps) {
  // Navigation Tabs: 'scan' | 'guests' | 'history'
  const [activeTab, setActiveTab] = React.useState<'scan' | 'guests' | 'history'>('scan');

  // Scanner state
  const [scannerActive, setScannerActive] = React.useState(false);
  const [cameraStarting, setCameraStarting] = React.useState(false);
  const startingRef = React.useRef(false);
  const [facingMode, setFacingMode] = React.useState<'environment' | 'user'>('environment');
  const [cameraError, setCameraError] = React.useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = React.useState(true);
  const [autoAdmit, setAutoAdmit] = React.useState(false);
  const [isFullscreen, setIsFullscreen] = React.useState(false);

  // Manual code input
  const [manualCode, setManualCode] = React.useState('');
  const [verifying, setVerifying] = React.useState(false);
  const [checkingInId, setCheckingInId] = React.useState<string | null>(null);

  // Result of current pass lookup
  const [verification, setVerification] = React.useState<VerifyPassResponse | null>(null);
  const [lookupError, setLookupError] = React.useState<string | null>(null);

  // Auto-admit countdown
  const [autoResetSeconds, setAutoResetSeconds] = React.useState<number | null>(null);

  // Guest list & status tracking
  const [registrations, setRegistrations] =
    React.useState<AdminEventRegistration[]>(initialRegistrations);
  const [guestSearch, setGuestSearch] = React.useState('');
  const [guestFilter, setGuestFilter] = React.useState<'all' | 'pending' | 'attended'>('all');

  // Session history
  /*
    The booking this desk has just admitted someone on. Admitting turns the
    lookup on screen into "admitted" — the same state as "already admitted" —
    and without this the card told the operator the person they had just let
    in was ALREADY admitted.
  */
  const [justAdmittedId, setJustAdmittedId] = React.useState<string | null>(null);

  const html5QrCodeRef = React.useRef<Html5Qrcode | null>(null);

  // Every stop goes through this one: html5-qrcode THROWS on a second stop
  // while one is under way (see lib/admin/camera.ts). useState keeps it the
  // same object for the life of the page.
  const [scanner] = React.useState(() => createScannerStopper(() => html5QrCodeRef.current));
  // Set when the page is left, so a camera that finishes starting afterwards
  // is switched off instead of staying on in the background.
  const unmountedRef = React.useRef(false);
  const isHandlingRef = React.useRef(false);
  // One look-up per pass presented, however long it is held up (lib/admin/camera.ts).
  const [repeatScans] = React.useState(() => createRepeatScanGuard());
  const handleVerifyRef = React.useRef<(code: string) => Promise<void>>(async () => {});
  const autoResetTimerRef = React.useRef<NodeJS.Timeout | null>(null);

  // Fullscreen toggle
  const toggleFullscreen = () => {
    if (typeof document === 'undefined') return;
    if (!document.fullscreenElement) {
      document.documentElement
        .requestFullscreen()
        .then(() => setIsFullscreen(true))
        .catch(() => {});
    } else {
      document
        .exitFullscreen()
        .then(() => setIsFullscreen(false))
        .catch(() => {});
    }
  };

  // Admit ONE person, by their pass. A group booking is admitted pass by pass.
  const executeCheckIn = React.useCallback(
    async (regId: string, passNumber: string) => {
      setCheckingInId(passNumber);
      const res = await checkInEventAttendeeAction(event.id, regId, passNumber);
      setCheckingInId(null);

      if (!res.ok || !res.data) {
        if (soundEnabled) playGateSound('error');
        setLookupError(res.error || 'Failed to record check-in.');
        return false;
      }

      const result = res.data;
      const admittedAt = result.attendedAt ?? new Date().toISOString();

      // Either way the person is in now — by this desk or, a moment earlier,
      // by another one — so the guest list and the card both show it.
      setRegistrations((prev) =>
        prev.map((r) => (r.id === regId ? stampGuestPass(r, passNumber, admittedAt) : r)),
      );

      if (result.alreadyAttended) {
        // Another desk got there first: this one did not admit them.
        setJustAdmittedId(null);
        if (soundEnabled) playGateSound('alert');
        setVerification((prev) =>
          admitInVerification(prev, regId, passNumber, admittedAt, result.message),
        );
        return false;
      }

      if (soundEnabled) playGateSound('success');
      const timeStr = new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });

      setJustAdmittedId(regId);
      setVerification((prev) =>
        admitInVerification(prev, regId, passNumber, admittedAt, `Admitted at ${timeStr}.`),
      );

      return true;
    },
    [event.id, soundEnabled],
  );

  // Pass verification handler
  /*
    `fromPick` marks a lookup the operator started by choosing a name from a
    list of matches. The re-lookup is by registration id — an exact match —
    but the CHOICE was made by name, so it is shown for confirmation and never
    auto-admitted: Auto-Admit is for a pass that was actually scanned.
  */
  const handleVerify = React.useCallback(
    async (codeToVerify: string, fromPick = false) => {
      const code = codeToVerify.trim();
      if (!code) return;

      if (autoResetTimerRef.current) {
        clearTimeout(autoResetTimerRef.current);
        autoResetTimerRef.current = null;
        setAutoResetSeconds(null);
      }

      setVerifying(true);
      setLookupError(null);
      setVerification(null);
      setJustAdmittedId(null);

      const res = await verifyEventPassAction(event.id, code);
      setVerifying(false);

      if (!res.ok || !res.data) {
        setLookupError(res.error || 'Pass not found or invalid.');
        if (soundEnabled) playGateSound('error');
        return;
      }

      const result = res.data;
      setVerification(result);

      if (result.status === 'valid') {
        // Auto-Admit acts only on an exact pass that names one person. A match
        // by name, email or phone waits for the operator to check the pass.
        const reg = result.registration;
        const pass = reg?.matchedAttendee;
        if (autoAdmit && !fromPick && canAutoAdmit(result) && reg && pass) {
          await executeCheckIn(reg.id, pass.passNumber);
          setAutoResetSeconds(2);
          autoResetTimerRef.current = setTimeout(() => {
            setVerification(null);
            setJustAdmittedId(null);
            setAutoResetSeconds(null);
            autoResetTimerRef.current = null;
          }, 2000);
        } else {
          if (soundEnabled) playGateSound('success');
        }
      } else if (result.status === 'already_attended' || result.status === 'multiple_matches') {
        if (soundEnabled) playGateSound('alert');
      } else {
        if (soundEnabled) playGateSound('error');
      }
    },
    [event.id, autoAdmit, executeCheckIn, soundEnabled],
  );

  handleVerifyRef.current = handleVerify;

  // Start Camera
  const startCamera = React.useCallback(
    async (mode: 'environment' | 'user' = facingMode) => {
      // A second tap while the camera is still starting would start it twice.
      if (startingRef.current) return;
      startingRef.current = true;
      setCameraError(null);
      /*
        The camera area must be ON SCREEN before the video starts. html5-qrcode
        sizes its scan box from the video's on-screen size when it starts
        playing; a hidden (display:none) area measures 0×0, it throws ("minimum
        size of 'config.qrbox' … 50px") and never starts scanning — the
        preview shows, but no pass is ever read. So show the area first, wait a
        frame for it to be laid out, then start.
      */
      setCameraStarting(true);
      try {
        await new Promise<void>((resolve) =>
          typeof requestAnimationFrame === 'function'
            ? requestAnimationFrame(() => resolve())
            : setTimeout(resolve, 0),
        );
        if (!html5QrCodeRef.current) {
          html5QrCodeRef.current = new Html5Qrcode('kiosk-camera-viewport');
        }

        const qr = html5QrCodeRef.current;
        // Stop what is running (switching cameras), or wait for a stop under way.
        await scanner.stop();

        await qr.start(
          { facingMode: mode },
          {
            fps: 12,
            qrbox: (viewfinderWidth, viewfinderHeight) => {
              const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
              const edge = Math.floor(minEdge * 0.76);
              return { width: edge, height: edge };
            },
            aspectRatio: 1.0,
          },
          async (decodedText) => {
            // The pass just handled, still held up: not a new presentation.
            if (repeatScans.seenAgain(decodedText)) return;
            // Busy with another pass; this one will be read again in a moment.
            if (isHandlingRef.current) return;
            repeatScans.handled(decodedText);
            isHandlingRef.current = true;
            if (navigator.vibrate) {
              try {
                navigator.vibrate([80, 40, 80]);
              } catch {
                // ignore
              }
            }
            await handleVerifyRef.current(decodedText);
            setTimeout(() => {
              isHandlingRef.current = false;
            }, 1200);
          },
          () => {},
        );
        if (unmountedRef.current) {
          // The page was left while the camera was starting: switch it off.
          await scanner.stop();
          return;
        }
        setScannerActive(true);
      } catch (err: unknown) {
        // The browser's own words ("NotAllowedError…") become what to do next.
        setCameraError(cameraProblem(err, window.isSecureContext, navigator.userAgent));
        setScannerActive(false);
      } finally {
        startingRef.current = false;
        setCameraStarting(false);
      }
    },
    [facingMode, scanner, repeatScans],
  );

  // Flip Camera Front/Back
  const toggleCameraFacing = async () => {
    const nextMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextMode);
    if (scannerActive) {
      await startCamera(nextMode);
    }
  };

  // Stop Camera
  const stopCamera = React.useCallback(async () => {
    await scanner.stop();
    setScannerActive(false);
  }, [scanner]);

  // Initialize camera when on scan tab
  React.useEffect(() => {
    if (activeTab === 'scan') {
      const timer = setTimeout(() => {
        startCamera();
      }, 350);
      return () => {
        clearTimeout(timer);
        stopCamera();
      };
    } else {
      stopCamera();
    }
  }, [activeTab, startCamera, stopCamera]);

  // Clean on unmount
  React.useEffect(() => {
    unmountedRef.current = false;
    return () => {
      unmountedRef.current = true;
      // Shares any stop already under way (the camera effect's cleanup runs
      // first). A second stop() would throw, from a cleanup, and take the
      // next page down with it.
      void scanner.stop();
      if (autoResetTimerRef.current) {
        clearTimeout(autoResetTimerRef.current);
      }
    };
  }, [scanner]);

  const onManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    handleVerify(manualCode);
  };

  const clearCurrent = () => {
    if (autoResetTimerRef.current) {
      clearTimeout(autoResetTimerRef.current);
      autoResetTimerRef.current = null;
    }
    setVerification(null);
    setJustAdmittedId(null);
    setLookupError(null);
    setAutoResetSeconds(null);
    setManualCode('');
  };

  // Admission stats count PEOPLE (passes), not bookings: a booking of four is
  // four people at the gate. Cancelled bookings are nobody's seat.
  const liveGuests = registrations.filter((r) => r.status !== 'cancelled');
  const passesByGuest = new Map(registrations.map((r) => [r.id, guestPasses(r)]));
  const passesFor = (r: AdminEventRegistration) => passesByGuest.get(r.id) ?? [];
  const isFullyAdmitted = (r: AdminEventRegistration) => passesFor(r).every((p) => p.admitted);
  const attendedCount = liveGuests.reduce(
    (sum, r) => sum + passesFor(r).filter((p) => p.admitted).length,
    0,
  );
  const totalCount =
    liveGuests.reduce((sum, r) => sum + passesFor(r).length, 0) || event.registeredCount || 0;
  const percentAdmitted = totalCount > 0 ? Math.round((attendedCount / totalCount) * 100) : 0;
  const pendingGuests = liveGuests.filter((r) => !isFullyAdmitted(r)).length;
  const admittedGuests = liveGuests.filter(isFullyAdmitted).length;
  // Everyone admitted, newest first: the Admitted tab (agrees with the header).
  const admitted = admittedEntries(registrations);
  // The lookup on screen is about someone THIS desk just admitted.
  const admittedHere =
    verification?.status === 'already_attended' &&
    justAdmittedId !== null &&
    verification.registration?.id === justAdmittedId;

  // Filtered guest list for Guest List tab
  const filteredGuests = registrations.filter((r) => {
    const cancelled = r.status === 'cancelled';
    if (guestFilter === 'pending' && (cancelled || isFullyAdmitted(r))) return false;
    if (guestFilter === 'attended' && (cancelled || !isFullyAdmitted(r))) return false;

    if (!guestSearch.trim()) return true;
    const query = guestSearch.toLowerCase().trim();
    const matchesName = r.fullName.toLowerCase().includes(query);
    const matchesPhone = r.phone.includes(query);
    const matchesEmail = r.email.toLowerCase().includes(query);
    const matchesPass = passNumberFor(r.id).toLowerCase().includes(query);
    const matchesFunction = r.functionName?.toLowerCase().includes(query);
    const matchesAttendee = r.attendees?.some(
      (a) =>
        a.fullName.toLowerCase().includes(query) ||
        (a.passNumber && a.passNumber.toLowerCase().includes(query)),
    );

    return (
      matchesName ||
      matchesPhone ||
      matchesEmail ||
      matchesPass ||
      matchesFunction ||
      matchesAttendee
    );
  });

  return (
    <div className="flex min-h-screen flex-col bg-background font-sans text-foreground selection:bg-primary selection:text-white">
      {/* 1. Kiosk Top Bar */}
      <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between border-b border-border/90 bg-surface/95 px-4 backdrop-blur-md sm:px-6">
        <div className="flex items-center gap-3">
          <Link
            href={`/admin/events/${event.id}/registrations`}
            className="flex items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-bold text-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" />
            <span className="hidden sm:inline">Exit Desk</span>
          </Link>

          <div className="h-5 w-px bg-border" />

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-black tracking-tight text-foreground sm:text-base">
                {event.title}
              </h1>
              <span className="text-2xs hidden items-center gap-1 rounded-full border border-success/30 bg-success-subtle px-2 py-0.5 font-bold text-success sm:flex">
                <span className="size-1.5 rounded-full bg-success" />
                GATE DESK
              </span>
            </div>
            <p className="text-2xs font-medium text-muted-foreground">
              {formatDate(event.startDate)} {event.venueName ? `• ${event.venueName}` : ''}
            </p>
          </div>
        </div>

        {/* Live Gauges & Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Quick Check-in Stats Pill */}
          <div className="hidden items-center gap-2.5 rounded-xl border border-border bg-background px-3 py-1.5 md:flex">
            <UserCheck className="size-4 text-success" />
            <div className="flex flex-col">
              <span className="text-2xs font-bold text-muted-foreground">
                {attendedCount} / {totalCount} Admitted
              </span>
              <div className="h-1.5 w-20 overflow-hidden rounded-full bg-border">
                <div
                  className="h-full rounded-full bg-success"
                  style={{
                    width: `${Math.min(100, Math.max(percentAdmitted, totalCount > 0 ? 4 : 0))}%`,
                  }}
                />
              </div>
            </div>
          </div>

          {/* Auto-Admit Toggle */}
          <button
            type="button"
            onClick={() => setAutoAdmit(!autoAdmit)}
            className={`shadow-2xs flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
              autoAdmit
                ? 'bg-warning text-foreground ring-2 ring-warning/30'
                : 'border border-border bg-background text-foreground hover:bg-muted'
            }`}
            title="Auto-Admit instantly admits the attendee upon scanning without extra tap"
          >
            <Zap className={`size-3.5 ${autoAdmit ? 'fill-current' : 'text-muted-foreground'}`} />
            <span className="hidden sm:inline">Auto-Admit:</span> {autoAdmit ? 'ON' : 'OFF'}
          </button>

          {/* Chime Sound Toggle */}
          <button
            type="button"
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`flex size-9 items-center justify-center rounded-xl border transition-colors ${
              soundEnabled
                ? 'border-success/30 bg-success-subtle text-success'
                : 'border-border bg-background text-muted-foreground'
            }`}
            title={soundEnabled ? 'Mute Chime Sound' : 'Enable Chime Sound'}
          >
            {soundEnabled ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
          </button>

          {/* Fullscreen Button */}
          <button
            type="button"
            onClick={toggleFullscreen}
            className="hidden size-9 items-center justify-center rounded-xl border border-border bg-background text-muted-foreground hover:bg-muted sm:flex"
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
          </button>
        </div>
      </header>

      {/* 2. Mode Navigation Tabs (BookMyShow / Eventbrite standard) */}
      <div className="border-b border-border/90 bg-surface px-4 sm:px-6">
        <div className="mx-auto flex max-w-4xl items-center justify-start gap-2 pt-2">
          <button
            type="button"
            onClick={() => setActiveTab('scan')}
            className={`flex items-center gap-2 border-b-2 px-4 py-3 text-xs font-bold transition-all sm:text-sm ${
              activeTab === 'scan'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Camera className="size-4" />
            QR Scanner
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('guests')}
            className={`flex items-center gap-2 border-b-2 px-4 py-3 text-xs font-bold transition-all sm:text-sm ${
              activeTab === 'guests'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <ListFilter className="size-4" />
            Guest List ({totalCount})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-2 border-b-2 px-4 py-3 text-xs font-bold transition-all sm:text-sm ${
              activeTab === 'history'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <History className="size-4" />
            Admitted ({admitted.length})
          </button>
        </div>
      </div>

      {/* 3. Main Body */}
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col p-4 sm:p-6 lg:p-8">
        {/* ============================================================== */}
        {/* TAB 1: QR CAMERA SCANNER */}
        {/* ============================================================== */}
        {activeTab === 'scan' && (
          <div className="mx-auto w-full max-w-lg space-y-5">
            {/* Camera Viewport Card */}
            <div className="relative overflow-hidden rounded-3xl border-2 border-input bg-surface-inverse shadow-xl">
              {/* Camera Action Overlays */}
              <div className="absolute right-3.5 top-3.5 z-20 flex items-center gap-2">
                <button
                  type="button"
                  onClick={toggleCameraFacing}
                  className="flex size-9 items-center justify-center rounded-full bg-surface-inverse/90 text-white shadow-md backdrop-blur-md transition-colors hover:bg-surface-inverse"
                  title="Flip Camera (Front/Back)"
                >
                  <FlipHorizontal className="size-4" />
                </button>

                {scannerActive ? (
                  <button
                    type="button"
                    onClick={stopCamera}
                    className="flex items-center gap-1.5 rounded-full bg-destructive/90 px-3 py-1.5 text-xs font-bold text-white shadow-md backdrop-blur-md hover:bg-destructive"
                  >
                    <CameraOff className="size-3.5" />
                    Pause
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => startCamera()}
                    className="flex items-center gap-1.5 rounded-full bg-success px-3 py-1.5 text-xs font-bold text-success-foreground shadow-md hover:bg-success"
                  >
                    <Camera className="size-3.5" />
                    Resume
                  </button>
                )}
              </div>

              {/* Live Video Mount Element */}
              <div className="relative flex aspect-square w-full items-center justify-center overflow-hidden sm:aspect-[4/3]">
                <div
                  id="kiosk-camera-viewport"
                  className={`h-full w-full overflow-hidden ${scannerActive || cameraStarting ? 'block' : 'hidden'}`}
                />

                {!scannerActive && !cameraStarting && (
                  <div className="flex flex-col items-center justify-center p-6 text-center text-surface-inverse-muted">
                    <div className="mb-3 flex size-14 items-center justify-center rounded-full bg-white/10 text-surface-inverse-muted">
                      <Camera className="size-7" />
                    </div>
                    <p className="text-base font-bold text-white">Camera Scanner Ready</p>
                    <p className="mt-1 max-w-xs text-xs text-surface-inverse-muted">
                      {cameraError ??
                        'Tap below to activate camera, or type pass details in the box underneath.'}
                    </p>

                    <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                      <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        onClick={() => startCamera()}
                        className="font-bold shadow-md"
                      >
                        <Camera className="mr-1.5 size-4" />
                        Enable Camera
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => setActiveTab('guests')}
                        className="font-semibold text-foreground"
                      >
                        <ListFilter className="mr-1.5 size-4" />
                        Open Guest List
                      </Button>
                    </div>
                  </div>
                )}

                {scannerActive && (
                  <>
                    {/* High-tech Laser Reticle */}
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                      <div className="relative size-60 sm:size-64">
                        <div className="absolute left-0 top-0 size-8 rounded-tl-xl border-l-4 border-t-4 border-primary" />
                        <div className="absolute right-0 top-0 size-8 rounded-tr-xl border-r-4 border-t-4 border-primary" />
                        <div className="absolute bottom-0 left-0 size-8 rounded-bl-xl border-b-4 border-l-4 border-primary" />
                        <div className="absolute bottom-0 right-0 size-8 rounded-br-xl border-b-4 border-r-4 border-primary" />
                        <div className="absolute inset-x-2 top-0 h-1 animate-pulse rounded-full bg-gradient-to-r from-transparent via-primary to-transparent shadow-[0_0_12px_var(--color-primary)]" />
                      </div>
                    </div>

                    <div className="pointer-events-none absolute bottom-4 z-10 rounded-full border border-input/60 bg-black/80 px-3.5 py-1.5 text-xs font-bold text-white backdrop-blur-md">
                      Fit Pass QR in center
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Manual Pass Code Search Bar */}
            <form onSubmit={onManualSubmit} className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  placeholder="Pass ID (SF-EVT-...), Name, or Phone..."
                  className="shadow-xs focus:outline-hidden h-12 w-full rounded-2xl border border-border-strong bg-surface px-4 pr-10 text-sm font-medium text-foreground placeholder-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
                {manualCode && (
                  <button
                    type="button"
                    onClick={() => setManualCode('')}
                    className="absolute right-3 top-3.5 text-muted-foreground hover:text-foreground"
                  >
                    <XCircle className="size-5" />
                  </button>
                )}
              </div>
              <Button
                type="submit"
                variant="primary"
                disabled={verifying || !manualCode.trim()}
                className="shadow-xs h-12 rounded-2xl px-5 font-bold"
              >
                {verifying ? <Spinner className="size-5" /> : <Search className="size-5" />}
              </Button>
            </form>

            {/* Verification Result Card */}
            {verification && (
              <div
                className={`rounded-3xl border-2 p-5 shadow-lg transition-all ${
                  verification.status === 'valid' || admittedHere
                    ? 'border-success bg-success-subtle text-success'
                    : verification.status === 'already_attended' ||
                        verification.status === 'multiple_matches'
                      ? 'border-warning bg-warning-subtle text-warning-foreground'
                      : 'border-destructive bg-destructive-subtle text-destructive'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    {verification.status === 'valid' && verification.matchedBy === 'pass' && (
                      <span className="shadow-xs flex items-center gap-1.5 rounded-full bg-success px-3 py-1 text-xs font-black uppercase text-success-foreground">
                        <CheckCircle2 className="size-4" />
                        VALID ENTRY • READY TO ADMIT
                      </span>
                    )}
                    {verification.status === 'valid' && verification.matchedBy === 'search' && (
                      <span className="shadow-xs flex items-center gap-1.5 rounded-full bg-warning px-3 py-1 text-xs font-black uppercase text-white">
                        <AlertTriangle className="size-4" />
                        FOUND BY NAME • CHECK THEIR PASS
                      </span>
                    )}
                    {verification.status === 'multiple_matches' && (
                      <span className="shadow-xs flex items-center gap-1.5 rounded-full bg-warning px-3 py-1 text-xs font-black uppercase text-white">
                        <ListFilter className="size-4" />
                        SEVERAL MATCHES • CHOOSE ONE
                      </span>
                    )}
                    {verification.status === 'event_cancelled' && (
                      <span className="shadow-xs flex items-center gap-1.5 rounded-full bg-destructive px-3 py-1 text-xs font-black uppercase text-destructive-foreground">
                        <XCircle className="size-4" />
                        EVENT CANCELLED
                      </span>
                    )}
                    {admittedHere && (
                      <span className="shadow-xs flex items-center gap-1.5 rounded-full bg-success px-3 py-1 text-xs font-black uppercase text-success-foreground">
                        <CheckCircle2 className="size-4" />
                        ADMITTED
                      </span>
                    )}
                    {verification.status === 'already_attended' && !admittedHere && (
                      <span className="shadow-xs flex items-center gap-1.5 rounded-full bg-warning px-3 py-1 text-xs font-black uppercase text-white">
                        <AlertTriangle className="size-4" />
                        ALREADY ADMITTED
                      </span>
                    )}
                    {verification.status === 'cancelled' && (
                      <span className="shadow-xs flex items-center gap-1.5 rounded-full bg-destructive px-3 py-1 text-xs font-black uppercase text-destructive-foreground">
                        <XCircle className="size-4" />
                        CANCELLED REGISTRATION
                      </span>
                    )}
                    {verification.status === 'wrong_event' && (
                      <span className="shadow-xs flex items-center gap-1.5 rounded-full bg-warning px-3 py-1 text-xs font-black uppercase text-white">
                        <AlertTriangle className="size-4" />
                        WRONG EVENT
                      </span>
                    )}
                    {verification.status === 'not_found' && (
                      <span className="shadow-xs flex items-center gap-1.5 rounded-full bg-muted-foreground px-3 py-1 text-xs font-black uppercase text-white">
                        PASS NOT FOUND
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={clearCurrent}
                    className="rounded-full bg-border/80 p-1 text-muted-foreground hover:bg-border-strong hover:text-foreground"
                  >
                    <XCircle className="size-5" />
                  </button>
                </div>

                <p className="mt-2 text-xs font-semibold">{verification.message}</p>

                {/* Several bookings matched: the operator picks the right one */}
                {verification.status === 'multiple_matches' && verification.candidates && (
                  <ul className="shadow-xs mt-4 divide-y divide-border overflow-hidden rounded-2xl border border-border/80 bg-surface">
                    {verification.candidates.map((candidate) => (
                      <li key={candidate.registrationId}>
                        <button
                          type="button"
                          onClick={() => handleVerify(candidate.registrationId, true)}
                          className="flex w-full items-center justify-between gap-3 p-3.5 text-left transition-colors hover:bg-background"
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-black text-foreground">
                              {candidate.fullName}
                            </span>
                            <span className="block truncate font-mono text-xs text-muted-foreground">
                              {candidate.passNumber}
                              {candidate.totalPasses > 1
                                ? ` • ${candidate.attendeeNames.join(', ')}`
                                : ''}
                            </span>
                          </span>
                          <span className="shrink-0 rounded-lg bg-muted px-2.5 py-1 text-xs font-bold text-foreground">
                            {candidate.status === 'cancelled'
                              ? 'Cancelled'
                              : `${candidate.admittedCount}/${candidate.totalPasses} in`}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                {/* Attendee Details Ticket Block */}
                {verification.registration && (
                  <div className="shadow-xs mt-4 space-y-3 rounded-2xl border border-border/80 bg-surface p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="font-mono text-xs font-bold text-primary">
                          {verification.registration.matchedAttendee?.passNumber ||
                            verification.registration.basePassId}
                        </span>
                        <h3 className="text-xl font-black tracking-tight text-foreground">
                          {verification.registration.matchedAttendee?.fullName ||
                            verification.registration.fullName}
                        </h3>
                      </div>
                      {verification.registration.functionName && (
                        <span className="rounded-lg border border-primary/30 bg-accent px-2.5 py-1 text-xs font-bold text-primary">
                          {verification.registration.functionName}
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2 border-t border-border pt-2 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1.5 truncate">
                        <Phone className="size-3.5 shrink-0 text-muted-foreground" />
                        <span className="truncate font-medium">
                          {verification.registration.phone}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 truncate">
                        <Mail className="size-3.5 shrink-0 text-muted-foreground" />
                        <span className="truncate font-medium">
                          {verification.registration.email}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Ticket className="size-3.5 shrink-0 text-muted-foreground" />
                        <span>{verification.registration.attendeeCount} Pass Booked</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Clock className="size-3.5 shrink-0 text-muted-foreground" />
                        <span>{formatDate(verification.registration.registeredAt)}</span>
                      </div>
                    </div>

                    {/* Every person on a group booking, each admitted by their own pass */}
                    {(verification.registration.allAttendees?.length ?? 0) > 1 && (
                      <ul className="divide-y divide-border rounded-xl border border-border bg-background">
                        {verification.registration.allAttendees!.map((pass) => (
                          <li
                            key={pass.passNumber}
                            className="flex items-center justify-between gap-2 px-3 py-2"
                          >
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-bold text-foreground">
                                {pass.fullName}
                              </span>
                              <span className="block font-mono text-xs text-muted-foreground">
                                {pass.passNumber}
                              </span>
                            </span>
                            {pass.admitted ? (
                              <span className="flex shrink-0 items-center gap-1 text-xs font-bold text-success">
                                <CheckCircle2 className="size-4 text-success" />
                                In
                              </span>
                            ) : canAdmitFrom(verification) ? (
                              <button
                                type="button"
                                onClick={() =>
                                  executeCheckIn(verification.registration!.id, pass.passNumber)
                                }
                                disabled={checkingInId === pass.passNumber}
                                className="shadow-xs flex shrink-0 items-center gap-1.5 rounded-xl bg-success px-3 py-1.5 text-xs font-black text-success-foreground transition-transform hover:bg-success active:scale-95 disabled:opacity-50"
                              >
                                <Check className="size-3.5" />
                                Admit
                              </button>
                            ) : (
                              <span className="shrink-0 text-xs font-semibold text-muted-foreground">
                                Not admitted
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}

                    {/* Action Admit Button — for the one person this lookup named */}
                    {verification.status === 'valid' &&
                      verification.registration.matchedAttendee && (
                        <div className="pt-2">
                          <button
                            type="button"
                            onClick={() =>
                              executeCheckIn(
                                verification.registration!.id,
                                verification.registration!.matchedAttendee!.passNumber,
                              )
                            }
                            disabled={
                              checkingInId === verification.registration.matchedAttendee.passNumber
                            }
                            className="active:scale-98 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-success text-base font-black text-success-foreground shadow-md transition-all hover:bg-success disabled:opacity-50"
                          >
                            {checkingInId ===
                            verification.registration.matchedAttendee.passNumber ? (
                              <>
                                <Spinner className="size-5" />
                                Admitting guest…
                              </>
                            ) : (
                              <>
                                <CheckCircle2 className="size-5" />
                                ADMIT ATTENDEE NOW
                              </>
                            )}
                          </button>
                        </div>
                      )}

                    {autoResetSeconds !== null && (
                      <div className="text-center text-xs font-bold text-success">
                        ✓ Admitted! Ready for next scan in {autoResetSeconds}s...
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {lookupError && !verification && (
              <div className="shadow-xs flex items-center justify-between rounded-2xl border border-destructive/30 bg-destructive-subtle p-4 text-destructive">
                <div className="flex items-center gap-2 text-xs font-semibold">
                  <XCircle className="size-4 shrink-0 text-destructive" />
                  <span>{lookupError}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setLookupError(null)}
                  className="text-destructive hover:text-destructive"
                >
                  <XCircle className="size-4" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 2: GUEST LIST & INSTANT CHECK-IN (BookMyShow standard) */}
        {/* ============================================================== */}
        {activeTab === 'guests' && (
          <div className="space-y-4">
            {/* Search & Filter Header */}
            <div className="shadow-xs flex flex-col gap-3 rounded-2xl border border-border/90 bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-3.5 size-4 text-muted-foreground" />
                <input
                  type="text"
                  value={guestSearch}
                  onChange={(e) => setGuestSearch(e.target.value)}
                  placeholder="Search guest by name, phone, email, pass ID..."
                  className="focus:outline-hidden h-11 w-full rounded-xl border border-border bg-background pl-10 pr-4 text-sm font-medium text-foreground placeholder-muted-foreground focus:border-primary focus:bg-surface"
                />
              </div>

              {/* Status Filter Chips */}
              <div className="flex items-center gap-1.5">
                {(['all', 'pending', 'attended'] as const).map((filter) => {
                  const isActive = guestFilter === filter;
                  return (
                    <button
                      key={filter}
                      type="button"
                      onClick={() => setGuestFilter(filter)}
                      className={`rounded-full px-3 py-1.5 text-xs font-bold capitalize transition-colors ${
                        isActive
                          ? 'shadow-xs bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground hover:bg-border hover:text-foreground'
                      }`}
                    >
                      {filter === 'all'
                        ? `All (${registrations.length})`
                        : filter === 'pending'
                          ? `Pending (${pendingGuests})`
                          : `Admitted (${admittedGuests})`}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Guest Cards List */}
            {filteredGuests.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-border bg-surface p-12 text-center text-muted-foreground">
                <UserCheck className="mb-2 size-10 text-muted-foreground" />
                <p className="text-base font-bold text-foreground">No Guests Found</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  No registered attendees match your current search or filter.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {filteredGuests.map((guest) => {
                  const passes = passesFor(guest);
                  const isCancelled = guest.status === 'cancelled';
                  const isAttended = !isCancelled && isFullyAdmitted(guest);

                  return (
                    <div
                      key={guest.id}
                      className={`p-4.5 relative flex flex-col justify-between rounded-2xl border transition-all ${
                        isAttended
                          ? 'shadow-2xs border-success/30 bg-success-subtle/40'
                          : 'shadow-xs border-border/90 bg-surface hover:border-border-strong'
                      }`}
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="text-2xs font-mono font-bold text-primary">
                              {passNumberFor(guest.id)}
                            </span>
                            <h4 className="text-base font-black tracking-tight text-foreground">
                              {guest.fullName}
                            </h4>
                          </div>

                          {guest.functionName && (
                            <span className="text-2xs rounded-md bg-accent px-2 py-0.5 font-bold text-primary">
                              {guest.functionName}
                            </span>
                          )}
                        </div>

                        <div className="mt-2.5 space-y-1 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1.5 truncate">
                            <Phone className="size-3.5 shrink-0 text-muted-foreground" />
                            <span>{guest.phone}</span>
                          </div>
                          <div className="flex items-center gap-1.5 truncate">
                            <Mail className="size-3.5 shrink-0 text-muted-foreground" />
                            <span>{guest.email}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Ticket className="size-3.5 shrink-0 text-muted-foreground" />
                            <span>
                              {guest.attendeeCount} {guest.attendeeCount === 1 ? 'Seat' : 'Seats'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Check-in: one row per person, each admitted by their own pass */}
                      {isCancelled ? (
                        <div className="mt-4 border-t border-border pt-3">
                          <span className="text-2xs font-semibold text-destructive">
                            Registration cancelled
                          </span>
                        </div>
                      ) : (
                        <ul className="mt-4 space-y-2 border-t border-border pt-3">
                          {passes.map((pass) => {
                            const isCheckingIn = checkingInId === pass.passNumber;
                            const admittedAt = pass.checkedInAt ?? guest.attendedAt;
                            return (
                              <li
                                key={pass.passNumber}
                                className="flex items-center justify-between gap-2"
                              >
                                {passes.length > 1 && (
                                  <span className="min-w-0">
                                    <span className="block truncate text-sm font-bold text-foreground">
                                      {pass.fullName}
                                    </span>
                                    <span className="block font-mono text-xs text-muted-foreground">
                                      {pass.passNumber}
                                    </span>
                                  </span>
                                )}

                                {pass.admitted ? (
                                  <span className="flex items-center gap-1 text-xs font-bold text-success">
                                    <CheckCircle2 className="size-4 text-success" />
                                    Admitted{' '}
                                    {admittedAt
                                      ? `(${new Date(admittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`
                                      : ''}
                                  </span>
                                ) : (
                                  <>
                                    {passes.length === 1 && (
                                      <span className="text-2xs font-semibold text-muted-foreground">
                                        Pending Entry
                                      </span>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => executeCheckIn(guest.id, pass.passNumber)}
                                      disabled={isCheckingIn}
                                      className="shadow-xs flex shrink-0 items-center gap-1.5 rounded-xl bg-success px-4 py-2 text-xs font-black text-success-foreground transition-transform hover:bg-success active:scale-95 disabled:opacity-50"
                                    >
                                      {isCheckingIn ? (
                                        <>
                                          <Spinner className="size-3.5" />
                                          Admitting…
                                        </>
                                      ) : (
                                        <>
                                          <Check className="size-3.5" />
                                          Check In
                                        </>
                                      )}
                                    </button>
                                  </>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 3: LIVE SHIFT ENTRY ACTIVITY */}
        {/* ============================================================== */}
        {activeTab === 'history' && (
          <div className="space-y-4">
            <div className="shadow-xs flex items-center justify-between rounded-2xl border border-border bg-surface p-4">
              <div>
                <h3 className="text-sm font-bold text-foreground">Admitted</h3>
                <p className="text-xs text-muted-foreground">
                  Everyone admitted to this event, newest first.
                </p>
              </div>
              <span className="shrink-0 whitespace-nowrap rounded-full bg-success-subtle px-3 py-1 font-mono text-xs font-black text-success">
                {admitted.length} Guests
              </span>
            </div>

            {admitted.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-border bg-surface p-12 text-center text-muted-foreground">
                <History className="mb-2 size-10 text-muted-foreground" />
                <p className="text-base font-bold text-foreground">No Check-Ins Yet</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Scanned attendees and manual check-ins will appear here in real-time.
                </p>
              </div>
            ) : (
              <div className="shadow-xs divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
                {admitted.map((item) => (
                  <div key={item.key} className="flex items-center justify-between p-4">
                    <div className="min-w-0 pr-2">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-bold text-foreground">{item.name}</p>
                        {item.functionName && (
                          <span className="rounded bg-accent px-2 py-0.5 text-xs font-bold text-primary">
                            {item.functionName}
                          </span>
                        )}
                      </div>
                      <p className="font-mono text-xs text-muted-foreground">{item.passNumber}</p>
                    </div>

                    <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-success">
                      <CheckCircle2 className="size-4 text-success" />
                      <span>{admittedTimeLabel(item.admittedAt)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
