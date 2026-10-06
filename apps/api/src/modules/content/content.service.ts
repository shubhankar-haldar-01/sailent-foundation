import { Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq, gte, inArray, isNull, lt, or, sql, type SQL } from 'drizzle-orm';

import {
  campaignProducts,
  products,
  campaigns,
  donations,
  donors,
  events,
  impactUpdates,
  programs,
  successStories,
  teamMembers,
  type DatabaseClient,
} from '@sailent/database';

import {
  PUBLIC_CAMPAIGN_STATUSES,
  campaignProgress,
  daysRemaining,
  deadlineCutoff,
  donationAvailability,
  quantityProgress,
} from '@sailent/validation';

import { DATABASE } from '../database/database.module.js';
import { CampaignContentService } from '../catalog/campaign-content.service.js';
import { CategoriesService } from '../catalog/categories.service.js';
import { NotFoundException } from '../../common/exceptions.js';
import {
  offsetFor,
  paginate,
  resolveSort,
  type PaginatedResult,
  type PaginationQuery,
} from '../../common/dto/pagination.dto.js';

/**
 * Public content queries.
 *
 * ONE service for the public read surface rather than seven near-identical
 * ones. The pattern is the same everywhere — filter to published, paginate,
 * sort against an allow-list — and duplicating it seven times would mean seven
 * places for a "published only" filter to be forgotten.
 *
 * THE VISIBILITY RULE, applied without exception: a public endpoint returns
 * only published, non-deleted rows. Drafts and archived content are 404 to the
 * public, exactly as if they did not exist. Admin listings are a separate
 * surface with their own permission checks — they are not this service with a
 * flag.
 */
@Injectable()
export class ContentService {
  constructor(
    @Inject(DATABASE) private readonly database: DatabaseClient,
    /**
     * Reused rather than reimplemented. The sub-resource queries already exist
     * and already take a `publicOnly` flag; a second copy here is a second
     * place for the visibility filter to be forgotten.
     */
    private readonly content: CampaignContentService,
    private readonly categories: CategoriesService,
  ) {}

  private get db() {
    return this.database.db;
  }

  // -------------------------------------------------------------------------
  // Programmes
  // -------------------------------------------------------------------------

  async listPrograms(query: PaginationQuery): Promise<PaginatedResult<unknown>> {
    const where = and(eq(programs.status, 'published'), isNull(programs.deletedAt));

    const sortable = {
      displayOrder: programs.displayOrder,
      title: programs.title,
      createdAt: programs.createdAt,
    };
    const { column, direction } = resolveSort(query.sort, sortable, 'displayOrder');

    const [items, [count]] = await Promise.all([
      this.db
        .select({
          id: programs.id,
          title: programs.title,
          slug: programs.slug,
          tagline: programs.tagline,
          shortDescription: programs.shortDescription,
          coverImage: programs.coverImage,
          category: programs.category,
          campaignCount: programs.campaignCount,
          displayOrder: programs.displayOrder,
          // Presentation only, but the card cannot render without it and a
          // second request per card to fetch one string would be absurd.
          accentIcon: programs.accentIcon,
        })
        .from(programs)
        .where(where)
        .orderBy(direction === 'desc' ? desc(column) : asc(column))
        .limit(query.limit)
        .offset(offsetFor(query.page, query.limit)),
      this.db
        .select({ value: sql<number>`count(*)::int` })
        .from(programs)
        .where(where),
    ]);

    return paginate(items, query.page, query.limit, count?.value ?? 0);
  }

  async getProgramBySlug(slug: string) {
    const [program] = await this.db
      .select()
      .from(programs)
      .where(
        and(eq(programs.slug, slug), eq(programs.status, 'published'), isNull(programs.deletedAt)),
      )
      .limit(1);

    if (!program) throw new NotFoundException('Programme');

    // Related content in one round trip rather than three sequential ones.
    const [relatedCampaigns, relatedStories, relatedImpact] = await Promise.all([
      this.db
        .select({
          id: campaigns.id,
          title: campaigns.title,
          slug: campaigns.slug,
          shortDescription: campaigns.shortDescription,
          coverImage: campaigns.coverImage,
          fundraisingGoal: campaigns.fundraisingGoal,
          amountRaised: campaigns.amountRaised,
          donorCount: campaigns.donorCount,
          endDate: campaigns.endDate,
          status: campaigns.status,
        })
        .from(campaigns)
        .where(
          and(
            eq(campaigns.programId, program.id),
            or(eq(campaigns.status, 'active'), eq(campaigns.status, 'completed')),
            isNull(campaigns.deletedAt),
          ),
        )
        .limit(12),
      this.db
        .select({
          id: successStories.id,
          title: successStories.title,
          slug: successStories.slug,
          excerpt: successStories.excerpt,
          coverImage: successStories.coverImage,
        })
        .from(successStories)
        .where(
          and(
            eq(successStories.programId, program.id),
            eq(successStories.status, 'published'),
            isNull(successStories.deletedAt),
          ),
        )
        .limit(6),
      this.db
        .select({
          id: impactUpdates.id,
          title: impactUpdates.title,
          description: impactUpdates.description,
          impactDate: impactUpdates.impactDate,
          location: impactUpdates.location,
          metricType: impactUpdates.metricType,
          metricValue: impactUpdates.metricValue,
        })
        .from(impactUpdates)
        .where(and(eq(impactUpdates.programId, program.id), eq(impactUpdates.isPublic, true)))
        .orderBy(desc(impactUpdates.impactDate))
        .limit(6),
    ]);

    return {
      ...program,
      campaigns: relatedCampaigns,
      stories: relatedStories,
      impactUpdates: relatedImpact,
    };
  }

