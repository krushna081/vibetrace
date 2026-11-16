import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type ToastTone = "success" | "error" | "info";

interface ToastInput {
  title: string;
  message?: string;
  tone?: ToastTone;
}

interface ToastItem extends ToastInput {
  id: string;
  tone: ToastTone;
}

interface ToastContextValue {
  toast: (input: ToastInput) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const toneIcon = {
  success: CheckCircle2,
  error: AlertTriangle,
  info: Info,
} as const;

export function ToastProvider({ children }: { children: ReactNode }): ReactNode {
  const [items, setItems] = useState<ToastItem[]>([]);
  const timers = useRef(new Map<string, number>());

  const dismiss = useCallback((id: string) => {
    setItems((current) => current.filter((item) => item.id !== id));
    const timer = timers.current.get(id);
    if (timer) window.clearTimeout(timer);
    timers.current.delete(id);
  }, []);

  const toast = useCallback(
    (input: ToastInput) => {
      const id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const item: ToastItem = { ...input, id, tone: input.tone ?? "info" };
      setItems((current) => [...current.slice(-3), item]);
      const timer = window.setTimeout(() => dismiss(id), 5_500);
      timers.current.set(id, timer);
    },
    [dismiss],
  );

  useEffect(() => {
    const map = timers.current;
    return () => {
      for (const timer of map.values()) window.clearTimeout(timer);
      map.clear();
    };
  }, []);

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="no-print"
        style={{
          position: "fixed",
          right: 16,
          bottom: 16,
          zIndex: 90,
          display: "flex",
          flexDirection: "column",
          gap: 8,
          width: "min(380px, calc(100vw - 32px))",
          pointerEvents: "none",
        }}
      >
        <AnimatePresence initial={false}>
          {items.map((item) => {
            const Icon = toneIcon[item.tone];
            const color =
              item.tone === "success"
                ? "var(--vt-lime)"
                : item.tone === "error"
                  ? "var(--vt-red)"
                  : "var(--vt-cyan)";
            return (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, y: 16, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, x: 24, transition: { duration: 0.16 } }}
                transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                role={item.tone === "error" ? "alert" : "status"}
                style={{
                  pointerEvents: "auto",
                  display: "flex",
                  gap: 10,
                  padding: "12px 12px 12px 14px",
                  border: "1px solid var(--vt-border-strong)",
                  borderLeft: `2px solid ${color}`,
                  borderRadius: 8,
                  background: "var(--vt-panel-raised)",
                  boxShadow: "0 14px 34px rgba(0,0,0,0.35)",
                }}
              >
                <Icon
                  size={16}
                  style={{ color, flex: "0 0 auto", marginTop: 2 }}
                  aria-hidden="true"
                />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 650, color: "var(--vt-text)" }}>
                    {item.title}
                  </p>
                  {item.message ? (
                    <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--vt-text-muted)" }}>
                      {item.message}
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => dismiss(item.id)}
                  aria-label="Dismiss notification"
                  style={{
                    alignSelf: "flex-start",
                    display: "grid",
                    placeItems: "center",
                    width: 24,
                    height: 24,
                    border: 0,
                    borderRadius: 4,
                    background: "transparent",
                    color: "var(--vt-text-faint)",
                    cursor: "pointer",
                  }}
                >
                  <X size={14} aria-hidden="true" />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside ToastProvider.");
  return context;
}
