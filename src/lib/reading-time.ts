/**
 * Simple word-count-based reading time — no dependency needed for this.
 * Strips Markdown syntax roughly (headings, emphasis, links) before
 * counting so the estimate isn't inflated by markup characters.
 */
export function readingTime(rawBody: string): string {
  const text = rawBody
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[#>*_`~-]/g, ' ')
    .replace(/\[(.*?)\]\(.*?\)/g, '$1')
    .trim();
  const words = text.split(/\s+/).filter(Boolean).length;
  const minutes = Math.max(1, Math.round(words / 200));
  return `${minutes} min read`;
}
