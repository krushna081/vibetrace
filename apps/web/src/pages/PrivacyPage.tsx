import { Link } from "react-router-dom";
import { ArrowLeft, Cookie, Database, EyeOff, LockKeyhole, Share2, Trash2 } from "lucide-react";
import { Badge, Card, PageHeader } from "@vibetrace/design-system";
import { usePageTitle } from "../hooks/use-api.js";

function PrivacySection({
  icon,
  title,
  children,
}: {
  icon?: React.ReactNode;
  title: string;
  children: React.ReactNode;
}): React.ReactNode {
  return (
    <Card style={{ padding: "20px 22px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {icon ? <span style={{ color: "var(--vt-lime)" }}>{icon}</span> : null}
        <h2 style={{ margin: 0, fontSize: 16, letterSpacing: "-0.02em" }}>{title}</h2>
      </div>
      <div style={{ marginTop: 8, color: "var(--vt-text-muted)", fontSize: 13, lineHeight: 1.75 }}>
        {children}
      </div>
    </Card>
  );
}

export function PrivacyPage(): React.ReactNode {
  usePageTitle("Privacy policy");

  return (
    <div>
      <PageHeader
        eyebrow="Privacy policy"
        title="What VibeTrace processes, and what it refuses to."
        description="This deployment is self-hostable and account-free. The policy below describes the default application behavior in this repository; the operator of a deployment controls its storage and retention configuration."
        actions={<Badge>Updated 15 Nov 2026</Badge>}
      />

      <div className="grid gap-4" style={{ maxWidth: 940 }}>
        <Card raised style={{ padding: "20px 22px", borderLeft: "2px solid var(--vt-lime)" }}>
          <span
            className="vt-mono"
            style={{
              fontSize: 9,
              letterSpacing: "0.12em",
              color: "var(--vt-lime)",
              textTransform: "uppercase",
            }}
          >
            Short version
          </span>
          <ul
            style={{
              margin: "9px 0 0",
              paddingLeft: 18,
              color: "var(--vt-text-muted)",
              fontSize: 13,
              lineHeight: 1.8,
            }}
          >
            <li>No account, no advertising, no third-party analytics SDK.</li>
            <li>
              Public pages are fetched server-side without your cookies, authorization headers or
              credentials.
            </li>
            <li>
              The extension reads a sanitized snapshot of the active tab, never form values,
              passwords, cookies or history.
            </li>
            <li>Reports contain structural facts and bounded evidence — not raw HTML.</li>
            <li>
              Sharing is opt-in and revocable. AI explanations are off by default and require
              explicit consent.
            </li>
          </ul>
        </Card>

        <PrivacySection icon={<Database size={16} />} title="Data processed for a scan">
          <p style={{ margin: "0 0 8px" }}>When you submit a URL, the API processes:</p>
          <ul style={{ margin: "0 0 8px", paddingLeft: 18 }}>
            <li>The target URL and derived domain, scan mode, client type and timestamps.</li>
            <li>
              The public HTTP response and a transient copy of returned HTML, bounded by size and
              time limits.
            </li>
            <li>
              Derived report data: scores, check results, evidence snippets, technology detections,
              structural profile and limitations.
            </li>
            <li>
              Operational logs containing request IDs, route, latency, result codes and errors.
            </li>
          </ul>
          <p style={{ margin: 0 }}>
            The full HTML is used to compute the report and is not intentionally written into the
            report record. Short sanitized evidence samples may be retained inside the report. Do
            not submit private, internal or credential-bearing URLs to a deployment you do not
            control; the fetch layer blocks private address ranges, but you remain responsible for
            the targets you choose.
          </p>
        </PrivacySection>

        <PrivacySection icon={<EyeOff size={16} />} title="What is never collected">
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            <li>Your browsing history, tabs, bookmarks, downloads or keystrokes.</li>
            <li>
              Form field values, password values, cookies or browser local/session storage from
              scanned pages.
            </li>
            <li>Cookies, authorization headers or credentials forwarded to the target website.</li>
            <li>
              Accounts, names, email addresses or payment details — there is no account system or
              billing.
            </li>
            <li>Advertising identifiers or behavioral profiles.</li>
          </ul>
        </PrivacySection>

        <PrivacySection icon={<Cookie size={16} />} title="Cookies and local storage">
          <p style={{ margin: "0 0 8px" }}>
            The web app does not require authentication cookies. The API uses in-memory rate
            limiting and does not set advertising or analytics cookies. The website stores a single
            local preference object under <code className="vt-mono">vibetrace:settings</code>{" "}
            containing theme, API base URL and AI-consent choice. Reports are cached in memory for
            the current page session and cleared on reload or when you press “Clear report cache” in
            Settings.
          </p>
          <p style={{ margin: 0 }}>
            The extension stores its configured API URL and consent preference in Chrome extension
            storage. It does not persist page snapshots or report bodies by default.
          </p>
        </PrivacySection>

        <PrivacySection icon={<Share2 size={16} />} title="Public sharing">
          <p style={{ margin: "0 0 8px" }}>
            Sharing is off by default. Creating a public link produces a random token and a
            read-only report view. Anyone with the token can read the report until you revoke the
            link or the scan is deleted or purged. Shared reports exclude raw HTML, cookies, request
            headers and the optional AI narrative. The token itself is not included in the report
            data and is not enumerable.
          </p>
          <p style={{ margin: 0 }}>
            Revoke sharing from the report's Share dialog. Deleting the scan also invalidates its
            link.
          </p>
        </PrivacySection>

        <PrivacySection icon={<LockKeyhole size={16} />} title="Optional AI explanation provider">
          <p style={{ margin: "0 0 8px" }}>
            The deterministic analysis engine does not call any external AI provider. An operator
            may configure an Ollama or OpenAI-compatible provider. If enabled, the AI page shows the
            provider and requires two explicit actions: enabling consent in Settings, then
            confirming a specific request. The request includes a bounded summary of report findings
            — scores, classification, technologies, failed checks and limitations. It excludes raw
            HTML, response headers, cookies and credentials.
          </p>
          <p style={{ margin: 0 }}>
            When enabled, the report summary is transmitted to the configured provider and is
            subject to that provider's retention and privacy terms. The generated narrative is
            labelled AI-generated and is not stored in the scan record by default.
          </p>
        </PrivacySection>

        <PrivacySection icon={<Database size={16} />} title="Storage, retention and deletion">
          <ul style={{ margin: "0 0 8px", paddingLeft: 18 }}>
            <li>
              The default in-memory store keeps scans only for the life of the API process and loses
              them on restart.
            </li>
            <li>
              When PostgreSQL/Prisma storage is enabled, the operator configures retention; the
              default retention setting is 24 hours, with a purge interval enforced by the API.
            </li>
            <li>Expired scans are purged together with their reports and share tokens.</li>
            <li>
              You can delete individual scans or clear all scans from the web UI, subject to API
              access.
            </li>
            <li>
              Backups, replicas and infrastructure logs are controlled by the deployment operator
              and are outside this application's automatic deletion.
            </li>
          </ul>
          <p style={{ margin: 0 }}>
            A report may contain the public URL, page title, metadata and observed public
            configuration. Treat reports as potentially sensitive if the scanned URL itself is
            sensitive.
          </p>
        </PrivacySection>

        <PrivacySection icon={<Trash2 size={16} />} title="Your choices">
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            <li>Scan without an account. No identity is required.</li>
            <li>Delete stored scans from History or Settings.</li>
            <li>Revoke public links at any time.</li>
            <li>Disable AI consent or leave the provider unconfigured.</li>
            <li>Clear local preferences and cached reports in Settings.</li>
            <li>Self-host the API and control storage, logs, retention and network egress.</li>
          </ul>
        </PrivacySection>

        <PrivacySection title="Security and abuse controls">
          <p style={{ margin: "0 0 8px" }}>
            Outbound fetches are validated before every connection and every redirect: scheme
            restrictions, DNS resolution and public-IP validation, DNS pinning, hostname and port
            restrictions, response and time limits, and no cookie or credential forwarding. The API
            applies request size limits, rate limits, request IDs, schema validation and security
            headers. Public share tokens are random and revocable.
          </p>
          <p style={{ margin: 0 }}>
            No system is perfectly secure. If you discover a vulnerability in a deployment, report
            it to that deployment's operator through their published security contact. This
            repository does not fabricate a contact address.
          </p>
        </PrivacySection>

        <PrivacySection title="Changes and scope">
          <p style={{ margin: 0 }}>
            This policy applies to the VibeTrace web application and bundled Chrome extension in
            this repository. Third-party services configured by an operator — including AI providers
            and database hosting — have their own policies. Material changes to this policy should
            be reflected in the repository history and the “updated” date above.
          </p>
        </PrivacySection>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 24 }}>
          <Link to="/methodology" className="vt-button vt-button--secondary vt-button--sm">
            <ArrowLeft size={13} aria-hidden="true" /> Read the methodology
          </Link>
          <Link to="/settings" className="vt-button vt-button--ghost vt-button--sm">
            Manage local preferences
          </Link>
        </div>
      </div>
    </div>
  );
}
