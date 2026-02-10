import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { join } from "path";

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(req: NextRequest) {
  try {
    // Leer archivo de migración
    const migrationPath = join(process.cwd(), '../../supabase/migrations/2026-02-08-table-availability-parallel.sql');
    const sql = readFileSync(migrationPath, 'utf-8');
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    
    // Dividir SQL en statements individuales (separados por ;)
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));
    
    const results = [];
    
    for (const statement of statements) {
      if (statement.trim()) {
        try {
          const { data, error } = await supabase.rpc('exec_sql', { sql_query: statement });
          if (error) {
            results.push({ statement: statement.substring(0, 100), error: error.message });
          } else {
            results.push({ statement: statement.substring(0, 100), success: true });
          }
        } catch (err: any) {
          results.push({ statement: statement.substring(0, 100), error: err.message });
        }
      }
    }
    
    return NextResponse.json({ 
      success: true, 
      message: 'Migración ejecutada',
      results 
    });
    
  } catch (error: any) {
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}
