import { useUiStore } from "@/store/ui";
import { messages, type Locale, type MsgKey } from "./messages";

export function t(locale: Locale, key: MsgKey): string {
  return messages[locale][key] ?? messages.en[key];
}

export function useT(): (key: MsgKey) => string {
  const locale = useUiStore((s) => s.locale);
  return (key) => t(locale, key);
}

export type { Locale, MsgKey };
