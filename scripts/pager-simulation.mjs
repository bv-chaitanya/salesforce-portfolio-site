/**
 * Pager physics simulation — run with: node scripts/pager-simulation.mjs
 *
 * Replays synthetic but realistic input-device wheel streams against:
 *   A) the OLD shipped wheel heuristics (reconstructed: v2 silence-gate,
 *      v4 impulse+zones, v5 impulse+latch) — to reproduce the reported bugs
 *   B) the PROPOSED position-mapped runway state machine — to verify immunity
 *
 * No DOM. Scroll position integrates deltas, clamped to the document.
 */

const VH = 900; // viewport height
const HERO = 800;

// ---------------------------------------------------------------- devices --
// Mac trackpad flick: ~8ms cadence, ramp up, exponential inertia tail with
// occasional equal-delta plateaus (the notch-rule killer).
function trackpadFlick(strength = 1) {
    const events = [];
    let t = 0;
    for (let i = 0; i < 6; i++) { events.push({ t, dy: 20 + i * 18 * strength }); t += 8; }
    let v = 110 * strength;
    while (v > 2) {
        events.push({ t, dy: v });
        if (events.length % 7 === 0) { events.push({ t: t + 8, dy: v }); t += 8; } // plateau
        v *= 0.93;
        t += 8;
    }
    return events;
}

// Mouse wheel roll: constant notches, spaced
function mouseRoll(notches = 10, spacing = 80, delta = 100) {
    return Array.from({ length: notches }, (_, i) => ({ t: i * spacing, dy: delta }));
}

// Slow deliberate trackpad drag (fingers on pad, no inertia)
function drag(pixels = 600, step = 12, cadence = 16) {
    const n = Math.ceil(pixels / step);
    return Array.from({ length: n }, (_, i) => ({ t: i * cadence, dy: step }));
}

const concat = (...streams) => {
    const out = [];
    let offset = 0;
    for (const s of streams) {
        for (const e of s) out.push({ t: e.t + offset, dy: e.dy });
        offset = out.length ? out[out.length - 1].t + 400 : 0; // 400ms pause between gestures
    }
    return out;
};

// ------------------------------------------------------- old heuristics ----
// v2: silence-gated ("fresh gesture" only)
function makeV2() {
    let lastEvt = 0;
    return (e, world) => {
        const fresh = e.t - lastEvt > 250;
        lastEvt = e.t;
        if (!fresh) return false;
        return e.dy > 30 && world.atBottom(16);
    };
}

// v4: impulse (rising delta / notch / fresh) + 160px zone + overshoot accumulator (no latch)
function makeV4() {
    let lastEvt = 0, lastAbs = 0, lastFlip = -1e9, accum = 0;
    return (e, world) => {
        const since = e.t - lastEvt; lastEvt = e.t;
        const prevAbs = since > 250 ? 0 : lastAbs;
        lastAbs = Math.abs(e.dy);
        if (e.t - lastFlip < 450) return false;
        const abs = Math.abs(e.dy);
        const impulse = abs >= 30 && (prevAbs === 0 || abs > prevAbs * 1.2 || (abs >= 40 && Math.abs(abs - prevAbs) < 1));
        if (e.dy <= 0 || !world.atBottom(160)) { accum = 0; return false; }
        accum += e.dy;
        if (impulse || accum > 160) { lastFlip = e.t; accum = 0; return true; }
        return false;
    };
}

// v5: v4 + post-flip latch until silence (250ms gap, 1100ms hard cap) + notch needs >=40ms gap
function makeV5() {
    let lastEvt = 0, lastAbs = 0, lastFlip = -1e9, accum = 0, latched = false;
    return (e, world) => {
        const since = e.t - lastEvt; lastEvt = e.t;
        if (latched) {
            if (since <= 250 && e.t - lastFlip < 1100) { lastAbs = Math.abs(e.dy); return false; }
            latched = false;
        }
        const prevAbs = since > 250 ? 0 : lastAbs;
        lastAbs = Math.abs(e.dy);
        const abs = Math.abs(e.dy);
        const impulse = abs >= 30 && (prevAbs === 0 || abs > prevAbs * 1.2
            || (abs >= 40 && Math.abs(abs - prevAbs) < 1 && since >= 40));
        if (e.dy <= 0 || !world.atBottom(160)) { accum = 0; return false; }
        accum += e.dy;
        if ((e.t - lastFlip >= 450) && (impulse || accum > 160)) {
            lastFlip = e.t; accum = 0; latched = true; return true;
        }
        return false;
    };
}

