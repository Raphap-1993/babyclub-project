"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseClient } from "@/lib/supabaseClient";

export function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const onLogout = async () => {
    if (!supabaseClient) {
      router.push("/auth/login");
      return;
    }
    setLoading(true);
    await supabaseClient.auth.signOut();
    setLoading(false);
    router.replace("/auth/login");
  };

  return (
    <button
      onClick={onLogout}
      disabled={loading}
      className="inline-flex items-center justify-center rounded-full border border-[#2b2b2b] bg-[#151515] px-5 py-2 text-sm font-semibold text-white/90 transition hover:border-[#3a3a3a] hover:bg-[#1c1c1c] hover:text-white disabled:opacity-70"
    >
      {loading ? "Saliendo..." : "Cerrar sesión"}
    </button>
  );
}
