"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getAudioDevices, getSetting, setSetting, type AudioDeviceInfo } from "@/lib/tauri";
import { SETTINGS_KEYS } from "@/lib/settings-keys";

export function AudioTab() {
  const t = useTranslations("settings");
  const [audioDevices, setAudioDevices] = useState<AudioDeviceInfo[]>([]);
  const [inputDevice, setInputDevice] = useState("");

  useEffect(() => {
    getAudioDevices()
      .then((d) => setAudioDevices(d.filter((x) => x.kind === "input")))
      .catch(() => {});
    getSetting(SETTINGS_KEYS.audioInputDevice)
      .then((v) => setInputDevice(v ?? ""))
      .catch(() => {});
  }, []);

  const changeInputDevice = (name: string) => {
    setInputDevice(name);
    void setSetting(SETTINGS_KEYS.audioInputDevice, name).catch(() => {});
  };

  return (
    <section className="space-y-3">
      <label className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wider">
        {t("audio.microphone")}
      </label>
      <Select
        value={inputDevice || "__default__"}
        onValueChange={(v) => changeInputDevice(v === "__default__" ? "" : v)}
      >
        <SelectTrigger className="max-w-md">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__default__">{t("audio.default_device")}</SelectItem>
          {audioDevices.map((d) => (
            <SelectItem key={d.id} value={d.name}>
              {d.name}
              {d.isDefault ? ` (${t("audio.default_device")})` : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-xs text-[var(--text-tertiary)]">{t("audio.hint")}</p>
    </section>
  );
}
