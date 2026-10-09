import type { GeographicReach } from '@/lib/content/impact';

/**
 * A light outline of India with a dot for every district we work in.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * THE DOTS COME FROM THE DATA; THE MAP ONLY KNOWS WHERE PLACES ARE.
 *
 * `reach.byState` lists the states and districts with a published program.
 * Each district is placed from the coordinates below; one this file does not
 * know falls back to its state's centre, and a state it does not know is left
 * off the drawing — but never off the page, because the same places are
 * listed in text for screen readers. Adding a district needs no change here
 * unless it should sit somewhere more precise than its state's centre.
 *
 * The outline is a deliberately simplified illustration in the page's own
 * neutrals, not a survey map; it is there to say "these places, in India",
 * not to settle a boundary.
 * ══════════════════════════════════════════════════════════════════════════
 */

/** [longitude, latitude] */
type LonLat = readonly [number, number];

const OUTLINE: readonly LonLat[] = [
  [68.2, 23.7],
  [68.8, 24.3],
  [70.0, 24.6],
  [71.0, 24.4],
  [70.4, 25.7],
  [70.0, 26.6],
  [70.8, 27.7],
  [72.2, 28.3],
  [73.4, 29.9],
  [74.5, 30.9],
  [74.6, 31.9],
  [75.3, 32.4],
  [74.4, 33.0],
  [74.0, 34.0],
  [73.8, 34.7],
  [74.3, 35.6],
  [74.6, 36.6],
  [75.5, 36.9],
  [76.8, 35.7],
  [77.8, 35.5],
  [78.9, 34.3],
  [78.7, 33.1],
  [79.3, 32.5],
  [78.8, 31.3],
  [80.2, 30.2],
  [81.1, 30.0],
  [80.1, 28.8],
  [81.5, 27.9],
  [83.3, 27.3],
  [84.6, 27.3],
  [85.8, 26.6],
  [87.2, 26.4],
  [88.1, 26.5],
  [88.2, 27.2],
  [88.8, 28.1],
  [88.9, 27.3],
  [89.8, 26.8],
  [92.0, 26.8],
  [92.5, 27.8],
  [94.0, 28.9],
  [95.4, 29.1],
  [96.2, 28.4],
  [97.3, 27.9],
  [96.7, 27.3],
  [95.3, 26.6],
  [95.1, 25.4],
  [94.6, 24.4],
  [93.8, 23.9],
  [93.3, 22.9],
  [92.8, 22.0],
  [92.3, 23.6],
  [91.8, 23.2],
  [91.2, 23.6],
  [91.6, 24.1],
  [92.3, 24.9],
  [91.8, 25.2],
  [90.0, 25.2],
  [89.8, 25.9],
  [89.0, 25.3],
  [88.5, 24.3],
  [88.7, 23.2],
  [89.0, 22.0],
  [88.9, 21.6],
  [87.5, 21.5],
  [86.9, 20.8],
  [86.4, 19.9],
  [85.0, 19.3],
  [84.1, 18.3],
  [82.3, 16.6],
  [81.3, 16.3],
  [80.3, 15.5],
  [80.1, 13.4],
  [79.9, 11.0],
  [79.8, 10.3],
  [78.9, 9.3],
  [78.1, 8.4],
  [77.5, 8.1],
  [76.6, 8.9],
  [76.0, 10.5],
  [75.4, 12.0],
  [74.8, 13.3],
  [74.4, 14.6],
  [73.8, 15.7],
  [73.3, 17.0],
  [72.9, 18.9],
  [72.8, 20.4],
  [72.6, 21.3],
  [72.2, 21.6],
  [71.0, 20.8],
  [70.0, 21.2],
  [69.0, 22.3],
  [69.6, 22.8],
  [68.6, 23.0],
];

