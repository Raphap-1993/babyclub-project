export default function AdminLoading() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="flex items-center gap-3 rounded-full border border-white/15 bg-[#0b0b0b] px-4 py-2 shadow-[0_20px_60px_rgba(0,0,0,0.45)]">
        <span className="h-3 w-3 animate-ping rounded-full bg-[#e91e63] opacity-80" />
        <span className="text-sm font-semibold text-white">Cargando</span>
      </div>
    </div>
  );
}
