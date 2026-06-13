"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  activateLicense,
  deactivateLicense,
  getLicenseStatus,
  type LicenseStatus,
} from "@/lib/tauri";

/**
 * Stripe Payment Link for the Pro upgrade. Replace with the operator's real
 * Payment Link before release (see docs/playbooks/release.md). After purchase,
 * the buyer receives a license key by email and pastes it below.
 */
const STRIPE_CHECKOUT_URL = "https://buy.stripe.com/test_meetflow_pro";

export function PlanTab() {
  const t = useTranslations("settings");
  const [license, setLicense] = useState<LicenseStatus | null>(null);
  const [licenseKey, setLicenseKey] = useState("");
  const [activating, setActivating] = useState(false);

  useEffect(() => {
    getLicenseStatus().then(setLicense).catch(() => {});
  }, []);

  const handleActivate = async () => {
    setActivating(true);
    try {
      const status = await activateLicense(licenseKey);
      setLicense(status);
      setLicenseKey("");
      toast.success(t("plan.activated"));
    } catch {
      toast.error(t("plan.invalid"));
    } finally {
      setActivating(false);
    }
  };

  const handleDeactivate = async () => {
    try {
      await deactivateLicense();
      setLicense(await getLicenseStatus());
    } catch (e) {
      toast.error(`${e}`);
    }
  };

  return (
    <>
      <section className="flex items-center justify-between rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-[var(--text-primary)]">
            {license?.tier === "pro" ? t("plan.current_pro") : t("plan.current_free")}
          </p>
          {license?.email && (
            <p className="text-xs text-[var(--text-tertiary)]">{license.email}</p>
          )}
        </div>
        <Badge variant={license?.tier === "pro" ? "default" : "secondary"}>
          {license?.tier === "pro" ? "Pro" : "Free"}
        </Badge>
      </section>

      {license?.tier === "pro" ? (
        <section className="space-y-3">
          <Button variant="outline" size="sm" onClick={handleDeactivate}>
            {t("plan.deactivate")}
          </Button>
        </section>
      ) : (
        <>
          <section className="space-y-2">
            <p className="text-sm text-[var(--text-secondary)]">{t("plan.upgrade_hint")}</p>
            <a href={STRIPE_CHECKOUT_URL} target="_blank" rel="noopener noreferrer">
              <Button variant="default" size="sm" className="gap-2">
                {t("plan.upgrade")}
                <ExternalLink className="w-3.5 h-3.5" />
              </Button>
            </a>
          </section>

          <Separator />

          <section className="space-y-3">
            <label className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wider">
              {t("plan.key_label")}
            </label>
            <div className="flex gap-2">
              <Input
                value={licenseKey}
                onChange={(e) => setLicenseKey(e.target.value)}
                placeholder={t("plan.key_placeholder")}
                className="flex-1 font-mono text-xs"
              />
              <Button
                variant="outline"
                size="sm"
                loading={activating}
                disabled={!licenseKey.trim()}
                onClick={handleActivate}
              >
                {t("plan.activate")}
              </Button>
            </div>
          </section>
        </>
      )}
    </>
  );
}
