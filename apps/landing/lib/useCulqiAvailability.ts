"use client";

import { useEffect, useState } from "react";

type CulqiAvailability = {
  mercadopago?: boolean;
  salesPaused?: boolean;
  checked: boolean;
  enabled: boolean;
  publicKey: string;
};

const DISABLED: CulqiAvailability = {
  checked: true,
  enabled: false,
  publicKey: "",
};

export function useCulqiAvailability(
  publicFlagEnabled: boolean,
  fallbackPublicKey: string,
) {
  const [state, setState] = useState<CulqiAvailability>({
    checked: false,
    enabled: false,
    publicKey: "",
  });

  useEffect(() => {
    let active = true;

    async function loadStatus() {
      try {
        const res = await fetch("/api/payments/status", {
          cache: "no-store",
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data?.success) throw new Error("payments_unavailable");
        const culqi = data?.providers?.culqi;
        const runtimePublicKey =
          typeof culqi?.publicKey === "string" ? culqi.publicKey.trim() : "";
        const publicKey =
          runtimePublicKey ||
          (publicFlagEnabled ? fallbackPublicKey.trim() : "");
        const enabled = Boolean(data?.success && culqi?.enabled && publicKey);

        if (active) {
          setState({
            mercadopago: Boolean(
              data?.providers?.mercadopago?.configured ||
                data?.providers?.mercadopago?.enabled,
            ),
            salesPaused: Boolean(data?.providers?.mercadopago?.salesPaused),
            checked: true,
            enabled,
            publicKey: enabled ? publicKey : "",
          });
        }
      } catch (_error) {
        if (active) {
          setState({ ...DISABLED, salesPaused: true });
        }
      }
    }

    void loadStatus();
    const interval = setInterval(loadStatus, 30_000);
    window.addEventListener("focus", loadStatus);

    return () => {
      active = false;
      clearInterval(interval);
      window.removeEventListener("focus", loadStatus);
    };
  }, [fallbackPublicKey, publicFlagEnabled]);

  return state;
}
