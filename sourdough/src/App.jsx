import React, { useMemo, useState } from "react";

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
  { key: "bread", name: "White bread flour", hyd: 0.72 },
  { key: "ap", name: "All-purpose flour", hyd: 0.67 },
  { key: "ww", name: "Whole wheat", hyd: 0.83 },
  { key: "rye", name: "Rye", hyd: 0.9 },
  { key: "spelt", name: "Spelt", hyd: 0.66 },
  { key: "durum", name: "Durum / semolina", hyd: 0.65 },
  { key: "einkorn", name: "Einkorn", hyd: 0.6 },
];
const byKey = Object.fromEntries(FLOUR_TYPES.map((f) => [f.key, f]));

const FEELS = [
  { key: "firmer", label: "Firmer", adj: -0.05, hint: "Easier to shape" },
  { key: "standard", label: "Standard", adj: 0 },
  { key: "slack", label: "Slack", adj: 0.05, hint: "Open crumb, sticky" },
];

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
    { id: 1, type: "bread", grams: 400 },
    { id: 2, type: "ww", grams: 100 },
  ]);
  const [feel, setFeel] = useState("standard");
  const [starterOverride, setStarterOverride] = useState(null); // null = automatic

  const r = useMemo(() => {
    const addedFlour = flours.reduce((a, f) => a + (f.grams || 0), 0);
    const starter = starterOverride ?? Math.round(addedFlour * 0.2);
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
  const addFlour = () => setFlours((fs) => [...fs, { id: nextId++, type: "bread", grams: 0 }]);

  const segments = [
    ...flours.map((f, i) => ({ w: f.grams || 0, color: flourTones[i % flourTones.length] })),
    { w: Math.max(0, r.waterAdd), color: waterBlue },
    { w: r.starter, color: starterGold },
    { w: r.salt, color: saltGrey },
  ].filter((x) => x.w > 0);

  return (
    <div className="min-h-screen" style={{ background: crust, color: ink }}>
      <div className="calculator max-w-lg mx-auto px-5 pt-10 pb-16">
        <div className="bakery-mark" aria-hidden="true">
          <svg viewBox="0 0 140 90" fill="none">
            <path d="M15 58C12 32 34 12 68 11C104 8 129 30 127 55C126 72 109 79 72 79C37 80 18 73 15 58Z" fill="#CB9148" stroke="#70441F" strokeWidth="2.5" />
            <path d="M22 58C43 68 99 69 120 55" stroke="#A46930" strokeWidth="2" />
            <path d="M42 28C34 37 32 46 35 53M66 22C55 33 53 45 57 57M91 24C80 33 77 45 80 57M111 34C103 40 99 47 100 53" stroke="#F8E5B9" strokeWidth="7" strokeLinecap="round" />
            <path d="M26 43L27 42M47 62L48 62M100 63L101 62M76 17L77 17" stroke="#F8E5B9" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <span>Flour · water · salt · time</span>
        </div>
        <h1 className="text-3xl leading-tight mb-3" style={display}>Sourdough calculator</h1>
        <p className="mt-1 text-sm" style={{ color: inkSoft, ...sans }}>
          Weigh your flours. It works out the water, salt and starter.
        </p>

        {/* Flours */}
        <div className="mt-6">
          <h2 className="text-xl" style={display}>Your flour</h2>
          <div className="mt-1">
            {flours.map((f, i) => (
              <div key={f.id} className="flex items-center gap-2 py-2" style={{ borderBottom: `1px solid ${crustLine}` }}>
                <span className="w-3 h-3 rounded-sm shrink-0" style={{ background: flourTones[i % flourTones.length] }} />
                <select
                  value={f.type}
                  aria-label="Flour type"
                  onChange={(e) => updateFlour(f.id, { type: e.target.value })}
                  className="flex-1 min-w-0 h-12 px-2 rounded-md focus:outline-none focus-visible:ring-2"
                  style={{ background: crustLight, color: ink, border: `1px solid ${crustLine}`, ...sans }}
                >
                  {FLOUR_TYPES.map((t) => (
                    <option key={t.key} value={t.key}>{t.name}</option>
                  ))}
                </select>
                <GramsInput ariaLabel={`${byKey[f.type].name} amount`} value={f.grams} onChange={(g) => updateFlour(f.id, { grams: g })} />
                <button
                  type="button"
                  aria-label="Remove flour"
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
          <button
            type="button"
            onClick={addFlour}
            disabled={flours.length >= flourTones.length}
            className="add-flour mt-3 h-11 px-4 rounded-md text-sm disabled:opacity-30 focus:outline-none focus-visible:ring-2"
            style={{ background: ink, color: "#FFFDF7", ...sans }}
          >
            Add a flour
          </button>
        </div>

        {/* Dough feel */}
        <div className="mt-8">
          <h2 className="text-xl" style={display}>How should the dough feel?</h2>
          <div className="feel-selector mt-3 flex rounded-md p-1 text-sm" style={{ background: crustLight, ...sans }}>
            {FEELS.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setFeel(f.key)}
                className="flex-1 h-10 rounded-md transition-colors focus:outline-none focus-visible:ring-2"
                style={{ background: feel === f.key ? ink : "transparent", color: feel === f.key ? crust : inkSoft }}
              >
                {f.label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs" style={{ color: inkSoft, ...sans }}>
            Firmer is easier to handle; slack gives a more open crumb but sticks to everything.
          </p>
        </div>

        {/* Results */}
        <div className="results mt-8">
          <h2 className="text-xl" style={display}>Add to the bowl</h2>

          <div className="mt-4 h-2 w-full flex rounded-sm overflow-hidden" aria-hidden="true">
            {segments.map((s, i) => (
              <div key={i} style={{ width: `${(s.w / Math.max(1, r.total)) * 100}%`, background: s.color }} />
            ))}
          </div>

          <div className="mt-3">
            <Row swatch={flourTones[0]} name="Flour" grams={r.addedFlour} />
            <Row swatch={waterBlue} name="Water" grams={Math.max(0, r.waterAdd)} />
            <div className="flex items-center gap-3 py-2">
              <span className="w-3 h-3 rounded-sm shrink-0" style={{ background: starterGold }} />
              <span className="flex-1 min-w-0" style={{ color: ink, ...sans }}>
                Starter
                {starterOverride === null ? (
                  <span className="ml-2 text-xs" style={{ color: inkSoft }}>20% of your flour</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setStarterOverride(null)}
                    className="ml-2 text-xs underline focus:outline-none focus-visible:ring-2 rounded"
                    style={{ color: starterGold }}
                  >
                    Back to automatic
                  </button>
                )}
              </span>
              <GramsInput ariaLabel="Starter amount" value={r.starter} onChange={(g) => setStarterOverride(g)} />
            </div>
            <Row swatch={saltGrey} name="Salt" grams={r.salt} note="2% of flour" decimals={1} />
          </div>

          <div className="mt-4 pt-3 text-sm space-y-1" style={{ borderTop: `1px solid ${crustLine}`, color: inkSoft, ...sans }}>
            <div className="flex justify-between">
              <span>Hydration this gives you</span>
              <span className="tabular-nums">{r.totalFlour > 0 ? Math.round(r.hyd * 100) : 0}%</span>
            </div>
            <div className="flex justify-between" style={{ color: ink }}>
              <span>Total dough</span>
              <span className="tabular-nums">{Math.round(r.total)} g</span>
            </div>
          </div>

          <p className="mt-4 text-xs leading-relaxed" style={{ color: inkSoft, ...sans }}>
            Assumes a 100% hydration starter fed with white flour. Its water and flour are already counted, so the water above is what actually goes in the bowl.
          </p>
        </div>
      </div>
    </div>
  );
}