  // -------------------------------------------------------------------------
  // Campaigns
  // -------------------------------------------------------------------------

  async listCampaigns(
    query: PaginationQuery & {
      programSlug?: string;
      category?: string;
      categorySlug?: string;
      state?: string;
      status?: string;
    },
  ): Promise<PaginatedResult<unknown>> {
    const filters: SQL[] = [isNull(campaigns.deletedAt)];

    /**
     * Default to ACTIVE and PAUSED. A caller may ask for `open`, `closed`,
     * `paused`, `completed` or `all`, but `draft` and `archived` are never
     * reachable from a public endpoint whatever is passed — unpublished work is
     * not public.
     *
     * `open` and `closed` split the default by whether a donation can be made
     * today, the deadline included (`hasEnded` in @sailent/validation):
     *
     *   open    active, with no end date or one that has not passed
     *   closed  paused, or active but past its end date
     */
    const cutoff = deadlineCutoff();
    if (query.status === 'open') {
      filters.push(
        eq(campaigns.status, 'active'),
        or(isNull(campaigns.endDate), gte(campaigns.endDate, cutoff))!,
      );
    } else if (query.status === 'closed') {
      filters.push(
        or(
          eq(campaigns.status, 'paused'),
          and(eq(campaigns.status, 'active'), lt(campaigns.endDate, cutoff)),
        )!,
      );
    } else if (query.status === 'completed') {
      filters.push(eq(campaigns.status, 'completed'));
    } else if (query.status === 'paused') {
      filters.push(eq(campaigns.status, 'paused'));
    } else if (query.status === 'all') {
      // Everything the public may see — still never draft or archived.
      filters.push(inArray(campaigns.status, PUBLIC_CAMPAIGN_STATUSES));
    } else {
      // The default listing shows what someone can act on today: open for
      // donations, or open and temporarily stopped.
      filters.push(inArray(campaigns.status, ['active', 'paused']));
    }

    if (query.category) filters.push(eq(campaigns.category, query.category));
    // Filter by the category's stable slug as well as its display name, so a
    // renamed category does not break every link that filtered by it.
    if (query.categorySlug) {
      filters.push(
        sql`${campaigns.categoryId} = (SELECT id FROM categories WHERE slug = ${query.categorySlug})`,
      );
    }
    if (query.state) filters.push(eq(campaigns.state, query.state));
    if (query.programSlug) {
      filters.push(
        sql`${campaigns.programId} = (SELECT id FROM programs WHERE slug = ${query.programSlug})`,
      );
    }
    if (query.q) {
      filters.push(
        sql`(${campaigns.title} ILIKE ${'%' + query.q + '%'} OR ${campaigns.shortDescription} ILIKE ${'%' + query.q + '%'})`,
      );
    }

    const where = and(...filters);

    const sortable = {
      endDate: campaigns.endDate,
      createdAt: campaigns.createdAt,
      amountRaised: campaigns.amountRaised,
      donorCount: campaigns.donorCount,
      title: campaigns.title,
    };
    const { column, direction } = resolveSort(query.sort, sortable, 'endDate');

    /**
     * `sort=featured` — the homepage's Featured Campaigns band.
     *
     * The campaigns an administrator has marked FEATURED come first, in the
     * order they were given (`featured_order`, lowest first; a featured
     * campaign with no number goes after the numbered ones). Everything else
     * follows by deadline, soonest first, so the band is never empty and what
     * fills it is what most needs support now. Postgres sorts NULLs last in
     * ascending order, so a campaign with no end date follows those that
     * have one.
     *
     * `created_at` and `id` settle ties, so two identical requests can never
     * return the same rows in a different order.
     */
    const orderBy =
      query.sort === 'featured'
        ? [
            desc(campaigns.isFeatured),
            asc(campaigns.featuredOrder),
            asc(campaigns.endDate),
            asc(campaigns.createdAt),
            asc(campaigns.id),
          ]
        : [direction === 'desc' ? desc(column) : asc(column)];

    const [items, [count]] = await Promise.all([
      this.db
        .select({
          id: campaigns.id,
          title: campaigns.title,
          slug: campaigns.slug,
          shortDescription: campaigns.shortDescription,
          coverImage: campaigns.coverImage,
          category: campaigns.category,
          location: campaigns.location,
          fundraisingGoal: campaigns.fundraisingGoal,
          amountRaised: campaigns.amountRaised,
          currency: campaigns.currency,
          donorCount: campaigns.donorCount,
          beneficiaryTarget: campaigns.beneficiaryTarget,
          beneficiariesReached: campaigns.beneficiariesReached,
          startDate: campaigns.startDate,
          endDate: campaigns.endDate,
          status: campaigns.status,
          isFeatured: campaigns.isFeatured,
          /**
           * Whether this campaign offers product-based giving.
           *
           * An EXISTS subquery rather than the product rows themselves: the
           * listing needs to know IF there are products (the card changes), not
           * what they are. Returning every product for every campaign would be
           * paying for a whole catalogue to render one badge.
           */
          /*
           * LITERAL SQL. A `sql` template emits column references unqualified,
           * so `${campaignProducts.campaignId} = ${campaigns.id}` renders as
           * `"campaign_id" = "id"` — both of which resolve INSIDE
           * campaign_products, making the condition false for every row. That
           * is what this expression did before Phase 5: every campaign
           * reported `hasProducts: false`, and the badge the card renders from
           * it never appeared on any of them.
           */
          hasProducts: sql<boolean>`EXISTS (
            SELECT 1 FROM campaign_products cp
            JOIN products p ON p.id = cp.product_id
            WHERE cp.campaign_id = campaigns.id
              AND cp.is_active = true
              AND p.status = 'active'
              AND cp.deleted_at IS NULL
              AND p.deleted_at IS NULL
          )`,
          programId: campaigns.programId,
          programTitle: programs.title,
          programSlug: programs.slug,
        })
        .from(campaigns)
        .leftJoin(programs, eq(programs.id, campaigns.programId))
        .where(where)
        .orderBy(...orderBy)
        .limit(query.limit)
        .offset(offsetFor(query.page, query.limit)),
      this.db
        .select({ value: sql<number>`count(*)::int` })
        .from(campaigns)
        .where(where),
    ]);

    return paginate(items, query.page, query.limit, count?.value ?? 0);
  }

