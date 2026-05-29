import Image from "next/image";

export function RegistroHero({ logoUrl }: { logoUrl?: string | null }) {
  return (
    <div className="space-y-3">
      <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
        {logoUrl ? (
          <Image
            src={logoUrl}
            alt="BABY"
            width={72}
            height={72}
            unoptimized
            className="h-10 w-auto object-contain opacity-95 sm:h-12"
          />
        ) : null}

        <div className="space-y-1 text-center sm:text-left">
          <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-white/55">
            BABY
          </p>
          <h1 className="text-2xl font-semibold lg:text-3xl">Registro</h1>
        </div>
      </div>

      <p className="text-sm text-white/58">
        Genera tu QR y completa tus datos antes del ingreso.
      </p>
    </div>
  );
}
