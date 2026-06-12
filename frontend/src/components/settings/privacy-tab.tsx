"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { FolderOpen, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { deleteAllData, getAppDataDir } from "@/lib/tauri";

export function PrivacyTab() {
  const t = useTranslations("settings");
  const [dataDir, setDataDir] = useState<string | null>(null);
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    getAppDataDir().then(setDataDir).catch(() => {});
  }, []);

  const handleDeleteAll = async () => {
    setDeleting(true);
    try {
      await deleteAllData();
      toast.success("All data deleted");
      setDeleteDialog(false);
    } catch (e) {
      toast.error(`Failed to delete data: ${e}`);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <section className="space-y-2">
        <label className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wider">
          {t("privacy.data_location")}
        </label>
        <div className="flex items-center gap-2">
          <code className="flex-1 text-xs bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded px-2.5 py-1.5 truncate text-[var(--text-secondary)]">
            {dataDir ?? "…"}
          </code>
          <Button variant="outline" size="icon-sm" aria-label="Open folder">
            <FolderOpen className="w-3.5 h-3.5" />
          </Button>
        </div>
      </section>

      <Separator />

      <section className="space-y-3">
        <label className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wider">
          Danger zone
        </label>
        <div className="rounded-xl border border-[var(--error)]/30 p-4 space-y-2">
          <p className="text-sm font-medium text-[var(--text-primary)]">
            {t("privacy.delete_all.label")}
          </p>
          <p className="text-xs text-[var(--text-tertiary)]">
            {t("privacy.delete_all.confirm_description")}
          </p>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setDeleteDialog(true)}
            className="gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5" />
            {t("privacy.delete_all.label")}
          </Button>
        </div>
      </section>

      <Dialog open={deleteDialog} onOpenChange={setDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("privacy.delete_all.confirm_title")}</DialogTitle>
            <DialogDescription>{t("privacy.delete_all.confirm_description")}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setDeleteDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteAll} loading={deleting}>
              {t("privacy.delete_all.confirm_button")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
