import React, { useEffect, useMemo, useState } from "react";

const ink = "#38291F";
const inkSoft = "#73604D";
const crust = "#F6F1E7";
const crustLight = "#FFFDF7";
const crustLine = "#D8CBB5";
const waterBlue = "#628B94";
const starterGold = "#A85E25";
const saltGrey = "#9D9A85";
const flourTones = ["#B98542", "#79512F", "#D5B57A", "#A08B55", "#CE9D66"];

const display = { fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif', fontWeight: 650, letterSpacing: "-0.035em" };
const sans = { fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif' };

// Baseline hydration each flour wants in a sourdough loaf
const FLOUR_TYPES = [
  { key: "bread", name: { en: "Strong bread flour", no: "Hvetemel special" }, hyd: 0.72 },
  { key: "ap", name: { en: "All-purpose flour", no: "Hvetemel, siktet" }, hyd: 0.67 },
  { key: "ww", name: { en: "Whole wheat", no: "Sammalt hvete" }, hyd: 0.83 },
  { key: "rye", name: { en: "Rye", no: "Rugmel" }, hyd: 0.9 },
  { key: "wrye", name: { en: "Wholemeal rye", no: "Sammalt rug" }, hyd: 0.95 },
  { key: "spelt", name: { en: "Spelt", no: "Speltmel" }, hyd: 0.66 },
  { key: "wspelt", name: { en: "Wholemeal spelt", no: "Sammalt spelt" }, hyd: 0.75 },
  { key: "durum", name: { en: "Durum / semolina", no: "Durum / semulegryn" }, hyd: 0.65 },
  { key: "einkorn", name: { en: "Einkorn", no: "Enkorn" }, hyd: 0.6 },
  { key: "oat", name: { en: "Oat flour", no: "Havremel" }, hyd: 0.8 },
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
    tagline: "Flour · water · salt · time",
    intro: "Weigh your flours. It works out the water, salt and starter.",
    yourFlour: "Your flour",
    flourType: "Flour type",
    amount: (name) => `${name} amount`,
    removeFlour: "Remove flour",
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
    hydration: "Hydration this gives you",
    totalDough: "Total dough",
    footnote: "Assumes a 100% hydration starter fed with white flour. Its water and flour are already counted, so the water above is what actually goes in the bowl.",
    oatNote: "Oat flour has no gluten. Keep it to about 20% of the flour, or the loaf gets dense.",
    recipes: "Start from a recipe",
    method: "Method",
    totalHint: "Change it to scale everything",
    flourHint: "change to scale",
  },
  no: {
    title: "Surdeigskalkulator",
    tagline: "Mel · vann · salt · tid",
    intro: "Vei opp melet ditt. Kalkulatoren regner ut vann, salt og surdeig.",
    yourFlour: "Melet ditt",
    flourType: "Meltype",
    amount: (name) => `Mengde ${name.toLowerCase()}`,
    removeFlour: "Fjern mel",
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
    hydration: "Dette gir en hydrering på",
    totalDough: "Total deig",
    footnote: "Forutsetter en surdeig med 100 % hydrering, matet med hvetemel. Vannet og melet i surdeigen er allerede regnet med, så vannet over er det du faktisk har i bollen.",
    oatNote: "Havremel har ikke gluten. Hold det til rundt 20 % av melet, ellers blir brødet kompakt.",
    recipes: "Start fra en oppskrift",
    method: "Fremgangsmåte",
    totalHint: "Endre for å skalere alt",
    flourHint: "endre for å skalere",
  },
};

// Evening-to-morning tin-loaf method; recipes override the steps that differ
const TIN = {
  en: {
    mix: "17–18: mix flour, water, starter and salt",
    folds: "3–5 stretch and folds through the evening",
    bulk: "Leave on the counter overnight; by morning it should have grown by a third to a half",
    shape: "Morning: shape and put in a greased tin",
    proof: "Bake after 1–2 h, or keep in the fridge and bake after work",
    bake: "230 °C for 45–50 min (5 min more straight from the fridge)",
    rest: "Cool 2 h before cutting",
  },
  no: {
    mix: "Kl. 17–18: bland mel, vann, surdeig og salt",
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
    name: { en: "Oat grovbrød", no: "Havregrovbrød" },
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
        "17–18: mix everything",
        "3–5 stretch and folds through the evening",
        "Leave on the counter overnight",
        "Morning: oil a tin and stretch the dough into it",
        "Rise until puffy, 2–4 h, or fridge until after work",
        "Oil, dimple, flaky salt and rosemary",
        "230 °C for 20–25 min",
      ],
      no: [
        "Kl. 17–18: bland alt",
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

function initialLang() {
  try {
    const saved = localStorage.getItem("sourdough-lang");
    if (saved === "en" || saved === "no") return saved;
  } catch {}
  const nav = (typeof navigator !== "undefined" && navigator.language) || "";
  return /^(nb|nn|no)\b/i.test(nav) ? "no" : "en";
}

let nextId = 3;

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
        className={`${wide ? "w-28" : "w-24"} h-12 text-center text-xl rounded-md bg-transparent focus:outline-none focus-visible:ring-2`}
        style={{ color: ink, border: `1px solid ${crustLine}`, ...display }}
      />
      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-sm pointer-events-none" style={{ color: inkSoft }}>g</span>
    </div>
  );
}

// Holds a draft while typing so a half-typed "1" doesn't scale the recipe down to one gram
function TotalInput({ value, onCommit, ariaLabel }) {
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
        className="w-28 h-11 text-center text-lg rounded-md bg-transparent focus:outline-none focus-visible:ring-2"
        style={{ color: ink, border: `1px solid ${crustLine}`, ...display }}
      />
      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-sm pointer-events-none" style={{ color: inkSoft }}>g</span>
    </div>
  );
}

