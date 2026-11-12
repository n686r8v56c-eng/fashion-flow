// Keep shared URLs local: saving a link never depends on fetching the shop.
const linkPattern = /[a-z][a-z0-9+.-]*:\/\/[^\s<>"'「」【】]+|(?:\/\/)?(?:[\p{L}\p{N}](?:[\p{L}\p{N}-]*[\p{L}\p{N}])?\.)+[\p{L}]{2,}(?::\d+)?(?:[/?#][^\s<>"'「」【】]*)?/giu;
const blockedProtocols = new Set(['javascript:', 'vbscript:', 'data:', 'file:', 'blob:', 'about:']);

function normalizeLink(value) {
  if (/[\u0000-\u001f\u007f]/.test(value)) return null;
  const candidate = value.startsWith('//') ? 'https:' + value
    : /^[a-z][a-z0-9+.-]*:\/\//i.test(value) ? value : 'https://' + value;
  try {
    const url = new URL(candidate);
    if (blockedProtocols.has(url.protocol) || !url.hostname || url.username || url.password) return null;
    return url.href;
  } catch { return null; }
}

export function parseSharedProduct(raw) {
  const text = String(raw || '').trim();
  // Do not extract a domain from inside an executable or local URL.
  if (/^(?:javascript|vbscript|data|file|blob|about):/i.test(text)) return {link: null, name: ''};
  const match = [...text.matchAll(linkPattern)][0];
  if (!match) return {link: null, name: ''};
  let token = match[0].replace(/[,.。!！;；，、）\]】」]+$/u, '');
  // Strip prose/Markdown closing parentheses without damaging balanced URL paths.
  while (token.endsWith(')') && (token.match(/\)/g)?.length || 0) > (token.match(/\(/g)?.length || 0)) token = token.slice(0, -1);
  const link = normalizeLink(token);
  const remainder = (text.slice(0, match.index) + text.slice(match.index + match[0].length)).replace(linkPattern, '');
  const name = remainder.split(/\r?\n/).map(line => line.trim())
    .filter(line => line && !/^쿠팡을 추천합니다[!！]?$/i.test(line) && !/^(?:공유|https?:\/\/)/i.test(line))
    .map(line => line.replace(/^[\s\[\]()<>:：-]+|[\s\[\]()<>:：-]+$/g, '').replace(/\s+\d{6,}\s*$/, '').trim())
    .find(Boolean) || '';
  return {link, name};
}
