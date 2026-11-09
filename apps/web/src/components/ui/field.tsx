import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { useId } from "react";
import { cn } from "@/lib/utils";

interface FieldWrapperProps {
  label?: string;
  hint?: string;
  error?: string;
  id: string;
  children: ReactNode;
  className?: string;
}

function FieldWrapper({ label, hint, error, id, children, className }: FieldWrapperProps) {
  return (
    <div className={className}>
      {label && (
        <label htmlFor={id} className="label">
          {label}
        </label>
      )}
      {children}
      {error ? (
        <p className="mt-1.5 text-xs text-rose-500" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1.5 text-xs text-subtle">{hint}</p>
      ) : null}
    </div>
  );
}

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
  wrapperClassName?: string;
}

export function Input({ label, hint, error, wrapperClassName, className, id, ...props }: InputProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  return (
    <FieldWrapper label={label} hint={hint} error={error} id={inputId} className={wrapperClassName}>
      <input id={inputId} className={cn("input", error && "border-rose-500 focus:border-rose-500 focus:ring-rose-500/20", className)} aria-invalid={Boolean(error)} {...props} />
    </FieldWrapper>
  );
}

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
  error?: string;
  wrapperClassName?: string;
}

export function Textarea({ label, hint, error, wrapperClassName, className, id, ...props }: TextareaProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  return (
    <FieldWrapper label={label} hint={hint} error={error} id={inputId} className={wrapperClassName}>
      <textarea id={inputId} className={cn("input min-h-24 resize-y", error && "border-rose-500", className)} aria-invalid={Boolean(error)} {...props} />
    </FieldWrapper>
  );
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  hint?: string;
  error?: string;
  wrapperClassName?: string;
  options: { value: string; label: string }[];
  placeholder?: string;
}

export function Select({ label, hint, error, wrapperClassName, className, id, options, placeholder, ...props }: SelectProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  return (
    <FieldWrapper label={label} hint={hint} error={error} id={inputId} className={wrapperClassName}>
      <select id={inputId} className={cn("input appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%239096ad%22 stroke-width=%222.5%22><path d=%22m6 9 6 6 6-6%22/></svg>')] bg-[length:12px] bg-[right_0.9rem_center] bg-no-repeat pr-9", error && "border-rose-500", className)} {...props}>
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </FieldWrapper>
  );
}
