const MIN = 1;
const MAX = 1000;
const KEY = "gd-piggy-bank";
const CAT_MOUSE = 0x0001;
const CAT_COIN = 0x0002;
const CAT_WALL = 0x0004;
const CAT_PIG = 0x0008;
const WALL_T = 18;

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
engine.gravity.x = 0;
engine.gravity.y = 0;
const mouse = Mouse.create(canvas);
const mouseConstraint = MouseConstraint.create(engine, {
  mouse,
  collisionFilter: { category: CAT_MOUSE, mask: CAT_COIN },
  constraint: { stiffness: 0.85, damping: 0.15, length: 0 },
});
Composite.add(engine.world, mouseConstraint);

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
    if (!Number.isInteger(total) || total < MIN || total > MAX) return null;
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
    collisionFilter: { category: CAT_WALL, mask: CAT_COIN },
  });
}

function pigBlock(x, y, w, h) {
  return Bodies.rectangle(x, y, w, h, {
    isStatic: true,
    friction: 0.9,
    restitution: 0,
    label: "pig",
    collisionFilter: { category: CAT_PIG, mask: CAT_COIN },
  });
}

function layout(w, h) {
  const artW = PigArt.canvas.width;
  const artH = PigArt.canvas.height;
  const pigX = Math.max(28, Math.round(w - artW - 24));
  const pigY = Math.round(Math.min(Math.max(28, (h - artH) / 2), Math.max(28, h - artH - 28)));
  return { w, h, pigX, pigY };
}

function rebuildStatics() {
  for (const body of statics) Composite.remove(engine.world, body);
  const m = view;
  const t = WALL_T;
  const bodies = [
    wall(m.w / 2, t / 2, m.w, t),
    wall(m.w / 2, m.h - t / 2, m.w, t),
    wall(t / 2, m.h / 2, t, m.h),
    wall(m.w - t / 2, m.h / 2, t, m.h),
  ];
  for (const solid of PigArt.solids) {
    if (solid.w < 1 || solid.h < 1) continue;
    bodies.push(pigBlock(
      m.pigX + solid.x + solid.w / 2,
      m.pigY + solid.y + solid.h / 2,
      solid.w,
      solid.h,
    ));
  }
  const slot = PigArt.slot;
  bodies.push(Bodies.rectangle(
    m.pigX + slot.x + slot.w / 2,
    m.pigY + slot.y + slot.h / 2,
    slot.w,
    slot.h,
    {
      isStatic: true,
      isSensor: true,
      label: "slot",
      collisionFilter: { category: CAT_PIG, mask: CAT_COIN },
    },
  ));
  statics = bodies;
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
  view = layout(w, h);
  rebuildStatics();
  renderRange();
}

const COIN_DIAMETERS = [32, 44, 56];
const MAX_COIN_R = 28;

function spawnCoin(x, y) {
  const diameter = COIN_DIAMETERS[(Math.random() * COIN_DIAMETERS.length) | 0];
  const radius = diameter / 2;
  const variants = CoinArt.variants;
  const body = Bodies.circle(x, y, radius, {
    restitution: 0.05,
    friction: 0.4,
    frictionStatic: 0.6,
    frictionAir: 0.08,
    density: 0.002,
    label: "coin",
    sleepThreshold: 28,
    collisionFilter: { category: CAT_COIN, mask: CAT_MOUSE | CAT_COIN | CAT_WALL | CAT_PIG },
  });
  body.radius = radius;
  body.sprite = variants[(Math.random() * variants.length) | 0];
  body.facing = ((Math.random() * 24) | 0) * (Math.PI / 12);
  Body.setInertia(body, Infinity);
  Body.setAngle(body, body.facing);
  Body.setAngularVelocity(body, 0);
  Composite.add(engine.world, body);
  coins.add(body);
  Sleeping.set(body, false);
}

function pigSolidBoxes() {
  const boxes = [];
  for (const solid of PigArt.solids) {
    if (solid.w < 1 || solid.h < 1) continue;
    boxes.push({
      x0: view.pigX + solid.x,
      y0: view.pigY + solid.y,
      x1: view.pigX + solid.x + solid.w,
      y1: view.pigY + solid.y + solid.h,
    });
  }
  return boxes;
}

function pointInPig(x, y, boxes) {
  for (const box of boxes) {
    if (x >= box.x0 && x < box.x1 && y >= box.y0 && y < box.y1) return true;
  }
  return false;
}

