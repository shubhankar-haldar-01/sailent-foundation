import fs from 'node:fs';

const API_BASE = 'http://localhost:4000/api/v1';
const WEB_BASE = 'http://localhost:3000';

async function main() {
  console.log('--- 1. Authenticating as Super Admin ---');
  const loginRes = await fetch(`${API_BASE}/auth/staff/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@sailent.local', password: 'DevPassword123!' }),
  });
  const loginJson = await loginRes.json();
  if (!loginJson.success || !loginJson.data) {
    throw new Error('Login failed: ' + JSON.stringify(loginJson));
  }
  const token = loginJson.data.accessToken;
  const refreshToken = loginJson.data.refreshToken;
  const expiresIn = loginJson.data.expiresIn;
  const actor = loginJson.data.actor;

  const cookiePayload = JSON.stringify({
    accessToken: token,
    refreshToken,
    expiresAt: Date.now() + expiresIn * 1000,
    actor,
  });
  const cookieHeader = `sailent_staff_session=${encodeURIComponent(cookiePayload)}`;

  console.log('✓ Successfully authenticated as Super Admin');

  console.log('--- 2. Fetching Sample Entity IDs from API ---');
  async function getFirstId(endpoint) {
    try {
      const res = await fetch(`${API_BASE}/${endpoint}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (Array.isArray(json.data)) return json.data[0]?.id;
      if (Array.isArray(json.data?.items)) return json.data.items[0]?.id;
      return null;
    } catch (e) {
      return null;
    }
  }

  const blogId = (await getFirstId('admin/blog')) || (await getFirstId('blog')) || '019e3fd5-a163-4679-b7f3-da8e1ad51277';
  const campaignId = (await getFirstId('admin/campaigns')) || '019e3fd5-a163-4679-b7f3-da8e1ad51277';
  const documentId = (await getFirstId('admin/documents')) || '019e3fd5-a163-4679-b7f3-da8e1ad51277';
  const donationId = (await getFirstId('admin/donations')) || '019e3fd5-a163-4679-b7f3-da8e1ad51277';
  const donorId = (await getFirstId('admin/donors')) || '019e3fd5-a163-4679-b7f3-da8e1ad51277';
  const eventId = (await getFirstId('admin/events')) || '019e3fd5-a163-4679-b7f3-da8e1ad51277';
  const impactId = (await getFirstId('admin/impact')) || '019e3fd5-a163-4679-b7f3-da8e1ad51277';
  const mediaId = (await getFirstId('admin/media')) || '019e3fd5-a163-4679-b7f3-da8e1ad51277';
  const messageId = (await getFirstId('admin/messages')) || '019e3fd5-a163-4679-b7f3-da8e1ad51277';
  const templateId = (await getFirstId('admin/notification-templates')) || '019e3fd5-a163-4679-b7f3-da8e1ad51277';
  const pageId = (await getFirstId('admin/pages')) || '019e3fd5-a163-4679-b7f3-da8e1ad51277';
  const productId = (await getFirstId('admin/products')) || '019e3fd5-a163-4679-b7f3-da8e1ad51277';
  const programId = (await getFirstId('admin/programs')) || '019e3fd5-a163-4679-b7f3-da8e1ad51277';
  const storyId = (await getFirstId('admin/stories')) || '019e3fd5-a163-4679-b7f3-da8e1ad51277';
  const teamId = (await getFirstId('admin/team')) || '019e3fd5-a163-4679-b7f3-da8e1ad51277';
  const userId = (await getFirstId('admin/users')) || '019e3fd5-a163-4679-b7f3-da8e1ad51277';
  const volunteerId = (await getFirstId('admin/volunteers')) || '019e3fd5-a163-4679-b7f3-da8e1ad51277';

  console.log('Sample IDs loaded for dynamic routes:');
  console.log({ campaignId, donationId, donorId, eventId, volunteerId, programId, productId });

  const allRoutes = [
    // Public / Auth
    { path: '/admin/login', auth: false, purpose: 'Staff sign-in' },
    { path: '/admin/forgot-password', auth: false, purpose: 'Forgot password request' },
    { path: '/admin/reset-password', auth: false, purpose: 'Reset password submission' },
    { path: '/admin/accept-invite', auth: false, purpose: 'Accept staff invitation' },

    // Core Dashboard & System
    { path: '/admin', auth: true, purpose: 'Overview dashboard with key NGO metrics' },
    { path: '/admin/audit-logs', auth: true, purpose: 'Immutable audit trail of actions' },
    { path: '/admin/settings', auth: true, purpose: 'Organisation configuration and operational policies' },
    { path: '/admin/roles', auth: true, purpose: 'Staff roles and permission matrix' },
    { path: '/admin/users', auth: true, purpose: 'Staff directory and invitations' },
    { path: `/admin/users/${userId}`, auth: true, purpose: 'Staff account detail and role assignment' },
    { path: '/admin/tax', auth: true, purpose: 'Form 10BD statutory tax reporting' },

    // Fundraising: Campaigns, Programs, Products
    { path: '/admin/campaigns', auth: true, purpose: 'Fundraising campaigns listing' },
    { path: '/admin/campaigns/new', auth: true, purpose: 'Create campaign form' },
    { path: `/admin/campaigns/${campaignId}/edit`, auth: true, purpose: 'Edit campaign and gallery management' },
    { path: '/admin/programs', auth: true, purpose: 'Programmes listing' },
    { path: '/admin/programs/new', auth: true, purpose: 'Create program form' },
    { path: `/admin/programs/${programId}/edit`, auth: true, purpose: 'Edit program' },
    { path: '/admin/products', auth: true, purpose: 'Donation product catalogue' },
    { path: '/admin/products/new', auth: true, purpose: 'Create product form' },
    { path: `/admin/products/${productId}`, auth: true, purpose: 'Product detail and pricing' },

    // Financial: Donations, Donors, Payments, Reconciliation
    { path: '/admin/donations', auth: true, purpose: 'Donation transactions directory' },
    { path: `/admin/donations/${donationId}`, auth: true, purpose: 'Donation transaction detail and receipt lookup' },
    { path: '/admin/donors', auth: true, purpose: 'Donors directory with giving totals' },
    { path: `/admin/donors/${donorId}`, auth: true, purpose: 'Donor detail, consents, and Form 10BD profile' },
    { path: '/admin/payments', auth: true, purpose: 'Payment gateway transactions log' },
    { path: '/admin/reconciliation', auth: true, purpose: 'Payment and ledger reconciliation' },
    { path: '/admin/reports', auth: true, purpose: 'Fundraising and donor analytics' },

    // Community: Volunteers, Team, Events
    { path: '/admin/volunteers', auth: true, purpose: 'Volunteer review queue and roster' },
    { path: `/admin/volunteers/${volunteerId}`, auth: true, purpose: 'Volunteer profile, hours verification, and certificates' },
    { path: '/admin/team', auth: true, purpose: 'Public leadership and team directory' },
    { path: '/admin/team/new', auth: true, purpose: 'Add team member profile' },
    { path: `/admin/team/${teamId}/edit`, auth: true, purpose: 'Edit team member profile' },
    { path: '/admin/events', auth: true, purpose: 'Events schedule and management' },
    { path: '/admin/events/new', auth: true, purpose: 'Create event form' },
    { path: `/admin/events/${eventId}/edit`, auth: true, purpose: 'Edit event form' },
    { path: `/admin/events/${eventId}/registrations`, auth: true, purpose: 'Event attendees and seat roster' },

    // CMS & Content: Blog, Stories, Pages, FAQs, Impact, Media, Documents
    { path: '/admin/blog', auth: true, purpose: 'Blog articles listing' },
    { path: '/admin/blog/new', auth: true, purpose: 'Create blog article' },
    { path: `/admin/blog/${blogId}`, auth: true, purpose: 'Edit blog article' },
    { path: '/admin/stories', auth: true, purpose: 'Beneficiary stories listing' },
    { path: '/admin/stories/new', auth: true, purpose: 'Create story' },
    { path: `/admin/stories/${storyId}`, auth: true, purpose: 'Edit story' },
    { path: '/admin/pages', auth: true, purpose: 'Custom CMS pages' },
    { path: '/admin/pages/new', auth: true, purpose: 'Create CMS page' },
    { path: `/admin/pages/${pageId}`, auth: true, purpose: 'Edit CMS page' },
    { path: '/admin/faqs', auth: true, purpose: 'Frequently asked questions manager' },
    { path: '/admin/impact', auth: true, purpose: 'Impact metrics and outcomes' },
    { path: '/admin/impact/new', auth: true, purpose: 'Create impact metric' },
    { path: `/admin/impact/${impactId}/edit`, auth: true, purpose: 'Edit impact metric' },
    { path: '/admin/media', auth: true, purpose: 'Media library and upload center' },
    { path: `/admin/media/${mediaId}`, auth: true, purpose: 'Media asset detail' },
    { path: '/admin/documents', auth: true, purpose: 'Documents repository' },
    { path: `/admin/documents/${documentId}`, auth: true, purpose: 'Document detail' },
    { path: '/admin/preview/campaigns/clean-water', auth: true, purpose: 'Draft campaign preview' },

    // Communications: Messages, Newsletter, Notifications
    { path: '/admin/messages', auth: true, purpose: 'Public contact inquiries inbox' },
    { path: `/admin/messages/${messageId}`, auth: true, purpose: 'Message detail and reply' },
    { path: '/admin/newsletter', auth: true, purpose: 'Newsletter subscribers list' },
    { path: '/admin/notification-templates', auth: true, purpose: 'Email and SMS notification templates' },
    { path: `/admin/notification-templates/${templateId}`, auth: true, purpose: 'Edit notification template' },
    { path: '/admin/notifications', auth: true, purpose: 'Manual notification broadcast form' },
    { path: '/admin/notifications/log', auth: true, purpose: 'Notification dispatch history and status' },
  ];

  console.log(`\n--- 3. Testing ${allRoutes.length} Routes ---`);
  let resultsMap = new Map();
  if (fs.existsSync('scratch/route-audit-results.json')) {
    try {
      const saved = JSON.parse(fs.readFileSync('scratch/route-audit-results.json', 'utf8'));
      if (Array.isArray(saved)) {
        for (const item of saved) {
          if (item.overallPassed) resultsMap.set(item.path, item);
        }
      }
    } catch {}
  }

  const results = [];

  for (const route of allRoutes) {
    if (resultsMap.has(route.path)) {
      const cached = resultsMap.get(route.path);
      console.log(`[PASS] ${route.path.padEnd(45)} Auth: ${cached.authStatus} | Unauth: ${cached.unauthStatus} | H1: "${cached.authSnippet}" (cached)`);
      results.push(cached);
      continue;
    }

    // Pacing delay so Next dev compiler has time to compile pages on demand
    await new Promise((r) => setTimeout(r, 250));

    // Test unauthenticated first with retry
    let unauthStatus = null;
    let unauthLocation = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const uRes = await fetch(`${WEB_BASE}${route.path}`, {
          redirect: 'manual',
          signal: AbortSignal.timeout(30000),
        });
        unauthStatus = uRes.status;
        unauthLocation = uRes.headers.get('location');
        break;
      } catch (e) {
        if (attempt === 2) unauthStatus = 'ERR: ' + e.message;
        else await new Promise((r) => setTimeout(r, 1000));
      }
    }

    // Test authenticated with retry
    let authStatus = null;
    let authHasError = false;
    let authSnippet = '';
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const aRes = await fetch(`${WEB_BASE}${route.path}`, {
          headers: {
            Cookie: cookieHeader,
          },
          redirect: 'manual',
          signal: AbortSignal.timeout(30000),
        });
        authStatus = aRes.status;
        const html = await aRes.text();
        authHasError = html.includes('Something went wrong') || html.includes('Application error') || html.includes('Unhandled Runtime Error');
        if (html.includes('<h1')) {
          const match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
          authSnippet = match ? match[1].replace(/<[^>]+>/g, '').trim() : '';
        }
        break;
      } catch (e) {
        if (attempt === 2) authStatus = 'ERR: ' + e.message;
        else await new Promise((r) => setTimeout(r, 1000));
      }
    }

    const unauthPassed = route.auth
      ? (unauthStatus === 307 || unauthStatus === 302 || unauthStatus === 401 || (unauthLocation && unauthLocation.includes('/admin/login')))
      : (unauthStatus === 200);

    const authPassed = authStatus === 200 && !authHasError;

    const statusStr = (authPassed && unauthPassed) ? 'PASS' : 'FAIL';
    console.log(`[${statusStr}] ${route.path.padEnd(45)} Auth: ${authStatus} | Unauth: ${unauthStatus} | H1: "${authSnippet}"`);

    const resultObj = {
      path: route.path,
      purpose: route.purpose,
      authRequired: route.auth,
      unauthStatus,
      unauthPassed,
      authStatus,
      authPassed,
      authHasError,
      authSnippet,
      overallPassed: authPassed && unauthPassed,
    };
    results.push(resultObj);
    fs.writeFileSync('scratch/route-audit-results.json', JSON.stringify(results, null, 2));
  }

  const passCount = results.filter(r => r.overallPassed).length;
  const failCount = results.length - passCount;
  console.log(`\n========================================`);
  console.log(`TOTAL: ${results.length} | PASSED: ${passCount} | FAILED: ${failCount}`);
  console.log(`========================================\n`);

  fs.writeFileSync('scratch/route-audit-results.json', JSON.stringify(results, null, 2));
}

main().catch(console.error);
