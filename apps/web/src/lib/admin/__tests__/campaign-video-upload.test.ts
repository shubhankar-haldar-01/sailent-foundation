// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/*
  The campaign video upload is the one admin server action that does its work
  on this server (it writes the file to disk) instead of through the API, so no
  API call checks the caller on its way. A server action is a public endpoint,
  and the staff cookie is readable JSON anyone can forge: before the fix, a
  POST with no session at all, or with a made-up cookie, wrote the file.

  These tests run the real permission check (`staffHolds`) against a stubbed
  API, and stub only the disk.
*/

const disk = vi.hoisted(() => ({
  existsSync: vi.fn(() => true),
  mkdirSync: vi.fn(),
  writeFileSync: vi.fn(),
}));
vi.mock('node:fs', () => disk);

const session = vi.hoisted(() => ({ token: null as string | null }));
vi.mock('@/lib/auth/session', () => ({ getAccessToken: async () => session.token }));
vi.mock('@/lib/api/forwarding', () => ({ requestForwardingHeaders: async () => ({}) }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), updateTag: vi.fn() }));
vi.mock('next/navigation', () => ({ redirect: vi.fn() }));

import { uploadCampaignVideo } from '../actions';

const fetchMock = vi.fn();

/** What the API's `GET auth/me` answers for a valid staff token. */
function meResponse(permissions: string[]) {
  return new Response(
    JSON.stringify({ success: true, data: { id: 'staff-1', audience: 'staff', permissions } }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );
}

function videoForm(): FormData {
  const form = new FormData();
  form.append('file', new File([new Uint8Array([0, 0, 0, 24])], 'clip.mp4', { type: 'video/mp4' }));
  return form;
}

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
  disk.writeFileSync.mockReset();
  disk.mkdirSync.mockReset();
  session.token = null;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('uploadCampaignVideo: who may write to the disk', () => {
  it('refuses a caller with no session, without asking the API or touching the disk', async () => {
    const result = await uploadCampaignVideo(videoForm());

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/permission/i);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(disk.writeFileSync).not.toHaveBeenCalled();
  });

  it('refuses a forged or expired token: the API is the judge, not the cookie', async () => {
    session.token = 'forged';
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({ success: false, error: { code: 'UNAUTHENTICATED', message: 'No.' } }),
        { status: 401 },
      ),
    );

    const result = await uploadCampaignVideo(videoForm());

    expect(result.ok).toBe(false);
    expect(String(fetchMock.mock.calls[0]?.[0])).toMatch(/\/auth\/me$/);
    expect(disk.writeFileSync).not.toHaveBeenCalled();
  });

  it('refuses a staff member who cannot create or edit campaigns', async () => {
    session.token = 'valid';
    fetchMock.mockResolvedValue(meResponse(['donation.read', 'campaign.read']));

    const result = await uploadCampaignVideo(videoForm());

    expect(result.ok).toBe(false);
    expect(disk.writeFileSync).not.toHaveBeenCalled();
  });

  it('refuses when the API cannot be reached: it fails closed', async () => {
    session.token = 'valid';
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));

    const result = await uploadCampaignVideo(videoForm());

    expect(result.ok).toBe(false);
    expect(disk.writeFileSync).not.toHaveBeenCalled();
  });

  it.each(['campaign.create', 'campaign.update'])(
    'saves the video for a staff member holding %s',
    async (permission) => {
      session.token = 'valid';
      fetchMock.mockResolvedValue(meResponse([permission]));

      const result = await uploadCampaignVideo(videoForm());

      expect(result.ok).toBe(true);
      expect(result.url).toMatch(/^\/uploads\/videos\/campaign-video-\d+-[0-9a-f]{16}\.mp4$/);
      expect(disk.writeFileSync).toHaveBeenCalledTimes(1);
    },
  );

  it('does not hand the file system’s message, with its server paths, to the browser', async () => {
    session.token = 'valid';
    fetchMock.mockResolvedValue(meResponse(['campaign.update']));
    disk.writeFileSync.mockImplementation(() => {
      throw new Error(
        "EACCES: permission denied, open '/srv/app/apps/web/public/uploads/videos/x'",
      );
    });
    const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const result = await uploadCampaignVideo(videoForm());

    expect(result).toEqual({ ok: false, error: 'Failed to save the video file.' });
    expect(logged).toHaveBeenCalled();
    logged.mockRestore();
  });
});
