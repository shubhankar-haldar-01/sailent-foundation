/**
 * A field people never see and naive bots fill in (Phase 13).
 *
 * Off-screen rather than `display: none`, which some bots skip; hidden from
 * assistive technology and the tab order, so nobody using the page can reach
 * it. The API accepts a filled-in submission with the usual answer and
 * discards it, so a bot learns nothing.
 */
export function Honeypot() {
  return (
    <div aria-hidden="true" className="absolute -left-[10000px] h-px w-px overflow-hidden">
      <label>
        Leave this field empty
        <input type="text" name="website" tabIndex={-1} autoComplete="off" defaultValue="" />
      </label>
    </div>
  );
}
