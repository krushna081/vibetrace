import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { buildFixtureSnapshot } from "../packages/analysis-engine/tests/fixtures.js";

const API_BASE = process.env.E2E_API_URL ?? "http://127.0.0.1:8787/api/v1";
const API_ORIGIN = new URL(API_BASE).origin;

async function createCompletedScan(
  request: APIRequestContext,
  overrides: { title?: string; generator?: string } = {},
): Promise<{ id: string; token?: string }> {
  const payload = buildFixtureSnapshot();
  if (overrides.title) payload.title = overrides.title;
  if (overrides.generator) payload.meta.generator = overrides.generator;
  const create = await request.post(`${API_BASE}/scans`, {
    data: {
      url: payload.url,
      mode: "snapshot",
      client: "extension",
      snapshot: payload,
    },
  });
  expect(create.status()).toBe(202);
  const created = (await create.json()) as { data: { id: string } };

  for (let attempt = 0; attempt < 120; attempt += 1) {
    const status = await request.get(`${API_BASE}/scans/${created.data.id}/status`);
    const body = (await status.json()) as { data: { status: string } };
    if (body.data.status === "completed" || body.data.status === "partially_completed") {
      return { id: created.data.id };
    }
    if (body.data.status === "failed") {
      throw new Error(`Fixture scan failed: ${JSON.stringify(body)}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error("Fixture scan did not finish in time");
}

async function configureApi(page: Page): Promise<void> {
  await page.addInitScript(
    ({ apiBaseUrl }) => {
      localStorage.setItem(
        "vibetrace:settings",
        JSON.stringify({ theme: "dark", apiBaseUrl, aiConsent: false }),
      );
    },
    { apiBaseUrl: API_ORIGIN },
  );
}

test.describe("VibeTrace web app", () => {
  test("landing page, navigation and honest empty validation", async ({ page }) => {
    await configureApi(page);
    await page.goto("/");

    await expect(page.getByRole("heading", { level: 1 })).toContainText(/Read the signals/i);
    await expect(page.getByText("AI development signals").first()).toBeVisible();
    await expect(page.getByRole("link", { name: /Methodology/i }).first()).toBeVisible();

    await page.goto("/scan");
    await expect(page.getByRole("heading", { name: /Analyze a public website/i })).toBeVisible();
    await page.getByRole("button", { name: /Analyze site/i }).click();
    await expect(page.getByText(/valid public website URL/i)).toBeVisible();

    await page.goto("/methodology");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/Methodology/i);
    await expect(page.getByText(/not a probability/i).first()).toBeVisible();
  });

  test("renders a real snapshot report, downloads JSON, prints and shares", async ({
    page,
    request,
  }) => {
    await configureApi(page);
    const { id } = await createCompletedScan(request, {
      title: "Atlas Workspace — AI product console",
    });

    await page.goto(`/scan/${id}`);
    await expect(page.getByRole("heading", { name: /Atlas Workspace/i })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText(/Strong AI-assisted development signals/i).first()).toBeVisible();
    await expect(page.getByText(/not a probability/i).first()).toBeVisible();
    await expect(page.getByText("Key findings")).toBeVisible();
    await expect(page.getByText("Source profile")).toBeVisible();
    await expect(page.getByText(/Raw HTML is not included/i)).toBeVisible();

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: /^JSON$/ }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^vibetrace-fixture-example-[a-f0-9]{8}\.json$/);

    const printPagePromise = page.context().waitForEvent("page");
    await page.getByRole("button", { name: /PDF \/ print/i }).click();
    const printPage = await printPagePromise;
    await expect(printPage.getByText(/VIBETRACE · WEBSITE FORENSICS/i)).toBeVisible({
      timeout: 20_000,
    });
    await printPage.close();

    await page.getByRole("button", { name: /^Share$/ }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("button", { name: /Revoke link/i })).toBeVisible({
      timeout: 15_000,
    });
    await page.keyboard.press("Escape");

    await page
      .getByRole("link", { name: /AI signals/i })
      .first()
      .click();
    await expect(page).toHaveURL(/\/scan\/[^/]+\/ai$/);
    await expect(page.getByText(/Supporting evidence/i).first()).toBeVisible();
    await expect(page.getByText(/not a calibrated probability/i).first()).toBeVisible();
  });

  test("compares two stored reports and opens a revocable shared report", async ({
    page,
    request,
  }) => {
    await configureApi(page);
    const first = await createCompletedScan(request);
    const second = await createCompletedScan(request);

    await page.goto(`/compare?a=${first.id}&b=${second.id}`);
    await expect(page.getByRole("heading", { name: /Compare scans/i })).toBeVisible();
    await expect(page.getByText(/AI signals/i).first()).toBeVisible({ timeout: 20_000 });

    const share = await request.post(`${API_BASE}/scans/${first.id}/share`);
    expect(share.status()).toBe(200);
    const shareBody = (await share.json()) as { data: { token: string; path: string } };

    await page.goto(`/shared/${shareBody.data.token}`);
    await expect(page.getByRole("heading", { name: /Atlas Workspace/i })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText(/read only/i).first()).toBeVisible();

    const revoke = await request.delete(`${API_BASE}/scans/${first.id}/share`);
    expect(revoke.status()).toBe(204);
    await page.reload();
    await expect(
      page.getByText(/Shared report unavailable|no longer available|not found/i).first(),
    ).toBeVisible({
      timeout: 15_000,
    });

    await page.goto(`/scan/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa`);
    await expect(page.getByText(/not found|unable to load/i).first()).toBeVisible({
      timeout: 20_000,
    });
  });
});