function pileFocus() {
  const limits = playLimits(MAX_COIN_R);
  const boxes = pigSolidBoxes();
  let openRight = limits.maxX;
  for (const box of boxes) {
    if (box.y1 <= limits.minY || box.y0 >= limits.maxY) continue;
    openRight = Math.min(openRight, box.x0 - MAX_COIN_R);
  }
  if (openRight < limits.minX) openRight = limits.minX;
  const midY = (limits.minY + limits.maxY) / 2;
  let cx = view.w / 2;
  if (cx > openRight || pointInPig(cx, midY, boxes)) {
    cx = (limits.minX + openRight) / 2;
  }
  cx = Math.min(openRight, Math.max(limits.minX, cx));
  const cy = Math.min(limits.maxY, Math.max(limits.minY, midY));
  return {
    cx,
    cy,
    minX: limits.minX,
    maxX: openRight,
    minY: limits.minY,
    maxY: limits.maxY,
  };
}

function pileGrid(count, availW, availH) {
  const pitchX = 20;
  const pitchY = 18;
  const cols = Math.max(1, Math.ceil(Math.sqrt(count)));
  const rows = Math.ceil(count / cols);
  const spanX = Math.max(0, cols - 1);
  const spanY = Math.max(0, rows - 1);
  let stepX = spanX ? pitchX : 0;
  let stepY = spanY ? pitchY : 0;
  let gridW = spanX * stepX;
  let gridH = spanY * stepY;
  if (gridW > availW || gridH > availH) {
    stepX = spanX ? Math.min(pitchX, availW / spanX) : 0;
    stepY = spanY ? Math.min(pitchY, availH / spanY) : 0;
    gridW = spanX * stepX;
    gridH = spanY * stepY;
  }
  return { cols, stepX, stepY, gridW, gridH };
}

function spawnPile(count) {
  if (!view || count <= 0) return;
  const focus = pileFocus();
  const availW = focus.maxX - focus.minX;
  const availH = focus.maxY - focus.minY;
  const grid = pileGrid(count, availW, availH);
  let originX = focus.cx - grid.gridW / 2;
  let originY = focus.cy - grid.gridH / 2;
  originX = Math.min(focus.maxX - grid.gridW, Math.max(focus.minX, originX));
  originY = Math.min(focus.maxY - grid.gridH, Math.max(focus.minY, originY));
  for (let i = 0; i < count; i++) {
    const col = i % grid.cols;
    const row = Math.floor(i / grid.cols);
    let x = originX + col * grid.stepX + (Math.random() - 0.5) * Math.min(8, grid.stepX || 8);
    let y = originY + row * grid.stepY + (Math.random() - 0.5) * Math.min(6, grid.stepY || 6);
    x = Math.min(focus.maxX, Math.max(focus.minX, x));
    y = Math.min(focus.maxY, Math.max(focus.minY, y));
    spawnCoin(x, y);
  }
}

function clearCoins() {
  doomed.length = 0;
  for (const coin of coins) Composite.remove(engine.world, coin);
  coins.clear();
  dragged = null;
}

function releaseDrag(coin) {
  if (dragged === coin) dragged = null;
  if (mouseConstraint.body === coin) {
    mouseConstraint.body = null;
    mouseConstraint.constraint.bodyB = null;
  }
}

