import contentByPath from "../data/human-reviewed-landing-content.json";

export type HumanReviewedLandingContent = {
  h1: string;
  intro: string[];
  collapsibleSummary: string;
  collapsibleParagraphs: string[];
};

const normalizePath = (value: string) => {
  const path = String(value || "/").split(/[?#]/, 1)[0] || "/";
  if (path === "/") return path;
  return `/${path.replace(/^\/+|\/+$/g, "")}/`;
};

export function getHumanReviewedLandingContent(path: string): HumanReviewedLandingContent | null {
  return (contentByPath as Record<string, HumanReviewedLandingContent>)[normalizePath(path)] || null;
}
