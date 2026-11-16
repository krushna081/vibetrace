import { useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Copy, FileJson, GitCompareArrows, Printer, RefreshCw, Share2, Trash2 } from "lucide-react";
import type { ScanReport } from "@vibetrace/shared-types";
import { Button } from "@vibetrace/design-system";
import { getApiClient } from "../lib/settings.js";
import { buildReportSummary, copyText, downloadJson } from "../lib/export.js";
import { describeError } from "../lib/errors.js";
import { invalidateReport } from "../lib/report-cache.js";
import { useToast } from "../providers/ToastProvider.js";
import { ShareDialog } from "./ShareDialog.js";
import { ConfirmDialog } from "./ConfirmDialog.js";

export function ReportActions({ report }: { report: ScanReport }): ReactNode {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [shareOpen, setShareOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [rescanning, setRescanning] = useState(false);

  const copy = async () => {
    try {
      await copyText(buildReportSummary(report));
      toast({ tone: "success", title: "Report summary copied" });
    } catch (err) {
      toast({ tone: "error", title: "Could not copy", message: describeError(err).message });
    }
  };

  const rescan = async () => {
    setRescanning(true);
    try {
      const result = await getApiClient().createScan({
        url: report.scan.url,
        mode: "remote",
        client: "web",
      });
      toast({ tone: "success", title: "Re-scan queued", message: report.scan.domain });
      navigate(`/scan/${result.id}`);
    } catch (err) {
      toast({ tone: "error", title: "Could not re-scan", message: describeError(err).message });
    } finally {
      setRescanning(false);
    }
  };

  const remove = async () => {
    setDeleting(true);
    try {
      await getApiClient().deleteScan(report.scan.id);
      invalidateReport(report.scan.id);
      toast({ tone: "success", title: "Scan deleted" });
      setDeleteOpen(false);
      navigate("/history");
    } catch (err) {
      toast({ tone: "error", title: "Could not delete scan", message: describeError(err).message });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div
      className="no-print"
      style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}
    >
      <Button
        size="sm"
        variant="secondary"
        onClick={() => void copy()}
        title="Copy a plain-text summary"
      >
        <Copy size={14} aria-hidden="true" /> Copy
      </Button>
      <Button
        size="sm"
        variant="secondary"
        onClick={() => downloadJson(report)}
        title="Download the validated JSON report"
      >
        <FileJson size={14} aria-hidden="true" /> JSON
      </Button>
      <Button
        size="sm"
        variant="secondary"
        onClick={() => window.open(`/scan/${report.scan.id}/print`, "_blank", "noopener")}
        title="Open the printable report and use your browser's Save as PDF option"
      >
        <Printer size={14} aria-hidden="true" /> PDF / print
      </Button>
      <Button size="sm" variant="secondary" onClick={() => setShareOpen(true)}>
        <Share2 size={14} aria-hidden="true" /> Share
      </Button>
      <Button
        size="sm"
        variant="secondary"
        onClick={() => navigate(`/history?compare=${report.scan.id}`)}
        title="Choose a second scan to compare"
      >
        <GitCompareArrows size={14} aria-hidden="true" /> Compare
      </Button>
      <Button size="sm" variant="ghost" loading={rescanning} onClick={() => void rescan()}>
        <RefreshCw size={14} aria-hidden="true" /> Re-scan
      </Button>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => setDeleteOpen(true)}
        title="Delete this scan from the server"
        aria-label="Delete scan"
      >
        <Trash2 size={14} aria-hidden="true" />
      </Button>

      <ShareDialog open={shareOpen} onClose={() => setShareOpen(false)} scanId={report.scan.id} />
      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={remove}
        busy={deleting}
        title="Delete this scan?"
        confirmLabel="Delete scan"
        description={
          <>
            The scan and its report will be removed from the API store. Public links stop working
            immediately. This action cannot be undone.
          </>
        }
      />
    </div>
  );
}