/** Approximate state centres — where a district this file does not know is placed. */
const STATE_CENTRES: Record<string, LonLat> = {
  'andhra pradesh': [79.7, 15.9],
  'arunachal pradesh': [94.7, 28.2],
  assam: [92.9, 26.2],
  bihar: [85.6, 25.8],
  chhattisgarh: [81.9, 21.3],
  goa: [74.1, 15.3],
  gujarat: [71.6, 22.3],
  haryana: [76.1, 29.1],
  'himachal pradesh': [77.2, 31.9],
  jharkhand: [85.3, 23.6],
  karnataka: [75.7, 15.3],
  kerala: [76.3, 10.5],
  'madhya pradesh': [78.7, 23.5],
  maharashtra: [75.7, 19.7],
  manipur: [93.9, 24.7],
  meghalaya: [91.4, 25.5],
  mizoram: [92.9, 23.2],
  nagaland: [94.6, 26.2],
  odisha: [84.7, 20.5],
  punjab: [75.3, 31.1],
  rajasthan: [74.2, 27.0],
  sikkim: [88.5, 27.5],
  'tamil nadu': [78.7, 11.1],
  telangana: [79.0, 18.1],
  tripura: [91.7, 23.9],
  'uttar pradesh': [80.9, 26.8],
  uttarakhand: [79.0, 30.1],
  'west bengal': [87.9, 22.9],
  delhi: [77.1, 28.7],
  'jammu and kashmir': [75.3, 33.8],
  ladakh: [77.6, 34.2],
};

/** Districts placed more precisely than their state's centre. */
const DISTRICTS: Record<string, LonLat> = {
  gaya: [85.0, 24.8],
  bastar: [82.0, 19.1],
  ranchi: [85.3, 23.35],
  bhopal: [77.4, 23.26],
  pune: [73.86, 18.52],
  kalahandi: [83.17, 19.9],
  patna: [85.14, 25.6],
  raipur: [81.63, 21.25],
  mumbai: [72.88, 19.08],
  nagpur: [79.09, 21.15],
  indore: [75.86, 22.72],
  bhubaneswar: [85.82, 20.3],
  khordha: [85.6, 20.2],
  kolkata: [88.36, 22.57],
  lucknow: [80.95, 26.85],
  jaipur: [75.79, 26.91],
  hyderabad: [78.49, 17.39],
  bengaluru: [77.59, 12.97],
  chennai: [80.27, 13.08],
};

/*
  Mercator, in degree units: the familiar shape of India. A plain
  longitude/latitude grid draws the country almost square and squashed.
*/
const mercator = (lat: number) =>
  (180 / Math.PI) * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
const MIN_LON = 67.5,
  TOP = mercator(37.5),
  SCALE = 12;
const project = ([lon, lat]: LonLat) =>
  [(lon - MIN_LON) * SCALE, (TOP - mercator(lat)) * SCALE] as const;
const OUTLINE_PATH =
  OUTLINE.map((point, index) => {
    const [x, y] = project(point);
    return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(' ') + ' Z';

const key = (name: string) => name.trim().toLowerCase();

export function IndiaPresenceMap({
  regions,
  className,
}: {
  regions: GeographicReach[];
  className?: string;
}) {
  // One dot per district; a duplicate position (two districts falling back to
  // the same state centre) is drawn once.
  const seen = new Set<string>();
  const dots: { label: string; x: number; y: number }[] = [];
  for (const region of regions) {
    const centre = STATE_CENTRES[key(region.state)];
    const districts = region.districts.length > 0 ? region.districts : [region.state];
    for (const district of districts) {
      const at = DISTRICTS[key(district)] ?? centre;
      if (!at) continue;
      const [x, y] = project(at);
      const id = `${x.toFixed(0)}-${y.toFixed(0)}`;
      if (seen.has(id)) continue;
      seen.add(id);
      dots.push({ label: `${district}, ${region.state}`, x, y });
    }
  }

  return (
    <div className={className}>
      <svg viewBox="0 0 366 398" className="h-auto w-full" aria-hidden="true">
        <path
          d={OUTLINE_PATH}
          className="fill-border/75 stroke-border-strong/60"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        {dots.map((dot) => (
          <g key={dot.label}>
            <circle cx={dot.x} cy={dot.y} r="10" className="fill-primary/10" />
            <circle cx={dot.x} cy={dot.y} r="6.5" className="fill-primary/20" />
            <circle cx={dot.x} cy={dot.y} r="4" className="fill-primary" />
          </g>
        ))}
      </svg>

      {/* The same places, in words, for anybody who cannot see the drawing. */}
      {regions.length > 0 ? (
        <ul className="sr-only">
          {regions.map((region) => (
            <li key={region.state}>
              {region.state}
              {region.districts.length > 0 ? `: ${region.districts.join(', ')}` : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
