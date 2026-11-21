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
  ShieldCheck,
  ListFilter,
  Check,
} from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';

import { cameraProblem, createRepeatScanGuard, createScannerStopper } from '@/lib/admin/camera';

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Badge,
  Spinner,
} from '@sailent/ui';
import { formatDate } from '@sailent/ui';
import {
  verifyEventPassAction,
  checkInEventAttendeeAction,
  type GatePass,
  type VerifyPassResponse,
} from '@/lib/admin/actions';
import type { AdminEvent } from '@/lib/admin/api';
import { admitInVerification, canAdmitFrom } from '@/lib/admin/gate';

interface EventCheckInScannerProps {
  event: AdminEvent;
}

interface RecentCheckInItem {
  id: string;
  name: string;
  passNumber?: string;
  functionName?: string | null;
  time: string;
  alreadyAttended?: boolean;
}

/**
 * Web Audio API synthesizer for gate check-in audio chimes.
 * Plays positive chime for valid entry and alert chord for error/already admitted.
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
      // Pleasant double chime: 587.33 Hz (D5) -> 880 Hz (A5)
      const now = ctx.currentTime;
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(587.33, now);
      osc1.frequency.exponentialRampToValueAtTime(880, now + 0.12);
      gain1.gain.setValueAtTime(0.2, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.35);
    } else if (type === 'alert') {
      // Warning double beep
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
      // Low buzz error
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
    // Ignore audio playback errors if audio context blocked by browser policy
  }
}

export function EventCheckInScanner({ event }: EventCheckInScannerProps) {
  const [scannerActive, setScannerActive] = React.useState(false);
  const [cameraStarting, setCameraStarting] = React.useState(false);
  const startingRef = React.useRef(false);
  const [cameraError, setCameraError] = React.useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = React.useState(true);
  const [manualCode, setManualCode] = React.useState('');
  const [verifying, setVerifying] = React.useState(false);
  /** The pass being admitted, while its request is in flight. */
  const [checkingIn, setCheckingIn] = React.useState<string | null>(null);

  // Result of current pass lookup
  const [verification, setVerification] = React.useState<VerifyPassResponse | null>(null);
  const [lookupError, setLookupError] = React.useState<string | null>(null);

  // Recent check-in list
  const [recentCheckIns, setRecentCheckIns] = React.useState<RecentCheckInItem[]>([]);

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

  // Pass verification handler
  const handleVerify = React.useCallback(
    async (codeToVerify: string) => {
      const code = codeToVerify.trim();
      if (!code) return;

      setVerifying(true);
      setLookupError(null);
      setVerification(null);

      const res = await verifyEventPassAction(event.id, code);
      setVerifying(false);

      if (!res.ok || !res.data) {
        setLookupError(res.error || 'Failed to verify pass. Try again.');
        if (soundEnabled) playGateSound('error');
        return;
      }

      const result = res.data;
      setVerification(result);

      if (result.status === 'valid') {
        if (soundEnabled) playGateSound('success');
      } else if (result.status === 'already_attended' || result.status === 'multiple_matches') {
        if (soundEnabled) playGateSound('alert');
      } else {
        if (soundEnabled) playGateSound('error');
      }
    },
    [event.id, soundEnabled],
  );

  handleVerifyRef.current = handleVerify;

  // Start Camera
  const startCamera = React.useCallback(async () => {
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
        html5QrCodeRef.current = new Html5Qrcode('qr-reader-container');
      }

      const qr = html5QrCodeRef.current;
      // A stop under way must finish first, or the start throws.
      await scanner.settled();
      if (qr.isScanning) {
        setScannerActive(true);
        return;
      }

      await qr.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: (viewfinderWidth, viewfinderHeight) => {
            const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
            const edge = Math.floor(minEdge * 0.75);
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
          }, 1500);
        },
        () => {
          // Frame error (no qr found in current frame) — normal, ignore
        },
      );
      if (unmountedRef.current) {
        // The page was left while the camera was starting: switch it off.
        await scanner.stop();
        return;
      }
      setScannerActive(true);
    } catch (err: unknown) {
      console.error('Failed to start camera:', err);
      setCameraError(cameraProblem(err, window.isSecureContext, navigator.userAgent));
      setScannerActive(false);
    } finally {
      startingRef.current = false;
      setCameraStarting(false);
    }
  }, [scanner, repeatScans]);

  // Stop Camera
  const stopCamera = React.useCallback(async () => {
    await scanner.stop();
    setScannerActive(false);
  }, [scanner]);

  // Cleanup on unmount
  React.useEffect(() => {
    unmountedRef.current = false;
    return () => {
      unmountedRef.current = true;
      // Shares any stop already under way; a second stop() would throw.
      void scanner.stop();
    };
  }, [scanner]);

  // Form submit for manual code entry
  const onManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    handleVerify(manualCode);
  };

  // Admit ONE person, by their pass. A group booking is admitted pass by pass.
  const handleCheckIn = async (pass: GatePass) => {
    const reg = verification?.registration;
    if (!reg) return;
    setCheckingIn(pass.passNumber);

    const res = await checkInEventAttendeeAction(event.id, reg.id, pass.passNumber);
    setCheckingIn(null);

    if (!res.ok || !res.data) {
      if (soundEnabled) playGateSound('error');
      setLookupError(res.error || 'Failed to mark check-in.');
      return;
    }

    const result = res.data;
    const admittedAt = result.attendedAt ?? new Date().toISOString();

    // Admitted a moment earlier, at another gate: show it, do not count it twice.
    if (result.alreadyAttended) {
      if (soundEnabled) playGateSound('alert');
      setVerification((prev) =>
        admitInVerification(prev, reg.id, pass.passNumber, admittedAt, result.message),
      );
      return;
    }

    if (soundEnabled) playGateSound('success');
    const timeStr = new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    setRecentCheckIns((prev) => [
      {
        id: pass.passNumber + '-' + Date.now(),
        name: pass.fullName,
        passNumber: pass.passNumber,
        functionName: reg.functionName,
        time: timeStr,
      },
      ...prev.slice(0, 14),
    ]);

    setVerification((prev) =>
      admitInVerification(prev, reg.id, pass.passNumber, admittedAt, `Checked in at ${timeStr}.`),
    );
  };

  return (
    <div className="space-y-6">
      {/* Top Controls Banner */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Badge variant="neutral" className="gap-1 font-mono text-xs">
              <ShieldCheck className="size-3 text-success" />
              Gate Admission Active
            </Badge>
            {recentCheckIns.length > 0 && (
              <Badge variant="success" className="font-mono text-xs">
                {recentCheckIns.length} Admitted This Session
              </Badge>
            )}
          </div>
          <h2 className="text-display-xs text-foreground mt-1 font-bold tracking-tight">
            Gate Pass Scanner & Check-In
          </h2>
          <p className="text-body-sm text-muted-foreground">
            Point camera at attendee QR pass or enter pass code / phone number below to admit
            guests.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setSoundEnabled(!soundEnabled)}
            title={soundEnabled ? 'Mute Chimes' : 'Enable Chimes'}
          >
            {soundEnabled ? (
              <Volume2 className="size-4 text-success" />
            ) : (
              <VolumeX className="size-4 text-muted-foreground" />
            )}
            <span className="hidden sm:inline">{soundEnabled ? 'Chime On' : 'Muted'}</span>
          </Button>

          <Button asChild variant="secondary" size="sm">
            <Link href={`/admin/events/${event.id}/registrations`}>
              <ArrowLeft className="mr-1.5 size-4" />
              Register Table
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column: Camera Scanner & Manual Input (7 cols) */}
        <div className="space-y-6 lg:col-span-7">
          {/* Camera Viewfinder Card */}
          <Card className="border-border overflow-hidden">
            <CardHeader className="bg-muted/30 border-b pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Camera className="text-primary size-4" />
                  Live QR Camera Scanner
                </CardTitle>
                <div className="flex items-center gap-2">
                  {scannerActive ? (
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={stopCamera}
                      className="h-8 gap-1.5 px-3 text-xs"
                    >
                      <CameraOff className="size-3.5" />
                      Stop Camera
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      onClick={startCamera}
                      className="h-8 gap-1.5 px-3 text-xs font-semibold"
                    >
                      <Camera className="size-3.5" />
                      Start Camera
                    </Button>
                  )}
                </div>
              </div>
              <CardDescription>
                Uses device back camera with instant autofocus. Fits standard pass QR codes.
              </CardDescription>
            </CardHeader>

            <CardContent className="p-4 sm:p-6">
              {/* QR Scanner Viewport */}
              <div className="relative mx-auto flex min-h-[280px] w-full max-w-[380px] flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-border-strong bg-surface-inverse sm:min-h-[340px]">
                {/* HTML5 QR Code Mount Element */}
                <div
                  id="qr-reader-container"
                  className={`w-full overflow-hidden ${scannerActive || cameraStarting ? 'block' : 'hidden'}`}
                />

                {!scannerActive && !cameraStarting && (
                  <div className="flex flex-col items-center p-6 text-center text-surface-inverse-muted">
                    <div className="mb-3 flex size-14 items-center justify-center rounded-full bg-white/10 text-surface-inverse-muted">
                      <Camera className="size-7" />
                    </div>
                    <p className="text-body font-medium text-white">Camera is Inactive</p>
                    <p className="text-caption mt-1 max-w-[260px] text-surface-inverse-muted">
                      Click below to turn on the camera for fast, contactless gate scanning.
                    </p>
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      onClick={startCamera}
                      className="mt-4 gap-1.5 font-semibold shadow-md"
                    >
                      <Camera className="size-4" />
                      Activate Camera Scanner
                    </Button>
                  </div>
                )}

                {scannerActive && (
                  <>
                    {/* High-tech targeting reticle overlay */}
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                      <div className="relative size-56 sm:size-64">
                        {/* 4 Optical Corners */}
                        <div className="border-t-3 border-l-3 absolute left-0 top-0 size-6 border-primary" />
                        <div className="border-t-3 border-r-3 absolute right-0 top-0 size-6 border-primary" />
                        <div className="border-b-3 border-l-3 absolute bottom-0 left-0 size-6 border-primary" />
                        <div className="border-b-3 border-r-3 absolute bottom-0 right-0 size-6 border-primary" />
                        {/* Animated Laser Bar */}
                        <div className="absolute inset-x-2 top-0 h-0.5 animate-pulse bg-gradient-to-r from-transparent via-primary to-transparent shadow-[0_0_8px_var(--color-primary)]" />
                      </div>
                    </div>
                    <div className="backdrop-blur-xs pointer-events-none absolute bottom-3 z-10 rounded-full bg-black/75 px-3 py-1 text-xs font-medium text-white">
                      Align QR code inside brackets
                    </div>
                  </>
                )}
              </div>

              {cameraError && (
                <div className="border-destructive/30 bg-destructive/10 text-destructive mt-4 flex items-start gap-3 rounded-lg border p-3">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                  <div className="text-caption font-medium">{cameraError}</div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Instant Manual Pass Search */}
          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Search className="text-primary size-4" />
                Instant Pass Lookup (Manual or Barcode Gun)
              </CardTitle>
              <CardDescription>
                Search by Pass Code (e.g.{' '}
                <span className="text-foreground font-mono font-semibold">SF-EVT-6B57C6BC</span>),
                Attendee Name, or Phone Number.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={onManualSubmit} className="flex flex-col gap-2 sm:flex-row">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value)}
                    placeholder="Enter pass code, attendee name, or phone..."
                    className="border-input bg-background text-body focus:ring-primary shadow-xs focus:outline-hidden h-11 w-full rounded-lg border px-3.5 pr-10 focus:ring-2"
                  />
                  {manualCode && (
                    <button
                      type="button"
                      onClick={() => setManualCode('')}
                      className="text-muted-foreground hover:text-foreground absolute right-3 top-3"
                    >
                      <XCircle className="size-5" />
                    </button>
                  )}
                </div>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={verifying || !manualCode.trim()}
                  className="h-11 px-5 font-semibold"
                >
                  {verifying ? (
                    <>
                      <Spinner className="mr-1.5 size-4" />
                      Checking…
                    </>
                  ) : (
                    <>
                      <Search className="mr-1.5 size-4" />
                      Verify Pass
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Admission Card & Scan Feed (5 cols) */}
        <div className="space-y-6 lg:col-span-5">
          {/* Pass Admission Verification Card */}
          <Card
            className={`border-2 transition-all ${
              verification?.status === 'valid'
                ? 'border-success bg-success-subtle/30'
                : verification?.status === 'already_attended' ||
                    verification?.status === 'multiple_matches'
                  ? 'border-warning bg-warning-subtle/30'
                  : verification?.status === 'cancelled' ||
                      verification?.status === 'event_cancelled' ||
                      verification?.status === 'wrong_event'
                    ? 'border-destructive bg-destructive/5'
                    : 'border-border'
            }`}
          >
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Ticket className="text-primary size-4" />
                  Pass Admission Result
                </CardTitle>
                {verification && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setVerification(null);
                      setLookupError(null);
                    }}
                    className="h-7 text-xs"
                  >
                    Clear
                  </Button>
                )}
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {verifying && (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <Spinner className="text-primary size-8" />
                  <p className="text-body-sm text-muted-foreground mt-3 font-medium">
                    Verifying the pass…
                  </p>
                </div>
              )}

              {lookupError && !verifying && (
                <div className="border-destructive/30 bg-destructive/10 text-destructive flex items-start gap-3 rounded-lg border p-4">
                  <XCircle className="mt-0.5 size-5 shrink-0" />
                  <div>
                    <p className="text-body-sm font-semibold">Verification Failed</p>
                    <p className="text-caption mt-0.5">{lookupError}</p>
                  </div>
                </div>
              )}

              {!verifying && !verification && !lookupError && (
                <div className="border-border text-muted-foreground flex flex-col items-center justify-center rounded-xl border border-dashed py-12 text-center">
                  <Ticket className="text-muted-foreground/50 mb-2 size-10" />
                  <p className="text-body text-foreground font-medium">Waiting for Pass</p>
                  <p className="text-caption mt-0.5 max-w-[220px]">
                    Scan a QR pass or type pass code to inspect details and admit the attendee.
                  </p>
                </div>
              )}

              {verification && !verifying && (
                <div className="space-y-4">
                  {/* Status Banner */}
                  {verification.status === 'valid' && verification.matchedBy === 'search' && (
                    <div className="shadow-xs flex items-start gap-3 rounded-xl border border-warning/30 bg-warning-subtle p-4 text-warning-foreground">
                      <AlertTriangle className="mt-0.5 size-6 shrink-0 text-warning-foreground" />
                      <div>
                        <p className="text-body font-bold uppercase tracking-wider text-warning-foreground">
                          FOUND BY NAME — CHECK THEIR PASS
                        </p>
                        <p className="text-caption mt-0.5 font-medium text-warning-foreground">
                          {verification.message}
                        </p>
                      </div>
                    </div>
                  )}

                  {verification.status === 'multiple_matches' && (
                    <div className="shadow-xs space-y-3 rounded-xl border border-warning/30 bg-warning-subtle p-4 text-warning-foreground">
                      <div className="flex items-start gap-3">
                        <ListFilter className="mt-0.5 size-6 shrink-0 text-warning-foreground" />
                        <div>
                          <p className="text-body font-bold uppercase tracking-wider text-warning-foreground">
                            SEVERAL MATCHES — CHOOSE ONE
                          </p>
                          <p className="text-caption mt-0.5 font-medium text-warning-foreground">
                            {verification.message}
                          </p>
                        </div>
                      </div>
                      <ul className="divide-y divide-warning/30 overflow-hidden rounded-lg border border-warning/30 bg-surface">
                        {verification.candidates?.map((candidate) => (
                          <li key={candidate.registrationId}>
                            <button
                              type="button"
                              onClick={() => handleVerify(candidate.registrationId)}
                              className="flex w-full items-center justify-between gap-3 p-3 text-left hover:bg-background"
                            >
                              <span className="min-w-0">
                                <span className="text-body-sm block truncate font-bold text-foreground">
                                  {candidate.fullName}
                                </span>
                                <span className="text-caption block truncate font-mono text-muted-foreground">
                                  {candidate.passNumber}
                                  {candidate.totalPasses > 1
                                    ? ` · ${candidate.attendeeNames.join(', ')}`
                                    : ''}
                                </span>
                              </span>
                              <span className="text-caption shrink-0 font-semibold text-muted-foreground">
                                {candidate.status === 'cancelled'
                                  ? 'Cancelled'
                                  : `${candidate.admittedCount}/${candidate.totalPasses} in`}
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {verification.status === 'event_cancelled' && (
                    <div className="border-destructive/40 bg-destructive/15 text-destructive shadow-xs flex items-start gap-3 rounded-xl border p-4">
                      <XCircle className="text-destructive mt-0.5 size-6 shrink-0" />
                      <div>
                        <p className="text-body text-destructive font-bold uppercase tracking-wider">
                          EVENT CANCELLED
                        </p>
                        <p className="text-caption text-destructive mt-0.5 font-medium">
                          {verification.message}
                        </p>
                      </div>
                    </div>
                  )}

                  {verification.status === 'valid' && verification.matchedBy === 'pass' && (
                    <div className="shadow-xs flex items-start gap-3 rounded-xl border border-success/30 bg-success-subtle p-4 text-success">
                      <CheckCircle2 className="mt-0.5 size-6 shrink-0 text-success" />
                      <div>
                        <p className="text-body font-bold uppercase tracking-wider text-success">
                          VALID ENTRY — READY TO ADMIT
                        </p>
                        <p className="text-caption mt-0.5 font-medium text-success">
                          {verification.message}
                        </p>
                      </div>
                    </div>
                  )}

                  {verification.status === 'already_attended' && (
                    <div className="shadow-xs flex items-start gap-3 rounded-xl border border-warning/30 bg-warning-subtle p-4 text-warning-foreground">
                      <AlertTriangle className="mt-0.5 size-6 shrink-0 text-warning-foreground" />
                      <div>
                        <p className="text-body font-bold uppercase tracking-wider text-warning-foreground">
                          ALREADY CHECKED IN
                        </p>
                        <p className="text-caption mt-0.5 font-medium text-warning-foreground">
                          {verification.message}
                        </p>
                      </div>
                    </div>
                  )}

                  {verification.status === 'cancelled' && (
                    <div className="border-destructive/40 bg-destructive/15 text-destructive shadow-xs flex items-start gap-3 rounded-xl border p-4">
                      <XCircle className="text-destructive mt-0.5 size-6 shrink-0" />
                      <div>
                        <p className="text-body text-destructive font-bold uppercase tracking-wider">
                          REGISTRATION CANCELLED
                        </p>
                        <p className="text-caption text-destructive mt-0.5 font-medium">
                          {verification.message}
                        </p>
                      </div>
                    </div>
                  )}

                  {verification.status === 'wrong_event' && (
                    <div className="shadow-xs flex items-start gap-3 rounded-xl border border-warning/30 bg-warning-subtle p-4 text-warning-foreground">
                      <AlertTriangle className="mt-0.5 size-6 shrink-0 text-warning-foreground" />
                      <div>
                        <p className="text-body font-bold uppercase tracking-wider text-warning-foreground">
                          WRONG EVENT
                        </p>
                        <p className="text-caption mt-0.5 font-medium text-warning-foreground">
                          {verification.message}
                        </p>
                      </div>
                    </div>
                  )}

                  {verification.status === 'not_found' && (
                    <div className="shadow-xs flex items-start gap-3 rounded-xl border border-border-strong bg-muted p-4 text-foreground">
                      <XCircle className="mt-0.5 size-6 shrink-0 text-muted-foreground" />
                      <div>
                        <p className="text-body font-bold uppercase tracking-wider text-foreground">
                          PASS NOT FOUND
                        </p>
                        <p className="text-caption mt-0.5 font-medium text-muted-foreground">
                          {verification.message}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Attendee Details Card */}
                  {verification.registration && (
                    <div className="border-border/80 shadow-xs space-y-3 rounded-xl border bg-surface p-4">
                      {/* Attendee Name & Pass Code */}
                      <div className="border-b pb-3">
                        <div className="flex items-center justify-between">
                          <span className="text-caption font-mono font-bold text-primary">
                            {verification.registration.matchedAttendee?.passNumber ||
                              verification.registration.basePassId}
                          </span>
                          {verification.registration.functionName && (
                            <Badge variant="accent" className="font-semibold">
                              {verification.registration.functionName}
                            </Badge>
                          )}
                        </div>
                        <h3 className="text-display-xs text-foreground mt-1 font-bold">
                          {verification.registration.matchedAttendee?.fullName ||
                            verification.registration.fullName}
                        </h3>
                      </div>

                      {/* Info grid */}
                      <div className="text-caption grid grid-cols-2 gap-2 text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <Phone className="size-3.5 text-muted-foreground" />
                          <span className="truncate">{verification.registration.phone}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Mail className="size-3.5 text-muted-foreground" />
                          <span className="truncate">{verification.registration.email}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Ticket className="size-3.5 text-muted-foreground" />
                          <span>
                            Booked for {verification.registration.attendeeCount}{' '}
                            {verification.registration.attendeeCount === 1 ? 'person' : 'persons'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Clock className="size-3.5 text-muted-foreground" />
                          <span>{formatDate(verification.registration.registeredAt)}</span>
                        </div>
                      </div>

                      {/* Every person on a group booking, each admitted by their own pass */}
                      {(verification.registration.allAttendees?.length ?? 0) > 1 && (
                        <div className="mt-3 rounded-lg border border-border bg-background p-2.5">
                          <p className="text-caption font-semibold text-foreground">
                            Passes on this booking:
                          </p>
                          <ul className="mt-1 divide-y divide-border/60">
                            {verification.registration.allAttendees!.map((pass) => (
                              <li
                                key={pass.passNumber}
                                className="text-caption flex items-center justify-between gap-2 py-1.5"
                              >
                                <span className="min-w-0">
                                  <span className="block truncate font-medium text-foreground">
                                    {pass.fullName}
                                  </span>
                                  <span className="block font-mono text-muted-foreground">
                                    {pass.passNumber}
                                  </span>
                                </span>
                                {pass.admitted ? (
                                  <span className="flex shrink-0 items-center gap-1 font-semibold text-success">
                                    <CheckCircle2 className="size-3.5" />
                                    Admitted
                                  </span>
                                ) : canAdmitFrom(verification) ? (
                                  <Button
                                    type="button"
                                    variant="primary"
                                    size="sm"
                                    onClick={() => handleCheckIn(pass)}
                                    disabled={checkingIn === pass.passNumber}
                                    className="h-8 shrink-0 font-semibold"
                                  >
                                    <Check className="mr-1 size-3.5" />
                                    Admit
                                  </Button>
                                ) : (
                                  <span className="shrink-0 text-muted-foreground">Not admitted</span>
                                )}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Big Action Check-In Button — for the one person this lookup named */}
                      {verification.status === 'valid' &&
                        verification.registration.matchedAttendee && (
                          <div className="pt-2">
                            <Button
                              type="button"
                              variant="primary"
                              onClick={() =>
                                handleCheckIn(verification.registration!.matchedAttendee!)
                              }
                              disabled={
                                checkingIn === verification.registration.matchedAttendee.passNumber
                              }
                              className="h-12 w-full text-base font-bold shadow-md"
                            >
                              {checkingIn ===
                              verification.registration.matchedAttendee.passNumber ? (
                                <>
                                  <Spinner className="mr-2 size-5" />
                                  Admitting attendee…
                                </>
                              ) : (
                                <>
                                  <CheckCircle2 className="mr-2 size-5" />
                                  ADMIT & CHECK IN ATTENDEE
                                </>
                              )}
                            </Button>
                          </div>
                        )}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Gate Admitted Stream */}
          <Card className="border-border">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <History className="text-primary size-4" />
                  Recent Check-In Activity
                </CardTitle>
                <span className="text-caption text-muted-foreground">
                  {recentCheckIns.length} in this session
                </span>
              </div>
            </CardHeader>
            <CardContent>
              {recentCheckIns.length === 0 ? (
                <div className="text-caption text-muted-foreground py-6 text-center">
                  No attendees checked in during this session yet.
                </div>
              ) : (
                <ul className="divide-border divide-y">
                  {recentCheckIns.map((item) => (
                    <li key={item.id} className="flex items-center justify-between py-2.5">
                      <div className="min-w-0 pr-2">
                        <div className="flex items-center gap-2">
                          <p className="text-body-sm text-foreground truncate font-semibold">
                            {item.name}
                          </p>
                          {item.functionName && (
                            <span className="text-2xs rounded bg-muted px-1.5 py-0.5 font-medium text-foreground">
                              {item.functionName}
                            </span>
                          )}
                        </div>
                        <p className="text-2xs text-muted-foreground font-mono">
                          {item.passNumber}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5 text-xs text-success">
                        <CheckCircle2 className="size-4 text-success" />
                        <span className="font-mono text-xs font-medium">{item.time}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