function flushRemovals() {
  if (!doomed.length) return;
  const batch = doomed.splice(0, doomed.length);
  let gained = 0;
  for (const coin of batch) {
    if (!coins.has(coin)) continue;
    coins.delete(coin);
    releaseDrag(coin);
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

function playLimits(radius) {
  return {
    minX: WALL_T + radius,
    maxX: view.w - WALL_T - radius,
    minY: WALL_T + radius,
    maxY: view.h - WALL_T - radius,
  };
}

function containCoins() {
  if (!view) return;
  for (const coin of coins) {
    const limits = playLimits(coin.radius);
    let x = coin.position.x;
    let y = coin.position.y;
    let vx = coin.velocity.x;
    let vy = coin.velocity.y;
    let fix = false;
    if (x < limits.minX) {
      x = limits.minX;
      if (vx < 0) vx = 0;
      fix = true;
    } else if (x > limits.maxX) {
      x = limits.maxX;
      if (vx > 0) vx = 0;
      fix = true;
    }
    if (y < limits.minY) {
      y = limits.minY;
      if (vy < 0) vy = 0;
      fix = true;
    } else if (y > limits.maxY) {
      y = limits.maxY;
      if (vy > 0) vy = 0;
      fix = true;
    }
    if (!fix) continue;
    Body.setPosition(coin, { x, y });
    Body.setVelocity(coin, { x: vx, y: vy });
  }
}

function clampDragConstraint() {
  if (!view) return;
  const constraint = mouseConstraint.constraint;
  const coin = constraint.bodyB;
  if (!coin || coin.label !== "coin" || !coins.has(coin)) return;
  const limits = playLimits(coin.radius);
  const pointB = constraint.pointB;
  const delta = coin.angle - constraint.angleB;
  const cos = Math.cos(delta);
  const sin = Math.sin(delta);
  const ox = pointB.x * cos - pointB.y * sin;
  const oy = pointB.x * sin + pointB.y * cos;
  const point = constraint.pointA;
  constraint.pointA = {
    x: Math.min(limits.maxX + ox, Math.max(limits.minX + ox, point.x)),
    y: Math.min(limits.maxY + oy, Math.max(limits.minY + oy, point.y)),
  };
}

function slotBounds() {
  const slot = PigArt.slot;
  return {
    x0: view.pigX + slot.x,
    y0: view.pigY + slot.y,
    x1: view.pigX + slot.x + slot.w,
    y1: view.pigY + slot.y + slot.h,
  };
}

function centerInSlot(coin) {
  if (!view) return false;
  const box = slotBounds();
  const x = coin.position.x;
  const y = coin.position.y;
  return x >= box.x0 && x < box.x1 && y >= box.y0 && y < box.y1;
}

function lockCoinSpin() {
  for (const coin of coins) {
    if (coin.angularVelocity !== 0) Body.setAngularVelocity(coin, 0);
    if (coin.angle !== coin.facing) Body.setAngle(coin, coin.facing);
  }
}

function putBack() {
  if (state.banked <= 0 || !view) return;
  state.banked -= 1;
  state.celebrated = false;
  const focus = pileFocus();
  const x = Math.min(focus.maxX, Math.max(focus.minX, focus.cx + (Math.random() - 0.5) * 12));
  const y = Math.min(focus.maxY, Math.max(focus.minY, focus.cy + (Math.random() - 0.5) * 12));
  spawnCoin(x, y);
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
  if (document.activeElement !== lowReadout) lowReadout.value = String(state.low);
  if (document.activeElement !== highReadout) highReadout.value = String(state.high);
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

function bindBound(input, which) {
  input.addEventListener("input", () => {
    const raw = input.value.trim();
    if (!/^\d+$/.test(raw)) return;
    const value = Number(raw);
    if (value > MAX) return;
    applyThumb(which, value);
    const committed = String(which === "low" ? state.low : state.high);
    if (committed !== raw && !committed.startsWith(raw)) input.value = committed;
  });
  input.addEventListener("blur", () => {
    const raw = input.value.trim();
    if (/^\d+$/.test(raw)) applyThumb(which, Number(raw));
    input.value = String(which === "low" ? state.low : state.high);
  });
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") input.blur();
  });
}

bindBound(lowReadout, "low");
bindBound(highReadout, "high");

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
  event.body.collisionFilter.mask = CAT_MOUSE | CAT_COIN | CAT_WALL;
  Sleeping.set(event.body, false);
  unlockAudio();
  sfx.grab();
});

Events.on(mouseConstraint, "enddrag", (event) => {
  const body = event.body;
  dragged = null;
  if (!coins.has(body)) return;
  body.collisionFilter.mask = CAT_MOUSE | CAT_COIN | CAT_WALL | CAT_PIG;
  sfx.release();
  if (centerInSlot(body)) {
    body.swallowed = true;
    doomed.push(body);
    flushRemovals();
  }
});

Events.on(engine, "beforeUpdate", clampDragConstraint);

Events.on(engine, "collisionStart", (event) => {
  for (const pair of event.pairs) {
    const coin = pair.bodyA.label === "coin" ? pair.bodyA : pair.bodyB.label === "coin" ? pair.bodyB : null;
    if (!coin) continue;
    const other = coin === pair.bodyA ? pair.bodyB : pair.bodyA;
    if (other.label === "slot" || other.isSensor) continue;
    const speed = Math.hypot(coin.velocity.x, coin.velocity.y);
    if (speed > 1.8) sfx.tick();
  }
});

function drawCoin(coin) {
  if (coin.swallowed) return;
  const radius = coin.radius;
  ctx.save();
  ctx.translate(Math.round(coin.position.x), Math.round(coin.position.y));
  ctx.rotate(coin.facing);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(coin.sprite, -radius, -radius, radius * 2, radius * 2);
  ctx.restore();
}

function draw() {
  const m = view;
  if (!m) return;
  ctx.clearRect(0, 0, m.w, m.h);
  ctx.imageSmoothingEnabled = false;
  drawTable(ctx, m.w, m.h);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(PigArt.canvas, m.pigX, m.pigY);
  for (const coin of coins) {
    if (coin === dragged) continue;
    drawCoin(coin);
  }
  if (dragged && coins.has(dragged)) drawCoin(dragged);
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
    lockCoinSpin();
    containCoins();
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
