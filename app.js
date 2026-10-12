const MIN = 0;
const MAX = 1000;
const KEY = "gd-piggy-bank";
const COIN_R = 8;
const PIG_SCALE = 5;

const PAL = {
  o: "#1f1f1f",
  b: "#ff7a1a",
  d: "#d9620a",
  s: "#2e2e2e",
  e: "#f2ebd9",
  k: "#1a1a1a",
};

const PIG = [
  "..........ssssss........................",
  "........oossssssoo......................",
  ".......obssssssssbo.....................",
  "......obsssssssssbbo....................",
  ".....obbsssssssssbbo........eee.........",
  "....obbbbssssssssbbbo......ekkke........",
  "...obbbbbsssssssssbbbbo....eeeoo........",
  "..obbbbbbbddddbbbbbbbbbo.....obbo.......",
  "..obbbbbbbbbbbbbbbbbbbbbbo...obbo.......",
  ".obbbbbbbbbbbbbbbbbbbbbbbbboobbo........",
  ".obbbbbbbbbbbbbbbbbbbbbbbbbbbbbbo.......",
  ".obbbbbbbbbbbbbbbbeebbbbbbbbbbbbbbo.....",
  "..obbbbbbbbbbbbbbbbkebbbbbbbbbbbbbbo....",
  "..obbbbbbbbbbbbbbbbeebbbbbbbbbbbbbbo....",
  "...obbbbbbbbbbbbbbbbbbbbbbbbbbbbbbo.....",
  "....obbbbbbbbbbbbbbbbbbbbbbbbbbbbo......",
  ".....ooooooooooooooooooooooooooooo......",
  "......dd....................dd..........",
  "......oo....................oo..........",
];

const COIN = [
  "..oooo..",
  ".obddbo.",
  "obbeebbo",
  "obbeebbo",
  "obbeebbo",
  "obbeebbo",
  ".obddbo.",
  "..oooo..",
];

const bar = document.querySelector("#bar");
const statusEl = document.querySelector("#status");
const lowReadout = document.querySelector("#low-readout");
const highReadout = document.querySelector("#high-readout");
const track = document.querySelector("#track");
const fill = document.querySelector("#fill");
const thumbLow = document.querySelector("#thumb-low");
const thumbHigh = document.querySelector("#thumb-high");
const backBtn = document.querySelector("#back");
const resetBtn = document.querySelector("#reset");
const canvas = document.querySelector("#stage");
const ctx = canvas.getContext("2d");

const state = { low: 40, high: 60, total: 0, banked: 0, celebrated: false };
const coins = new Set();
const doomed = [];
let statics = [];
let view = null;
let dragged = null;

const { Engine, Bodies, Body, Composite, Events, Mouse, MouseConstraint, Sleeping } = Matter;
const engine = Engine.create({ enableSleeping: true });
engine.gravity.y = 1.6;
const mouse = Mouse.create(canvas);
const mouseConstraint = MouseConstraint.create(engine, {
  mouse,
  collisionFilter: { mask: 0xffffffff },
  constraint: { stiffness: 0.85, damping: 0.15, length: 0 },
});
Composite.add(engine.world, mouseConstraint);

const pigSprite = sprite(PIG, PIG_SCALE);
const coinSprite = sprite(COIN, 2);

function sprite(rows, scale) {
  const width = rows[0].length;
  for (const row of rows) {
    if (row.length !== width) throw new Error("sprite row length");
  }
  const canvasEl = document.createElement("canvas");
  canvasEl.width = width * scale;
  canvasEl.height = rows.length * scale;
  const g = canvasEl.getContext("2d");
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const color = PAL[row[x]];
      if (!color) continue;
      g.fillStyle = color;
      g.fillRect(x * scale, y * scale, scale, scale);
    }
  });
  return canvasEl;
}

function clampRange(low, high) {
  low = Math.round(Number(low));
  high = Math.round(Number(high));
  if (!Number.isFinite(low)) low = 40;
  if (!Number.isFinite(high)) high = 60;
  low = Math.min(MAX, Math.max(MIN, low));
  high = Math.min(MAX, Math.max(MIN, high));
  if (low > high) {
    const swap = low;
    low = high;
    high = swap;
  }
  if (high < 1) high = 1;
  if (low > high) low = high;
  return [low, high];
}

function roll(low, high) {
  return low + Math.floor(Math.random() * (high - low + 1));
}

function readRangeFromUrl() {
  const params = new URLSearchParams(location.search);
  if (!params.has("low") || !params.has("high")) return null;
  const low = Number(params.get("low"));
  const high = Number(params.get("high"));
  if (!Number.isFinite(low) || !Number.isFinite(high)) return null;
  return clampRange(low, high);
}

