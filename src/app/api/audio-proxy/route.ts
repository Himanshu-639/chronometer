// ─── GET /api/audio-proxy?url=... ────────────────────────────────────────────
// Proxies audio from Freesound (and other sources) to bypass CORS restrictions.
// The browser cannot fetch Freesound preview URLs directly due to CORS headers.
// This route fetches the audio server-side and streams it to the client.
//
// Security: Only allows URLs from trusted audio domains.
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server';

// ── Allowlist of trusted audio source domains ─────────────────────────────────

const ALLOWED_DOMAINS = [
  'freesound.org',
  'archive.org',
  'wikimedia.org',
  'soundjay.com',
];

function isAllowedUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ALLOWED_DOMAINS.some(
      (domain) => parsed.hostname === domain || parsed.hostname.endsWith(`.${domain}`),
    );
  } catch {
    return false;
  }
}

export async function GET(request: NextRequest) {
  const rawUrl = request.nextUrl.searchParams.get('url');

  if (!rawUrl) {
    return NextResponse.json({ error: 'url parameter required' }, { status: 400 });
  }

  if (!isAllowedUrl(rawUrl)) {
    return NextResponse.json({ error: 'URL domain not in allowlist' }, { status: 403 });
  }

  try {
    const upstream = await fetch(rawUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'audio/*,*/*;q=0.9',
      },
    });

    if (!upstream.ok) {
      return NextResponse.json(
        { error: `Upstream error: ${upstream.status}` },
        { status: upstream.status },
      );
    }

    const contentType = upstream.headers.get('content-type') ?? 'audio/mpeg';
    const body = await upstream.arrayBuffer();

    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        // Cache audio aggressively — it never changes
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err) {
    console.error('[audio-proxy]', err);
    return NextResponse.json({ error: 'Failed to fetch audio' }, { status: 500 });
  }
}