  async getCampaignBySlug(slug: string) {
    const [campaign] = await this.db
      .select()
      .from(campaigns)
      .where(
        and(
          eq(campaigns.slug, slug),
          /**
           * The shared visibility rule, not a list repeated here.
           * `paused` stays reachable because it was public a moment ago and
           * pulling the page from under everyone holding the link is worse
           * than showing it with donations closed; `completed` stays as
           * history. `draft` and `archived` are 404.
           */
          inArray(campaigns.status, PUBLIC_CAMPAIGN_STATUSES),
          isNull(campaigns.deletedAt),
        ),
      )
      .limit(1);

    if (!campaign) throw new NotFoundException('Campaign');

    const [products, program, stories, faqList, galleryItems, updateList, documentList] =
      await Promise.all([
        this.listCampaignProducts(campaign.id),
        campaign.programId
          ? this.db
              .select({ id: programs.id, title: programs.title, slug: programs.slug })
              .from(programs)
              .where(eq(programs.id, campaign.programId))
              .limit(1)
              .then((rows) => rows[0] ?? null)
          : Promise.resolve(null),
        this.db
          .select({
            id: successStories.id,
            title: successStories.title,
            slug: successStories.slug,
            excerpt: successStories.excerpt,
            coverImage: successStories.coverImage,
          })
          .from(successStories)
          .where(
            and(
              eq(successStories.campaignId, campaign.id),
              eq(successStories.status, 'published'),
              isNull(successStories.deletedAt),
            ),
          )
          .limit(6),
        // The sub-resources, each filtered to what the public may see IN THE
        // QUERY rather than after it. A private image fetched and then dropped
        // has still been read into an object something might serialise.
        this.content.listFaqs(campaign.id, { publishedOnly: true }),
        this.content.listGallery(campaign.id, { publicOnly: true }),
        this.content.listUpdates(campaign.id, { publishedOnly: true }),
        this.content.listDocuments(campaign.id, { publicOnly: true }),
      ]);

    // `internalNotes` is ADMIN-ONLY and must never leave through a public
    // endpoint — stripped here rather than relying on every caller to remember.
    const { internalNotes: _internalNotes, ...publicFields } = campaign;

    return {
      ...publicFields,
      program,
      products,
      stories,
      faqs: faqList.items,
      gallery: galleryItems.items,
      updates: updateList.items,
      documents: documentList.items,
      // Computed server-side by the one shared implementation, so the figure
      // on the page and the figure in the API cannot disagree.
      progress: campaignProgress(campaign.fundraisingGoal, campaign.amountRaised),
      daysRemaining: daysRemaining(campaign.endDate),
      // Tells the client what the donate control should say, and why — without
      // the client having to know the lifecycle rules. From the status, and the
      // end date, which closes an active campaign at the end of its day.
      donation: donationAvailability(campaign.status, campaign.endDate),
    };
  }