function writeRangeToUrl(low, high) {
  const url = new URL(location.href);
  url.searchParams.set("low", String(low));
  url.searchParams.set("high", String(high));
  if (url.href !== location.href) history.replaceState(null, "", url);
}

function savedSession() {
  try {
    const data = JSON.parse(localStorage.getItem(KEY));
    if (!data) return null;
    const [low, high] = clampRange(data.rangeLow, data.rangeHigh);
    const total = data.total;
    const banked = data.banked;
    if (!Number.isInteger(total) || total < 0 || total > MAX) return null;
    if (!Number.isInteger(banked) || banked < 0 || banked > total) return null;
    return { low, high, total, banked };
  } catch {
    return null;
  }
}

function save() {
  localStorage.setItem(KEY, JSON.stringify({
    rangeLow: state.low,
    rangeHigh: state.high,
    total: state.total,
    banked: state.banked,
  }));
}

function loadState() {
  const fromUrl = readRangeFromUrl();
  const saved = savedSession();
  if (fromUrl) {
    state.low = fromUrl[0];
    state.high = fromUrl[1];
    if (saved && saved.low === state.low && saved.high === state.high) {
      state.total = saved.total;
      state.banked = saved.banked;
    } else {
      state.total = roll(state.low, state.high);
      state.banked = 0;
    }
  } else if (saved) {
    state.low = saved.low;
    state.high = saved.high;
    state.total = saved.total;
    state.banked = saved.banked;
  } else {
    state.low = 40;
    state.high = 60;
    state.total = roll(state.low, state.high);
    state.banked = 0;
  }
  state.celebrated = state.banked >= state.total;
  writeRangeToUrl(state.low, state.high);
  save();
}

let audioCtx = null;
let unlocked = false;
let lastTick = 0;

function unlockAudio() {
  if (!audioCtx) audioCtx = new AudioContext();
  if (audioCtx.state === "suspended") audioCtx.resume();
  unlocked = true;
}

function beep(freq, when, dur, vol) {
  if (!unlocked) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = "square";
  osc.frequency.setValueAtTime(freq, when);
  gain.gain.setValueAtTime(vol, when);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + dur);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start(when);
  osc.stop(when + dur + 0.02);
}

const sfx = {
  grab() { beep(880, audioCtx.currentTime, 0.05, 0.05); },
  release() { beep(420, audioCtx.currentTime, 0.07, 0.05); },
  banked() {
    const t = audioCtx.currentTime;
    beep(660, t, 0.07, 0.06);
    beep(990, t + 0.07, 0.1, 0.06);
  },
  putBack() {
    const t = audioCtx.currentTime;
    beep(880, t, 0.06, 0.05);
    beep(520, t + 0.07, 0.08, 0.05);
  },
  tick() {
    if (!unlocked) return;
    const t = audioCtx.currentTime;
    if (t - lastTick < 0.09) return;
    lastTick = t;
    beep(180, t, 0.03, 0.025);
  },
  goal() {
    const t = audioCtx.currentTime;
    [523, 659, 784, 1046].forEach((freq, i) => beep(freq, t + i * 0.09, 0.12, 0.06));
  },
  reset() {
    const t = audioCtx.currentTime;
    beep(440, t, 0.07, 0.05);
    beep(294, t + 0.08, 0.1, 0.05);
  },
};

function wall(x, y, w, h) {
  return Bodies.rectangle(x, y, w, h, {
    isStatic: true,
    friction: 0.85,
    restitution: 0,
    label: "wall",
  });
}

function measure(w, h) {
  const floor = h - 18;
  const bankW = PIG[0].length * PIG_SCALE;
  const bankH = PIG.length * PIG_SCALE;
  const bankX = Math.round(w - 28 - bankW);
  const bankY = Math.round(floor - bankH);
  const penRight = Math.max(140, bankX - 92);
  return {
    w,
    h,
    floor,
    bankX,
    bankY,
    pen: { x: 20, y: 16, w: penRight - 20, h: floor - 16 },
    bumperX: penRight,
  };
}

function slotSensor(originX, originY) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -1;
  let maxY = -1;
  PIG.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      if (row[x] !== "s") continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  });
  const x = originX + minX * PIG_SCALE;
  const y = originY + minY * PIG_SCALE;
  const w = (maxX - minX + 1) * PIG_SCALE;
  const h = (maxY - minY + 1) * PIG_SCALE;
  return Bodies.rectangle(x + w / 2, y + h / 2, w, h, {
    isStatic: true,
    isSensor: true,
    label: "slot",
  });
}

