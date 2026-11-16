export { analyzeWebsite, ENGINE_VERSION } from "./analyze.js";
export { safeFetch } from "./fetch/safe-fetch.js";
export type {
  SafeFetchResult,
  SafeFetchOptions,
  SafeFetchImplementation,
} from "./fetch/safe-fetch.js";
export { ScanError, toScanError } from "./fetch/errors.js";
export type { ScanErrorCode } from "./fetch/errors.js";
export {
  validateTargetUrl,
  isPublicAddress,
  isBlockedHostname,
  createPinnedLookup,
  defaultResolver,
  DEFAULT_ALLOWED_PORTS,
} from "./fetch/url-guard.js";
export type { HostResolver, ResolvedAddress, ValidatedTarget } from "./fetch/url-guard.js";
export {
  detectTechnologies,
  technologyRegistryMetadata,
  TECHNOLOGY_REGISTRY,
} from "./fingerprints/technologies.js";
export {
  detectAISignals,
  fingerprintRegistryMetadata,
  AI_FINGERPRINT_REGISTRY,
  BUILDER_DEFINITIONS,
} from "./fingerprints/ai.js";
export { extractDocumentFacts } from "./document.js";
export { buildSnapshotHtml, mergeSnapshotFacts } from "./snapshot.js";
export type {
  AnalyzerContext,
  AnalyzeInput,
  AnalyzeOptions,
  AssetProbe,
  ProbeSummary,
  SeoProbe,
} from "./types.js";
