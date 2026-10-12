globalThis.drawTable = function drawTable(ctx, width, height) {
  const G = 4;
  const PLANK = "#c7a27a";
  const SHADE = "#5a4635";
  const SEAM = "#1f1f1f";
  const HI = "#d9d0bc";
  const PATTERN = [52, 44, 60, 48, 56, 40];

  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = SEAM;
  ctx.fillRect(0, 0, width, height);

  const sw = Math.floor(width / G) * G;
  const sh = Math.floor(height / G) * G;
  if (sw < G * 8 || sh < G * 8) return;

  ctx.fillStyle = SHADE;
  ctx.fillRect(G, G, sw - G * 2, sh - G * 2);

  const inset = G * 3;
  const x0 = inset;
  const y0 = inset;
  const x1 = sw - inset;
  const y1 = sh - inset;
  const innerW = x1 - x0;
  const innerH = y1 - y0;
  if (innerW < G || innerH < G) return;

  ctx.fillStyle = PLANK;
  ctx.fillRect(x0, y0, innerW, innerH);

  const marginX = Math.floor((innerW * 0.22) / G) * G;
  const marginY = Math.floor((innerH * 0.2) / G) * G;
  const calmL = x0 + marginX;
  const calmR = x1 - marginX;
  const calmT = y0 + marginY;
  const calmB = y1 - marginY;

  function hash(a, b) {
    let n = (a * 374761393 + b * 668265263) | 0;
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return (n ^ (n >>> 16)) >>> 0;
  }

  function outsideCenter(x, y, w, h) {
    return x + w <= calmL || x >= calmR || y + h <= calmT || y >= calmB;
  }

  function dot(x, y, color) {
    if (x < x0 || y < y0 || x + G > x1 || y + G > y1) return;
    if (!outsideCenter(x, y, G, G)) return;
    ctx.fillStyle = color;
    ctx.fillRect(x, y, G, G);
  }

  const bands = [];
  let y = y0;
  let pi = 0;
  while (y < y1) {
    let size = PATTERN[pi % PATTERN.length];
    const remain = y1 - y;
    if (remain < size + 32) size = remain;
    bands.push({ y: y, h: size, i: pi });
    y += size;
    pi += 1;
    if (size <= 0) break;
  }

  for (let b = 0; b < bands.length; b++) {
    const band = bands[b];
    const last = b === bands.length - 1;
    const lip = G;
    const shadow = G;
    const gap = last ? 0 : G;
    ctx.fillStyle = HI;
    ctx.fillRect(x0, band.y, innerW, lip);
    const shadeY = band.y + band.h - gap - shadow;
    if (shadeY >= band.y + lip) {
      ctx.fillStyle = SHADE;
      ctx.fillRect(x0, shadeY, innerW, shadow);
    }
    if (!last) {
      ctx.fillStyle = SEAM;
      ctx.fillRect(x0, band.y + band.h - gap, innerW, gap);
    }

    const bodyY = band.y + lip + G;
    const bodyB = shadeY;
    if (bodyB - bodyY < G * 2) continue;

    const rows = Math.floor((bodyB - bodyY) / (G * 2));
    for (let r = 0; r < rows; r++) {
      const gy = bodyY + r * G * 2;
      const left = hash(band.i + 1, r + 3);
      if (left % 3 !== 0) {
        const len = 2 + (left % 4);
        const ox = x0 + G * 2 + ((left >>> 3) % 4) * G;
        for (let c = 0; c < len; c++) {
          dot(ox + c * G, gy, (left >>> (c + 4)) & 1 ? SHADE : HI);
        }
      }
      const right = hash(band.i + 9, r + 11);
      if (right % 3 !== 0) {
        const len = 2 + (right % 4);
        const ox = x1 - G * (4 + len) - ((right >>> 3) % 4) * G;
        for (let c = 0; c < len; c++) {
          dot(ox + c * G, gy, (right >>> (c + 2)) & 1 ? SHADE : HI);
        }
      }
    }

    if (band.i % 2 !== 0) continue;
    const nailY = bodyY + Math.floor((bodyB - bodyY - G * 2) / (G * 2)) * G;
    const nails = [
      [x0 + G * 5, nailY],
      [x1 - G * 7, nailY],
    ];
    for (let n = 0; n < nails.length; n++) {
      const nx = nails[n][0];
      const ny = nails[n][1];
      if (ny + G * 2 > bodyB) continue;
      if (!outsideCenter(nx, ny, G * 2, G * 2)) continue;
      ctx.fillStyle = SEAM;
      ctx.fillRect(nx, ny, G * 2, G * 2);
      ctx.fillStyle = SHADE;
      ctx.fillRect(nx, ny, G, G);
      dot(nx + G, ny, HI);
    }
  }
};
