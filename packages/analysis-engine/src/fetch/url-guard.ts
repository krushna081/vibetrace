import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import ipaddr from "ipaddr.js";
import { ScanError } from "./errors.js";

export interface ResolvedAddress {
  address: string;
  family: 4 | 6;
}

export type HostResolver = (hostname: string) => Promise<ResolvedAddress[]>;

export interface ValidatedTarget {
  url: URL;
  hostname: string;
  port: number;
  protocol: "http:" | "https:";
  addresses: ResolvedAddress[];
  pinned: ResolvedAddress;
}

export interface ValidateUrlOptions {
  resolver?: HostResolver;
  allowedPorts?: number[];
}

export const DEFAULT_ALLOWED_PORTS = [80, 443];

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "localhost.localdomain",
  "ip6-localhost",
  "ip6-loopback",
  "metadata",
  "metadata.google.internal",
  "metadata.goog",
  "instance-data",
  "kubernetes",
  "kubernetes.default",
  "kubernetes.default.svc",
]);

const BLOCKED_HOST_SUFFIXES = [
  ".localhost",
  ".local",
  ".internal",
  ".intranet",
  ".lan",
  ".home.arpa",
  ".corp",
  ".localdomain",
];

const EXPLICIT_BLOCKED_ADDRESSES = new Set([
  "169.254.169.254",
  "169.254.170.2",
  "100.100.100.200",
  "192.0.0.192",
  "168.63.129.16",
  "fd00:ec2::254",
]);

export const defaultResolver: HostResolver = async (hostname) => {
  const rows = await lookup(hostname, { all: true, verbatim: true });
  return rows.map((row) => ({
    address: row.address,
    family: row.family === 6 ? 6 : 4,
  }));
};

/**
 * Only globally routable unicast addresses are allowed. IPv4-mapped IPv6
 * addresses are unwrapped first. NAT64, 6to4 and Teredo prefixes are rejected
 * because they can be used to smuggle non-public IPv4 destinations.
 */
export function isPublicAddress(rawAddress: string): boolean {
  let address: ipaddr.IPv4 | ipaddr.IPv6;
  try {
    address = ipaddr.parse(rawAddress);
  } catch {
    return false;
  }

  const parsed: ipaddr.IPv4 | ipaddr.IPv6 = address;
  const unwrapped: ipaddr.IPv4 | ipaddr.IPv6 =
    parsed.kind() === "ipv6" && (parsed as ipaddr.IPv6).isIPv4MappedAddress()
      ? (parsed as ipaddr.IPv6).toIPv4Address()
      : parsed;

  const normalized = unwrapped.toNormalizedString().toLowerCase();
  if (EXPLICIT_BLOCKED_ADDRESSES.has(normalized)) return false;

  if (unwrapped.kind() === "ipv6") {
    if (
      normalized.startsWith("64:ff9b:") ||
      normalized.startsWith("2002:") ||
      normalized.startsWith("2001:0")
    ) {
      return false;
    }
  }

  if (unwrapped.range() !== "unicast") return false;

  if (unwrapped.kind() === "ipv4") {
    const [a, b] = (unwrapped as ipaddr.IPv4).octets;
    // Documentation, benchmarking, "this network" and other special ranges.
    if (a === 0 || a === 10 || a === 127) return false;
    if (a === 100 && b >= 64 && b <= 127) return false;
    if (a === 169 && b === 254) return false;
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 192 && b === 168) return false;
    if (a === 192 && b === 0) return false;
    if (a === 198 && (b === 18 || b === 19)) return false;
    if (a === 198 && b === 51) return false;
    if (a === 203 && b === 0) return false;
    if (a >= 224) return false;
  }

  return true;
}

export function isBlockedHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  if (!host) return true;
  if (host.includes("%")) return true;
  if (BLOCKED_HOSTNAMES.has(host)) return true;
  if (BLOCKED_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix))) return true;
  if (!host.includes(".") && isIP(host) === 0) return true;
  return false;
}

function normalizePort(url: URL): number {
  if (url.port) return Number(url.port);
  return url.protocol === "https:" ? 443 : 80;
}

/**
 * Validate a candidate URL, resolve it once, reject every non-public address,
 * and return a pinned address for the actual connection. This is intended to
 * be called again for every redirect hop.
 */
export async function validateTargetUrl(
  input: string | URL,
  options: ValidateUrlOptions = {},
): Promise<ValidatedTarget> {
  let url: URL;
  try {
    url = typeof input === "string" ? new URL(input) : new URL(input.toString());
  } catch {
    throw new ScanError("INVALID_URL");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new ScanError("UNSUPPORTED_PROTOCOL");
  }
  if (url.username || url.password) {
    throw new ScanError("CREDENTIALS_NOT_ALLOWED");
  }
  if (url.toString().length > 2048) {
    throw new ScanError("INVALID_URL", "URL exceeds maximum length");
  }

  const rawHostname = url.hostname.toLowerCase().replace(/\.$/, "");
  const hostname =
    rawHostname.startsWith("[") && rawHostname.endsWith("]")
      ? rawHostname.slice(1, -1)
      : rawHostname;
  if (!hostname || hostname.length > 253) throw new ScanError("INVALID_URL");

  const allowedPorts = options.allowedPorts ?? DEFAULT_ALLOWED_PORTS;
  const port = normalizePort(url);
  if (!Number.isInteger(port) || !allowedPorts.includes(port)) {
    throw new ScanError("BLOCKED_PORT");
  }

  let addresses: ResolvedAddress[];
  const literalFamily = isIP(hostname);

  if (literalFamily > 0) {
    addresses = [{ address: hostname, family: literalFamily === 6 ? 6 : 4 }];
  } else {
    if (isBlockedHostname(hostname)) throw new ScanError("BLOCKED_HOSTNAME");
    try {
      const resolver = options.resolver ?? defaultResolver;
      addresses = await resolver(hostname);
    } catch (error) {
      throw new ScanError("DNS_RESOLUTION_FAILED", "DNS lookup failed", error);
    }
  }

  if (addresses.length === 0) {
    throw new ScanError("DNS_RESOLUTION_FAILED", "DNS returned no addresses");
  }

  for (const row of addresses) {
    if (!isPublicAddress(row.address)) {
      throw new ScanError("BLOCKED_ADDRESS", `Blocked non-public address for ${hostname}`);
    }
  }

  const pinned = addresses.find((row) => row.family === 4) ?? addresses[0]!;
  return {
    url,
    hostname,
    port,
    protocol: url.protocol,
    addresses,
    pinned,
  };
}

/**
 * A custom DNS lookup used by the outbound connector. It always returns the
 * already-validated, pinned address, so a second malicious DNS answer cannot
 * redirect the TCP connection to an internal host (DNS rebinding).
 */
export function createPinnedLookup(pinned: ResolvedAddress) {
  return (
    _hostname: string,
    options: { all?: boolean } | number,
    callback: (...args: unknown[]) => void,
  ) => {
    if (typeof options === "object" && options?.all) {
      callback(null, [{ address: pinned.address, family: pinned.family }]);
      return;
    }
    callback(null, pinned.address, pinned.family);
  };
}
