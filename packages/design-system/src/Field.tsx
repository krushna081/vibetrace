import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from "react";
import { cn } from "./cn.js";

export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
  optional,
}: {
  label: ReactNode;
  htmlFor?: string;
  hint?: ReactNode;
  error?: ReactNode;
  children: ReactNode;
  optional?: boolean;
}): ReactNode {
  return (
    <div>
      <label className="vt-label" htmlFor={htmlFor}>
        {label}
        {optional ? (
          <span
            style={{
              marginLeft: 6,
              color: "var(--vt-text-faint)",
              letterSpacing: 0,
              textTransform: "none",
            }}
          >
            (optional)
          </span>
        ) : null}
      </label>
      {children}
      {error ? (
        <p className="vt-error-text" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="vt-hint">{hint}</p>
      ) : null}
    </div>
  );
}

export interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(function TextInput(
  { className, invalid, ...rest },
  ref,
) {
  return (
    <input
      ref={ref}
      className={cn("vt-input", className)}
      aria-invalid={invalid || undefined}
      {...rest}
    />
  );
});

export interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(function TextArea(
  { className, invalid, ...rest },
  ref,
) {
  return (
    <textarea
      ref={ref}
      className={cn("vt-textarea", className)}
      aria-invalid={invalid || undefined}
      {...rest}
    />
  );
});

export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled,
  id,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
  id?: string;
}): ReactNode {
  const generated = useId();
  const inputId = id ?? generated;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 16,
      }}
    >
      <div>
        <label
          htmlFor={inputId}
          style={{ display: "block", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
        >
          {label}
        </label>
        {description ? (
          <p style={{ margin: "3px 0 0", color: "var(--vt-text-muted)", fontSize: 12 }}>
            {description}
          </p>
        ) : null}
      </div>
      <label className="vt-switch" aria-label={typeof label === "string" ? label : undefined}>
        <input
          id={inputId}
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(event) => onChange(event.currentTarget.checked)}
        />
        <span className="vt-switch-track" aria-hidden="true" />
      </label>
    </div>
  );
}