  /**
   * The products a campaign is asking for, as the public sees them.
   *
   * ══════════════════════════════════════════════════════════════════════════
   * An INNER JOIN onto the catalogue, filtered on BOTH statuses.
   *
   * A product is shown only when the catalogue says it is active AND this
   * campaign has it switched on. Two flags rather than one, because they answer
   * different questions: the catalogue answers "do we do this at all", the
   * junction answers "are we asking for it here". A product withdrawn centrally
   * therefore vanishes from every campaign at once, without anyone having to
   * visit each one — which is the failure mode the old denormalised shape had,
   * where withdrawing something meant finding every copy of it.
   *
   * `price` comes from the JUNCTION, never from the catalogue. What this
   * campaign charges is its own; `defaultPrice` is not sent, because the public
   * has no use for a number that is not what they will pay.
   * ══════════════════════════════════════════════════════════════════════════
   */
  async listCampaignProducts(campaignId: string) {
    const rows = await this.db
      .select({
        id: campaignProducts.id,
        productId: campaignProducts.productId,
        name: products.name,
        slug: products.slug,
        description: products.description,
        image: products.image,
        unit: products.unit,
        price: campaignProducts.price,
        currency: campaignProducts.currency,
        targetQuantity: campaignProducts.targetQuantity,
        providedQuantity: campaignProducts.providedQuantity,
        maxPerDonation: campaignProducts.maxPerDonation,
        status: campaignProducts.status,
        sortOrder: campaignProducts.sortOrder,
      })
      .from(campaignProducts)
      .innerJoin(products, eq(products.id, campaignProducts.productId))
      .where(
        and(
          eq(campaignProducts.campaignId, campaignId),
          eq(campaignProducts.isActive, true),
          eq(products.status, 'active'),
          isNull(campaignProducts.deletedAt),
          isNull(products.deletedAt),
        ),
      )
      .orderBy(asc(campaignProducts.sortOrder), asc(products.name));

    // Computed server-side by the one shared implementation, so the figure on
    // the page and the figure in the API cannot disagree.
    return rows.map((row) => ({
      ...row,
      progress: quantityProgress(row.targetQuantity, row.providedQuantity),
    }));
  }

  async getCampaignProductsBySlug(slug: string) {
    const [campaign] = await this.db
      .select({ id: campaigns.id })
      .from(campaigns)
      .where(and(eq(campaigns.slug, slug), isNull(campaigns.deletedAt)))
      .limit(1);

    if (!campaign) throw new NotFoundException('Campaign');
    return this.listCampaignProducts(campaign.id);
  }

  // -------------------------------------------------------------------------
  // Stories, events, team, impact
  // -------------------------------------------------------------------------

  async listStories(query: PaginationQuery): Promise<PaginatedResult<unknown>> {
    const where = and(eq(successStories.status, 'published'), isNull(successStories.deletedAt));

    const sortable = {
      publishedAt: successStories.publishedAt,
      title: successStories.title,
      createdAt: successStories.createdAt,
    };
    const { column } = resolveSort(query.sort, sortable, 'publishedAt');

    const [items, [count]] = await Promise.all([
      this.db
        .select({
          id: successStories.id,
          title: successStories.title,
          slug: successStories.slug,
          excerpt: successStories.excerpt,
          coverImage: successStories.coverImage,
          category: successStories.category,
          location: successStories.location,
          publishedAt: successStories.publishedAt,
          programId: successStories.programId,
          campaignId: successStories.campaignId,
          /**
           * The SLUG, not only the id.
           *
           * A client that receives `programId` and needs "which programme is
           * this story about" has to fetch every programme to find out. The
           * join costs nothing here and removes a round trip there.
           */
          programSlug: programs.slug,
          programTitle: programs.title,
          campaignSlug: campaigns.slug,
        })
        .from(successStories)
        .leftJoin(programs, eq(programs.id, successStories.programId))
        .leftJoin(campaigns, eq(campaigns.id, successStories.campaignId))
        .where(where)
        .orderBy(desc(column))
        .limit(query.limit)
        .offset(offsetFor(query.page, query.limit)),
      this.db
        .select({ value: sql<number>`count(*)::int` })
        .from(successStories)
        .where(where),
    ]);

    return paginate(items, query.page, query.limit, count?.value ?? 0);
  }