function bankSolids(originX, originY) {
  const bodies = [];
  PIG.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      while (x < row.length && (row[x] === "." || row[x] === "s")) x++;
      const start = x;
      while (x < row.length && row[x] !== "." && row[x] !== "s") x++;
      if (x === start) continue;
      const w = (x - start) * PIG_SCALE;
      const h = PIG_SCALE + 1;
      bodies.push(wall(
        originX + start * PIG_SCALE + w / 2,
        originY + y * PIG_SCALE + PIG_SCALE / 2,
        w,
        h,
      ));
    }
  });
  bodies.push(slotSensor(originX, originY));
  return bodies;
}

function rebuildStatics() {
  for (const body of statics) Composite.remove(engine.world, body);
  const m = view;
  statics = [
    wall(m.w / 2, m.floor + 30, m.w + 80, 60),
    wall(-30, m.floor - 2000, 60, 5000),
    wall(m.w + 30, m.floor - 2000, 60, 5000),
    wall(m.bumperX + 8, m.floor - 12, 16, 24),
    ...bankSolids(m.bankX, m.bankY),
  ];
  Composite.add(engine.world, statics);
}

function resize() {
  const dpr = Math.max(1, Math.round(devicePixelRatio || 1));
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (w < 2 || h < 2) return;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = false;
  mouse.pixelRatio = dpr;
  view = measure(w, h);
  rebuildStatics();
  renderRange();
}

function spawnCoin(x, y) {
  const body = Bodies.circle(x, y, COIN_R, {
    restitution: 0.08,
    friction: 0.45,
    frictionStatic: 0.7,
    frictionAir: 0.02,
    density: 0.002,
    label: "coin",
    sleepThreshold: 36,
  });
  Body.setInertia(body, Infinity);
  Composite.add(engine.world, body);
  coins.add(body);
}

function spawnPile(count) {
  if (!view || count <= 0) return;
  const cols = Math.max(1, Math.floor((view.pen.w - 28) / (COIN_R * 2 + 2)));
  for (let i = 0; i < count; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = view.pen.x + 18 + COIN_R + col * (COIN_R * 2 + 2);
    const y = view.pen.y + 8 - row * (COIN_R * 2 + 1);
    spawnCoin(x, y);
  }
}

function clearCoins() {
  doomed.length = 0;
  for (const coin of coins) Composite.remove(engine.world, coin);
  coins.clear();
}

function flushRemovals() {
  if (!doomed.length) return;
  const batch = doomed.splice(0, doomed.length);
  let gained = 0;
  for (const coin of batch) {
    if (!coins.has(coin)) continue;
    coins.delete(coin);
    Composite.remove(engine.world, coin);
    gained++;
  }
  if (!gained) return;
  state.banked += gained;
  sfx.banked();
  const finished = state.banked >= state.total && !state.celebrated;
  if (finished) state.celebrated = true;
  save();
  updateUi();
  if (finished) sfx.goal();
}

function putBack() {
  if (state.banked <= 0 || !view) return;
  state.banked -= 1;
  state.celebrated = false;
  const x = view.pen.x + 24 + Math.random() * Math.max(1, view.pen.w - 48);
  spawnCoin(x, view.pen.y + 12);
  sfx.putBack();
  save();
  updateUi();
}

function resetPile() {
  state.total = roll(state.low, state.high);
  state.banked = 0;
  state.celebrated = state.total === 0;
  clearCoins();
  spawnPile(state.total);
  sfx.reset();
  save();
  updateUi();
  if (state.celebrated) sfx.goal();
}

function updateUi() {
  const done = state.celebrated;
  bar.classList.toggle("bar--done", done);
  statusEl.textContent = done ? "Goal complete" : "";
  backBtn.disabled = state.banked <= 0;
  renderRange();
}

function renderRange() {
  const width = track.clientWidth || 1;
  const xOf = (value) => (value / MAX) * width;
  thumbLow.style.left = xOf(state.low) + "px";
  thumbHigh.style.left = xOf(state.high) + "px";
  fill.style.left = xOf(state.low) + "px";
  fill.style.width = Math.max(0, xOf(state.high) - xOf(state.low)) + "px";
  lowReadout.textContent = String(state.low);
  highReadout.textContent = String(state.high);
  thumbLow.setAttribute("aria-valuemin", String(MIN));
  thumbLow.setAttribute("aria-valuemax", String(state.high));
  thumbLow.setAttribute("aria-valuenow", String(state.low));
  thumbHigh.setAttribute("aria-valuemin", String(state.low));
  thumbHigh.setAttribute("aria-valuemax", String(MAX));
  thumbHigh.setAttribute("aria-valuenow", String(state.high));
}

