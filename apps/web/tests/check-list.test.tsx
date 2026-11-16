/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { CheckResult, SectionReport } from "@vibetrace/shared-types";
import { CheckList, SectionMethodology } from "../src/components/report/CheckList.js";

afterEach(cleanup);

function check(partial: Partial<CheckResult> & Pick<CheckResult, "id" | "status">): CheckResult {
  return {
    title: partial.id,
    category: "security",
    basis: "measured",
    weight: 10,
    detail: "Fixture detail",
    evidence: [],
    ...partial,
  };
}

const section: SectionReport = {
  id: "security",
  title: "Security",
  summary: "Passive security observations.",
  score: {
    score: 50,
    grade: "F",
    coverage: 100,
    earned: 10,
    possible: 20,
    explanation: "Two measured checks.",
    methodology: ["Weights are fixed."],
    missing: ["Response headers"],
    checks: [
      check({
        id: "CSP present",
        status: "pass",
        evidence: ["content-security-policy: default-src 'self'"],
      }),
      check({
        id: "Missing HSTS",
        status: "fail",
        detail: "Strict-Transport-Security was not observed.",
        evidence: ["strict-transport-security: absent"],
        recommendation: "Serve HSTS on HTTPS responses.",
      }),
    ],
  },
  metrics: [],
  limitations: ["Header checks are passive."],
};

describe("CheckList", () => {
  it("renders checks with status, weight and evidence", () => {
    render(<CheckList section={section} showFilters />);
    expect(screen.getByText("Checks & evidence")).toBeInTheDocument();
    expect(screen.getByText("CSP present")).toBeInTheDocument();
    expect(screen.getByText("Missing HSTS")).toBeInTheDocument();
    expect(screen.getAllByText("Pass").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Fail").length).toBeGreaterThan(0);
    expect(screen.getByText("content-security-policy: default-src 'self'")).toBeInTheDocument();
    expect(screen.getByText("Serve HSTS on HTTPS responses.")).toBeInTheDocument();
  });

  it("filters checks without fabricating results", () => {
    render(<CheckList section={section} showFilters initialFilter="all" />);
    fireEvent.click(screen.getByRole("button", { name: /Fail 1/i }));
    expect(screen.queryByText("CSP present")).not.toBeInTheDocument();
    expect(screen.getByText("Missing HSTS")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Unavailable 0/i }));
    expect(screen.getByText("No checks match this filter")).toBeInTheDocument();
  });
});

describe("SectionMethodology", () => {
  it("shows coverage methodology, missing data and limitations", () => {
    render(<SectionMethodology section={section} />);
    expect(screen.getByText(/Methodology, coverage & missing data/)).toBeInTheDocument();
    expect(screen.getByText("Two measured checks.")).toBeInTheDocument();
    expect(screen.getByText("Response headers")).toBeInTheDocument();
    expect(screen.getByText("Header checks are passive.")).toBeInTheDocument();
  });
});
