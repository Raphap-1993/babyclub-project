import { createClient } from "@supabase/supabase-js";
import AdminUsersClient from "./AdminUsersClient";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const dynamic = "force-dynamic";

type Role = { id: number; code: string; name: string };
type StaffUser = {
  id: string;
  is_active: boolean;
  created_at: string;
  auth_user_id: string;
  role: Role;
  person: {
    id: string;
    dni: string | null;
    first_name: string;
    last_name: string;
    email: string | null;
    phone: string | null;
  };
};

async function fetchRoles(): Promise<Role[]> {
  if (!supabaseUrl || !supabaseServiceKey) return [];
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data } = await supabase.from("staff_roles").select("id,code,name").order("name", { ascending: true });
  return (data as any[])?.map((r) => ({ id: r.id, code: r.code, name: r.name })) || [];
}

async function fetchStaff(): Promise<StaffUser[]> {
  if (!supabaseUrl || !supabaseServiceKey) return [];
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data } = await supabase
    .from("staff")
    .select(
      "id,is_active,created_at,auth_user_id,person:persons(id,dni,first_name,last_name,email,phone),role:staff_roles(id,code,name)"
    )
    .order("created_at", { ascending: false });

  return (
    (data as any[])?.map((s) => ({
      id: s.id,
      is_active: s.is_active,
      created_at: s.created_at,
      auth_user_id: s.auth_user_id,
      role: Array.isArray(s.role) ? s.role[0] : s.role,
      person: Array.isArray(s.person) ? s.person[0] : s.person,
    })) || []
  );
}

export default async function UsersPage() {
  const [roles, staff] = await Promise.all([fetchRoles(), fetchStaff()]);
  return <AdminUsersClient roles={roles} initialStaff={staff} />;
}