  async getStoryBySlug(slug: string) {
    const [row] = await this.db
      .select({
        story: successStories,
        programSlug: programs.slug,
        programTitle: programs.title,
        campaignSlug: campaigns.slug,
      })
      .from(successStories)
      .leftJoin(programs, eq(programs.id, successStories.programId))
      .leftJoin(campaigns, eq(campaigns.id, successStories.campaignId))
      .where(
        and(
          eq(successStories.slug, slug),
          eq(successStories.status, 'published'),
          isNull(successStories.deletedAt),
        ),
      )
      .limit(1);

    if (!row) throw new NotFoundException('Story');

    /**
     * ══════════════════════════════════════════════════════════════════════
     * AN ALLOWLIST, NOT A DELETE LIST.
     *
     * This used to select the whole row and strip `consentDocumentId`. Two
     * things were wrong with that, and the second one mattered:
     *
     *   - `authorId` and `deletedAt` went out on a public endpoint. Internal
     *     identifiers, of no use to a reader.
     *   - `subjectName` went out EVEN WHEN `isAnonymised` WAS TRUE. A story
     *     marked anonymised is one where somebody asked not to be named, or
     *     where naming them would put them at risk, and the flag was being
     *     recorded and then ignored.
     *
     * A delete list fails open: the next column added to the table is public
     * until somebody remembers to strip it. This names what may leave.
     * ══════════════════════════════════════════════════════════════════════
     */
    const story = row.story;

    return {
      id: story.id,
      title: story.title,
      slug: story.slug,
      excerpt: story.excerpt,
      content: story.content,
      coverImage: story.coverImage,
      gallery: story.gallery,
      category: story.category,
      location: story.location,
      challenge: story.challenge,
      intervention: story.intervention,
      journey: story.journey,
      outcome: story.outcome,
      impact: story.impact,
      publishedAt: story.publishedAt,
      metaTitle: story.metaTitle,
      metaDescription: story.metaDescription,
      isAnonymised: story.isAnonymised,

      /*
        THE WHOLE POINT OF THE FLAG. An anonymised story carries no name, and
        the decision is made here rather than trusted to every template that
        might render one.
      */
      subjectName: story.isAnonymised ? null : story.subjectName,

      /*
        `consentObtained` stays: it is what lets a page say the subject agreed
        to appear. `consentDocumentId` does NOT — it points at the signed form
        in private storage, and the flag is the public fact while the pointer
        is not.
      */
      consentObtained: story.consentObtained,

      programSlug: row.programSlug,
      programTitle: row.programTitle,
      campaignSlug: row.campaignSlug,
    };
  }

  async listEvents(query: PaginationQuery & { when?: 'upcoming' | 'past' }) {
    const filters: SQL[] = [eq(events.status, 'published'), isNull(events.deletedAt)];

    if (query.when === 'past') {
      filters.push(sql`${events.startDate} < now()`);
    } else if (query.when === 'upcoming') {
      filters.push(sql`${events.startDate} >= now()`);
    }

    const where = and(...filters);
    const descending = query.when === 'past';

    const [items, [count]] = await Promise.all([
      this.db
        .select({
          id: events.id,
          title: events.title,
          slug: events.slug,
          summary: events.summary,
          coverImage: events.coverImage,
          startDate: events.startDate,
          endDate: events.endDate,
          venueName: events.venueName,
          city: events.city,
          isOnline: events.isOnline,
          capacity: events.capacity,
          registeredCount: events.registeredCount,
          registrationStatus: events.registrationStatus,
          // Same reasoning as the story listing: the slug is what a link needs.
          programSlug: programs.slug,
          campaignSlug: campaigns.slug,
        })
        .from(events)
        .leftJoin(programs, eq(programs.id, events.programId))
        .leftJoin(campaigns, eq(campaigns.id, events.campaignId))
        .where(where)
        .orderBy(descending ? desc(events.startDate) : asc(events.startDate))
        .limit(query.limit)
        .offset(offsetFor(query.page, query.limit)),
      this.db
        .select({ value: sql<number>`count(*)::int` })
        .from(events)
        .where(where),
    ]);

    return paginate(items, query.page, query.limit, count?.value ?? 0);
  }

