"use client";

import { type CodeTypePolicy } from "shared/codeBatchPolicy";

export const CODE_TYPE_POLICY_ROWS = [
  { code_type: "courtesy", label: "Cortesía" },
  { code_type: "promoter", label: "Promotor" },
  { code_type: "table", label: "Mesa" },
] as const;

export type SupportedCodeType = (typeof CODE_TYPE_POLICY_ROWS)[number]["code_type"];

export function normalizeCodeTypePolicies(policies: CodeTypePolicy[] | null | undefined): CodeTypePolicy[] {
  return CODE_TYPE_POLICY_ROWS.map((entry) => {
    const row = policies?.find((policy) => policy?.code_type === entry.code_type);
    return {
      code_type: entry.code_type,
      requires_expiration: row?.requires_expiration === true,
      updated_by_staff_id: row?.updated_by_staff_id ?? null,
      updated_at: row?.updated_at ?? null,
    };
  });
}

type Props = {
  policies: CodeTypePolicy[] | null | undefined;
  loading?: boolean;
  savingCodeType?: SupportedCodeType | null;
  error?: string | null;
  onToggle: (codeType: SupportedCodeType, nextValue: boolean) => void;
};

export function CodeTypePoliciesPanel({
  policies,
  loading = false,
  savingCodeType = null,
  error = null,
  onToggle,
}: Props) {
  const rows = normalizeCodeTypePolicies(policies);

  return (
    <section className="rounded-2xl border border-white/10 bg-[#0b0b0b]/75 p-4 shadow-[0_20px_70px_rgba(0,0,0,0.35)]">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/10 pb-3">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-white/50">Code Policies</p>
          <h2 className="text-lg font-semibold text-white">Expiración por tipo de código</h2>
          <p className="mt-1 text-sm text-white/60">
            Activa la expiración obligatoria para los tipos soportados del panel de códigos.
          </p>
        </div>

      </div>

      <div className="mt-4 grid gap-3">
        {rows.map((row) => {
          const meta = CODE_TYPE_POLICY_ROWS.find((entry) => entry.code_type === row.code_type)!;
          const isSaving = savingCodeType === row.code_type;
          return (
            <label
              key={row.code_type}
              className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-black/25 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white">{meta.label}</p>
                <p className="text-xs text-white/55">Requiere `expires_at` al generar lotes cuando está activo.</p>
              </div>

                <span className="flex items-center gap-3">
                  <span className="text-xs text-white/55">{row.requires_expiration ? "Obligatoria" : "Opcional"}</span>
                  <input
                    type="checkbox"
                    checked={row.requires_expiration}
                    onChange={(event) => onToggle(row.code_type as SupportedCodeType, event.target.checked)}
                    disabled={loading || isSaving}
                    className="h-4 w-4 rounded border-white/20 bg-transparent text-[#e91e63] focus:ring-[#e91e63]"
                  />
                </span>
              </label>
            );
        })}
      </div>

      {error ? <p className="mt-3 text-sm text-red-300">{error}</p> : null}
      {loading ? <p className="mt-2 text-xs text-white/45">Cargando políticas...</p> : null}
    </section>
  );
}
