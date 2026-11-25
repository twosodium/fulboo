// Fetch fixtures from API-Sports and write normalized data files
import { writeFile, mkdir } from "node:fs/promises";

const KEY = process.env.API_FOOTBALL_KEY;
if (!KEY) { console.error("Missing API_FOOTBALL_KEY"); process.exit(1); }

const HOST = "https://v3.football.api-sports.io";
const FINISHED = new Set(["FT", "AET", "PEN"]);

// competition code name and API-Sports league id
const COMPS = [
  { code: "cl",        name: "Champions League",       id: 2 },
  { code: "el",        name: "Europa League",          id: 3 },
  { code: "conf",      name: "Conference League",      id: 848 },
  { code: "cwc",       name: "Club World Cup",         id: 15 },
  { code: "pl",        name: "Premier League",         id: 39 },
  { code: "laliga",    name: "La Liga",                id: 140 },
  { code: "seriea",    name: "Serie A",                id: 135 },
  { code: "bundesliga",name: "Bundesliga",             id: 78 },
  { code: "ligue1",    name: "Ligue 1",                id: 61 },
  { code: "copadelrey",name: "Copa del Rey",           id: 143 },
  { code: "dfb",       name: "DFB-Pokal",              id: 81 },
  { code: "coppa",     name: "Coppa Italia",           id: 137 },
  { code: "coupe",     name: "Coupe de France",        id: 66 },
  { code: "facup",     name: "FA Cup",                 id: 45 },
  { code: "efl",       name: "EFL Cup",                id: 48 },
];

const STOP = new Set(["FC","CF","AC","SC","AS","SS","SSC","RC","UD","CD","CA","AFC","CP","US","SV","1","II"]);
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Pull one API endpoint as json
async function api(path) {
  const res = await fetch(`${HOST}/${path}`, { headers: { "x-apisports-key": KEY } });
  const json = await res.json();
  if (json.errors && Object.keys(json.errors).length) throw new Error(JSON.stringify(json.errors));
  return json.response || [];
}

// Three letter code derived from a club name
function shortName(name) {
  const clean = name.normalize("NFD").replace(/[̀-ͯ]/g, "");
  const words = clean.split(/\s+/).filter(w => w && !STOP.has(w.toUpperCase()));
  return (words.join("") || clean).slice(0, 3).toUpperCase();
}

// Deterministic dot color from a club id
function color(id) {
  let h = 0; for (const ch of String(id)) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return `hsl(${h} 62% 55%)`;
}

// Current season year and start end dates for a league
async function season(id) {
  const rows = await api(`leagues?id=${id}&current=true`);
  const s = rows[0]?.seasons?.find(x => x.current) || rows[0]?.seasons?.at(-1);
  const y = s ? s.year : new Date().getUTCFullYear();
  const end = `${y + 1}-06-30`;
  return { year: y, meta: { id: String(y), label: `${y}-${String((y + 1) % 100).padStart(2, "0")}`, start: `${y}-07-01`, end } };
}

// Build one normalized competition file
async function build(comp) {
  const { year, meta } = await season(comp.id);
  await sleep(6500);
  const rows = await api(`fixtures?league=${comp.id}&season=${year}`);
  const teams = {}, matches = [];
  for (const r of rows) {
    const h = r.teams.home, a = r.teams.away, done = FINISHED.has(r.fixture.status.short);
    for (const t of [h, a]) if (!teams[t.id]) teams[t.id] = { name: t.name, short: shortName(t.name), color: color(t.id), crest: t.logo };
    const iso = new Date(r.fixture.date).toISOString();
    matches.push({ date: iso.slice(0, 10), time: iso.slice(11, 16), home: String(h.id), away: String(a.id),
      hg: done ? r.goals.home : null, ag: done ? r.goals.away : null });
  }
  return { code: comp.code, name: comp.name, seasons: [meta], teams, matches };
}

await mkdir("data", { recursive: true });
const out = [];
for (const comp of COMPS) {
  try {
    const data = await build(comp);
    await writeFile(`data/${comp.code}.json`, JSON.stringify(data));
    out.push({ code: comp.code, name: comp.name });
    console.log(`${comp.code} ${Object.keys(data.teams).length} teams ${data.matches.length} matches`);
  } catch (e) {
    console.error(`skip ${comp.code} ${e.message}`);
  }
  await sleep(6500);
}
await writeFile("data/manifest.json", JSON.stringify({ updated: new Date().toISOString(), competitions: out }));
console.log(`wrote ${out.length} competitions`);
