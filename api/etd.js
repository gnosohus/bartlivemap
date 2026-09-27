// Vercel Serverless Function — proxies BART's real-time ETD (estimated departure) API.
//
// Why this exists: api.bart.gov does not send Access-Control-Allow-Origin headers, so a browser calling
// it directly with fetch() is blocked by CORS no matter what domain the page is hosted on (this was NOT
// fixed by moving from file:// to https://). Server-to-server requests aren't subject to CORS, so this
// function calls BART on the server and simply relays the same JSON back to the browser at same-origin
// "/api/etd" — the client code in index.html doesn't need to know or care that a proxy is involved.
//
// BART_KEY is BART's own published public demo key (MW9S-E7SL-26DU-VV8V), same one that was already in
// index.html — safe to keep in source, it's not a secret.

const BART_KEY = "MW9S-E7SL-26DU-VV8V";
const BART_URL = `https://api.bart.gov/api/etd.aspx?cmd=etd&orig=ALL&key=${BART_KEY}&json=y`;

export default async function handler(req, res) {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const bartRes = await fetch(BART_URL, { signal: ctrl.signal });
    clearTimeout(t);

    if (!bartRes.ok) {
      res.status(502).json({ error: "BART API returned status " + bartRes.status });
      return;
    }

    const data = await bartRes.json();
    // Short edge/CDN cache: ETDs change constantly, but a few seconds of caching smooths out bursts of
    // concurrent visitors without staling the countdown noticeably.
    res.setHeader("Cache-Control", "public, max-age=0, s-maxage=5, stale-while-revalidate=15");
    res.status(200).json(data);
  } catch (err) {
    res.status(502).json({ error: "Failed to reach BART API", detail: String(err) });
  }
}
