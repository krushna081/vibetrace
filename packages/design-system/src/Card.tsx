import type { CSSProperties, HTMLAttributes, ReactNode } from "react";
import { cn } from "./cn.js";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  raised?: boolean;
}

export function Card({ className, raised, ...rest }: CardProps): ReactNode {
  return <div className={cn("vt-card", raised && "vt-card-raised", className)} {...rest} />;
}

export function CardHeader({
  title,
  description,
  action,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}): ReactNode {
  return (
    <div
      className={cn(className)}
      style={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 16,
        padding: "18px 20px",
        borderBottom: "1px solid var(--vt-border)",
      }}
    >
      <div style={{ minWidth: 0 }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 650, letterSpacing: "-0.01em" }}>
          {title}
        </h3>
        {description ? (
          <p style={{ margin: "4px 0 0", color: "var(--vt-text-muted)", fontSize: 13 }}>
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div style={{ flex: "0 0 auto" }}>{action}</div> : null}
    </div>
  );
}

export function CardBody({
  children,
  className,
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}): ReactNode {
  return (
    <div className={cn(className)} style={{ padding: "18px 20px", ...style }}>
      {children}
    </div>
  );
}
