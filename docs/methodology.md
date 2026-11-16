# Scoring methodology

VibeTrace reports **seven independent lenses**, not a composite score. A single “website quality” number would hide missing evidence and imply comparability that does not exist. The report shows each category with its own checks, coverage, explanation, methodology and missing evidence.

| Lens                  | Kind                 | What it summarizes                                                          |
| --------------------- | -------------------- | --------------------------------------------------------------------------- |
| Security              | Weighted checks      | Passive HTTPS, header, cookie, mixed-content and exposure observations      |
| Performance           | Weighted checks      | Measured fetch timings, transfer sizes and available navigation timing      |
| Accessibility         | Weighted checks      | Detectable static-markup issues only                                        |
| SEO                   | Weighted checks      | Indexable metadata, heading structure, crawl hints and structured data      |
| Code quality          | Weighted checks      | Static structure, maintainability and source hygiene signals                |
| Technology confidence | Detection confidence | Confidence in detected frontend technologies                                |
| AI signals            | Evidence index       | Builder-specific, source-pattern and circumstantial AI-development evidence |

## Weighted category scores

Each check has a fixed weight and a status:

- **Pass** earns 100% of its weight.
- **Warning** earns 50%.
- **Failure** earns 0%.
- **Unavailable** earns 0% and is tracked as missing evidence.
- **Info** does not affect the score.

For each category:

```text
score    = round(earned / availableWeight × 100)
coverage = availableWeight / allScoredWeight × 100
```

`availableWeight` contains pass, warning and failure checks. `allScoredWeight` adds unavailable checks. A category with no scored checks has `score: null` and grade `null`.

If **coverage is below 40%**, the score is withheld and the UI shows `—`. This is deliberate: a perfect score from one check is not a reliable category result. The report shows missing evidence and the methodology instead of imputing values.

Grades:

| Grade | Minimum score |
| ----- | ------------- |
| A     | 90            |
| B     | 80            |
| C     | 70            |
| D     | 60            |
| E     | 50            |
| F     | 0             |

Grades are only assigned when a numeric score exists. Coverage is displayed alongside every category; a grade without coverage is incomplete context.

## Technology confidence

A technology detection is built from one or more weighted evidence items (headers, HTML patterns, script URLs, class signatures, meta tags, etc.). Each detection gets:

```text
confidence = round(min(98, 100 × (1 − e^(−Σ evidence weights / 38))))
```

Independent strong evidence raises confidence more than a single weak pattern. The cap of 98 acknowledges that fingerprints can collide.

The aggregate technology-confidence lens is the arithmetic mean of detected technology confidences. Its coverage is the share of detections with confidence of at least 50. If no technology is detected, the aggregate is unavailable rather than 0.

## AI-development signal index

The index is an **evidence summary**, not a probability and not authorship detection. Positive evidence falls into three categories:

- **Builder-specific** — artifacts closely associated with particular AI site builders or generated scaffolds.
- **Source-pattern** — structural or code-organization patterns commonly observed in AI-assisted builds.
- **Circumstantial** — weaker supporting signals that may have other explanations.

The adjusted index is:

```text
adjusted = max(0, Σ positive weights − 0.5 × Σ contradictory weights)
```

Classification:

| Classification | Rule                                                                       |
| -------------- | -------------------------------------------------------------------------- |
| Strong         | Adjusted index ≥ 40 **and** at least one strong builder-specific indicator |
| Moderate       | Adjusted index ≥ 24                                                        |
| Weak           | Adjusted index ≥ 7                                                         |
| Insufficient   | Adjusted index < 7 or not enough evidence                                  |
| Mixed          | Contradictory weight ≥ 75% of positive weight, overriding the above        |

Evidence is shown with its category, weight, source, observation and explanation. Contradictions are shown separately. The index is explicitly **uncalibrated**: it is not trained on a labelled corpus and cannot be interpreted as “72% likely AI-generated.” Absence of signals is not evidence of absence.

The report also lists limitations that depend on mode. For example, snapshot reports cannot observe server headers or external bundles, so those checks are unavailable rather than marked as failures.

## Security checks

Security checks are passive observations:

- HTTPS and redirect behavior
- response headers such as HSTS, CSP, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` and framing protections
- cookie flags (`Secure`, `HttpOnly`, `SameSite`) when headers are available
- mixed-content URLs in the page
- source-map exposure and other publicly visible artifacts

They are **not vulnerability tests**. A passing check does not mean the site is secure; a warning does not establish exploitability. Manual review and dedicated scanners are still required.

## Performance checks

Performance uses measurements that actually exist:

- server-side fetch timing and time to first byte
- HTML/asset transfer sizes
- resource counts
- navigation timing supplied by the extension snapshot, where available
- optional bounded asset probes

No synthetic Lighthouse score is invented. Browser-only behavior and full Core Web Vitals cannot be measured without a browser, so unavailable metrics stay unavailable. A remote scan may show fewer performance checks than a snapshot that includes navigation timing.

## Accessibility checks

Static markup can reveal:

- missing image alternatives
- unlabeled form controls
- unnamed buttons and links
- heading structure problems
- duplicate IDs
- document language
- semantic landmarks

Static markup cannot establish contrast, keyboard operability, focus order, screen-reader output or dynamic behavior. Those are not scored. A good accessibility score is therefore a limited statement about detectable markup, not a conformance claim.

## SEO checks

Checks cover:

- title and description metadata
- canonical URL
- robots directives and viewport
- heading structure
- language
- structured data presence
- `robots.txt` and sitemap availability probes
- indexability hints

Robots/sitemap checks are single-request availability observations, not full crawl validation. VibeTrace does not crawl the site or test every URL.

## Code quality checks

Code-quality checks summarize observable frontend structure and hygiene: document structure, script/style usage, inline content, source-map availability, duplicate IDs, semantic elements and framework artifacts. They do not execute page JavaScript, lint third-party bundles, or judge architecture hidden behind a build.

## Recommendations and limitations

Recommendations are generated from observed checks and evidence. They describe a concrete action and the evidence that triggered it. They do not claim a fix will produce a particular score.

Every report carries limitations, including mode-specific ones. Read them together with scores and coverage. When the platform says “unavailable,” it means the evidence was not observable — not that the site passed or failed.

## Reproducibility

The engine is deterministic for the same input snapshot or fetched material. Remote timings and site content can change between scans, so comparisons show movement but not statistical significance. Comparison does not imply causation.
