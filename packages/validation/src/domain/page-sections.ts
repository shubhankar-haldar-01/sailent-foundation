import { z } from 'zod';

/**
 * The approved sections a page may be composed from.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * THIS FILE IS THE THING THAT STOPS A COMPOSER BECOMING A PAGE BUILDER.
 *
 * docs/database-architecture.md, on `pages.sections`: "an ordered array of
 * `{ type, props }` where `type` must be one of the APPROVED section
 * components … An unknown section type is rejected."
 *
 * So the allowlist is closed, and it is closed HERE rather than in the UI. A
 * select box that only offers approved types is a convenience; a schema that
 * refuses everything else is the control. The API validates against this on
 * every write, so a hand-made request cannot introduce a section the site
 * cannot render — or any markup at all.
 *
 * EVERY TYPE IS A COMPONENT THAT ALREADY EXISTS. The composer reorders what
 * the homepage already renders; it does not introduce a parallel set of
 * "CMS blocks" that would then need their own styling, their own tests and
 * their own drift. docs/information-architecture.md §3.6 names the reusable
 * sections, and these are the ones built.
 *
 * PROPS ARE DELIBERATELY THIN. Each section fetches its own data server-side —
 * campaigns, stories, metrics — exactly as it does today. What an editor
 * controls is WHICH sections appear, IN WHAT ORDER, and a small number of
 * display choices. Nobody authors HTML, and no prop is ever rendered as
 * markup.
 * ══════════════════════════════════════════════════════════════════════════
 */

/** A heading an editor may override, where the section supports one. */
const headingOverride = z.string().trim().min(1).max(120).optional();

/** How many records a feed-style section shows. Bounded on both sides. */
const limit = z.number().int().min(1).max(12).optional();

/**
 * The registry: type → the schema for that type's props.
 *
 * Adding a section is deliberately a two-step act — a component, and an entry
 * here. That is the point: a new section type is a product decision, not
 * something an editor can conjure by sending unfamiliar JSON.
 */
export const SECTION_PROPS = {
  /** The hero, with the verified headline metrics. */
  hero: z.object({}).strict(),

  /** Campaign cards with the category filter. */
  campaigns: z.object({ heading: headingOverride, limit }).strict(),

  /** The verified impact figures. Never editor-authored numbers. */
  impact: z.object({ heading: headingOverride }).strict(),

  /** Who we are — the standing explanatory band. */
  about: z.object({}).strict(),

  /** Recent stories alongside upcoming events. */
  storiesAndEvents: z.object({ heading: headingOverride, limit }).strict(),

  /** What people have said, from recorded testimonials. */
  testimonials: z.object({ heading: headingOverride }).strict(),

  /** The community call to action. */
  community: z.object({}).strict(),

  /** Partner logos. */
  partners: z.object({ heading: headingOverride }).strict(),

  /** The newsletter sign-up. */
  newsletter: z.object({}).strict(),
} as const;

export type SectionType = keyof typeof SECTION_PROPS;

export const SECTION_TYPES = Object.keys(SECTION_PROPS) as [SectionType, ...SectionType[]];

/**
 * One section.
 *
 * A discriminated union rather than `{ type: enum, props: unknown }`, so the
 * props are checked against the TYPE'S OWN schema — `{ type: 'hero', props: {
 * limit: 900 } }` is refused, not quietly accepted and ignored.
 *
 * Written out rather than generated from `SECTION_PROPS`, because Zod's
 * discriminated union needs each member's literal to be statically known: a
 * mapped construction typechecks as `ZodRawShape` and loses exactly the
 * narrowing this exists for. The duplication is one line per section, and
 * `SECTION_TYPES_MATCH` below fails the build if the two ever diverge.
 */
export const pageSectionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('hero'), props: SECTION_PROPS.hero.default({}) }),
  z.object({ type: z.literal('campaigns'), props: SECTION_PROPS.campaigns.default({}) }),
  z.object({ type: z.literal('impact'), props: SECTION_PROPS.impact.default({}) }),
  z.object({ type: z.literal('about'), props: SECTION_PROPS.about.default({}) }),
  z.object({
    type: z.literal('storiesAndEvents'),
    props: SECTION_PROPS.storiesAndEvents.default({}),
  }),
  z.object({ type: z.literal('testimonials'), props: SECTION_PROPS.testimonials.default({}) }),
  z.object({ type: z.literal('community'), props: SECTION_PROPS.community.default({}) }),
  z.object({ type: z.literal('partners'), props: SECTION_PROPS.partners.default({}) }),
  z.object({ type: z.literal('newsletter'), props: SECTION_PROPS.newsletter.default({}) }),
]);

export type PageSection = z.infer<typeof pageSectionSchema>;

/**
 * A page's whole section list.
 *
 * BOUNDED, and duplicates are allowed on purpose: two campaign bands at
 * different points down a long page is a reasonable layout, while forty
 * sections is a mistake somebody should be stopped from saving.
 */
export const pageSectionsSchema = z
  .array(pageSectionSchema)
  .max(30, 'A page may hold at most 30 sections.');

/** Is this a type the site can render? Used for the clearest possible error. */
export function isApprovedSectionType(value: unknown): value is SectionType {
  return typeof value === 'string' && value in SECTION_PROPS;
}

/**
 * The union and the registry must name the same set.
 *
 * A compile-time check, not a test: forgetting to add a member to the union
 * above would silently make a registered section unsavable, and forgetting to
 * register one would make a union member unvalidated. Either way this stops
 * compiling.
 */
type UnionTypes = PageSection['type'];
type RegistryTypes = SectionType;
type Exact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : never) : never;
export const SECTION_TYPES_MATCH: Exact<UnionTypes, RegistryTypes> = true;
