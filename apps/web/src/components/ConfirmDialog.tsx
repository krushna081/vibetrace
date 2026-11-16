import type { ReactNode } from "react";
import { Button } from "@vibetrace/design-system";
import { Modal } from "./Modal.js";

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirm",
  tone = "danger",
  busy = false,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description: ReactNode;
  confirmLabel?: string;
  tone?: "danger" | "primary";
  busy?: boolean;
}): ReactNode {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      busy={busy}
      width={460}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant={tone === "danger" ? "danger" : "primary"}
            loading={busy}
            onClick={() => void onConfirm()}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div style={{ color: "var(--vt-text-muted)", fontSize: 13 }}>{description}</div>
    </Modal>
  );
}
