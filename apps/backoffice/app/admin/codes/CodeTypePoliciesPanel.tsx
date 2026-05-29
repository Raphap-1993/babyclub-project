"use client";

import { Button } from "@/components/ui/button";

type CodeTypePolicyRow = {
  code_type: string;
  requires_expiration: boolean;
};

type Props = {
  policies: CodeTypePolicyRow[];
  saving?: boolean;
  onChange: (codeType: string, requiresExpiration: boolean) => void;
  onSave: () => void;
};

const LABELS: Record<string, string> = {
  courtesy: "Cortesía",
  promoter: "Promotor",
  table: "Mesa",
};

export function CodeTypePoliciesPanel({ policies, saving = false, onChange, onSave }: Props) {
  const orderedPolicies = ["courtesy", "promoter", "table"].map((codeType) => {
    const existing = policies.find((policy) => policy.code_type === codeType);
    return existing || { code_type: codeType, requires_expiration: false };
  });

  return (
    <section className="rounded-2xl border border-white/10 bg-[#0b0b0b] p-4 shadow-[0_20px_70px_rgba(0,0,0,0.35)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.18em] text-white/45">Políticas por tipo</p>
          <h3 className="text-lg font-semibold text-white">Expiración obligatoria por código</h3>
          <p className="text-sm text-white/55">
            Define qué tipos requieren fecha de expiración para poder generar lotes.
          </p>
        </div>
        <Button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="rounded-full bg-gradient-to-r from-[#e91e63] to-[#ff77b6] text-sm font-semibold text-white"
        >
          {saving ? "Guardando..." : "Guardar políticas"}
        </Button>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {orderedPolicies.map((policy) => (
          <label
            key={policy.code_type}
            className="flex h-full flex-col justify-between rounded-2xl border border-white/10 bg-black/35 p-4"
          >
            <div className="space-y-1">
              <p className="text-sm font-semibold text-white">{LABELS[policy.code_type] || policy.code_type}</p>
              <p className="text-xs text-white/45">Code type: {policy.code_type}</p>
            </div>
            <div className="mt-4 flex items-center justify-between gap-3">
              <span className="text-sm text-white/70">Requiere expiración</span>
              <input
                type="checkbox"
                checked={policy.requires_expiration}
                onChange={(event) => onChange(policy.code_type, event.target.checked)}
                className="h-4 w-4 rounded border-white/30 bg-black/50 text-[#e91e63] focus:ring-[#e91e63]"
              />
            </div>
          </label>
        ))}
      </div>
    </section>
  );
}
