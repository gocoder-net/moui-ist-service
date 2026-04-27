/**
 * Cloudflare Worker — R2 Storage Proxy for moui-ist
 *
 * Routes:
 *   GET  /:bucket/*path          → Serve file publicly (cached)
 *   POST /upload?bucket&path&type → Upload file (auth required)
 *   POST /delete                  → Delete files (auth required)
 *   POST /list?bucket&prefix      → List files by prefix (auth required)
 *
 * R2 Bindings: ARTWORKS_BUCKET, CHAT_IMAGES_BUCKET, BGM_BUCKET
 * Secret:      API_TOKEN
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Content-Type',
};

function getBucket(env, name) {
  return {
    artworks: env.ARTWORKS_BUCKET,
    'chat-images': env.CHAT_IMAGES_BUCKET,
    bgm: env.BGM_BUCKET,
  }[name] || null;
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }

    // ── GET: Serve files publicly ──
    if (request.method === 'GET') {
      const parts = url.pathname.slice(1).split('/'); // remove leading /
      const bucketName = parts[0];
      const path = parts.slice(1).join('/');

      if (!bucketName || !path) {
        return jsonResponse({ error: 'Invalid path' }, 400);
      }

      const r2Bucket = getBucket(env, bucketName);
      if (!r2Bucket) return jsonResponse({ error: 'Bucket not found' }, 404);

      const object = await r2Bucket.get(path);
      if (!object) return jsonResponse({ error: 'Not found' }, 404);

      const headers = new Headers(CORS);
      headers.set('Content-Type', object.httpMetadata?.contentType || 'application/octet-stream');
      headers.set('Cache-Control', 'public, max-age=31536000, immutable');
      headers.set('ETag', object.httpEtag);

      return new Response(object.body, { headers });
    }

    // ── Auth check for mutations ──
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token || token !== env.API_TOKEN) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    // ── POST /upload: Upload file ──
    if (request.method === 'POST' && url.pathname === '/upload') {
      const bucketName = url.searchParams.get('bucket');
      const path = url.searchParams.get('path');
      const contentType = url.searchParams.get('type') || 'application/octet-stream';

      if (!bucketName || !path) {
        return jsonResponse({ error: 'Missing bucket or path' }, 400);
      }

      const r2Bucket = getBucket(env, bucketName);
      if (!r2Bucket) return jsonResponse({ error: 'Invalid bucket' }, 400);

      await r2Bucket.put(path, request.body, {
        httpMetadata: { contentType },
      });

      const publicUrl = `${url.origin}/${bucketName}/${path}`;
      return jsonResponse({ url: publicUrl });
    }

    // ── POST /list: List files by prefix ──
    if (request.method === 'POST' && url.pathname === '/list') {
      const bucketName = url.searchParams.get('bucket');
      const prefix = url.searchParams.get('prefix') || '';

      if (!bucketName) {
        return jsonResponse({ error: 'Missing bucket' }, 400);
      }

      const r2Bucket = getBucket(env, bucketName);
      if (!r2Bucket) return jsonResponse({ error: 'Invalid bucket' }, 400);

      const listed = await r2Bucket.list({ prefix, limit: 1000 });
      const keys = listed.objects.map((obj) => obj.key);
      return jsonResponse({ keys });
    }

    // ── POST /delete: Delete files ──
    if (request.method === 'POST' && url.pathname === '/delete') {
      const { bucket, paths } = await request.json();

      if (!bucket || !paths || !Array.isArray(paths)) {
        return jsonResponse({ error: 'Missing bucket or paths' }, 400);
      }

      const r2Bucket = getBucket(env, bucket);
      if (!r2Bucket) return jsonResponse({ error: 'Invalid bucket' }, 400);

      await r2Bucket.delete(paths);
      return jsonResponse({ success: true });
    }

    return jsonResponse({ error: 'Not found' }, 404);
  },
};