  async getEventBySlug(slug: string) {
    const [row] = await this.db
      .select({ event: events, programSlug: programs.slug, campaignSlug: campaigns.slug })
      .from(events)
      .leftJoin(programs, eq(programs.id, events.programId))
      .leftJoin(campaigns, eq(campaigns.id, events.campaignId))
      .where(and(eq(events.slug, slug), eq(events.status, 'published'), isNull(events.deletedAt)))
      .limit(1);

    if (!row) throw new NotFoundException('Event');

    // The joining link is PRIVATE — released to registrants, never on a public
    // endpoint where anyone with the URL could walk into an online session.
    const { meetingUrl: _meetingUrl, ...publicFields } = row.event;

    return { ...publicFields, programSlug: row.programSlug, campaignSlug: row.campaignSlug };
  }

  // -------------------------------------------------------------------------
  // Public campaign sub-resources
  //
  // Each resolves the slug to a campaign the PUBLIC may see before touching
  // the child records, so a draft campaign's FAQs are unreachable even by
  // someone who knows its id.
  // -------------------------------------------------------------------------

  private async publicCampaignId(slug: string): Promise<string> {
    const [row] = await this.db
      .select({ id: campaigns.id })
      .from(campaigns)
      .where(
        and(
          eq(campaigns.slug, slug),
          inArray(campaigns.status, PUBLIC_CAMPAIGN_STATUSES),
          isNull(campaigns.deletedAt),
        ),
      )
      .limit(1);

    if (!row) throw new NotFoundException('Campaign');
    return row.id;
  }

  async publicCampaignFaqs(slug: string) {
    return this.content.listFaqs(await this.publicCampaignId(slug), { publishedOnly: true });
  }

  async publicCampaignGallery(slug: string) {
    return this.content.listGallery(await this.publicCampaignId(slug), { publicOnly: true });
  }

  /**
   * The people who recently gave to this campaign.
   *
   * ══════════════════════════════════════════════════════════════════════════
   * THIS IS THE ONLY PUBLIC ENDPOINT THAT RETURNS A DONOR'S NAME, SO THE RULES
   * ARE IN THE QUERY RATHER THAN IN A SERIALISER.
   *
   *   • `donations.anonymous` is honoured in the SELECT: an anonymous gift
   *     returns the literal 'Anonymous Donor' and the donor's name is never
   *     read out of the database at all. A name fetched and then swapped has
   *     still been in the process, the heap and possibly a log line.
   *
   *   • `donors.is_anonymous` is honoured too. The donation-level flag is the
   *     choice made at the till; the donor-level one is a standing preference
   *     set in their dashboard. EITHER hides the name — a donor who asked to be
   *     anonymous everywhere should not have to remember to tick the box again.
   *
   *   • Only `successful` donations. A pending or failed attempt is not a gift,
   *     and listing one would publish an intention somebody never completed.
   *
   *   • NOTHING ELSE IS SELECTED. No email, no phone, no donor id, no donation
   *     id, no reference. What comes back is a display name, an amount and a
   *     timestamp, because that is all the page shows and anything more would
   *     be one refactor away from being rendered.
   * ══════════════════════════════════════════════════════════════════════════
   *
   * `sort` is an allow-list of two, never a column name from the request.
   */
  async publicCampaignDonors(
    slug: string,
    options: { sort?: 'recent' | 'generous'; limit?: number } = {},
  ) {
    const campaignId = await this.publicCampaignId(slug);
    const limit = Math.min(Math.max(options.limit ?? 5, 1), 25);

    /*
      Built once and reused for both the name and the initials, so the two can
      never disagree — an "Anonymous Donor" row showing real initials would leak
      exactly what the flag exists to hide.
    */
    const hidden = sql<boolean>`(${donations.anonymous} OR ${donors.isAnonymous})`;

    const rows = await this.db
      .select({
        name: sql<string>`
          CASE WHEN ${hidden} THEN 'Anonymous Donor'
               ELSE btrim(concat_ws(' ', ${donors.firstName}, ${donors.lastName}))
          END
        `,
        anonymous: hidden,
        amount: donations.amount,
        donatedAt: donations.completedAt,
      })
      .from(donations)
      .innerJoin(donors, eq(donors.id, donations.donorId))
      .where(
        and(
          eq(donations.campaignId, campaignId),
          // No soft-delete filter: `donations` has no `deleted_at`, and that is
          // deliberate — a financial record is never removed.
          eq(donations.status, 'successful'),
        ),
      )
      /*
        A TIEBREAKER, for the same reason the admin lists have one.

        Donations that landed in the same second — or, in development, that were
        seeded with the same offset — have no defined order among themselves, so
        two identical requests can return different rows in the top five. The
        reference is unique, which makes the order total.
      */
      .orderBy(
        options.sort === 'generous'
          ? desc(donations.amount)
          : desc(sql`coalesce(${donations.completedAt}, ${donations.donationDate})`),
        desc(donations.reference),
      )
      .limit(limit);

    return {
      items: rows.map((row) => ({
        // Trimmed to a display name; a blank one falls back rather than
        // rendering an empty row.
        name: row.name?.trim() || 'Anonymous Donor',
        anonymous: Boolean(row.anonymous),
        amount: Number(row.amount),
        donatedAt: row.donatedAt,
      })),
    };
  }

