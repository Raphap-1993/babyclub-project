const DOOR_ROLE_KEYS = ["door", "entrance", "control", "puerta", "ingreso", "entrada", "acceso", "scan", "scanner"];

export const isDoorRole = (role?: string | null) => {
  const roleText = (role || "").toLowerCase();
  return DOOR_ROLE_KEYS.some((key) => roleText.includes(key));
};
