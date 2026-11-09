import { Send } from "lucide-react";
import { useState, type FormEvent, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";

export function Composer({
  onSend,
  disabled,
  placeholder = "Ask about overdue work, a project, or a task key…",
}: {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  const [value, setValue] = useState("");

  function submit(e?: FormEvent) {
    e?.preventDefault();
    const text = value.trim();
    if (!text || disabled) return;
    onSend(text);
    setValue("");
  }

  function onKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  return (
    <form onSubmit={submit} className="flex items-end gap-2">
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={onKey}
        rows={2}
        placeholder={placeholder}
        className="input min-h-[2.75rem] flex-1 resize-none"
        disabled={disabled}
      />
      <Button type="submit" size="icon" disabled={disabled || !value.trim()} aria-label="Send">
        <Send className="h-4 w-4" />
      </Button>
    </form>
  );
}
