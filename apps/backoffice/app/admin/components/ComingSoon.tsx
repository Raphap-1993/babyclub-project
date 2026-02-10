import { AdminHeader, AdminPage, AdminPanel } from "@/components/admin/PageScaffold";

type ComingSoonProps = {
  title: string;
  description?: string;
};

export function ComingSoon({ title, description }: ComingSoonProps) {
  return (
    <AdminPage maxWidth="6xl">
      <AdminHeader
        kicker="Módulo"
        title={title}
        description={description || "Estamos terminando esta sección. Pronto podrás gestionarla desde aquí."}
      />
      <AdminPanel contentClassName="px-6 py-10">
        <div className="flex min-h-[260px] flex-col items-center justify-center gap-3 text-center text-white">
          <span className="rounded-full border border-[#2b2b2b] px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-white/70">
            Módulo en desarrollo
          </span>
          <p className="max-w-xl text-sm text-white/70">
            Estamos unificando el nuevo diseño y los componentes de experiencia para este módulo.
          </p>
        </div>
      </AdminPanel>
    </AdminPage>
  );
}
