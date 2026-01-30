export const ADMIN_ROLES = ["admin", "superadmin"];
export const DOOR_ROLES = ["door", "entrance", "control", "puerta", "ingreso", "entrada", "acceso", "scan", "scanner"];

type RoleInput = string | null | undefined | Array<string | null | undefined>;

export function hasRole(roles: RoleInput, allowed: string[] = []): boolean {
  if (!allowed.length) return false;
  const normalizedAllowed = allowed.map((role) => role.toLowerCase());
  if (normalizedAllowed.includes("*")) return true;

  const roleList = Array.isArray(roles) ? roles : [roles];
  const normalizedRoles = roleList
    .filter((role): role is string => typeof role === "string" && role.trim().length > 0)
    .map((role) => role.toLowerCase());

  if (!normalizedRoles.length) return false;

  if (normalizedAllowed.includes("door")) {
    const doorKeys = DOOR_ROLES.map((role) => role.toLowerCase());
    if (normalizedRoles.some((role) => doorKeys.some((key) => role.includes(key)))) {
      return true;
    }
  }

  return normalizedRoles.some((role) => normalizedAllowed.includes(role));
}
