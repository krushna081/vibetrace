import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertOctagon } from "lucide-react";
import { Button, Card } from "@vibetrace/design-system";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("VibeTrace UI error", error, info.componentStack);
  }

  render(): ReactNode {
    if (!this.state.error) return this.props.children;
    return (
      <div style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: 20 }}>
        <Card style={{ maxWidth: 560, padding: "28px 26px" }}>
          <AlertOctagon size={24} style={{ color: "var(--vt-red)" }} aria-hidden="true" />
          <h1 style={{ margin: "12px 0 0", fontSize: 22, letterSpacing: "-0.03em" }}>
            The interface hit an unexpected error.
          </h1>
          <p style={{ margin: "8px 0 0", color: "var(--vt-text-muted)", fontSize: 13 }}>
            Your scans are unaffected; data lives on the API. Reload the page to recover. If the
            problem persists, open the browser console and report the stack trace.
          </p>
          <pre
            className="vt-mono"
            style={{
              marginTop: 12,
              padding: 10,
              background: "var(--vt-black)",
              border: "1px solid var(--vt-border)",
              borderRadius: 6,
              fontSize: 10,
              overflow: "auto",
              maxHeight: 120,
              color: "var(--vt-red)",
            }}
          >
            {this.state.error.message}
          </pre>
          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            <Button variant="primary" size="sm" onClick={() => window.location.reload()}>
              Reload application
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                this.setState({ error: null });
                window.location.assign("/");
              }}
            >
              Go home
            </Button>
          </div>
        </Card>
      </div>
    );
  }
}
