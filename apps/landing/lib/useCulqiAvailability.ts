"use client";

import { useEffect, useState } from "react";

type CulqiAvailability = {
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
    checked: !publicFlagEnabled,
    enabled: false,
    publicKey: "",
  });

  useEffect(() => {
    let active = true;

    async function loadStatus() {
      if (!publicFlagEnabled) {
        setState(DISABLED);
        return;
      }

      try {
        const res = await fetch("/api/payments/status", {
          cache: "no-store",
        });
        const data = await res.json().catch(() => ({}));
        const culqi = data?.providers?.culqi;
        const runtimePublicKey =
          typeof culqi?.publicKey === "string" ? culqi.publicKey.trim() : "";
        const publicKey = runtimePublicKey || fallbackPublicKey.trim();
        const enabled = Boolean(data?.success && culqi?.enabled && publicKey);

        if (active) {
          setState({
            checked: true,
            enabled,
            publicKey: enabled ? publicKey : "",
          });
        }
      } catch (_error) {
        if (active) {
          setState(DISABLED);
        }
      }
    }

    void loadStatus();

    return () => {
      active = false;
    };
  }, [fallbackPublicKey, publicFlagEnabled]);

  return state;
}
