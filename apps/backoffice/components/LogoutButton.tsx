"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseClient } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function LogoutButton({ className }: { className?: string }) {
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
    <Button
      onClick={onLogout}
      disabled={loading}
      variant="outline"
      className={cn("h-10 rounded-xl", className)}
    >
      {loading ? "Saliendo..." : "Cerrar sesión"}
    </Button>
  );
}