// --------------------------------------------------- old-world simulator ---
// Old design: one panel in flow; doc = hero + panel + 120px padding.
function simulateOld(name, heuristicFactory, stream, panels) {
    let tab = 0;
    const docHeight = () => HERO + panels[tab] + 120;
    let scrollY = Math.max(0, docHeight() - VH); // start parked at page bottom
    const world = { atBottom: (eps) => VH + scrollY >= docHeight() - eps };
    const decide = heuristicFactory();
    let flips = 0;
    for (const e of stream) {
        scrollY = Math.min(Math.max(0, scrollY + e.dy), docHeight() - VH);
        if (decide(e, world) && tab < panels.length - 1) {
            tab++;
            flips++;
            scrollY = HERO; // ensureTopVisible lands at panel top
        }
    }
    return { name, flips, tab };
}

// ------------------------------------------------- new runway state machine -
// computePagerState: pure position -> {tab, p}. Doc = hero + panel + runway(0.7*VH)
// (runway only when a next tab exists). Commit at p >= 1 -> scrollY = HERO.
const RUNWAY = Math.round(VH * 0.7);

function computeP(scrollY, panelH, hasNext) {
    if (!hasNext) return 0;
    const runwayStart = Math.max(0, HERO + panelH - VH);
    return Math.min(Math.max((scrollY - runwayStart) / RUNWAY, 0), 1);
}

function simulateNew(stream, panels, { startAtBottom = true } = {}) {
    let tab = 0;
    let commits = 0;
    const docHeight = () => {
        const hasNext = tab < panels.length - 1;
        return HERO + panels[tab] + (hasNext ? RUNWAY : 120);
    };
    let scrollY = startAtBottom
        ? Math.max(0, HERO + panels[tab] - VH) // parked at content end (p = 0)
        : 0;
    let maxParkedP = 0;
    for (const e of stream) {
        scrollY = Math.min(Math.max(0, scrollY + e.dy), docHeight() - VH);
        const hasNext = tab < panels.length - 1;
        const p = computeP(scrollY, panels[tab], hasNext);
        if (p >= 1 && hasNext) {
            tab++;
            commits++;
            scrollY = HERO; // same-frame handoff to new panel top
        } else if (p > 0) {
            maxParkedP = Math.max(maxParkedP, p);
        }
    }
    const finalP = computeP(scrollY, panels[tab], tab < panels.length - 1);
    return { commits, tab, finalP: +finalP.toFixed(2), maxParkedP: +maxParkedP.toFixed(2) };
}

// --------------------------------------- REFINED: continuous-flow model ----
// Simulation finding: jump-on-commit lets momentum chain through short pages.
// Refinement: NO scroll jumps. One continuous document: hero + p1 + seam +
// p2 + seam + ... Each seam (RUNWAY px) scroll-maps the next panel sliding in
// as a fixed overlay; at seam end the next panel continues in natural flow.
// Momentum behaves exactly like a long document — predictable everywhere.
function continuousMetrics(panels) {
    const starts = [];
    const seams = [];
    let cursor = HERO;
    for (let i = 0; i < panels.length; i++) {
        starts.push(cursor);
        if (i < panels.length - 1) {
            const seamStart = Math.max(cursor, cursor + panels[i] - VH);
            seams.push(seamStart);
            cursor = seamStart + RUNWAY;
        }
    }
    const docHeight = cursor + panels[panels.length - 1] + 120;
    return { starts, seams, docHeight };
}

function continuousState(scrollY, m) {
    let segment = 0;
    for (let i = 0; i < m.starts.length; i++) {
        if (scrollY >= m.starts[i]) segment = i;
    }
    let p = 0;
    if (segment < m.seams.length) {
        p = Math.min(Math.max((scrollY - m.seams[segment]) / RUNWAY, 0), 1);
    }
    return { segment, p };
}

function simulateContinuous(stream, panels, { startAt = 'bottomOfFirst' } = {}) {
    const m = continuousMetrics(panels);
    let scrollY = startAt === 'bottomOfFirst' ? m.seams[0] : 0; // parked at seam start (p=0)
    if (startAt === 'top') scrollY = HERO;
    let seamsCrossed = 0;
    let prev = continuousState(scrollY, m);
    let maxP = 0;
    for (const e of stream) {
        scrollY = Math.min(Math.max(0, scrollY + e.dy), m.docHeight - VH);
        const st = continuousState(scrollY, m);
        if (st.segment > prev.segment) seamsCrossed += st.segment - prev.segment;
        maxP = Math.max(maxP, st.p);
        prev = st;
    }
    return { endSegment: prev.segment, endP: +prev.p.toFixed(2), seamsCrossed, maxP: +maxP.toFixed(2) };
}

