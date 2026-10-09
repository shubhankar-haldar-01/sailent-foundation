import { cn } from '@sailent/ui';

/**
 * The accepted payment methods, as a row of marks.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * DRAWN STAND-INS, TO BE SWAPPED FOR THE OFFICIAL ARTWORK BEFORE LAUNCH.
 *
 * Showing which methods a merchant accepts is ordinary, and each network
 * publishes acceptance marks for exactly that — but they ask for their own
 * files, unaltered. This project does not hold those files yet, so each mark
 * here is a simple drawing in the brand's colours that reads the same at this
 * size: Razorpay's slash, UPI's and RuPay's two arrows, the Mastercard circles.
 * When the official SVGs arrive, each `<li>` takes an `<img>` instead and
 * nothing around this row changes.
 *
 * Every mark carries its name for assistive tech; the drawings are hidden.
 * ══════════════════════════════════════════════════════════════════════════
 */
export function PaymentLogos({ className }: { className?: string }) {
  return (
    <ul
      aria-label="Accepted payment methods"
      className={cn(
        'flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-1',
        // Dark mode: the marks keep their brand colours, on a white chip, as
        // payment marks are shown on dark sites — recolouring them is not ours
        // to do, and on a dark ground they drop to 1.2–1.7:1.
        'dark:rounded-lg dark:bg-white dark:px-3 dark:py-2',
        className,
      )}
    >
      <li className="flex items-center gap-1">
        <svg aria-hidden="true" viewBox="0 0 10 16" className="h-4 w-auto">
          <path d="M6.2 0H10L5.6 16H1.8L3.5 9.8 0 11.6 1.2 7.1Z" fill="#3395FF" />
          <path d="M6.2 0H10L8.9 4 4.6 5.9Z" fill="#072654" />
        </svg>
        <span className="text-[0.8125rem] font-bold tracking-tight text-[#072654]">Razorpay</span>
      </li>

      <li className="flex items-center gap-0.5">
        <span className="text-[0.8125rem] font-bold tracking-tight text-[#3a3f51]">UPI</span>
        <TwinArrows />
      </li>

      <li>
        <span className="text-[1.0625rem] font-bold italic leading-none tracking-tight text-[#1a1f71]">
          VISA
        </span>
      </li>

      <li>
        <svg role="img" aria-label="Mastercard" viewBox="0 0 26 16" className="h-5 w-auto">
          <circle cx="8" cy="8" r="8" fill="#EB001B" />
          <circle cx="18" cy="8" r="8" fill="#F79E1B" />
          <path d="M13 1.76A8 8 0 0 1 13 14.24 8 8 0 0 1 13 1.76Z" fill="#FF5F00" />
        </svg>
      </li>

      <li className="flex items-center gap-0.5">
        <span className="text-[0.8125rem] font-bold tracking-tight text-[#097939]">RuPay</span>
        <TwinArrows />
      </li>
    </ul>
  );
}

/** The orange and green arrows UPI and RuPay both carry. */
function TwinArrows() {
  return (
    <svg aria-hidden="true" viewBox="0 0 14 14" className="h-3.5 w-auto">
      <path d="M1 1.5 6 7 1 12.5H4L9 7 4 1.5Z" fill="#F58220" />
      <path d="M5 1.5 10 7 5 12.5H8L13 7 8 1.5Z" fill="#3EA54A" />
    </svg>
  );
}
