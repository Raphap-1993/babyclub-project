import { DOOR_ROLES, hasRole } from "shared/auth/roles";

export const isDoorRole = (role?: string | null) => hasRole(role ?? null, ["door"]);

export { DOOR_ROLES };
