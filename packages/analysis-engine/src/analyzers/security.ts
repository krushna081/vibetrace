import type { CategoryScore, Metric, SectionReport } from "@vibetrace/shared-types";
import { buildCategoryScore, SCORE_METHODOLOGIES } from "@vibetrace/scoring-engine";
import type { AnalyzerContext } from "../types.js";
import { check, metric, serviceSummary, unavailable } from "./helpers.js";

const SECURITY_HEADERS = [
  "strict-transport-security",
  "content-security-policy",
  "x-content-type-options",
  "referrer-policy",
  "permissions-policy",
  "x-frame-options",
  "cross-origin-opener-policy",
];

interface SecretPattern {
  id: string;
  label: string;
  pattern: RegExp;
  severity: "high" | "medium";
}

const SECRET_PATTERNS: SecretPattern[] = [
  {
    id: "aws-access-key",
    label: "AWS access-key-like value",
    pattern: /AKIA[0-9A-Z]{16}/g,
    severity: "high",
  },
  {
    id: "stripe-secret",
    label: "Stripe secret-key-like value",
    pattern: /sk_live_[A-Za-z0-9]{16,}/g,
    severity: "high",
  },
  {
    id: "github-token",
    label: "GitHub token-like value",
    pattern: /ghp_[A-Za-z0-9]{30,}/g,
    severity: "high",
  },
  {
    id: "slack-token",
    label: "Slack token-like value",
    pattern: /xox[baprs]-[A-Za-z0-9-]{20,}/g,
    severity: "high",
  },
  {
    id: "private-key",
    label: "Private-key block",
    pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g,
    severity: "high",
  },
  {
    id: "openai-key",
    label: "OpenAI-style API key",
    pattern: /sk-(?:proj-)?[A-Za-z0-9_-]{32,}/g,
    severity: "high",
  },
  {
    id: "google-api-key",
    label: "Google API-key-like value",
    pattern: /AIza[0-9A-Za-z_-]{35}/g,
    severity: "medium",
  },
  {
    id: "generic-secret",
    label: "Secret-like assignment",
    pattern:
      /(?:api[_-]?key|api[_-]?secret|client[_-]?secret|access[_-]?token)\s*[:=]\s*["'][A-Za-z0-9_\-./]{24,}["']/gi,
    severity: "medium",
  },
];

function safeResource(value: string): string {
  try {
    const url = new URL(value);
    return `${url.origin}${url.pathname}`;
  } catch {
    return value.slice(0, 180);
  }
}

function headerValue(context: AnalyzerContext, name: string): string {
  return context.response.headers[name.toLowerCase()] ?? "";
}

function scanForSecrets(
  text: string,
): { id: string; label: string; count: number; severity: string }[] {
  const findings: { id: string; label: string; count: number; severity: string }[] = [];
  for (const candidate of SECRET_PATTERNS) {
    candidate.pattern.lastIndex = 0;
    const matches = text.match(candidate.pattern);
    if (matches && matches.length > 0) {
      findings.push({
        id: candidate.id,
        label: candidate.label,
        count: matches.length,
        severity: candidate.severity,
      });
    }
  }
  return findings;
}

export function analyzeSecurity(context: AnalyzerContext): {
  section: SectionReport;
  score: CategoryScore;
} {
  const checks = [];
  const isHttps = context.finalUrl.startsWith("https://");
  const headersAvailable = context.response.headersAvailable;
  const https = isHttps;

  checks.push(
    check({
      id: "https",
      title: "HTTPS transport",
      category: "security",
      status: https ? "pass" : "fail",
      weight: 18,
      detail: https
        ? "The final analyzed URL uses HTTPS."
        : "The final analyzed URL was served over plain HTTP. All content is observable and modifiable in transit.",
      evidence: [context.finalUrl],
      recommendation: https
        ? undefined
        : "Serve the site exclusively over HTTPS and redirect all HTTP requests to the HTTPS origin.",
    }),
  );

  const hsts = headerValue(context, "strict-transport-security");
  if (!headersAvailable) {
    checks.push(
      unavailable(
        "hsts",
        "HTTP Strict Transport Security",
        "security",
        8,
        "Response headers are not available in snapshot mode.",
        "Run a server-side URL scan to inspect HSTS.",
      ),
    );
  } else if (!https) {
    checks.push(
      unavailable(
        "hsts",
        "HTTP Strict Transport Security",
        "security",
        8,
        "HSTS cannot apply to an HTTP page.",
        "Move the site to HTTPS, then enable HSTS.",
      ),
    );
  } else {
    const maxAge = /max-age\s*=\s*(\d+)/i.exec(hsts)?.[1];
    const seconds = maxAge ? Number(maxAge) : 0;
    checks.push(
      check({
        id: "hsts",
        title: "HTTP Strict Transport Security",
        category: "security",
        status: hsts && seconds >= 15_552_000 ? "pass" : "warn",
        weight: 8,
        detail: hsts
          ? `HSTS is present with max-age=${seconds}${/includeSubDomains/i.test(hsts) ? " and includeSubDomains" : ""}.`
          : "No Strict-Transport-Security response header was observed.",
        evidence: hsts ? [hsts.slice(0, 300)] : ["Header absent"],
        recommendation:
          hsts && seconds >= 15_552_000
            ? undefined
            : "After confirming HTTPS coverage, send Strict-Transport-Security with max-age of at least 15552000 seconds.",
      }),
    );
  }

  const cspHeader = headerValue(context, "content-security-policy");
  const cspMeta = context.facts.meta["content-security-policy"] ?? "";
  const csp = cspHeader || cspMeta;
  const cspUnsafe = /unsafe-inline|unsafe-eval/i.test(csp);
  checks.push(
    check({
      id: "csp",
      title: "Content Security Policy",
      category: "security",
      status: !csp ? (headersAvailable ? "fail" : "warn") : cspUnsafe ? "warn" : "pass",
      weight: 15,
      detail: csp
        ? `A Content-Security-Policy is present${cspHeader ? " as a response header" : " via a meta tag"}${cspUnsafe ? " but permits unsafe-inline or unsafe-eval" : ""}.`
        : headersAvailable
          ? "No Content-Security-Policy response header or meta policy was observed."
          : "No meta Content-Security-Policy was observed; response headers are unavailable in snapshot mode.",
      evidence: csp ? [csp.slice(0, 500)] : ["Policy absent"],
      recommendation: csp
        ? cspUnsafe
          ? "Progressively remove unsafe-inline and unsafe-eval using nonces or hashes, starting in report-only mode."
          : undefined
        : "Define a restrictive Content-Security-Policy. Start in report-only mode, then enforce it after reviewing violations.",
    }),
  );

  const nosniff = headerValue(context, "x-content-type-options").toLowerCase().includes("nosniff");
  if (!headersAvailable) {
    checks.push(
      unavailable(
        "nosniff",
        "X-Content-Type-Options",
        "security",
        7,
        "Response headers are not available in snapshot mode.",
      ),
    );
  } else {
    checks.push(
      check({
        id: "nosniff",
        title: "X-Content-Type-Options",
        category: "security",
        status: nosniff ? "pass" : "warn",
        weight: 7,
        detail: nosniff
          ? "The response uses X-Content-Type-Options: nosniff."
          : "X-Content-Type-Options: nosniff was not observed.",
        recommendation: nosniff
          ? undefined
          : "Send X-Content-Type-Options: nosniff on all responses.",
      }),
    );
  }

  const referrer = headerValue(context, "referrer-policy");
  if (!headersAvailable) {
    checks.push(
      unavailable(
        "referrer-policy",
        "Referrer-Policy",
        "security",
        6,
        "Response headers are not available in snapshot mode.",
      ),
    );
  } else {
    checks.push(
      check({
        id: "referrer-policy",
        title: "Referrer-Policy",
        category: "security",
        status: !referrer ? "warn" : /unsafe-url/i.test(referrer) ? "fail" : "pass",
        weight: 6,
        detail: referrer
          ? `Referrer-Policy is set to ${referrer.slice(0, 120)}.`
          : "No Referrer-Policy header was observed.",
        recommendation: referrer
          ? /unsafe-url/i.test(referrer)
            ? "Replace unsafe-url with strict-origin-when-cross-origin or a stricter policy."
            : undefined
          : "Set Referrer-Policy to strict-origin-when-cross-origin or stricter.",
      }),
    );
  }

  const permissions = headerValue(context, "permissions-policy");
  if (!headersAvailable) {
    checks.push(
      unavailable(
        "permissions-policy",
        "Permissions-Policy",
        "security",
        5,
        "Response headers are not available in snapshot mode.",
      ),
    );
  } else {
    checks.push(
      check({
        id: "permissions-policy",
        title: "Permissions-Policy",
        category: "security",
        status: permissions ? "pass" : "warn",
        weight: 5,
        detail: permissions
          ? "A Permissions-Policy response header is present."
          : "No Permissions-Policy header was observed. Unused powerful browser features may remain available.",
        evidence: permissions ? [permissions.slice(0, 400)] : ["Header absent"],
        recommendation: permissions
          ? undefined
          : "Add Permissions-Policy and disable camera, microphone, geolocation and other features the site does not require.",
      }),
    );
  }

  const frameOptions = headerValue(context, "x-frame-options");
  const frameAncestors = /frame-ancestors\s+([^;]+)/i.exec(cspHeader)?.[1]?.trim() ?? "";
  if (!headersAvailable) {
    checks.push(
      unavailable(
        "clickjacking",
        "Frame embedding protection",
        "security",
        7,
        "Frame protections are delivered by response headers; headers are not available in snapshot mode.",
      ),
    );
  } else {
    const protectedFrame = Boolean(frameOptions) || Boolean(frameAncestors);
    checks.push(
      check({
        id: "clickjacking",
        title: "Frame embedding protection",
        category: "security",
        status: protectedFrame ? "pass" : "warn",
        weight: 7,
        detail: protectedFrame
          ? `Frame embedding is restricted by ${frameOptions ? "X-Frame-Options" : "CSP frame-ancestors"}.`
          : "Neither X-Frame-Options nor CSP frame-ancestors was observed.",
        recommendation: protectedFrame
          ? undefined
          : "Set CSP frame-ancestors 'none' or X-Frame-Options DENY unless embedding is required.",
      }),
    );
  }

  const mixedResources: { url: string; active: boolean }[] = [];
  if (https) {
    const resources = [
      ...context.facts.scriptFacts
        .map((script) => script.src)
        .filter((value): value is string => Boolean(value))
        .map((url) => ({ url, active: true })),
      ...context.facts.stylesheets.map((sheet) => ({ url: sheet.href, active: true })),
      ...context.facts.images
        .map((image) => image.src)
        .filter(Boolean)
        .map((url) => ({ url, active: false })),
    ];
    for (const resource of resources) {
      try {
        if (new URL(resource.url).protocol === "http:") mixedResources.push(resource);
      } catch {
        // Ignore malformed resource URLs.
      }
    }
  }
  const activeMixed = mixedResources.filter((item) => item.active).length;
  checks.push(
    check({
      id: "mixed-content",
      title: "Mixed content",
      category: "security",
      status:
        !https || mixedResources.length === 0
          ? https
            ? "pass"
            : "unavailable"
          : activeMixed > 0
            ? "fail"
            : "warn",
      weight: 12,
      detail: !https
        ? "Mixed-content evaluation is not applicable to an HTTP page."
        : mixedResources.length === 0
          ? "No HTTP-hosted scripts, stylesheets or images were observed on the HTTPS page."
          : `${mixedResources.length} insecure HTTP resource(s) were observed; ${activeMixed} are active script or style resources.`,
      evidence: mixedResources.slice(0, 8).map((item) => safeResource(item.url)),
      recommendation:
        mixedResources.length > 0 ? "Load all scripts, styles and media over HTTPS." : undefined,
    }),
  );

  if (!headersAvailable) {
    checks.push(
      unavailable(
        "cookies",
        "Cookie transport attributes",
        "security",
        6,
        "Set-Cookie headers are intentionally not exposed to snapshot mode.",
        "Run a server-side URL scan to inspect cookie attributes without exposing cookie values.",
      ),
    );
  } else if (context.response.cookieFlags.count === 0) {
    checks.push(
      check({
        id: "cookies",
        title: "Cookie transport attributes",
        category: "security",
        status: "info",
        weight: 6,
        detail: "No Set-Cookie headers were observed on the analyzed document response.",
        recommendation:
          "If the application sets cookies on other routes, verify Secure, HttpOnly and SameSite there.",
      }),
    );
  } else {
    const flags = context.response.cookieFlags;
    const good = flags.allSecure && flags.allHttpOnly && flags.allSameSite;
    checks.push(
      check({
        id: "cookies",
        title: "Cookie transport attributes",
        category: "security",
        status: good ? "pass" : "warn",
        weight: 6,
        detail: `${flags.count} Set-Cookie header(s) observed. Secure: ${flags.count > 0 ? (flags.allSecure ? "all" : "not all") : "n/a"}; HttpOnly: ${flags.allHttpOnly ? "all" : "not all"}; SameSite: ${flags.allSameSite ? "all" : "not all"}. Cookie names and values are never stored in the report.`,
        recommendation: good
          ? undefined
          : "Set Secure, HttpOnly and an appropriate SameSite attribute on all session cookies.",
      }),
    );
  }

  const secretText = [context.facts.rawHtml, ...context.facts.inlineScriptSamples].join("\n");
  const secretFindings = scanForSecrets(secretText);
  const highSeverity = secretFindings.filter((finding) => finding.severity === "high");
  checks.push(
    check({
      id: "exposed-secrets",
      title: "Secret-like values in inline source",
      category: "security",
      status: secretFindings.length === 0 ? "pass" : highSeverity.length > 0 ? "fail" : "warn",
      weight: 8,
      basis: "heuristic",
      detail:
        secretFindings.length === 0
          ? "No high-confidence secret-like patterns were found in the inspected HTML and inline scripts. External bundles were not exhaustively secret-scanned."
          : `Suspected secret-like values were detected (${secretFindings.map((finding) => `${finding.label} ×${finding.count}`).join("; ")}). Values are redacted and never included in this report. Some matches can be intentional public browser keys.`,
      evidence:
        secretFindings.length === 0
          ? []
          : secretFindings.map(
              (finding) => `${finding.label}: suspected pattern detected (redacted)`,
            ),
      recommendation:
        secretFindings.length === 0
          ? undefined
          : "Treat suspected values as compromised until verified. Rotate real secrets, remove them from client code, and use server-side or restricted short-lived credentials.",
    }),
  );

  const server = headerValue(context, "server");
  const poweredBy = headerValue(context, "x-powered-by");
  const disclosure = [server, poweredBy].filter(Boolean).join(" | ");
  checks.push(
    check({
      id: "server-disclosure",
      title: "Server version disclosure",
      category: "security",
      status: headersAvailable ? (disclosure ? "warn" : "pass") : "unavailable",
      weight: 2,
      detail: headersAvailable
        ? disclosure
          ? `Server technology details are exposed: ${disclosure.slice(0, 160)}`
          : "No Server or X-Powered-By disclosure was observed."
        : "Response headers are unavailable in snapshot mode.",
      basis: "measured",
      recommendation: disclosure
        ? "Reduce unnecessary framework and version disclosure in Server and X-Powered-By headers."
        : undefined,
    }),
  );

  const score = buildCategoryScore({
    checks,
    explanation:
      "Security is scored from passive configuration evidence only. No exploit, authentication bypass, fuzzing or destructive test is performed.",
    methodology: [SCORE_METHODOLOGIES.security, ...SCORE_METHODOLOGIES.category.split("\n")],
    missing: headersAvailable ? [] : ["Most response-header checks unavailable in snapshot mode"],
  });

  const metrics: Metric[] = [
    metric("https", "HTTPS", isHttps ? "Yes" : "No"),
    metric("status", "Upstream HTTP status", context.response.status, {
      measured: context.response.status !== null,
      note: context.response.status === null ? "Not available for extension snapshots" : undefined,
    }),
    metric("headers-inspected", "Response headers inspected", headersAvailable ? "Yes" : "No"),
    metric("mixed-resources", "Insecure HTTP resources", mixedResources.length),
    metric(
      "cookie-headers",
      "Set-Cookie headers observed",
      headersAvailable ? context.response.cookieFlags.count : null,
      {
        measured: headersAvailable,
      },
    ),
    metric("secret-patterns", "Suspected secret-like patterns", secretFindings.length, {
      measured: true,
      note: "Values redacted. Pattern matches require manual verification.",
    }),
    ...SECURITY_HEADERS.map((name) => {
      const value = headerValue(context, name);
      return metric(
        `header-${name}`,
        name,
        headersAvailable ? (value ? "present" : "absent") : null,
        {
          measured: headersAvailable,
          note: value ? value.slice(0, 500) : undefined,
        },
      );
    }),
  ];

  const limitations = [
    "All checks are passive. A passing check does not mean the site is secure, and a failing check is not proof of exploitability.",
    "CDNs and reverse proxies can add, remove or rewrite headers; deployment-specific behavior may differ from the analyzed edge response.",
    "CSP is evaluated syntactically, not by exercising every browser execution path.",
    "Secret-like pattern matching is heuristic. Reports never include the matched values.",
    "No authenticated, private or destructive resources are accessed.",
  ];
  if (!headersAvailable) {
    limitations.push(
      "Extension snapshot mode cannot read Set-Cookie or other response headers, so several checks are marked unavailable and data coverage is lower.",
    );
  }

  const section: SectionReport = {
    id: "security",
    title: "Security configuration",
    summary: serviceSummary(score.score, "Security configuration"),
    score,
    metrics,
    limitations,
  };
  return { section, score };
}
