export function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/[^\p{L}\p{N}-]+/gu, "") // keeps BG letters too
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}