function applyThumb(which, value) {
  let low = state.low;
  let high = state.high;
  if (which === "low") low = value;
  else high = value;
  if (low > high) {
    if (which === "low") low = high;
    else high = low;
  }
  [state.low, state.high] = clampRange(low, high);
  writeRangeToUrl(state.low, state.high);
  save();
  renderRange();
}

let dragThumb = null;

function pointerValue(event) {
  const rect = track.getBoundingClientRect();
  const t = rect.width ? (event.clientX - rect.left) / rect.width : 0;
  return Math.round(Math.min(MAX, Math.max(MIN, t * MAX)));
}

function nearerThumb(value) {
  return Math.abs(value - state.low) <= Math.abs(value - state.high) ? "low" : "high";
}

track.addEventListener("pointerdown", (event) => {
  unlockAudio();
  if (event.target === thumbLow) dragThumb = "low";
  else if (event.target === thumbHigh) dragThumb = "high";
  else dragThumb = nearerThumb(pointerValue(event));
  applyThumb(dragThumb, pointerValue(event));
  track.setPointerCapture(event.pointerId);
});

track.addEventListener("pointermove", (event) => {
  if (!dragThumb) return;
  applyThumb(dragThumb, pointerValue(event));
});

function endThumbDrag() { dragThumb = null; }
track.addEventListener("pointerup", endThumbDrag);
track.addEventListener("pointercancel", endThumbDrag);

function onThumbKey(which, event) {
  const step = event.shiftKey ? 10 : 1;
  if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
    applyThumb(which, (which === "low" ? state.low : state.high) - step);
    event.preventDefault();
  } else if (event.key === "ArrowRight" || event.key === "ArrowUp") {
    applyThumb(which, (which === "low" ? state.low : state.high) + step);
    event.preventDefault();
  }
}

thumbLow.addEventListener("keydown", (event) => onThumbKey("low", event));
thumbHigh.addEventListener("keydown", (event) => onThumbKey("high", event));

backBtn.addEventListener("click", () => {
  unlockAudio();
  putBack();
});

resetBtn.addEventListener("click", () => {
  unlockAudio();
  resetPile();
});

window.addEventListener("pointerdown", unlockAudio);

Events.on(mouseConstraint, "startdrag", (event) => {
  if (event.body.label !== "coin") return;
  dragged = event.body;
  Sleeping.set(event.body, false);
  unlockAudio();
  sfx.grab();
});

Events.on(mouseConstraint, "enddrag", (event) => {
  const body = event.body;
  dragged = null;
  if (coins.has(body)) sfx.release();
});

Events.on(engine, "collisionStart", (event) => {
  for (const pair of event.pairs) {
    const coin = pair.bodyA.label === "coin" ? pair.bodyA : pair.bodyB.label === "coin" ? pair.bodyB : null;
    if (!coin) continue;
    const other = coin === pair.bodyA ? pair.bodyB : pair.bodyA;
    if (other.label === "slot") {
      if (!coin.swallowed) {
        coin.swallowed = true;
        doomed.push(coin);
      }
      continue;
    }
    const speed = Math.hypot(coin.velocity.x, coin.velocity.y);
    if (speed > 1.8) sfx.tick();
  }
});

function draw() {
  const m = view;
  if (!m) return;
  ctx.clearRect(0, 0, m.w, m.h);
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = "#3a3a3a";
  ctx.fillRect(0, m.floor, m.w, m.h - m.floor);
  ctx.fillStyle = "#1f1f1f";
  ctx.fillRect(0, m.floor, m.w, 3);
  ctx.fillStyle = "#5a4635";
  ctx.fillRect(m.bumperX, m.floor - 24, 16, 24);

  for (const coin of coins) {
    if (coin === dragged) continue;
    const x = Math.round(coin.position.x - COIN_R);
    const y = Math.round(coin.position.y - COIN_R);
    ctx.drawImage(coinSprite, x, y);
  }
  ctx.drawImage(pigSprite, m.bankX, m.bankY);
  if (dragged && coins.has(dragged)) {
    const x = Math.round(dragged.position.x - COIN_R);
    const y = Math.round(dragged.position.y - COIN_R);
    ctx.drawImage(coinSprite, x, y);
  }
}

let last = performance.now();
let acc = 0;

function frame(now) {
  const dt = Math.min(48, now - last);
  last = now;
  acc += dt;
  if (dragged) Sleeping.set(dragged, false);
  let steps = 0;
  while (acc >= 16.666 && steps < 3) {
    Engine.update(engine, 16.666);
    flushRemovals();
    acc -= 16.666;
    steps++;
  }
  if (steps === 3) acc = 0;
  draw();
  requestAnimationFrame(frame);
}

loadState();
resize();
spawnPile(state.total - state.banked);
updateUi();
window.addEventListener("resize", resize);
requestAnimationFrame(frame);