// ------------------------------------------------------------- scenarios ---
const PANELS = [3200, 1100, 600, 900]; // Experience, Skills, Certifications, Education
const pad = (s, n) => String(s).padEnd(n);

console.log('USER-REPORTED BUG SCENARIOS — old heuristics vs position-mapped runway');
console.log('viewport 900px, hero 800px, panels [Exp 3200, Skills 1100, Certs 600, Edu 900]\n');

const scenarios = [
    {
        name: 'S1 mouse: roll 10 notches at page end ("not going to skills")',
        stream: mouseRoll(10, 80, 100),
        expect: 'exactly 1 page turn'
    },
    {
        name: 'S2 trackpad: one hard flick at page end ("auto-advances")',
        stream: trackpadFlick(2.2),
        expect: 'exactly 1 page turn'
    },
    {
        name: 'S3 trackpad: three deliberate flicks ("took 3 scrolls")',
        stream: concat(trackpadFlick(1), trackpadFlick(1), trackpadFlick(1)),
        expect: '1 turn on the FIRST flick (others read next page)'
    },
    {
        name: 'S4 drag: slow continuous 1600px scroll from page end',
        stream: drag(1600),
        expect: 'exactly 1 page turn (deliberate continuation)'
    }
];

for (const sc of scenarios) {
    console.log(sc.name + '   [expected: ' + sc.expect + ']');
    for (const [label, factory] of [['v2 silence-gate', makeV2], ['v4 impulse+zones', makeV4], ['v5 final latch', makeV5]]) {
        const r = simulateOld(label, factory, sc.stream, PANELS);
        console.log('   old ' + pad(label, 18) + ' page turns: ' + r.flips);
    }
    const n = simulateNew(sc.stream, PANELS);
    console.log('   NEW jump-commit       page turns: ' + n.commits
        + (n.finalP > 0 ? '  (parked p=' + n.finalP + ')' : ''));
    const c = simulateContinuous(sc.stream, PANELS);
    console.log('   NEW continuous-flow   ends on: ' + ['Experience','Skills','Certs','Education'][c.endSegment]
        + ' | seams crossed: ' + c.seamsCrossed
        + (c.endP > 0 && c.endP < 1 ? ' | mid-slide p=' + c.endP + ' (visible, reversible)' : ''));
    console.log('');
}

// mid-page reading must never transition
console.log('S5 reading: 1200px of scrolling from the TOP of Experience (mid-page)');
const mid = simulateNew(drag(1200), PANELS, { startAtBottom: false });
console.log('   NEW jump-commit       page turns: ' + mid.commits + ' (p stayed ' + mid.finalP + ')');
const midC = simulateContinuous(drag(1200), PANELS, { startAt: 'top' });
console.log('   NEW continuous-flow   seams crossed: ' + midC.seamsCrossed + ' (max p touched: ' + midC.maxP + ')\n');

console.log('S7 backward: from Skills top, scroll UP 900px (continuous model only)');
const back = (() => {
    const m = continuousMetrics(PANELS);
    let scrollY = m.seams[0] + RUNWAY; // exactly at Skills start
    let minP = 1;
    for (const e of drag(900).map((x) => ({ t: x.t, dy: -x.dy }))) {
        scrollY = Math.max(0, scrollY + e.dy);
        const st = continuousState(scrollY, m);
        if (st.segment === 0) minP = Math.min(minP, st.p);
    }
    const st = continuousState(scrollY, m);
    return { seg: st.segment, minP: +minP.toFixed(2) };
})();
console.log('   NEW continuous-flow   ends on: ' + ['Experience','Skills'][back.seg]
    + ' — slid back out through the seam (free, symmetric backward support)\n');

// reversibility: scrub into the runway then back out
console.log('S6 scrub: 400px into runway, then 400px back up');
const scrub = concat(drag(400), drag(400).map((e) => ({ t: e.t, dy: -e.dy })));
const sr = simulateNew(scrub, PANELS);
console.log('   NEW runway model      page turns: ' + sr.commits
    + ' (peaked p=' + sr.maxParkedP + ', settled p=' + sr.finalP + ' — fully reversible)\n');

console.log('Determinism check: identical streams replayed 3x →');
for (let i = 0; i < 3; i++) {
    const r = simulateNew(trackpadFlick(2.2), PANELS);
    process.stdout.write('   run ' + (i + 1) + ': turns=' + r.commits + ' p=' + r.finalP + (i < 2 ? '\n' : '\n'));
}
