import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireStaffRole } from "shared/auth/requireStaff";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function POST(req: NextRequest) {
  console.log('📤 Upload endpoint called');
  
  const guard = await requireStaffRole(req);
  if (!guard.ok) {
    console.log('❌ Auth failed:', guard.error);
    return NextResponse.json({ success: false, error: guard.error }, { status: guard.status });
  }

  if (!supabaseUrl || !supabaseServiceKey) {
    console.log('❌ Supabase config missing');
    return NextResponse.json({ success: false, error: "Supabase config missing" }, { status: 500 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const folder = formData.get('folder') as string || 'uploads';

    console.log('📁 File received:', { 
      name: file?.name, 
      type: file?.type, 
      size: file?.size,
      folder 
    });

    if (!file) {
      console.log('❌ No file in request');
      return NextResponse.json({ success: false, error: "No file provided" }, { status: 400 });
    }

    // Validate file type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf'];
    if (!validTypes.includes(file.type)) {
      console.log('❌ Invalid file type:', file.type);
      return NextResponse.json({ 
        success: false, 
        error: "Formato no válido. Solo se permiten imágenes (JPG, PNG, WEBP) o PDF" 
      }, { status: 400 });
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      console.log('❌ File too large:', file.size);
      return NextResponse.json({ 
        success: false, 
        error: "El archivo es muy grande. Máximo 5MB" 
      }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Generate unique filename
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    const filePath = `${folder}/${fileName}`;

    console.log('⬆️ Uploading to:', filePath);

    // Convert File to ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload file - usar bucket 'event-assets' que ya existe
    const { data, error } = await supabase.storage
      .from('event-assets')
      .upload(filePath, buffer, {
        contentType: file.type,
        cacheControl: '3600',
        upsert: false
      });

    if (error) {
      console.error('❌ Storage upload error:', error);
      return NextResponse.json({ 
        success: false, 
        error: `Error de Supabase: ${error.message}` 
      }, { status: 500 });
    }

    console.log('✅ File uploaded:', data.path);

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('event-assets')
      .getPublicUrl(filePath);

    console.log('✅ Public URL generated:', publicUrl);

    return NextResponse.json({ 
      success: true, 
      url: publicUrl,
      path: filePath
    });
  } catch (err: any) {
    console.error('❌ Unexpected upload error:', err);
    return NextResponse.json({ 
      success: false, 
      error: err.message || 'Error inesperado al subir el archivo' 
    }, { status: 500 });
  }
}
