import { describe, it, expect } from 'vitest';
import { sanitizeRichText } from '../sanitizeRichText';

describe('sanitizeRichText', () => {
  it('turns text pasted from another page into plain text (styles, fonts and sizes dropped)', () => {
    const pasted = `<meta charset='utf-8'><span style="font-family: 'Times New Roman'; font-size: 13px; letter-spacing: -1px;">Smell like you mean it</span>`;
    expect(sanitizeRichText(pasted)).toBe('Smell like you mean it');
    expect(sanitizeRichText('<h1 style="font-size:12px"><font size="2" color="#f00">Hi</font></h1>')).toBe('<font>Hi</font>');
  });

  it('keeps what the editor can make: breaks, bold, italic, underline, links, lists, the chosen font', () => {
    const html = 'A<br><strong>b</strong> <em>i</em> <u>u</u> <font face="Playfair Display">x</font><ul><li>one</li></ul>';
    expect(sanitizeRichText(html)).toBe(html);
    expect(sanitizeRichText('<a href="https://fype.io" target="_blank" style="color:red">go</a>')).toBe(
      '<a href="https://fype.io" target="_blank" rel="noopener noreferrer">go</a>',
    );
  });

  it('removes scripts, event handlers and javascript: links', () => {
    expect(sanitizeRichText('hi<script>alert(1)</script><style>p{}</style>')).toBe('hi');
    expect(sanitizeRichText('<b onclick="x()">b</b>')).toBe('<b>b</b>');
    expect(sanitizeRichText('<a href="java\tscript:alert(1)">x</a>')).toBe('<a>x</a>');
    expect(sanitizeRichText('<a href=" JavaScript:alert(1)">x</a>')).toBe('<a>x</a>');
    expect(sanitizeRichText('<img src=x onerror=alert(1)>')).toBe('');
  });

  it('handles empty values and does not change clean text', () => {
    expect(sanitizeRichText('')).toBe('');
    expect(sanitizeRichText(null)).toBe('');
    expect(sanitizeRichText('Plain &amp; simple')).toBe('Plain &amp; simple');
    const once = sanitizeRichText('<div style="x"><b>a</b></div>');
    expect(sanitizeRichText(once)).toBe(once);
  });
});
