import { describe, expect, it, vi } from "vitest";
import { ScanError } from "../src/fetch/errors.js";
import {
  createPinnedLookup,
  isBlockedHostname,
  isPublicAddress,
  validateTargetUrl,
  type HostResolver,
} from "../src/fetch/url-guard.js";

const publicResolver: HostResolver = vi.fn(async () => [
  { address: "93.184.216.34", family: 4 as const },
  { address: "2606:2800:220:1:248:1893:25c8:1946", family: 6 as const },
]);

async function expectCode(promise: Promise<unknown>, code: string): Promise<void> {
  await expect(promise).rejects.toMatchObject({ name: "ScanError", code });
}

describe("isPublicAddress", () => {
  it.each([
    "127.0.0.1",
    "10.0.0.1",
    "172.16.4.5",
    "192.168.1.1",
    "169.254.169.254",
    "100.64.0.1",
    "198.18.0.1",
    "203.0.113.10",
    "0.0.0.0",
    "224.0.0.1",
    "::1",
    "fc00::1",
    "fe80::1",
    "::ffff:127.0.0.1",
    "64:ff9b::1",
    "2002:a00:1::",
    "2001:0:4136:e378::",
    "not-an-ip",
  ])("rejects non-public address %s", (address) => {
    expect(isPublicAddress(address)).toBe(false);
  });

  it.each(["93.184.216.34", "1.1.1.1", "2606:4700:4700::1111", "2001:4860:4860::8888"])(
    "accepts public address %s",
    (address) => {
      expect(isPublicAddress(address)).toBe(true);
    },
  );
});

describe("isBlockedHostname", () => {
  it.each([
    "localhost",
    "LOCALHOST.",
    "api.localhost",
    "service.internal",
    "printer.local",
    "metadata.google.internal",
    "router.lan",
    "single-label",
    "bad%zone.example",
  ])("blocks %s", (host) => {
    expect(isBlockedHostname(host)).toBe(true);
  });

  it("allows ordinary public hostnames", () => {
    expect(isBlockedHostname("example.com")).toBe(false);
  });
});

describe("validateTargetUrl", () => {
  it("rejects non-http protocols", async () => {
    await expectCode(validateTargetUrl("file:///etc/passwd"), "UNSUPPORTED_PROTOCOL");
    await expectCode(validateTargetUrl("ftp://example.com"), "UNSUPPORTED_PROTOCOL");
  });

  it("rejects credentials embedded in URLs", async () => {
    await expectCode(
      validateTargetUrl("https://user:secret@example.com/", { resolver: publicResolver }),
      "CREDENTIALS_NOT_ALLOWED",
    );
  });

  it("rejects loopback, private IP literals and metadata endpoints", async () => {
    await expectCode(validateTargetUrl("http://127.0.0.1/"), "BLOCKED_ADDRESS");
    await expectCode(validateTargetUrl("http://10.0.0.5/"), "BLOCKED_ADDRESS");
    await expectCode(
      validateTargetUrl("http://169.254.169.254/latest/meta-data"),
      "BLOCKED_ADDRESS",
    );
    await expectCode(validateTargetUrl("http://[::1]/"), "BLOCKED_ADDRESS");
    await expectCode(validateTargetUrl("http://[fd00::1]/"), "BLOCKED_ADDRESS");
  });

  it("rejects localhost and internal hostnames before DNS", async () => {
    const resolver = vi.fn(publicResolver);
    await expectCode(validateTargetUrl("http://localhost:80/", { resolver }), "BLOCKED_HOSTNAME");
    await expectCode(
      validateTargetUrl("http://dashboard.internal/", { resolver }),
      "BLOCKED_HOSTNAME",
    );
    expect(resolver).not.toHaveBeenCalled();
  });

  it("rejects ports outside the allowlist", async () => {
    await expectCode(
      validateTargetUrl("http://example.com:8080/", { resolver: publicResolver }),
      "BLOCKED_PORT",
    );
    await expectCode(
      validateTargetUrl("http://example.com:22/", { resolver: publicResolver }),
      "BLOCKED_PORT",
    );
  });

  it("pins a validated public address", async () => {
    const target = await validateTargetUrl("https://example.com/path?q=1", {
      resolver: publicResolver,
    });
    expect(target.hostname).toBe("example.com");
    expect(target.port).toBe(443);
    expect(target.pinned).toEqual({ address: "93.184.216.34", family: 4 });
    expect(target.addresses).toHaveLength(2);
  });

  it("rejects a DNS answer containing any private address (rebinding)", async () => {
    const mixedResolver: HostResolver = async () => [
      { address: "93.184.216.34", family: 4 },
      { address: "127.0.0.1", family: 4 },
    ];
    await expectCode(
      validateTargetUrl("https://rebind.example/", { resolver: mixedResolver }),
      "BLOCKED_ADDRESS",
    );
  });

  it("rejects a DNS failure with a safe error", async () => {
    const failingResolver: HostResolver = async () => {
      throw new Error("NXDOMAIN");
    };
    await expectCode(
      validateTargetUrl("https://missing.example/", { resolver: failingResolver }),
      "DNS_RESOLUTION_FAILED",
    );
  });

  it("supports custom allowed ports for explicitly sanctioned environments", async () => {
    const target = await validateTargetUrl("http://example.com:8443/", {
      resolver: publicResolver,
      allowedPorts: [8443],
    });
    expect(target.port).toBe(8443);
  });

  it("returns ScanError public messages rather than raw resolver data", async () => {
    try {
      await validateTargetUrl("http://127.0.0.1/");
      throw new Error("expected rejection");
    } catch (error) {
      expect(error).toBeInstanceOf(ScanError);
      expect((error as ScanError).publicMessage).toContain("public websites");
    }
  });
});

describe("createPinnedLookup", () => {
  it("returns the pinned address for both lookup call styles", () => {
    const lookup = createPinnedLookup({ address: "93.184.216.34", family: 4 });
    const single = vi.fn();
    lookup("example.com", {}, single);
    expect(single).toHaveBeenCalledWith(null, "93.184.216.34", 4);
    const multiple = vi.fn();
    lookup("example.com", { all: true }, multiple);
    expect(multiple).toHaveBeenCalledWith(null, [{ address: "93.184.216.34", family: 4 }]);
  });
});
