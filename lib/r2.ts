/**
 * Cloudflare R2 Storage client
 * Worker를 통해 R2에 업로드/삭제/공개 URL 생성
 */

const R2_WORKER_URL =
  process.env.EXPO_PUBLIC_R2_WORKER_URL || '';
const R2_API_TOKEN =
  process.env.EXPO_PUBLIC_R2_API_TOKEN || '';

/** R2에 파일 업로드 → 공개 URL 반환 */
export async function r2Upload(
  bucket: string,
  path: string,
  blob: Blob,
  contentType: string,
): Promise<{ url: string | null; error: string | null }> {
  try {
    const res = await fetch(
      `${R2_WORKER_URL}/upload?bucket=${encodeURIComponent(bucket)}&path=${encodeURIComponent(path)}&type=${encodeURIComponent(contentType)}`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${R2_API_TOKEN}` },
        body: blob,
      },
    );
    if (!res.ok) {
      const text = await res.text();
      return { url: null, error: `Upload failed (${res.status}): ${text}` };
    }
    const data = await res.json();
    return { url: data.url, error: null };
  } catch (err: any) {
    return { url: null, error: err.message };
  }
}

/** R2에서 파일 삭제 */
export async function r2Delete(bucket: string, paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  try {
    await fetch(`${R2_WORKER_URL}/delete`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${R2_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ bucket, paths }),
    });
  } catch {
    // 삭제 실패는 무시 (파일이 이미 없을 수 있음)
  }
}

/** R2 파일 목록 조회 (prefix 기반) */
export async function r2List(bucket: string, prefix: string): Promise<string[]> {
  try {
    const res = await fetch(
      `${R2_WORKER_URL}/list?bucket=${encodeURIComponent(bucket)}&prefix=${encodeURIComponent(prefix)}`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${R2_API_TOKEN}` },
      },
    );
    if (!res.ok) return [];
    const data = await res.json();
    return data.keys || [];
  } catch {
    return [];
  }
}

/** R2 공개 URL 생성 */
export function r2PublicUrl(bucket: string, path: string): string {
  return `${R2_WORKER_URL}/${bucket}/${path}`;
}

/**
 * 원본 URL → 썸네일 URL 변환
 * R2 URL만 변환, Supabase URL은 그대로 반환
 * .../userId/abc.jpg → .../userId/thumb_abc.jpg
 */
export function r2ThumbUrl(url: string): string {
  if (!url || !url.includes('workers.dev/')) return url;
  const lastSlash = url.lastIndexOf('/');
  if (lastSlash === -1) return url;
  return url.slice(0, lastSlash + 1) + 'thumb_' + url.slice(lastSlash + 1);
}

/** 공개 URL에서 R2 경로 추출 */
export function r2ExtractPath(url: string, bucket: string): string | null {
  // R2 Worker URL 형식: https://worker.domain/bucket/path
  const marker = `/${bucket}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  return decodeURIComponent(url.slice(idx + marker.length));
}
