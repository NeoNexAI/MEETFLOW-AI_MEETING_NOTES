"use client";

import { useQuery } from "@tanstack/react-query";
import { getLicenseStatus, type Entitlements, type Tier } from "@/lib/tauri";

const FREE_ENTITLEMENTS: Entitlements = {
  cloudLlm: false,
  largeModels: false,
  advancedExport: false,
  integrations: false,
};

/**
 * Current license tier + entitlements. Defaults to Free until/if a valid
 * license is loaded. The backend enforces these gates too; the UI uses them
 * for affordances (Pro badges, disabled controls).
 */
export function useLicense(): {
  tier: Tier;
  isPro: boolean;
  entitlements: Entitlements;
} {
  const { data } = useQuery({
    queryKey: ["license"],
    queryFn: getLicenseStatus,
    staleTime: 60_000,
  });
  return {
    tier: data?.tier ?? "free",
    isPro: data?.tier === "pro",
    entitlements: data?.entitlements ?? FREE_ENTITLEMENTS,
  };
}
