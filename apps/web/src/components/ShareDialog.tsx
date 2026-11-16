import { useEffect, useState, type ReactNode } from "react";
import { Copy, ExternalLink, Link2, LoaderCircle, ShieldOff } from "lucide-react";
import { Alert, Badge, Button } from "@vibetrace/design-system";
import { getApiClient } from "../lib/settings.js";
import { copyText } from "../lib/export.js";
import { describeError } from "../lib/errors.js";
import { useToast } from "../providers/ToastProvider.js";
import { Modal } from "./Modal.js";

export function ShareDialog({
  open,
  onClose,
  scanId,
}: {
  open: boolean;
  onClose: () => void;
  scanId: string;
}): ReactNode {
  const { toast } = useToast();
  const [link, setLink] = useState<string | null>(null);
  const [sharedAt, setSharedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revoked, setRevoked] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setRevoked(false);
    setLink(null);
    getApiClient()
      .shareReport(scanId)
      .then((share) => {
        if (cancelled) return;
        setLink(`${window.location.origin}/shared/${share.token}`);
        setSharedAt(share.createdAt);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(describeError(err).message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, scanId]);

  const copy = async () => {
    if (!link) return;
    try {
      await copyText(link);
      toast({ tone: "success", title: "Share link copied" });
    } catch (err) {
      toast({ tone: "error", title: "Could not copy", message: describeError(err).message });
    }
  };

  const revoke = async () => {
    setRevoking(true);
    try {
      await getApiClient().unshareReport(scanId);
      setLink(null);
      setRevoked(true);
      toast({ tone: "success", title: "Public link revoked" });
    } catch (err) {
      toast({ tone: "error", title: "Could not revoke link", message: describeError(err).message });
    } finally {
      setRevoking(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Share report"
      description="Create a read-only public link for this report."
      width={560}
      footer={
        <>
          {link ? (
            <Button variant="danger" loading={revoking} onClick={() => void revoke()}>
              <ShieldOff size={14} aria-hidden="true" /> Revoke link
            </Button>
          ) : null}
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          {link ? (
            <Button variant="primary" onClick={() => void copy()}>
              <Copy size={14} aria-hidden="true" /> Copy link
            </Button>
          ) : null}
        </>
      }
    >
      {loading ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            color: "var(--vt-text-muted)",
            fontSize: 13,
          }}
        >
          <LoaderCircle size={16} className="vt-spinner" aria-hidden="true" />
          Creating or retrieving the share token…
        </div>
      ) : error ? (
        <Alert tone="danger" title="Unable to create a share link">
          {error}
        </Alert>
      ) : revoked ? (
        <div>
          <Alert tone="success" title="Public access revoked">
            The previous link no longer resolves. You can create a new link at any time.
          </Alert>
          <Button
            variant="secondary"
            style={{ marginTop: 12 }}
            onClick={() => {
              setRevoked(false);
              setLoading(true);
              setError(null);
              getApiClient()
                .shareReport(scanId)
                .then((share) => {
                  setLink(`${window.location.origin}/shared/${share.token}`);
                  setSharedAt(share.createdAt);
                })
                .catch((err: unknown) => setError(describeError(err).message))
                .finally(() => setLoading(false));
            }}
          >
            <Link2 size={14} aria-hidden="true" /> Create a new link
          </Button>
        </div>
      ) : link ? (
        <div>
          <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
            <Badge tone="lime">Link active</Badge>
            {sharedAt ? (
              <Badge>First shared {new Date(sharedAt).toLocaleDateString()}</Badge>
            ) : null}
          </div>
          <div
            className="vt-mono"
            style={{
              display: "flex",
              gap: 8,
              alignItems: "center",
              padding: "10px 12px",
              border: "1px solid var(--vt-border)",
              borderRadius: 8,
              background: "var(--vt-black)",
              fontSize: 12,
              overflowWrap: "anywhere",
            }}
          >
            <Link2
              size={14}
              style={{ flex: "0 0 auto", color: "var(--vt-lime)" }}
              aria-hidden="true"
            />
            <a href={link} target="_blank" rel="noreferrer" style={{ color: "var(--vt-lime)" }}>
              {link}
            </a>
            <a
              href={link}
              target="_blank"
              rel="noreferrer"
              aria-label="Open shared report in a new tab"
              style={{ marginLeft: "auto", color: "var(--vt-text-faint)", display: "inline-flex" }}
            >
              <ExternalLink size={14} aria-hidden="true" />
            </a>
          </div>
          <p style={{ margin: "14px 0 0", color: "var(--vt-text-muted)", fontSize: 12 }}>
            Anyone with this random link can read the report until you revoke it. Shared reports
            exclude raw page source, request metadata, and any AI explanation. The scan id itself is
            not required to view the report.
          </p>
        </div>
      ) : null}
    </Modal>
  );
}
