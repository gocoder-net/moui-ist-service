/**
 * 모든 작품/전시관/아카이브 + Supabase Storage + R2 파일 삭제
 * 실행: node scripts/cleanup.mjs
 */
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://xtcyfuizbdegshaujfof.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh0Y3lmdWl6YmRlZ3NoYXVqZm9mIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjQwMjY3NywiZXhwIjoyMDkxOTc4Njc3fQ.6OY8tbBDzl40Ft5Y7-t6Rd1GzUOVkSDsIQZv3bnPH0U'
);

const R2_WORKER_URL = 'https://moui-ist-r2.gocoder-net.workers.dev';
const R2_API_TOKEN = 'moui-r2-secret-2026';

// ── Supabase Storage 삭제 ──
async function clearSupabaseBucket(bucket) {
  console.log(`  [Supabase/${bucket}] 파일 목록 조회...`);
  const { data: folders } = await supabase.storage.from(bucket).list('', { limit: 1000 });
  if (!folders || folders.length === 0) {
    console.log(`  [Supabase/${bucket}] 비어있음`);
    return;
  }
  for (const folder of folders) {
    if (folder.id) {
      await supabase.storage.from(bucket).remove([folder.name]);
    } else {
      const { data: files } = await supabase.storage.from(bucket).list(folder.name, { limit: 1000 });
      if (files && files.length > 0) {
        const paths = files.map(f => `${folder.name}/${f.name}`);
        await supabase.storage.from(bucket).remove(paths);
        console.log(`  [Supabase/${bucket}/${folder.name}] ${paths.length}개 삭제`);
        for (const f of files) {
          if (!f.id) {
            const { data: subFiles } = await supabase.storage.from(bucket).list(`${folder.name}/${f.name}`, { limit: 1000 });
            if (subFiles && subFiles.length > 0) {
              const subPaths = subFiles.map(sf => `${folder.name}/${f.name}/${sf.name}`);
              await supabase.storage.from(bucket).remove(subPaths);
              console.log(`  [Supabase/${bucket}/${folder.name}/${f.name}] ${subPaths.length}개 삭제`);
            }
          }
        }
      }
    }
  }
}

// ── R2 파일 삭제 ──
async function clearR2Bucket(bucket) {
  console.log(`  [R2/${bucket}] 파일 목록 조회...`);
  const res = await fetch(
    `${R2_WORKER_URL}/list?bucket=${encodeURIComponent(bucket)}&prefix=`,
    { method: 'POST', headers: { Authorization: `Bearer ${R2_API_TOKEN}` } }
  );
  if (!res.ok) {
    console.log(`  [R2/${bucket}] 조회 실패: ${res.status}`);
    return;
  }
  const { keys } = await res.json();
  if (!keys || keys.length === 0) {
    console.log(`  [R2/${bucket}] 비어있음`);
    return;
  }
  // 100개씩 배치 삭제
  for (let i = 0; i < keys.length; i += 100) {
    const batch = keys.slice(i, i + 100);
    await fetch(`${R2_WORKER_URL}/delete`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${R2_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ bucket, paths: batch }),
    });
    console.log(`  [R2/${bucket}] ${Math.min(i + 100, keys.length)}/${keys.length}개 삭제`);
  }
}

async function main() {
  console.log('=== 전체 초기화 시작 ===\n');

  // 1. DB 데이터 삭제 (외래키 순서)
  console.log('1. exhibition_artworks 삭제...');
  await supabase.from('exhibition_artworks').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  console.log('2. collection_artworks 삭제...');
  await supabase.from('collection_artworks').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  console.log('3. exhibitions 삭제...');
  await supabase.from('exhibitions').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  console.log('4. artwork_collections 삭제...');
  await supabase.from('artwork_collections').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  console.log('5. artworks 삭제...');
  await supabase.from('artworks').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  // 2. Supabase Storage 파일 삭제
  console.log('\n6. Supabase Storage 파일 삭제...');
  await clearSupabaseBucket('artworks');
  await clearSupabaseBucket('chat-images');
  await clearSupabaseBucket('bgm');

  // 3. R2 파일 삭제
  console.log('\n7. Cloudflare R2 파일 삭제...');
  await clearR2Bucket('artworks');
  await clearR2Bucket('chat-images');
  await clearR2Bucket('bgm');

  console.log('\n=== 초기화 완료! (DB + Supabase Storage + R2 전부 삭제) ===');
}

main().catch(console.error);