function Row({ swatch, name, grams, note, decimals = 0 }) {
  const shown = decimals ? (Math.round(grams * 10) / 10).toFixed(1) : Math.round(grams);
  return (
    <div className="flex items-baseline gap-3 py-2">
      <span className="w-3 h-3 rounded-sm shrink-0 self-center" style={{ background: swatch }} />
      <span className="flex-1 min-w-0" style={{ color: ink, ...sans }}>
        {name}
        {note && <span className="ml-2 text-xs" style={{ color: inkSoft }}>{note}</span>}
      </span>
      <span className="tabular-nums" style={{ color: ink, fontSize: 30, ...display }}>
        {shown}
        <span className="text-sm ml-1" style={{ color: inkSoft }}>g</span>
      </span>
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

  const oatGrams = flours.reduce((a, f) => a + (f.type === "oat" ? f.grams || 0 : 0), 0);
  const oatShare = r.addedFlour > 0 ? oatGrams / r.addedFlour : 0;

  const segments = [
    ...flours.map((f, i) => ({ w: f.grams || 0, color: flourTones[i % flourTones.length] })),
    { w: Math.max(0, r.waterAdd), color: waterBlue },
    { w: r.starter, color: starterGold },
    { w: r.salt, color: saltGrey },
  ].filter((x) => x.w > 0);

  return (
    <div className="min-h-screen" style={{ background: crust, color: ink }}>
      <div className="calculator max-w-lg mx-auto px-5 pt-10 pb-16">
        <div className="lang-switch" role="group" aria-label="Language / Språk">
          {[
            { key: "no", label: "NO" },
            { key: "en", label: "EN" },
          ].map((l) => (
            <button
              key={l.key}
              type="button"
              aria-pressed={lang === l.key}
              onClick={() => setLang(l.key)}
              className="h-8 px-3 rounded-md text-xs focus:outline-none focus-visible:ring-2"
              style={{ background: lang === l.key ? ink : "transparent", color: lang === l.key ? crust : inkSoft, ...sans }}
            >
              {l.label}
            </button>
          ))}
        </div>
        <div className="bakery-mark" aria-hidden="true">
          <svg viewBox="0 0 140 90" fill="none">
            <path d="M15 58C12 32 34 12 68 11C104 8 129 30 127 55C126 72 109 79 72 79C37 80 18 73 15 58Z" fill="#CB9148" stroke="#70441F" strokeWidth="2.5" />
            <path d="M22 58C43 68 99 69 120 55" stroke="#A46930" strokeWidth="2" />
            <path d="M42 28C34 37 32 46 35 53M66 22C55 33 53 45 57 57M91 24C80 33 77 45 80 57M111 34C103 40 99 47 100 53" stroke="#F8E5B9" strokeWidth="7" strokeLinecap="round" />
            <path d="M26 43L27 42M47 62L48 62M100 63L101 62M76 17L77 17" stroke="#F8E5B9" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <span>{t.tagline}</span>
        </div>
        <h1 className="text-3xl leading-tight mb-3" style={display}>{t.title}</h1>
        <p className="mt-1 text-sm" style={{ color: inkSoft, ...sans }}>
          {t.intro}
        </p>

        {/* Recipes */}
        <div className="mt-6">
          <h2 className="text-xl" style={display}>{t.recipes}</h2>
          <div className="recipe-chips mt-3 flex flex-wrap gap-2">
            {RECIPES.map((rec) => (
              <button
                key={rec.key}
                type="button"
                aria-pressed={recipe === rec.key}
                onClick={() => pickRecipe(rec)}
                className="h-9 px-3 rounded-full text-sm focus:outline-none focus-visible:ring-2"
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
        </div>

        {/* Flours */}
        <div className="mt-8">
          <h2 className="text-xl" style={display}>{t.yourFlour}</h2>
          <div className="mt-1">
            {flours.map((f, i) => (
              <div key={f.id} className="flex items-center gap-2 py-2" style={{ borderBottom: `1px solid ${crustLine}` }}>
                <span className="w-3 h-3 rounded-sm shrink-0" style={{ background: flourTones[i % flourTones.length] }} />
                <select
                  value={f.type}
                  aria-label={t.flourType}
                  onChange={(e) => updateFlour(f.id, { type: e.target.value })}
                  className="flex-1 min-w-0 h-12 px-2 rounded-md focus:outline-none focus-visible:ring-2"
                  style={{ background: crustLight, color: ink, border: `1px solid ${crustLine}`, ...sans }}
                >
                  {FLOUR_TYPES.map((ft) => (
                    <option key={ft.key} value={ft.key}>{ft.name[lang]}</option>
                  ))}
                </select>
                <GramsInput ariaLabel={t.amount(byKey[f.type].name[lang])} value={f.grams} onChange={(g) => updateFlour(f.id, { grams: g })} />
                <button
                  type="button"
                  aria-label={t.removeFlour}
                  onClick={() => removeFlour(f.id)}
                  disabled={flours.length === 1}
                  className="w-10 h-12 rounded-md text-lg disabled:opacity-30 focus:outline-none focus-visible:ring-2"
                  style={{ color: inkSoft }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          {oatShare > 0.2 && (
            <p className="mt-2 text-xs" style={{ color: starterGold, ...sans }}>{t.oatNote}</p>
          )}
          <button
            type="button"
            onClick={addFlour}
            disabled={flours.length >= flourTones.length}
            className="add-flour mt-3 h-11 px-4 rounded-md text-sm disabled:opacity-30 focus:outline-none focus-visible:ring-2"
            style={{ background: ink, color: "#FFFDF7", ...sans }}
          >
            {t.addFlour}
          </button>
        </div>

        {/* Dough feel */}
        <div className="mt-8">
          <h2 className="text-xl" style={display}>{t.feelHeading}</h2>
          <div className="feel-selector mt-3 flex rounded-md p-1 text-sm" style={{ background: crustLight, ...sans }}>
            {FEELS.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setFeel(f.key)}
                className="flex-1 h-10 rounded-md transition-colors focus:outline-none focus-visible:ring-2"
                style={{ background: feel === f.key ? ink : "transparent", color: feel === f.key ? crust : inkSoft }}
              >
                {t.feels[f.key]}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs" style={{ color: inkSoft, ...sans }}>
            {t.feelHint}
          </p>
        </div>

        {/* Results */}
        <div className="results mt-8">
          <h2 className="text-xl" style={display}>{t.addToBowl}</h2>

          <div className="mt-4 h-2 w-full flex rounded-sm overflow-hidden" aria-hidden="true">
            {segments.map((s, i) => (
              <div key={i} style={{ width: `${(s.w / Math.max(1, r.total)) * 100}%`, background: s.color }} />
            ))}
          </div>

          <div className="mt-3">
            <div className="flex items-center gap-3 py-2">
              <span className="w-3 h-3 rounded-sm shrink-0" style={{ background: flourTones[0] }} />
              <span className="flex-1 min-w-0" style={{ color: ink, ...sans }}>
                {t.flour}
                <span className="ml-2 text-xs" style={{ color: inkSoft }}>{t.flourHint}</span>
              </span>
              <TotalInput ariaLabel={t.flour} value={r.addedFlour} onCommit={scaleFlourTo} />
            </div>
            <Row swatch={waterBlue} name={t.water} grams={Math.max(0, r.waterAdd)} />
            <div className="flex items-center gap-3 py-2">
              <span className="w-3 h-3 rounded-sm shrink-0" style={{ background: starterGold }} />
              <span className="flex-1 min-w-0" style={{ color: ink, ...sans }}>
                {t.starter}
                {starterOverride === null ? (
                  <span className="ml-2 text-xs" style={{ color: inkSoft }}>{t.starterAuto}</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setStarterOverride(null)}
                    className="ml-2 text-xs underline focus:outline-none focus-visible:ring-2 rounded"
                    style={{ color: starterGold }}
                  >
                    {t.backToAuto}
                  </button>
                )}
              </span>
              <GramsInput ariaLabel={t.starterAmount} value={r.starter} onChange={(g) => setStarterOverride(g)} />
            </div>
            <Row swatch={saltGrey} name={t.salt} grams={r.salt} note={t.saltNote} decimals={1} />
          </div>

          <div className="mt-4 pt-3 text-sm space-y-1" style={{ borderTop: `1px solid ${crustLine}`, color: inkSoft, ...sans }}>
            <div className="flex justify-between">
              <span>{t.hydration}</span>
              <span className="tabular-nums">{r.totalFlour > 0 ? Math.round(r.hyd * 100) : 0}%</span>
            </div>
            <div className="flex items-center justify-between gap-3 pt-2" style={{ color: ink }}>
              <span>
                {t.totalDough}
                <span className="block text-xs" style={{ color: inkSoft }}>{t.totalHint}</span>
              </span>
              <TotalInput ariaLabel={t.totalDough} value={r.total} onCommit={scaleTotalTo} />
            </div>
          </div>

          <p className="mt-4 text-xs leading-relaxed" style={{ color: inkSoft, ...sans }}>
            {t.footnote}
          </p>
        </div>

        {/* Method */}
        {activeRecipe && (
          <div className="method mt-8">
            <h2 className="text-xl" style={display}>
              {t.method} · {activeRecipe.name[lang]}
            </h2>
            <ul className="mt-3 pl-5 list-disc space-y-1 text-sm" style={{ color: ink, ...sans }}>
              {activeRecipe.steps[lang].map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
