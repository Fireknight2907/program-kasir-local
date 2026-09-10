import { normalizePng, boundedUploadForm } from '@/lib/png-upload';
import { randomUUID } from 'node:crypto';
import { requireAdmin } from '@/lib/session';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseKey) return NextResponse.json({ error: 'Upload belum dikonfigurasi. Hubungi admin sistem.' }, { status: 503 });
    const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false, autoRefreshToken: false } });
    let formData;
    try { formData = await boundedUploadForm(request); }
    catch { return NextResponse.json({error:'Unggahan tidak valid atau melebihi 5 MB.'},{status:400}); }
    const file = formData.get('file');

    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'File gambar tidak ditemukan' }, { status: 400 });
    }

    let buffer;
    try { buffer = await normalizePng(file); }
    catch(e) { return NextResponse.json({error:e.message},{status:400}); }
    const filename = randomUUID() + '.png';

    const { data, error } = await supabase.storage
      .from('menu-images')
      .upload(filename, buffer, {
        contentType: 'image/png',
        upsert: false
      });

    if (error) {
      console.error('Supabase upload error:', error);
      return NextResponse.json({ error: 'Gagal mengunggah ke Supabase Storage. Pastikan bucket "menu-images" sudah dibuat.' }, { status: 500 });
    }

    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from('menu-images')
      .getPublicUrl(filename);

    return NextResponse.json({ url: publicUrlData.publicUrl });
  } catch (error) {
    console.error('Error uploading file:', error);
    return NextResponse.json({ error: 'Gagal mengunggah gambar PNG' }, { status: 500 });
  }
}
