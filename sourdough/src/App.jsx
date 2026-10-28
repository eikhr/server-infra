import React, { useEffect, useMemo, useState } from "react";

const ink = "#38291F";
const inkSoft = "#73604D";
const crust = "#F6F1E7";
const crustLight = "#FFFDF7";
const crustLine = "#D8CBB5";
const MAX_FLOURS = 5;
const waterBlue = "#628B94";
const starterGold = "#A85E25";
const saltGrey = "#A9A58F";

// Average of the flour colours, weighted by grams
function blendColor(parts) {
  const total = parts.reduce((a, p) => a + p.w, 0) || 1;
  const rgb = [0, 1, 2].map((i) =>
    Math.round(parts.reduce((a, p) => a + parseInt(p.color.slice(1 + i * 2, 3 + i * 2), 16) * p.w, 0) / total),
  );
  return `#${rgb.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

function Swatch({ color }) {
  return <span className="swatch shrink-0" style={{ background: color }} />;
}

// Mixing time to the morning after, with the night shaded and the ready window marked
function RiseTimeline({ mixAt, range, nightLabel }) {
  const [hh, mm] = mixAt.split(":").map(Number);
  const mix = hh + mm / 60;
  const span = Math.max(16, Math.ceil(range[1] + 2));
  const pct = (h) => `${(Math.min(span, Math.max(0, h)) / span) * 100}%`;
  const nights = [-1, 0, 1].map((d) => [23 - mix + 24 * d, 31 - mix + 24 * d]).filter(([a, b]) => b > 0 && a < span);
  const ticks = [];
  for (let h = Math.ceil(mix / 3) * 3 - mix; h <= span - 0.75; h += 3) if (h >= 0.75) ticks.push(h);
  return (
    <div className="timeline mt-3" aria-hidden="true">
      <div className="timeline-bar">
        {nights.map(([a, b], i) => (
          <div key={i} className="timeline-night" style={{ left: pct(a), width: `calc(${pct(b)} - ${pct(a)})` }}>
            <span>{nightLabel}</span>
          </div>
        ))}
        <div className="timeline-ready" style={{ left: pct(range[0]), width: `calc(${pct(range[1])} - ${pct(range[0])})` }} />
        <div className="timeline-mix" />
      </div>
      <div className="timeline-ticks">
        {ticks.map((h) => (
          <span key={h} style={{ left: pct(h) }}>{String(Math.round(mix + h) % 24).padStart(2, "0")}</span>
        ))}
      </div>
    </div>
  );
}

const display = { fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif', fontWeight: 650, letterSpacing: "-0.035em" };
const sans = { fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif' };

// Baseline hydration each flour wants in a sourdough loaf
const FLOUR_TYPES = [
  { key: "bread", color: "#D9AE66", name: { en: "Strong bread flour", no: "Hvetemel special" }, hyd: 0.72 },
  { key: "ap", color: "#E6C88F", name: { en: "All-purpose flour", no: "Hvetemel, siktet" }, hyd: 0.67 },
  { key: "ww", color: "#A9743F", name: { en: "Whole wheat", no: "Sammalt hvete" }, hyd: 0.83 },
  { key: "rye", color: "#8C6D55", name: { en: "Rye", no: "Rugmel" }, hyd: 0.9 },
  { key: "wrye", color: "#5C4231", name: { en: "Wholemeal rye", no: "Sammalt rug" }, hyd: 0.95 },
  { key: "spelt", color: "#C99C5A", name: { en: "Spelt", no: "Speltmel" }, hyd: 0.66 },
  { key: "wspelt", color: "#93693C", name: { en: "Wholemeal spelt", no: "Sammalt spelt" }, hyd: 0.75 },
  { key: "durum", color: "#E2B84C", name: { en: "Durum / semolina", no: "Durum / semulegryn" }, hyd: 0.65 },
  { key: "einkorn", color: "#BF8F45", name: { en: "Einkorn", no: "Enkorn" }, hyd: 0.6 },
  { key: "oat", color: "#CDBA8E", name: { en: "Oat flour", no: "Havremel" }, hyd: 0.8 },
];
const byKey = Object.fromEntries(FLOUR_TYPES.map((f) => [f.key, f]));

const FEELS = [
  { key: "firmer", adj: -0.05 },
  { key: "standard", adj: 0 },
  { key: "slack", adj: 0.05 },
];

const STRINGS = {
  en: {
    title: "Sourdough calculator",
    intro: "Weigh your flours. It works out the water, salt and starter.",
    yourFlour: "Your flour",
    flourType: "Flour type",
    amount: (name) => `${name} amount`,
    removeFlour: "Remove flour",
    less: (n, u) => `${n} ${u} less`,
    more: (n, u) => `${n} ${u} more`,
    riseHeading: "How long will it rise?",
    roomTemp: "Room temperature",
    mixedAt: "Mixed at",
    coldStarter: "Starter straight from the fridge",
    readyAt: (a, b) => `Ready around ${a}–${b}`,
    riseFor: (h) => `${h} h rise`,
    night: "night",
    doughWeight: (g) => `${g} g of dough`,
    riseNote: "A rough guide to when the dough has grown by a third to a half. Trust the dough over the clock.",
    addFlour: "Add a flour",
    feelHeading: "How should the dough feel?",
    feels: { firmer: "Firmer", standard: "Standard", slack: "Slack" },
    feelHint: "Firmer is easier to handle; slack gives a more open crumb but sticks to everything.",
    addToBowl: "Add to the bowl",
    flour: "Flour",
    water: "Water",
    starter: "Starter",
    starterAuto: "10% of your flour",
    backToAuto: "Back to automatic",
    starterAmount: "Starter amount",
    salt: "Salt",
    saltNote: "2% of flour",
    hydration: "Hydration",
    totalDough: "Total dough",
    footnote: "Assumes a 100% hydration starter; its flour and water are already counted.",
    oatNote: "Oat flour has no gluten. Keep it to about 20% of the flour, or the loaf gets dense.",
    recipes: "Start from a recipe",
    method: "Method",
  },
  no: {
    title: "Surdeigskalkulator",
    intro: "Vei opp melet ditt. Kalkulatoren regner ut vann, salt og surdeig.",
    yourFlour: "Melet ditt",
    flourType: "Meltype",
    amount: (name) => `Mengde ${name.toLowerCase()}`,
    removeFlour: "Fjern mel",
    less: (n, u) => `${n} ${u} mindre`,
    more: (n, u) => `${n} ${u} mer`,
    riseHeading: "Hvor lenge skal den heve?",
    roomTemp: "Romtemperatur",
    mixedAt: "Blandet kl.",
    coldStarter: "Surdeig rett fra kjøleskapet",
    readyAt: (a, b) => `Klar ca. kl. ${a}–${b}`,
    riseFor: (h) => `${h} t heving`,
    night: "natt",
    doughWeight: (g) => `${g} g deig`,
    riseNote: "Et grovt anslag for når deigen har vokst med en tredjedel til halvparten. Stol mer på deigen enn klokka.",
    addFlour: "Legg til mel",
    feelHeading: "Hvordan skal deigen kjennes?",
    feels: { firmer: "Fastere", standard: "Standard", slack: "Løsere" },
    feelHint: "En fastere deig er lettere å håndtere. En løsere deig gir mer åpen krumme, men klistrer seg til alt.",
    addToBowl: "Ha i bollen",
    flour: "Mel",
    water: "Vann",
    starter: "Surdeig",
    starterAuto: "10 % av melet",
    backToAuto: "Tilbake til automatisk",
    starterAmount: "Mengde surdeig",
    salt: "Salt",
    saltNote: "2 % av melet",
    hydration: "Hydrering",
    totalDough: "Total deig",
    footnote: "Forutsetter surdeig med 100 % hydrering; melet og vannet i den er regnet med.",
    oatNote: "Havremel har ikke gluten. Hold det til rundt 20 % av melet, ellers blir brødet kompakt.",
    recipes: "Start fra en oppskrift",
    method: "Fremgangsmåte",
  },
};

// Evening-to-morning tin-loaf method; recipes override the steps that differ
const TIN = {
  en: {
    mix: "{mix}: mix flour, water, starter and salt",
    folds: "3–5 stretch and folds through the evening",
    bulk: "Leave on the counter overnight; by morning it should have grown by a third to a half",
    shape: "Morning: shape and put in a greased tin",
    proof: "Bake after 1–2 h, or keep in the fridge and bake after work",
    bake: "230 °C for 45–50 min (5 min more straight from the fridge)",
    rest: "Cool 2 h before cutting",
  },
  no: {
    mix: "Kl. {mix}: bland mel, vann, surdeig og salt",
    folds: "Strekk og brett 3–5 ganger utover kvelden",
    bulk: "La stå på benken over natten; om morgenen skal den ha vokst med en tredjedel til halvparten",
    shape: "Morgen: form og legg i smurt brødform",
    proof: "Stek etter 1–2 t, eller sett i kjøleskapet og stek etter jobb",
    bake: "230 °C i 45–50 min (5 min ekstra rett fra kjøleskapet)",
    rest: "Avkjøl 2 t før du skjærer",
  },
};
const ORDER = ["mix", "folds", "bulk", "shape", "topping", "proof", "bake", "rest"];
const tin = (o = {}) =>
  Object.fromEntries(
    ["en", "no"].map((l) => [l, ORDER.map((k) => o[k]?.[l] ?? TIN[l][k]).filter((step) => step != null)]),
  );

const RECIPES = [
  {
    key: "half",
    name: { en: "Half whole wheat", no: "Halvgrovt brød" },
    flours: [["ap", 250], ["ww", 250]],
    feel: "standard",
    steps: tin(),
  },
  {
    key: "thirds",
    name: { en: "Three-way loaf", no: "Tredelt grovbrød" },
    flours: [["ap", 167], ["ww", 167], ["rye", 166]],
    feel: "standard",
    steps: tin({ folds: { en: "2–3 stretch and folds with wet hands through the evening", no: "Strekk og brett 2–3 ganger med våte hender utover kvelden" } }),
  },
  {
    key: "extra",
    name: { en: "Extra coarse", no: "Ekstra grovt" },
    flours: [["ap", 150], ["ww", 350]],
    feel: "standard",
    steps: tin(),
  },
  {
    key: "oat",
    name: { en: "Oat wholemeal loaf", no: "Havregrovbrød" },
    flours: [["ap", 200], ["ww", 200], ["oat", 100]],
    feel: "standard",
    steps: tin({ topping: { en: "Sprinkle oats on top", no: "Dryss havregryn på toppen" } }),
  },
  {
    key: "spelt",
    name: { en: "Whole spelt", no: "Grovt speltbrød" },
    flours: [["spelt", 200], ["wspelt", 300]],
    feel: "firmer",
    steps: tin({
      folds: { en: "2–3 gentle stretch and folds through the evening", no: "Strekk og brett forsiktig 2–3 ganger utover kvelden" },
      bulk: { en: "Leave on the counter overnight; spelt overproofs easily, so a third is plenty", no: "La stå på benken over natten; spelt overhever lett, så en tredjedel er nok" },
    }),
  },
  {
    key: "rye",
    name: { en: "Coarse rye", no: "Grovt rugbrød" },
    flours: [["ap", 250], ["wrye", 250]],
    feel: "standard",
    steps: tin({
      folds: { en: "Mix well, no folds", no: "Bland godt, ingen strekk og brett" },
      bulk: { en: "Leave on the counter overnight; by morning it should look puffy and cracked on top", no: "La stå på benken over natten; om morgenen skal den være luftig og ha sprekker på toppen" },
      shape: { en: "Morning: scrape into a greased tin with a wet hand", no: "Morgen: skrap over i smurt brødform med våt hånd" },
      rest: { en: "Wait until the next day before cutting", no: "Vent til neste dag før du skjærer" },
    }),
  },
  {
    key: "focaccia",
    name: { en: "Focaccia", no: "Focaccia" },
    feel: "slack",
    flours: [["ap", 500]],
    steps: {
      en: [
        "{mix}: mix everything",
        "3–5 stretch and folds through the evening",
        "Leave on the counter overnight",
        "Morning: oil a tin and stretch the dough into it",
        "Rise until puffy, 2–4 h, or fridge until after work",
        "Oil, dimple, flaky salt and rosemary",
        "230 °C for 20–25 min",
      ],
      no: [
        "Kl. {mix}: bland alt",
        "Strekk og brett 3–5 ganger utover kvelden",
        "La stå på benken over natten",
        "Morgen: olje i langpanne, strekk ut deigen",
        "Hev til den er luftig, 2–4 t, eller i kjøleskapet til etter jobb",
        "Olje, fingergroper, flaksalt og rosmarin",
        "230 °C i 20–25 min",
      ],
    },
  },
];

// Bulk rise until the dough has grown by a third to a half. Each halving of the
// starter costs one more doubling time, and fermentation runs about twice as
// fast per 8 °C. Calibrated to roughly 6.5 h for 20 % starter at 21 °C.
const WHOLE_GRAIN = new Set(["ww", "rye", "wrye", "wspelt"]);
function bulkHours({ starterShare, temp, wholeShare, coldStarter }) {
  if (starterShare <= 0) return null;
  const doubling = 2.7 * 2 ** ((21 - temp) / 8);
  const doublings = Math.max(1, 2.4 + Math.log2(0.2 / starterShare));
  return doubling * doublings * (1 - 0.2 * wholeShare) * (coldStarter ? 1.2 : 1);
}

function loadPrefs() {
  try {
    return JSON.parse(localStorage.getItem("sourdough-rise")) || {};
  } catch {
    return {};
  }
}

function initialLang() {
  try {
    const saved = localStorage.getItem("sourdough-lang");
    if (saved === "en" || saved === "no") return saved;
  } catch {}
  const nav = (typeof navigator !== "undefined" && navigator.language) || "";
  return /^(nb|nn|no)\b/i.test(nav) ? "no" : "en";
}

let nextId = 3;

// −/+ buttons around an amount, so phones rarely need the number keyboard
function Stepper({ step, onStep, t, unit = "g", children }) {
  const btn = (dir, label, text) => (
    <button
      type="button"
      aria-label={label}
      onClick={() => onStep(dir * step)}
      className="stepper-btn w-10 self-stretch text-xl leading-none shrink-0 focus:outline-none focus-visible:ring-2"
      style={{ color: ink, ...sans }}
    >
      {text}
    </button>
  );
  return (
    <div className="stepper flex items-stretch h-12 shrink-0 rounded-md overflow-hidden" style={{ background: crustLight, border: `1px solid ${crustLine}` }}>
      {btn(-1, t.less(step, unit), "−")}
      {children}
      {btn(1, t.more(step, unit), "+")}
    </div>
  );
}

function GramsInput({ value, onChange, ariaLabel, wide }) {
  return (
    <div className="relative shrink-0">
      <input
        type="number"
        inputMode="numeric"
        aria-label={ariaLabel}
        value={value}
        min={0}
        onChange={(e) => onChange(Math.max(0, parseFloat(e.target.value) || 0))}
        className={`${wide ? "w-28" : "w-24"} h-12 text-center text-lg rounded-md bg-transparent focus:outline-none focus-visible:ring-2`}
        style={{ color: ink, border: `1px solid ${crustLine}`, ...display }}
      />
      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-sm pointer-events-none" style={{ color: inkSoft }}>g</span>
    </div>
  );
}

// Holds a draft while typing so a half-typed "1" doesn't scale the recipe down to one gram
function TotalInput({ value, onCommit, ariaLabel, unit = "g" }) {
  const [draft, setDraft] = useState(null);
  const commit = () => {
    const g = parseFloat(draft);
    if (draft !== null && g > 0) onCommit(g);
    setDraft(null);
  };
  return (
    <div className="relative shrink-0">
      <input
        type="number"
        inputMode="numeric"
        aria-label={ariaLabel}
        value={draft ?? Math.round(value)}
        min={0}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        className="w-24 h-12 text-center text-lg rounded-md bg-transparent focus:outline-none focus-visible:ring-2"
        style={{ color: ink, border: `1px solid ${crustLine}`, ...display }}
      />
      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-sm pointer-events-none" style={{ color: inkSoft }}>{unit}</span>
    </div>
  );
}

function AmountRow({ label, note, muted, swatch, children }) {
  return (
    <div className="flex items-center gap-3 min-h-12 py-1">
      {swatch === undefined ? null : swatch ? <Swatch color={swatch} /> : <span className="swatch shrink-0" />}
      <div className="flex-1 min-w-0" style={{ color: muted ? inkSoft : ink, ...sans }}>
        {label}
        {note && <div className="note">{note}</div>}
      </div>
      {children}
    </div>
  );
}

// Same footprint as a Stepper, so computed and editable amounts share one column
function StaticAmount({ value, unit = "g", muted }) {
  return (
    <div className="stepper flex items-stretch h-12 shrink-0" style={{ border: "1px solid transparent" }}>
      <span className="w-10 shrink-0" />
      <div className="relative flex">
        <output className="static-value tabular-nums text-lg" style={{ color: muted ? inkSoft : ink, ...display }}>{value}</output>
        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-sm pointer-events-none" style={{ color: inkSoft }}>{unit}</span>
      </div>
      <span className="w-10 shrink-0" />
    </div>
  );
}

export default function SourdoughCalculator() {
  const [flours, setFlours] = useState([
    { id: 1, type: "ap", grams: 400 },
    { id: 2, type: "ww", grams: 100 },
  ]);
  const [feel, setFeel] = useState("standard");
  const [starterOverride, setStarterOverride] = useState(null); // null = automatic
  const [recipe, setRecipe] = useState(null);
  const [rise, setRise] = useState(() => ({ temp: 21, mixAt: "18:00", coldStarter: false, ...loadPrefs() }));
  const updateRise = (patch) => setRise((x) => ({ ...x, ...patch }));

  useEffect(() => {
    try {
      localStorage.setItem("sourdough-rise", JSON.stringify(rise));
    } catch {}
  }, [rise]);
  const [lang, setLang] = useState(initialLang);
  const t = STRINGS[lang];
  const activeRecipe = RECIPES.find((x) => x.key === recipe);

  useEffect(() => {
    document.documentElement.lang = lang === "no" ? "nb" : "en";
    document.title = t.title;
    try {
      localStorage.setItem("sourdough-lang", lang);
    } catch {}
  }, [lang, t.title]);

  const r = useMemo(() => {
    const addedFlour = flours.reduce((a, f) => a + (f.grams || 0), 0);
    const starter = starterOverride ?? Math.round(addedFlour * 0.1);
    const starterFlour = starter / 2; // assumes a 100% hydration starter
    const starterWater = starter / 2;
    const totalFlour = addedFlour + starterFlour;

    const feelAdj = FEELS.find((f) => f.key === feel)?.adj ?? 0;
    const weighted =
      totalFlour > 0
        ? (flours.reduce((a, f) => a + (f.grams || 0) * byKey[f.type].hyd, 0) + starterFlour * byKey.bread.hyd) / totalFlour
        : 0;
    const hyd = weighted + feelAdj;

    const totalWater = totalFlour * hyd;
    const waterAdd = totalWater - starterWater;
    const salt = totalFlour * 0.02;
    const total = totalFlour + totalWater + salt;
    return { addedFlour, starter, starterFlour, starterWater, totalFlour, hyd, waterAdd, salt, total };
  }, [flours, feel, starterOverride]);

  const updateFlour = (id, patch) => setFlours((fs) => fs.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  const removeFlour = (id) => setFlours((fs) => fs.filter((f) => f.id !== id));
  const addFlour = () => setFlours((fs) => [...fs, { id: nextId++, type: "ap", grams: 0 }]);

  const pickRecipe = (rec) => {
    if (recipe === rec.key) return setRecipe(null);
    setRecipe(rec.key);
    setFlours(rec.flours.map(([type, grams]) => ({ id: nextId++, type, grams })));
    setFeel(rec.feel);
    setStarterOverride(null);
  };

  // Every amount is proportional to the flour, so scaling the flours scales the whole dough
  const scaleBy = (k) => {
    setFlours((fs) => fs.map((f) => ({ ...f, grams: Math.round((f.grams || 0) * k) })));
    if (starterOverride !== null) setStarterOverride(Math.round(starterOverride * k));
  };
  const scaleFlourTo = (target) => r.addedFlour > 0 && scaleBy(target / r.addedFlour);
  const scaleTotalTo = (target) => r.total > 0 && scaleBy(target / r.total);

  const wholeGrams = flours.reduce((a, f) => a + (WHOLE_GRAIN.has(f.type) ? f.grams || 0 : 0), 0);
  const riseH = bulkHours({
    starterShare: r.addedFlour > 0 ? r.starter / r.addedFlour : 0,
    temp: rise.temp,
    wholeShare: r.addedFlour > 0 ? wholeGrams / r.addedFlour : 0,
    coldStarter: rise.coldStarter,
  });
  const riseRange = riseH && [riseH * 0.85, riseH * 1.15];
  const fmtHours = (h) => (Math.round(h * 2) / 2).toLocaleString(lang === "no" ? "nb" : "en");
  const clockAfter = (h) => {
    const [hh, mm] = rise.mixAt.split(":").map(Number);
    const mins = Math.round((hh * 60 + mm + h * 60) / 15) * 15;
    return `${String(Math.floor(mins / 60) % 24).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
  };

  const mixColor = blendColor(flours.map((f) => ({ w: f.grams || 0, color: byKey[f.type].color })));
  const segments = [
    ...flours.map((f) => ({ w: f.grams || 0, color: byKey[f.type].color })),
    { w: Math.max(0, r.waterAdd), color: waterBlue },
    { w: r.starter, color: starterGold },
    { w: r.salt, color: saltGrey },
  ].filter((x) => x.w > 0);

  const oatGrams = flours.reduce((a, f) => a + (f.type === "oat" ? f.grams || 0 : 0), 0);
  const oatShare = r.addedFlour > 0 ? oatGrams / r.addedFlour : 0;

  return (
    <div className="min-h-screen" style={{ background: crust, color: ink }}>
      <div className="calculator max-w-lg mx-auto px-5 pt-6 pb-16">
        <header className="flex items-center gap-3">
          <svg className="loaf shrink-0" viewBox="0 0 140 90" fill="none" aria-hidden="true">
            <path d="M15 58C12 32 34 12 68 11C104 8 129 30 127 55C126 72 109 79 72 79C37 80 18 73 15 58Z" fill="#CB9148" stroke="#70441F" strokeWidth="4" />
            <path d="M42 28C34 37 32 46 35 53M66 22C55 33 53 45 57 57M91 24C80 33 77 45 80 57M111 34C103 40 99 47 100 53" stroke="#F8E5B9" strokeWidth="8" strokeLinecap="round" />
          </svg>
          <h1 className="flex-1 min-w-0" style={display}>{t.title}</h1>
          <div className="lang-switch flex shrink-0" role="group" aria-label="Language / Språk">
            {[
              { key: "no", label: "NO" },
              { key: "en", label: "EN" },
            ].map((l) => (
              <button
                key={l.key}
                type="button"
                aria-pressed={lang === l.key}
                onClick={() => setLang(l.key)}
                className="h-10 w-10 rounded-md text-xs focus:outline-none focus-visible:ring-2"
                style={{ background: lang === l.key ? ink : "transparent", color: lang === l.key ? crust : inkSoft, ...sans }}
              >
                {l.label}
              </button>
            ))}
          </div>
        </header>
        <p className="intro mt-2" style={{ color: inkSoft, ...sans }}>{t.intro}</p>

        {/* Recipes */}
        <section className="mt-7">
          <h2 style={display}>{t.recipes}</h2>
          <div className="recipe-chips mt-3 flex flex-wrap gap-2">
            {RECIPES.map((rec) => (
              <button
                key={rec.key}
                type="button"
                aria-pressed={recipe === rec.key}
                onClick={() => pickRecipe(rec)}
                className="h-9 px-3 rounded-full text-sm shrink-0 focus:outline-none focus-visible:ring-2"
                style={{
                  background: recipe === rec.key ? ink : crustLight,
                  color: recipe === rec.key ? crust : ink,
                  border: `1px solid ${recipe === rec.key ? ink : crustLine}`,
                  ...sans,
                }}
              >
                {rec.name[lang]}
              </button>
            ))}
          </div>
        </section>

        {/* Flours */}
        <section className="mt-8">
          <h2 style={display}>{t.yourFlour}</h2>
          <div className="mt-1">
            {flours.map((f) => (
              <div key={f.id} className="flour-row py-2" style={{ borderBottom: `1px solid ${crustLine}` }}>
                <Swatch color={byKey[f.type].color} />
                <select
                  value={f.type}
                  aria-label={t.flourType}
                  onChange={(e) => updateFlour(f.id, { type: e.target.value })}
                  className="min-w-0 w-full h-12 px-2 rounded-md focus:outline-none focus-visible:ring-2"
                  style={{ background: crustLight, color: ink, border: `1px solid ${crustLine}`, ...sans }}
                >
                  {FLOUR_TYPES.map((ft) => (
                    <option key={ft.key} value={ft.key}>{ft.name[lang]}</option>
                  ))}
                </select>
                <Stepper step={100} t={t} onStep={(d) => updateFlour(f.id, { grams: Math.max(0, (f.grams || 0) + d) })}>
                  <GramsInput ariaLabel={t.amount(byKey[f.type].name[lang])} value={f.grams} onChange={(g) => updateFlour(f.id, { grams: g })} />
                </Stepper>
                <button
                  type="button"
                  aria-label={t.removeFlour}
                  onClick={() => removeFlour(f.id)}
                  disabled={flours.length === 1}
                  className="remove w-10 h-12 rounded-md text-lg disabled:opacity-30 focus:outline-none focus-visible:ring-2"
                  style={{ color: inkSoft }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          {oatShare > 0.2 && <p className="note warn mt-2">{t.oatNote}</p>}
          <button
            type="button"
            onClick={addFlour}
            disabled={flours.length >= MAX_FLOURS}
            className="add-flour mt-3 w-full h-11 rounded-md text-sm disabled:opacity-30 focus:outline-none focus-visible:ring-2"
            style={{ color: ink, ...sans }}
          >
            + {t.addFlour}
          </button>
        </section>

        {/* Dough feel */}
        <section className="mt-8">
          <h2 style={display}>{t.feelHeading}</h2>
          <div className="feel-selector mt-3 flex rounded-md p-1 text-sm" style={{ background: crustLight, ...sans }}>
            {FEELS.map((f) => (
              <button
                key={f.key}
                type="button"
                aria-pressed={feel === f.key}
                onClick={() => setFeel(f.key)}
                className="flex-1 h-10 rounded-md transition-colors focus:outline-none focus-visible:ring-2"
                style={{ background: feel === f.key ? ink : "transparent", color: feel === f.key ? crust : inkSoft }}
              >
                {t.feels[f.key]}
              </button>
            ))}
          </div>
          <p className="note mt-2">{t.feelHint}</p>
        </section>

        {/* Results */}
        <section className="card mt-8">
          <h2 style={display}>{t.addToBowl}</h2>
          <div className="note">{t.doughWeight(Math.round(r.total))}</div>
          <div className="mix-bar mt-3" aria-hidden="true">
            {segments.map((sg, i) => (
              <div key={i} style={{ flexGrow: sg.w, background: sg.color }} />
            ))}
          </div>
          <div className="mt-2">
            <AmountRow label={t.flour} swatch={mixColor}>
              <Stepper step={100} t={t} onStep={(d) => r.addedFlour + d > 0 && scaleFlourTo(r.addedFlour + d)}>
                <TotalInput ariaLabel={t.flour} value={r.addedFlour} onCommit={scaleFlourTo} />
              </Stepper>
            </AmountRow>
            <AmountRow label={t.water} swatch={waterBlue}>
              <StaticAmount value={Math.round(Math.max(0, r.waterAdd))} />
            </AmountRow>
            <AmountRow
              label={t.starter}
              swatch={starterGold}
              note={
                starterOverride === null ? (
                  t.starterAuto
                ) : (
                  <button type="button" onClick={() => setStarterOverride(null)} className="underline rounded focus:outline-none focus-visible:ring-2">
                    {t.backToAuto}
                  </button>
                )
              }
            >
              <Stepper step={10} t={t} onStep={(d) => setStarterOverride(Math.max(0, r.starter + d))}>
                <GramsInput ariaLabel={t.starterAmount} value={r.starter} onChange={(g) => setStarterOverride(g)} />
              </Stepper>
            </AmountRow>
            <AmountRow label={t.salt} note={t.saltNote} swatch={saltGrey}>
              <StaticAmount value={(Math.round(r.salt * 10) / 10).toLocaleString(lang === "no" ? "nb" : "en", { minimumFractionDigits: 1 })} />
            </AmountRow>
          </div>
          <div className="card-divider">
            <AmountRow label={t.hydration} muted swatch={null}>
              <StaticAmount value={r.totalFlour > 0 ? Math.round(r.hyd * 100) : 0} unit="%" muted />
            </AmountRow>
            <AmountRow label={t.totalDough} swatch={null}>
              <Stepper step={100} t={t} onStep={(d) => r.total + d > 0 && scaleTotalTo(r.total + d)}>
                <TotalInput ariaLabel={t.totalDough} value={r.total} onCommit={scaleTotalTo} />
              </Stepper>
            </AmountRow>
          </div>
          <p className="note mt-3">{t.footnote}</p>
        </section>

        {/* Rise time */}
        <section className="card mt-6">
          <h2 style={display}>{t.riseHeading}</h2>
          <div className="mt-2">
            <AmountRow label={t.roomTemp}>
              <Stepper step={1} unit="°C" t={t} onStep={(d) => updateRise({ temp: Math.min(32, Math.max(10, rise.temp + d)) })}>
                <TotalInput unit="°C" ariaLabel={t.roomTemp} value={rise.temp} onCommit={(v) => updateRise({ temp: Math.min(32, Math.max(10, Math.round(v))) })} />
              </Stepper>
            </AmountRow>
            <AmountRow label={t.mixedAt}>
              <input
                type="time"
                aria-label={t.mixedAt}
                value={rise.mixAt}
                onChange={(e) => e.target.value && updateRise({ mixAt: e.target.value })}
                className="time-input h-12 rounded-md text-lg focus:outline-none focus-visible:ring-2"
                style={{ color: ink, border: `1px solid ${crustLine}`, ...display }}
              />
            </AmountRow>
            <label className="flex items-center gap-3 min-h-12 cursor-pointer" style={sans}>
              <input type="checkbox" checked={rise.coldStarter} onChange={(e) => updateRise({ coldStarter: e.target.checked })} className="cold-check shrink-0" />
              <span>{t.coldStarter}</span>
            </label>
          </div>
          {riseRange && (
            <div className="card-divider rise-out">
              <div className="tabular-nums" style={{ color: ink, ...display }}>
                {t.readyAt(clockAfter(riseRange[0]), clockAfter(riseRange[1]))}
              </div>
              <div className="note tabular-nums">{t.riseFor(`${fmtHours(riseRange[0])}–${fmtHours(riseRange[1])}`)}</div>
              <RiseTimeline mixAt={rise.mixAt} range={riseRange} nightLabel={t.night} />
            </div>
          )}
          <p className="note mt-3">{t.riseNote}</p>
        </section>

        {/* Method */}
        {activeRecipe && (
          <section className="method mt-8">
            <h2 style={display}>
              {t.method}: {activeRecipe.name[lang]}
            </h2>
            <ul className="mt-3 pl-5 list-disc space-y-1" style={{ color: ink, ...sans }}>
              {activeRecipe.steps[lang].map((step, i) => (
                <li key={i}>{step.replace("{mix}", rise.mixAt)}</li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
