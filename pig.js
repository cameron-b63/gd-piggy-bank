(function () {
  const SCALE = 4;
  const W = 55;
  const H = 40;
  const PAL = {
    o: "#1f1f1f",
    b: "#ff7a1a",
    d: "#d9620a",
    e: "#f2ebd9",
    k: "#1a1a1a",
    s: "#2e2e2e",
  };

  const grid = Array.from({ length: H }, () => Array(W).fill(""));

  function plot(x, y, color) {
    x = x | 0;
    y = y | 0;
    if (x >= 0 && y >= 0 && x < W && y < H) grid[y][x] = color;
  }

  function ellipse(cx, cy, rx, ry, color) {
    for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++) {
      for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
        const nx = (x + 0.5 - cx) / rx;
        const ny = (y + 0.5 - cy) / ry;
        if (nx * nx + ny * ny <= 1) plot(x, y, color);
      }
    }
  }

  function roundRect(x0, y0, w, h, r, color) {
    const x1 = x0 + r;
    const y1 = y0 + r;
    const x2 = x0 + w - r;
    const y2 = y0 + h - r;
    for (let y = y0; y < y0 + h; y++) {
      for (let x = x0; x < x0 + w; x++) {
        const px = x + 0.5;
        const py = y + 0.5;
        let dx = 0;
        let dy = 0;
        if (px < x1) dx = x1 - px;
        else if (px > x2) dx = px - x2;
        if (py < y1) dy = y1 - py;
        else if (py > y2) dy = py - y2;
        if (dx * dx + dy * dy <= r * r) plot(x, y, color);
      }
    }
  }

  ellipse(27, 20, 15.4, 10.3, "b");
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (grid[y][x] === "b" && (y + 0.5 - 20) / 10.3 > 0.16) grid[y][x] = "d";
    }
  }

  ellipse(38, 10.2, 7.2, 5.4, "b");
  ellipse(39.2, 9.4, 3.2, 2.05, "e");
  plot(41, 11, "k");
  plot(42, 11, "k");
  plot(42, 12, "k");
  plot(41, 12, "k");

  ellipse(38, 29.8, 7.2, 5.4, "b");
  ellipse(39.2, 30.6, 3.2, 2.05, "e");
  plot(41, 28, "k");
  plot(42, 28, "k");
  plot(41, 29, "k");
  plot(42, 29, "k");

  ellipse(47.6, 20, 6.5, 4.8, "e");
  for (let y = 17; y <= 19; y++) {
    for (let x = 46; x <= 48; x++) plot(x, y, "k");
  }
  for (let y = 21; y <= 23; y++) {
    for (let x = 46; x <= 48; x++) plot(x, y, "k");
  }

  const filled = grid.map((row) => row.slice());
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (filled[y][x]) continue;
      let touch = false;
      for (let dy = -1; dy <= 1 && !touch; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          const yy = y + dy;
          if (xx >= 0 && yy >= 0 && xx < W && yy < H && filled[yy][xx]) touch = true;
        }
      }
      if (touch) grid[y][x] = "o";
    }
  }

  const tail = [
    "..ooooo....",
    ".o.....o...",
    "o..ooo..o..",
    "o.o...o.o..",
    "o.o.oo..o..",
    ".o.o..o.o..",
    "..o.oo..o..",
    "...o...o...",
    "....ooo....",
  ];
  for (let y = 0; y < tail.length; y++) {
    for (let x = 0; x < tail[y].length; x++) {
      if (tail[y][x] !== ".") plot(x, 15 + y, tail[y][x]);
    }
  }
  plot(10, 18, "b");
  plot(11, 18, "b");
  plot(12, 18, "b");
  plot(10, 19, "b");
  plot(11, 19, "b");
  plot(12, 19, "b");
  plot(10, 17, "o");
  plot(11, 17, "o");
  plot(10, 20, "o");

  roundRect(19, 15, 16, 10, 3.5, "s");

  const canvas = document.createElement("canvas");
  canvas.width = W * SCALE;
  canvas.height = H * SCALE;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const color = PAL[grid[y][x]];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(x * SCALE, y * SCALE, SCALE, SCALE);
    }
  }

  let minX = W;
  let minY = H;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (grid[y][x] !== "s") continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }

  const slot = {
    x: minX * SCALE,
    y: minY * SCALE,
    w: (maxX - minX + 1) * SCALE,
    h: (maxY - minY + 1) * SCALE,
  };

  function bounds(test) {
    let x0 = W;
    let y0 = H;
    let x1 = -1;
    let y1 = -1;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (!grid[y][x] || grid[y][x] === "s" || !test(x, y)) continue;
        if (x < x0) x0 = x;
        if (y < y0) y0 = y;
        if (x > x1) x1 = x;
        if (y > y1) y1 = y;
      }
    }
    return {
      x: x0 * SCALE,
      y: y0 * SCALE,
      w: (x1 - x0 + 1) * SCALE,
      h: (y1 - y0 + 1) * SCALE,
    };
  }

  const solids = [
    bounds((x) => x < minX),
    bounds((x, y) => x > maxX && x < 43 && y > 13 && y < 27),
    bounds((x, y) => x >= minX && x <= maxX && y < minY),
    bounds((x, y) => x >= minX && x <= maxX && y > maxY),
    bounds((x, y) => x >= 43 && y >= 14 && y <= 26),
    bounds((x, y) => y <= 14 && x >= 32 && x <= 47),
    bounds((x, y) => y >= 26 && x >= 32 && x <= 47),
  ];

  globalThis.PigArt = { canvas, slot, solids };
})();
