import type { CSSProperties, ReactNode } from "react";
import { cn } from "./cn.js";

export type BadgeTone = "neutral" | "lime" | "amber" | "red" | "cyan";

export function Badge({
  children,
  tone = "neutral",
  className,
  title,
  style,
}: {
  children: ReactNode;
  tone?: BadgeTone;
  className?: string;
  title?: string;
  style?: CSSProperties;
}): ReactNode {
  return (
    <span
      className={cn("vt-badge", tone !== "neutral" && `vt-badge--${tone}`, className)}
      title={title}
      style={style}
    >
      {children}
    </span>
  );
}
