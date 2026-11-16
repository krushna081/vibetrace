import type { CategoryScore, Metric, SectionReport } from "@vibetrace/shared-types";
import { buildCategoryScore, SCORE_METHODOLOGIES } from "@vibetrace/scoring-engine";
import type { AnalyzerContext } from "../types.js";
import { check, metric, percent, serviceSummary, unavailable } from "./helpers.js";

export function analyzeAccessibility(context: AnalyzerContext): {
  section: SectionReport;
  score: CategoryScore;
} {
  const { facts, snapshot } = context;
  const checks = [];
  const imageCount = snapshot?.dom.imageCount ?? facts.images.length;
  const imagesWithAlt =
    snapshot?.dom.imagesWithAlt ?? facts.images.filter((image) => image.altPresent).length;
  const inputCount = snapshot?.dom.inputCount ?? facts.inputs.length;
  const labeledInputs =
    snapshot?.dom.labeledInputCount ?? facts.inputs.filter((input) => input.hasLabel).length;
  const buttonCount = snapshot?.dom.buttonCount ?? facts.buttons.length;
  const namedButtons =
    snapshot !== undefined
      ? buttonCount - snapshot.dom.unnamedButtonCount
      : facts.buttons.filter((button) => button.hasAccessibleName).length;
  const linkCount = snapshot?.dom.linkCount ?? facts.links.length;
  const namedLinks =
    snapshot !== undefined
      ? linkCount - snapshot.dom.unnamedLinkCount
      : facts.links.filter((link) => link.hasAccessibleName).length;
  const headingLevels = snapshot?.dom.headingLevels.length
    ? snapshot.dom.headingLevels
    : facts.headings.map((heading) => heading.level);
  const duplicateIds = snapshot?.dom.duplicateIds ?? facts.duplicateIds;

  checks.push(
    check({
      id: "lang",
      title: "Document language",
      category: "accessibility",
      status: facts.lang ? "pass" : "fail",
      weight: 8,
      detail: facts.lang
        ? `The document declares language "${facts.lang}", which helps screen readers select pronunciation rules.`
        : "The html element has no lang attribute.",
      recommendation: facts.lang ? undefined : "Add a valid lang attribute to the html element.",
    }),
  );

  checks.push(
    check({
      id: "image-alt",
      title: "Image text alternatives",
      category: "accessibility",
      status:
        imageCount === 0
          ? "info"
          : imagesWithAlt === imageCount
            ? "pass"
            : percent(imagesWithAlt, imageCount) >= 80
              ? "warn"
              : "fail",
      weight: 14,
      detail:
        imageCount === 0
          ? "No content images were found."
          : `${imagesWithAlt} of ${imageCount} images have an alt attribute. Empty alt is valid for decorative images; rich alt quality requires manual review.`,
      recommendation:
        imageCount > 0 && imagesWithAlt < imageCount
          ? "Add a meaningful alt attribute to informative images and an explicit empty alt to decorative images."
          : undefined,
    }),
  );

  checks.push(
    check({
      id: "form-labels",
      title: "Form input labels",
      category: "accessibility",
      status:
        inputCount === 0
          ? "info"
          : labeledInputs === inputCount
            ? "pass"
            : labeledInputs / inputCount >= 0.7
              ? "warn"
              : "fail",
      weight: 12,
      detail:
        inputCount === 0
          ? "No visible form controls were found."
          : `${labeledInputs} of ${inputCount} visible inputs have an associated label, aria-label or aria-labelledby. Placeholder text alone is not counted as a label.`,
      recommendation:
        inputCount > 0 && labeledInputs < inputCount
          ? "Associate every form control with a visible <label for> or a valid aria-label/aria-labelledby."
          : undefined,
    }),
  );

  checks.push(
    check({
      id: "button-names",
      title: "Button accessible names",
      category: "accessibility",
      status:
        buttonCount === 0
          ? "info"
          : namedButtons === buttonCount
            ? "pass"
            : percent(namedButtons, buttonCount) >= 80
              ? "warn"
              : "fail",
      weight: 10,
      detail:
        buttonCount === 0
          ? "No buttons were found."
          : `${namedButtons} of ${buttonCount} buttons have a text, aria-label or title-derived accessible name. Icon-only controls need explicit labeling.`,
      recommendation:
        buttonCount > 0 && namedButtons < buttonCount
          ? "Give icon-only buttons an accessible name with visible or aria-label text."
          : undefined,
    }),
  );

  checks.push(
    check({
      id: "link-names",
      title: "Link accessible names",
      category: "accessibility",
      status:
        linkCount === 0
          ? "info"
          : namedLinks === linkCount
            ? "pass"
            : percent(namedLinks, linkCount) >= 85
              ? "warn"
              : "fail",
      weight: 8,
      detail:
        linkCount === 0
          ? "No links were found."
          : `${namedLinks} of ${linkCount} links have discernible text, aria-label or image alt text.`,
      recommendation:
        linkCount > 0 && namedLinks < linkCount
          ? "Ensure every link has discernible text; avoid empty anchors and ambiguous 'click here' labels."
          : undefined,
    }),
  );

  let skips = 0;
  for (let index = 1; index < headingLevels.length; index += 1) {
    if (headingLevels[index]! - headingLevels[index - 1]! > 1) skips += 1;
  }
  checks.push(
    check({
      id: "heading-structure",
      title: "Heading structure",
      category: "accessibility",
      status: headingLevels.length === 0 ? "fail" : skips === 0 ? "pass" : "warn",
      weight: 8,
      basis: "heuristic",
      detail:
        headingLevels.length === 0
          ? "No headings were found, so the document has no structural outline."
          : `${headingLevels.length} heading(s) found with ${skips} skipped level(s).`,
      recommendation:
        headingLevels.length === 0 || skips > 0
          ? "Create a logical heading outline and avoid skipping levels (for example H2 directly to H4)."
          : undefined,
    }),
  );

  checks.push(
    check({
      id: "document-title",
      title: "Descriptive document title",
      category: "accessibility",
      status: !facts.title ? "fail" : facts.title.length >= 5 ? "pass" : "warn",
      weight: 5,
      detail: facts.title
        ? `The page title is "${facts.title.slice(0, 180)}".`
        : "The page has no title, which impairs orientation for assistive technology and browser tabs.",
      recommendation: facts.title ? undefined : "Add a concise, descriptive page title.",
    }),
  );

  checks.push(
    check({
      id: "duplicate-ids",
      title: "Duplicate element IDs",
      category: "accessibility",
      status: duplicateIds === 0 ? "pass" : "warn",
      weight: 4,
      detail:
        duplicateIds === 0
          ? "No duplicate element IDs were found."
          : `${duplicateIds} duplicated ID value(s) were found. Duplicate IDs can break label and ARIA references.`,
      recommendation:
        duplicateIds === 0
          ? undefined
          : "Make all element IDs unique and update associated ARIA/label references.",
    }),
  );

  if (snapshot) {
    checks.push(
      unavailable(
        "positive-tabindex",
        "Positive tabindex usage",
        "accessibility",
        4,
        "The sanitized extension snapshot does not include a reliable tabindex census.",
      ),
    );
  } else {
    checks.push(
      check({
        id: "positive-tabindex",
        title: "Positive tabindex usage",
        category: "accessibility",
        status: facts.tabindexPositive === 0 ? "pass" : "warn",
        weight: 4,
        detail:
          facts.tabindexPositive === 0
            ? "No positive tabindex values were found."
            : `${facts.tabindexPositive} element(s) use a positive tabindex, which can create an unexpected keyboard order.`,
        recommendation:
          facts.tabindexPositive === 0
            ? undefined
            : 'Prefer natural DOM order and tabindex="0" or "-1" where needed.',
      }),
    );
  }

  const skipLink = context.facts.links.some(
    (link) =>
      /#(?:main|content|main-content|skip)/i.test(link.href) &&
      /skip|main|content/i.test(link.text),
  );
  checks.push(
    check({
      id: "skip-link",
      title: "Skip navigation link",
      category: "accessibility",
      status: skipLink ? "pass" : "warn",
      weight: 3,
      detail: skipLink
        ? "A potential skip-navigation link was observed."
        : "No skip-to-content link was detected in the inspected markup. This is a convention, not a strict requirement.",
      recommendation: skipLink
        ? undefined
        : "Consider a visible-on-focus skip link that targets the main content region.",
    }),
  );

  checks.push(
    unavailable(
      "contrast",
      "Color contrast",
      "accessibility",
      10,
      "Contrast requires computed styles from a browser. It cannot be reliably assessed from static HTML without executing the site's CSS.",
      "Use a browser-based accessibility audit to evaluate contrast in every theme and state.",
    ),
  );
  checks.push(
    unavailable(
      "keyboard",
      "Keyboard navigation",
      "accessibility",
      8,
      "End-to-end keyboard behavior requires interaction with the live page and is not established by static markup.",
      "Perform a keyboard-only walkthrough: focus visibility, tab order, dialogs, menus and escape behavior.",
    ),
  );

  const score = buildCategoryScore({
    checks,
    explanation:
      "Accessibility is scored from automatically detectable markup facts only. Checks that require interaction or computed styles are marked unavailable and excluded from the earned score.",
    methodology: [SCORE_METHODOLOGIES.accessibility, ...SCORE_METHODOLOGIES.category.split("\n")],
    missing: ["Color contrast", "Keyboard interaction", "Screen-reader behavior"],
  });

  const metrics: Metric[] = [
    metric("images", "Images", imageCount),
    metric("images-with-alt", "Images with alt", imagesWithAlt),
    metric("inputs", "Visible form controls", inputCount),
    metric("labeled-inputs", "Labeled form controls", labeledInputs),
    metric("buttons", "Buttons", buttonCount),
    metric("named-buttons", "Buttons with accessible names", namedButtons),
    metric("links", "Links", linkCount),
    metric("named-links", "Links with accessible names", namedLinks),
    metric("duplicate-ids", "Duplicate ID values", duplicateIds),
    metric("headings", "Headings", headingLevels.length),
    metric("skip-link", "Skip link detected", skipLink ? "Yes" : "No"),
  ];

  const section: SectionReport = {
    id: "accessibility",
    title: "Accessibility",
    summary: serviceSummary(score.score, "Accessibility"),
    score,
    metrics,
    limitations: [
      "Automated checks can find only a subset of WCAG issues. They do not replace manual or assistive-technology testing.",
      "Alt-text presence is not alt-text quality; decorative versus informative intent requires human review.",
      "Color contrast, focus visibility, keyboard operability, screen-reader announcements and cognitive load are not fully measurable from static markup.",
      "CSS and JavaScript behavior is not executed on the backend.",
      ...(snapshot ? ["Snapshot counts use the sanitized live DOM from the extension."] : []),
    ],
  };
  return { section, score };
}