  async publicCampaignUpdates(slug: string) {
    return this.content.listUpdates(await this.publicCampaignId(slug), { publishedOnly: true });
  }

  async publicCampaignDocuments(slug: string) {
    return this.content.listDocuments(await this.publicCampaignId(slug), { publicOnly: true });
  }

  /**
   * Categories with at least one public record.
   *
   * A filter chip leading to an empty page is worse than no chip, so the
   * counts are of PUBLIC records and empty categories are dropped.
   */
  async listPublicCategories(kind: 'program' | 'campaign') {
    const { items } = await this.categories.list({ kind, activeOnly: true });

    return {
      items: items
        .map(({ id: _id, isActive: _isActive, ...rest }) => rest)
        .filter((item) => (kind === 'program' ? item.programCount : item.campaignCount) > 0),
    };
  }

  async listTeam() {
    return this.db
      .select({
        id: teamMembers.id,
        name: teamMembers.name,
        slug: teamMembers.slug,
        photoUrl: teamMembers.photoUrl,
        designation: teamMembers.designation,
        department: teamMembers.department,
        memberType: teamMembers.memberType,
        bio: teamMembers.bio,
        socialLinks: teamMembers.socialLinks,
        displayOrder: teamMembers.displayOrder,
      })
      .from(teamMembers)
      .where(
        and(
          eq(teamMembers.isPublic, true),
          eq(teamMembers.status, 'published'),
          isNull(teamMembers.deletedAt),
        ),
      )
      .orderBy(asc(teamMembers.displayOrder));
  }

  /**
   * Public impact.
   *
   * Aggregates are computed from the database rather than stored as copy
   * (decision A14). A figure nobody can derive is a figure nobody should see,
   * and `null` here is the honest answer when there is nothing to report — the
   * UI renders no statistic rather than a zero.
   */
  async getImpact() {
    const [totals] = await this.db
      .select({
        programmes: sql<number>`(SELECT count(*)::int FROM programs WHERE status = 'published' AND deleted_at IS NULL)`,
        campaigns: sql<number>`(SELECT count(*)::int FROM campaigns WHERE status IN ('active','completed') AND deleted_at IS NULL)`,
        beneficiariesReached: sql<number>`(SELECT coalesce(sum(beneficiaries_reached),0)::int FROM campaigns WHERE deleted_at IS NULL)`,
        // DISTINCT DONORS, not a sum of the campaigns' counters: summing
        // counted somebody who gave to four campaigns four times. A donation
        // with no donor cannot be matched to another, so it counts as one.
        donorCount: sql<number>`(SELECT (count(DISTINCT donor_id) + count(*) FILTER (WHERE donor_id IS NULL))::int FROM donations WHERE status = 'successful')`,
        activeVolunteers: sql<number>`(SELECT count(*)::int FROM volunteers WHERE status = 'active')`,
        verifiedVolunteerHours: sql<number>`(SELECT coalesce(sum(verified_hours),0)::int FROM volunteers)`,
      })
      .from(sql`(SELECT 1) AS _`);

    const updates = await this.db
      .select({
        id: impactUpdates.id,
        title: impactUpdates.title,
        // The slug and cover, added in Phase 9 — without the slug the listing
        // cannot link to `/impact/[slug]`, which is the page it exists to
        // introduce.
        slug: impactUpdates.slug,
        coverImage: impactUpdates.coverImage,
        description: impactUpdates.description,
        impactDate: impactUpdates.impactDate,
        location: impactUpdates.location,
        metricType: impactUpdates.metricType,
        metricValue: impactUpdates.metricValue,
        metricUnit: impactUpdates.metricUnit,
        verificationMethod: impactUpdates.verificationMethod,
        programId: impactUpdates.programId,
        campaignId: impactUpdates.campaignId,
        eventId: impactUpdates.eventId,
        programSlug: programs.slug,
      })
      .from(impactUpdates)
      .leftJoin(programs, eq(programs.id, impactUpdates.programId))
      .where(and(eq(impactUpdates.isPublic, true), eq(impactUpdates.status, 'published')))
      .orderBy(desc(impactUpdates.impactDate))
      .limit(20);

    /**
     * Geographic reach, COMPUTED from where the programmes actually are.
     *
     * Decision A14 in its most literal form: "we work in four states" is a
     * claim, and the only honest source for it is the programme records
     * themselves. Nobody types this number in, so nobody can inflate it — and
     * when a programme closes, the figure falls on its own.
     */
    const reachRows = await this.db.execute<{
      state: string;
      districts: string[];
      programmes: string[];
    }>(sql`
      SELECT location ->> 'state' AS state,
             array_agg(DISTINCT location ->> 'district') AS districts,
             array_agg(DISTINCT p.title) AS programmes
      FROM programs p
      CROSS JOIN LATERAL jsonb_array_elements(coalesce(p.locations, '[]'::jsonb)) AS location
      WHERE p.status = 'published' AND p.deleted_at IS NULL
      GROUP BY location ->> 'state'
      ORDER BY location ->> 'state'
    `);

    const reach = reachRows.rows ?? [];
    const districts = new Set(reach.flatMap((row) => row.districts ?? []));

    return {
      totals: totals ?? null,
      reach: {
        states: reach.length,
        districts: districts.size,
        byState: reach,
      },
      updates,
    };
  }

