import { describe, expect, it } from "vitest";
import {
  formatBytes,
  formatDuration,
  hostnameOf,
  normalizeUrlInput,
  pathOf,
  percent,
  titleCase,
} from "../src/lib/format.js";
import { slugify } from "../src/lib/export.js";

describe("URL input normalization", () => {
  it("adds https to bare hostnames", () => {
    expect(normalizeUrlInput("example.com")).toBe("https://example.com/");
    expect(normalizeUrlInput("  example.com/path?q=1 ")).toBe("https://example.com/path?q=1");
  });

  it("keeps explicit http and https URLs", () => {
    expect(normalizeUrlInput("http://example.com/")).toBe("http://example.com/");
    expect(normalizeUrlInput("https://example.com/a")).toBe("https://example.com/a");
  });

  it("rejects unsupported protocols and malformed hosts", () => {
    expect(normalizeUrlInput("javascript:alert(1)")).toBeNull();
    expect(normalizeUrlInput("file:///etc/passwd")).toBeNull();
    expect(normalizeUrlInput("not a url")).toBeNull();
    expect(normalizeUrlInput("")).toBeNull();
  });
});

describe("formatting helpers", () => {
  it("formats durations with honest precision", () => {
    expect(formatDuration(null)).toBe("—");
    expect(formatDuration(0)).toBe("0 ms");
    expect(formatDuration(940)).toBe("940 ms");
    expect(formatDuration(1_500)).toBe("1.5 s");
    expect(formatDuration(42_000)).toBe("42 s");
    expect(formatDuration(61_000)).toBe("1m 1s");
  });

  it("formats byte sizes", () => {
    expect(formatBytes(null)).toBe("—");
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(1_536)).toBe("1.5 KB");
    expect(formatBytes(1_572_864)).toBe("1.50 MB");
  });

  it("extracts hostnames and paths without credentials", () => {
    expect(hostnameOf("https://www.example.com/a?b=1")).toBe("example.com");
    expect(hostnameOf("nonsense")).toBe("nonsense");
    expect(pathOf("https://example.com/a?b=1#c")).toBe("/a?b=1");
  });

  it("never turns a missing value into a fake number", () => {
    expect(percent(null)).toBe("—");
    expect(percent(49.6)).toBe("50%");
  });

  it("title-cases snake and kebab values", () => {
    expect(titleCase("code_quality")).toBe("Code Quality");
    expect(titleCase("partially-completed")).toBe("Partially Completed");
  });
});

describe("export naming", () => {
  it("produces filesystem-safe slugs", () => {
    expect(slugify("Example.COM — Home")).toBe("example-com-home");
    expect(slugify("  ")).toBe("");
    expect(slugify("a".repeat(90))).toHaveLength(60);
  });
});
