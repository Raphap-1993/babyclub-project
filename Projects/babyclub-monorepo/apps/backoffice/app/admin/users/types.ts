export type Role = { id: number; code: string; name: string };
export type StaffUser = {
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