  /**
   * One team member's page.
   *
   * Both flags are required, exactly as the listing requires them — a member
   * whose `status` says published but whose `isPublic` says otherwise is
   * unreachable here too. `/team` and `/team/[slug]` must never disagree about
   * who is on the team.
   *
   * `emailPublic` is returned because it is, by name and by intent, a published
   * address. Nothing else contactable is.
   */
  async getTeamMemberBySlug(slug: string) {
    const [row] = await this.db
      .select({
        id: teamMembers.id,
        name: teamMembers.name,
        slug: teamMembers.slug,
        photoUrl: teamMembers.photoUrl,
        designation: teamMembers.designation,
        department: teamMembers.department,
        memberType: teamMembers.memberType,
        bio: teamMembers.bio,
        experience: teamMembers.experience,
        socialLinks: teamMembers.socialLinks,
        emailPublic: teamMembers.emailPublic,
        displayOrder: teamMembers.displayOrder,
      })
      .from(teamMembers)
      .where(
        and(
          eq(teamMembers.slug, slug),
          eq(teamMembers.isPublic, true),
          eq(teamMembers.status, 'published'),
          isNull(teamMembers.deletedAt),
        ),
      )
      .limit(1);

    if (!row) throw new NotFoundException('Team member');
    return row;
  }

  /**
   * One impact record.
   *
   * ══════════════════════════════════════════════════════════════════════════
   * `verificationMethod` IS PART OF THE PUBLIC PAYLOAD, NOT AN INTERNAL NOTE.
   *
   * Decision A14 is that a published figure traces to something checkable. A
   * detail page that shows "1,240 children reached" and keeps the method in the
   * admin is a page that has published the claim and withheld the evidence,
   * which is the arrangement the decision exists to prevent.
   * ══════════════════════════════════════════════════════════════════════════
   *
   * The parent's slug comes back with it so the page can link home — to the
   * campaign that funded the work, the programme it belongs to, or the event
   * that produced the figures.
   */
  async getImpactBySlug(slug: string) {
    const [row] = await this.db
      .select({
        id: impactUpdates.id,
        title: impactUpdates.title,
        slug: impactUpdates.slug,
        description: impactUpdates.description,
        coverImage: impactUpdates.coverImage,
        images: impactUpdates.images,
        videos: impactUpdates.videos,
        location: impactUpdates.location,
        state: impactUpdates.state,
        impactDate: impactUpdates.impactDate,
        statistics: impactUpdates.statistics,
        metricType: impactUpdates.metricType,
        metricValue: impactUpdates.metricValue,
        metricUnit: impactUpdates.metricUnit,
        verificationMethod: impactUpdates.verificationMethod,
        publishedAt: impactUpdates.publishedAt,
        programSlug: programs.slug,
        programTitle: programs.title,
        campaignSlug: campaigns.slug,
        campaignTitle: campaigns.title,
        eventSlug: events.slug,
        eventTitle: events.title,
        /**
         * The event's title is only shown when the event itself is public.
         *
         * An impact record may legitimately be attached to an internal event
         * that was never published; naming it here would leak the existence of
         * something nobody chose to put on the site.
         */
        eventIsPublic: sql<boolean>`(events.status = 'published' AND events.deleted_at IS NULL)`,
      })
      .from(impactUpdates)
      .leftJoin(programs, eq(programs.id, impactUpdates.programId))
      .leftJoin(campaigns, eq(campaigns.id, impactUpdates.campaignId))
      .leftJoin(events, eq(events.id, impactUpdates.eventId))
      .where(
        and(
          eq(impactUpdates.slug, slug),
          eq(impactUpdates.isPublic, true),
          eq(impactUpdates.status, 'published'),
        ),
      )
      .limit(1);

    if (!row) throw new NotFoundException('Impact record');

    const { eventIsPublic, ...record } = row;
    return {
      ...record,
      eventSlug: eventIsPublic ? record.eventSlug : null,
      eventTitle: eventIsPublic ? record.eventTitle : null,
    };
  }
}
