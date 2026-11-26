// Fetch current-season fixtures from SportAPI and write normalized data files
import { writeFile, mkdir, access } from "node:fs/promises";

const KEY = process.env.SPORTAPI_KEY;
if (!KEY) { console.error("Missing SPORTAPI_KEY"); process.exit(1); }

const HOST = "https://sportapi.ai/api";
const LOGO = file => `https://sportapi.ai/logos/${file}`;
const FINISHED = new Set(["FT", "AET", "PENS"]);
const STOP = new Set(["FC","CF","AC","SC","AS","SS","SSC","RC","UD","CD","CA","AFC","CP","US","SV","1","II"]);
const sleep = ms => new Promise(r => setTimeout(r, ms));

// competition league id to code and name, in display order
const COMPS = [
  [18, "cl", "Champions League"], [22, "el", "Europa League"], [23, "conf", "Conference League"],
  [24, "pl", "Premier League"], [1, "laliga", "La Liga"], [3, "seriea", "Serie A"],
  [2, "bundesliga", "Bundesliga"], [9, "ligue1", "Ligue 1"],
  [32, "copadelrey", "Copa del Rey"], [31, "dfb", "DFB-Pokal"], [30, "coppa", "Coppa Italia"],
  [28, "coupe", "Coupe de France"], [58, "facup", "FA Cup"], [25, "efl", "EFL Cup"],
];
const BYID = new Map(COMPS.map(([id, code, name]) => [id, { code, name }]));
const CUPS = new Set(["copadelrey", "dfb", "coppa", "coupe", "facup", "efl"]);

// current season slug like 2026-27
const now = new Date();
const startY = now.getUTCMonth() + 1 >= 7 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
const SLUG = `${startY}-${String((startY + 1) % 100).padStart(2, "0")}`;
const SEASON = { id: SLUG, label: SLUG, start: `${startY}-07-01`, end: `${startY + 1}-06-30` };

// date sweep window from season start to a near-future horizon
const FROM = process.env.FROM || SEASON.start;
const TO = new Date(now.getTime() + 45 * 86400000).toISOString().slice(0, 10);

// three letter code from a club name
function shortName(name) {
  const clean = name.normalize("NFD").replace(/[̀-ͯ]/g, "");
  const words = clean.split(/\s+/).filter(w => w && !STOP.has(w.toUpperCase()));
  return (words.join("") || clean).slice(0, 3).toUpperCase();
}
// deterministic dot color from a club name
function color(name) {
  let h = 0; for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return `hsl(${h} 62% 55%)`;
}
const logoName = v => v ? String(v).replace(/[^\w.-]/g, "_") : null;

// pad an svg into a square so circular crop fits
function padSvg(svg) {
  svg = svg.replace(/<\?xml[^>]*\?>/i, "").trim();
  const open = svg.match(/<svg[^>]*>/i);
  if (!open) return svg;
  const tag = open[0];
  const vb = tag.match(/viewBox\s*=\s*["']\s*([\d.+-]+)[,\s]+([\d.+-]+)[,\s]+([\d.+-]+)[,\s]+([\d.+-]+)/i);
  const wa = tag.match(/\bwidth\s*=\s*["']([\d.]+)/i), ha = tag.match(/\bheight\s*=\s*["']([\d.]+)/i);
  const w = vb ? +vb[3] : (wa ? +wa[1] : 0), h = vb ? +vb[4] : (ha ? +ha[1] : 0);
  if (!w || !h) return svg;
  const C = Math.max(w, h), s = 0.66 * C / Math.max(w, h), iw = w * s, ih = h * s, x = (C - iw) / 2, y = (C - ih) / 2;
  let inner = tag;
  if (!vb) inner = inner.replace(/<svg/i, `<svg viewBox="0 0 ${w} ${h}"`);
  inner = inner.replace(/\s(width|height|x|y)\s*=\s*["'][^"']*["']/gi, "");
  inner = inner.replace(/<svg/i, `<svg x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${iw.toFixed(1)}" height="${ih.toFixed(1)}"`);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${C}" height="${C}" viewBox="0 0 ${C} ${C}">${svg.replace(open[0], inner)}</svg>`;
}

async function api(path) {
  const res = await fetch(`${HOST}/${path}`, { headers: { "X-Api-Key": KEY } });
  if (!res.ok) throw new Error(`http ${res.status}`);
  return res.json();
}

// list of dates from a to b inclusive
function dates(a, b) {
  const out = []; let d = new Date(a + "T00:00:00Z"), end = new Date(b + "T00:00:00Z");
  while (d <= end) { out.push(d.toISOString().slice(0, 10)); d = new Date(d.getTime() + 86400000); }
  return out;
}

const comps = {};             // code to {teams, matches}
const logos = new Map();      // saved filename to source value
for (const [, { code, name }] of [...BYID]) comps[code] = { name, teams: {}, matches: [] };

let calls = 0;
for (const day of dates(FROM, TO)) {
  let json;
  try { json = await api(`fixtures/date/${day}`); } catch (e) { console.error(`day ${day} ${e.message}`); continue; }
  calls++;
  for (const f of json.data || []) {
    const meta = BYID.get(f.league_id); if (!meta) continue;
    const c = comps[meta.code];
    for (const side of ["home", "away"]) {
      const id = String(f[`${side}_id`]), raw = f[`${side}_logo`], file = logoName(raw);
      if (!c.teams[id]) c.teams[id] = { name: f[`${side}_team`], short: shortName(f[`${side}_team`]), color: color(f[`${side}_team`]), crest: file ? `data/logos/${file}` : null };
      else if (file && !c.teams[id].crest) c.teams[id].crest = `data/logos/${file}`;
      if (file) logos.set(file, raw);
    }
    const done = FINISHED.has(f.status), iso = f.kickoff_utc || "";
    c.matches.push({ date: iso.slice(0, 10) || f.date, time: iso.slice(11, 16), home: String(f.home_id), away: String(f.away_id),
      hg: done ? f.home_score : null, ag: done ? f.away_score : null, stage: f.stage || null });
  }
  await sleep(150);
}

// download club crests into data/logos (skip if already present)
await mkdir("data/logos", { recursive: true });
const files = [...logos.entries()];
for (let i = 0; i < files.length; i += 8) {
  await Promise.all(files.slice(i, i + 8).map(async ([file, raw]) => {
    const path = `data/logos/${file}`;
    try { await access(path); return; } catch {}
    try { const r = await fetch(LOGO(raw)); if (r.ok) await writeFile(path, Buffer.from(await r.arrayBuffer())); } catch {}
  }));
}

// write one file per competition with matches plus manifest
const out = [];
for (const [, code, name] of COMPS) {
  const c = comps[code];
  if (!c.matches.length) { console.log(`skip ${code} (no fixtures)`); continue; }
  const type = CUPS.has(code) ? "cup" : "league";
  await writeFile(`data/${code}.json`, JSON.stringify({ code, name, type, seasons: [SEASON], teams: c.teams, matches: c.matches }));
  out.push({ code, name, type });
  console.log(`${code} ${Object.keys(c.teams).length} teams ${c.matches.length} matches`);
}
await writeFile("data/manifest.json", JSON.stringify({ updated: new Date().toISOString(), competitions: out }));
console.log(`season ${SLUG}, ${calls} day-calls, ${files.length} logos, ${out.length} competitions`);
