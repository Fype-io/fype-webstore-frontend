// Cleans the rich text a merchant types or pastes into a theme property (headings, subtitles, FAQ
// answers...) down to what the editor can actually make: line breaks, bold, italic, underline,
// links, lists and the chosen font. Everything else (inline styles, font sizes, colours, spans,
// scripts) is dropped, so text from another page or app looks like text typed here, and the
// theme's own size and spacing always win. String-based, so it also runs on the server.
// Keep in sync with fype-ecommerce/src/utils/sanitizeRichText.ts (the theme editor).

const ALLOWED_TAGS = new Set(['p', 'div', 'br', 'b', 'strong', 'i', 'em', 'u', 'a', 'font', 'ul', 'ol', 'li']);

const TAG = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>/g;

const attr = (attrs: string, name: string): string | null => {
  const m = new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'>]+))`, 'i').exec(` ${attrs}`);
  return m ? (m[1] ?? m[2] ?? m[3] ?? '') : null;
};

const safeHref = (raw: string): string | null => {
  // eslint-disable-next-line no-control-regex
  const compact = raw.replace(/[\x00-\x20\s]+/g, '').toLowerCase();
  if (/^(javascript|data|vbscript):/.test(compact)) return null;
  return raw.trim().replace(/"/g, '&quot;');
};

export function sanitizeRichText(html: string | null | undefined): string {
  if (!html) return '';
  const stripped = String(html)
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style)\b[\s\S]*?<\/\1\s*>/gi, '');

  return stripped.replace(TAG, (_all, closing: string, rawName: string, attrs: string) => {
    const name = rawName.toLowerCase();
    if (!ALLOWED_TAGS.has(name)) return '';
    if (closing) return name === 'br' ? '' : `</${name}>`;
    if (name === 'br') return '<br>';
    if (name === 'a') {
      const href = attr(attrs, 'href');
      const safe = href === null ? null : safeHref(href);
      if (!safe) return '<a>';
      const blank = (attr(attrs, 'target') || '').toLowerCase() === '_blank';
      return `<a href="${safe}"${blank ? ' target="_blank" rel="noopener noreferrer"' : ''}>`;
    }
    if (name === 'font') {
      const face = attr(attrs, 'face');
      return face && /^[\w ,'-]+$/.test(face) ? `<font face="${face}">` : '<font>';
    }
    return `<${name}>`;
  });
}
