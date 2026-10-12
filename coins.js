(function () {
  const OUTLINE = "#1f1f1f";
  const ORANGE = "#ff7a1a";
  const DEEP = "#d9620a";
  const CREAM = "#f2ebd9";
  const TAN = "#c7a27a";
  const BROWN = "#5a4635";
  const INK = "#2e2e2e";
  const STONE = "#b8b0a0";
  const GREEN = "#2d8a4e";

  function draw(paint) {
    const canvas = document.createElement("canvas");
    canvas.width = 44;
    canvas.height = 44;
    const g = canvas.getContext("2d");
    g.imageSmoothingEnabled = false;
    const size = 2;
    for (let y = 0; y < 22; y++) {
      for (let x = 0; x < 22; x++) {
        const dx = (x + 0.5) * size - 22;
        const dy = (y + 0.5) * size - 22;
        const color = paint(dx, dy);
        if (!color) continue;
        g.fillStyle = color;
        g.fillRect(x * size, y * size, size, size);
      }
    }
    return canvas;
  }

  function round(dx, dy) {
    const d = Math.hypot(dx, dy);
    if (d > 21) return null;
    if (d > 19) return OUTLINE;
    if (d > 16.2) return dx * 0.3 + dy < 0 ? ORANGE : DEEP;
    if (d < 5.2) return dx + dy < 0 ? CREAM : DEEP;
    if (d < 7.2) return OUTLINE;
    if (dx * 0.45 + dy * 0.85 < -11) return CREAM;
    if (dx * 0.45 + dy * 0.85 > 10) return DEEP;
    return ORANGE;
  }

  function oval(dx, dy) {
    const e = Math.hypot(dx / 21, dy / 18.6);
    if (e > 1) return null;
    if (e > 0.9) return OUTLINE;
    if (e > 0.76) return dx * 0.2 + dy < 0 ? STONE : TAN;
    if (e < 0.28) return dx + dy < 0 ? CREAM : BROWN;
    if (e < 0.4) return OUTLINE;
    if (dx * 0.35 + dy * 0.8 < -9) return CREAM;
    if (dx * 0.35 + dy * 0.8 > 8) return TAN;
    return STONE;
  }

  function octagon(dx, dy) {
    const ax = Math.abs(dx);
    const ay = Math.abs(dy);
    const cut = ax + ay;
    if (ax > 20.5 || ay > 20.5 || cut > 29.5) return null;
    if (ax > 18.2 || ay > 18.2 || cut > 26.2) return OUTLINE;
    if (cut < 8) return dx + dy < 0 ? CREAM : TAN;
    if (cut < 10.5) return OUTLINE;
    if (dx * 0.4 + dy * 0.75 < -9) return CREAM;
    if (dx * 0.4 + dy * 0.75 > 10) return BROWN;
    return GREEN;
  }

  function notch(dx, dy) {
    const d = Math.hypot(dx, dy);
    const inCut = dx > 12 && Math.abs(dy) < 4.2;
    if (d > 21 || inCut) return null;
    const wall = dx > 10 && dx <= 14 && Math.abs(dy) < 6.4;
    const lip = dx > 12 && Math.abs(dy) >= 4.2 && Math.abs(dy) < 6.6;
    if (d > 19 || wall || lip) return OUTLINE;
    if (dx * 0.25 + dy * 0.7 < -9) return ORANGE;
    if (dx * 0.25 + dy * 0.7 > 9) return BROWN;
    return DEEP;
  }

  function squareHole(dx, dy) {
    const d = Math.hypot(dx, dy);
    const hole = Math.max(Math.abs(dx), Math.abs(dy));
    if (d > 21) return null;
    if (hole < 4.2) return null;
    if (d > 19 || hole < 6.4) return OUTLINE;
    if (d > 15.2 && d <= 17.2) return BROWN;
    if (dx * 0.35 + dy * 0.7 < -9) return CREAM;
    if (dx * 0.35 + dy * 0.7 > 8) return BROWN;
    return TAN;
  }

  function thickRim(dx, dy) {
    const d = Math.hypot(dx, dy);
    if (d > 21) return null;
    if (d > 19) return OUTLINE;
    if (d > 11.5) return dx * 0.2 + dy * 0.5 > 6 ? BROWN : INK;
    if (d > 9.4) return OUTLINE;
    if (d < 3.5) return CREAM;
    if (dx * 0.4 + dy * 0.75 > 5) return DEEP;
    return ORANGE;
  }

  globalThis.CoinArt = {
    radius: 22,
    variants: [
      draw(round),
      draw(oval),
      draw(octagon),
      draw(notch),
      draw(squareHole),
      draw(thickRim),
    ],
  };
})();
