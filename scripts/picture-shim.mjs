/**
 * Injected into the Google Images tab (hidden WebView on the phone, Playwright
 * in `npm run dev`). Keep the Java copies in PictureSearch.java in sync.
 */

export function consentShim() {
  const labels = ["accept all", "i agree", "accept", "i accept", "agree"];
  const nodes = document.querySelectorAll("button, input[type=submit], [role=button]");
  for (let i = 0; i < nodes.length; i++) {
    const t = (nodes[i].innerText || nodes[i].value || nodes[i].getAttribute("aria-label") || "")
      .trim()
      .toLowerCase();
    if (!t) continue;
    for (let j = 0; j < labels.length; j++) {
      if (t === labels[j]) {
        nodes[i].click();
        return "clicked";
      }
    }
  }
  return "none";
}

export function harvestShim() {
  function captcha() {
    const text = (document.body && document.body.innerText ? document.body.innerText : "").toLowerCase();
    if (location.pathname.indexOf("/sorry") !== -1) return true;
    if (document.querySelector('iframe[src*="recaptcha"], form[action*="sorry"], #captcha')) return true;
    return text.indexOf("unusual traffic") !== -1 || text.indexOf("are you a robot") !== -1;
  }
  function skip(url) {
    if (!url || url.indexOf("https://") !== 0) return true;
    if (url.indexOf("data:") === 0) return true;
    return /logo|favicon|sprite|\/icon(?:s)?\/|maps\.google|ssl\.gstatic\.com\/gb|www\.gstatic\.com\/images\/branding|google\.com\/images\/branding/.test(
      url,
    );
  }
  function decode(url) {
    return String(url)
      .replace(/\\u003d/gi, "=")
      .replace(/\\u0026/gi, "&")
      .replace(/\\\//g, "/")
      .replace(/&amp;/g, "&")
      .trim();
  }
  function ok(url) {
    if (skip(url)) return false;
    if (url.indexOf("encrypted-tbn") !== -1 && url.indexOf("gstatic.com") !== -1) return true;
    if (url.indexOf("googleusercontent.com") !== -1) return true;
    if (url.indexOf("gstatic.com/images") !== -1) return true;
    if (/\.(jpg|jpeg|png|webp|gif)(\?|#|$)/i.test(url)) return true;
    try {
      const host = new URL(url).hostname;
      return /^(?:images?|img|i|cdn|media|static)\./i.test(host);
    } catch {
      return false;
    }
  }
  const map = {};
  function add(url, thumb, title, width, height) {
    url = decode(url || "");
    thumb = decode(thumb || "");
    const chosen = ok(url) ? url : ok(thumb) ? thumb : "";
    if (!chosen || map[chosen]) return;
    if (width && width < 80) return;
    map[chosen] = {
      url: chosen,
      thumb: ok(thumb) ? thumb : chosen,
      title: title || "",
      width: width || 0,
      height: height || 0,
    };
  }
  const imgs = document.querySelectorAll("img");
  for (let i = 0; i < imgs.length; i++) {
    const img = imgs[i];
    const src = img.currentSrc || img.src || img.getAttribute("data-src") || img.getAttribute("data-iurl") || "";
    const ou = img.getAttribute("data-ou") || img.getAttribute("data-lpage") || "";
    add(ou || src, src, img.alt || "", img.naturalWidth || img.width || 0, img.naturalHeight || img.height || 0);
  }
  const html = document.documentElement ? document.documentElement.innerHTML : "";
  const reOu = /"(?:ou|originalUrl|ow)"\s*:\s*"(https?:[^"\\]+)"/g;
  let match;
  while ((match = reOu.exec(html))) {
    add(match[1], "", "", 0, 0);
  }
  const reTbn = /https:\/\/encrypted-tbn\d+\.gstatic\.com\/images\?[^"'\s<>]+/g;
  while ((match = reTbn.exec(html))) {
    add(match[0], match[0], "", 0, 0);
  }
  const hits = [];
  for (const key of Object.keys(map)) hits.push(map[key]);
  return { captcha: captcha(), hits };
}

export const CONSENT_SHIM = `(${consentShim.toString()})()`;
export const HARVEST_SHIM = `(${harvestShim.toString()})()`;
