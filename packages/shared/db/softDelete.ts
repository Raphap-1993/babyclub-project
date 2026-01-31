export const NOT_DELETED = { deleted_at: null };

export function buildArchivePayload(staffId?: string | null) {
  return {
    deleted_at: new Date().toISOString(),
    deleted_by: staffId || null,
    is_active: false,
  };
}

export function applyNotDeleted<T extends { is: (column: string, value: any) => any }>(query: T) {
  const candidate: any = query;
  if (candidate && typeof candidate.is === "function") {
    return candidate.is("deleted_at", null);
  }
  return query;
}
