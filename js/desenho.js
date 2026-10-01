/* ---------- desenhos e animações (SVG) ----------
   Cada desenho é uma função (s) → SVG, com s de 0 a 1 = fração da carga aplicada.
   O laço de animação varre s com (1 − cos)/2: a carga sobe, segura e volta, sem trancos.
   O cordão muda de cor com o aproveitamento (âmbar → vermelho quando chega a n = 1). */

const f1 = v => Math.round(v * 10) / 10;
function seta(x1, y1, x2, y2, cls, cab = 7) {
  const L = Math.hypot(x2 - x1, y2 - y1);
  if (L < 0.5) return '';
  const ux = (x2 - x1) / L, uy = (y2 - y1) / L, c = Math.min(cab, L * 0.6);
  const bx = x2 - ux * c, by = y2 - uy * c, w = c * 0.5;
  return `<line class="${cls}" x1="${f1(x1)}" y1="${f1(y1)}" x2="${f1(bx)}" y2="${f1(by)}"/>` +
    `<polygon class="${cls} hd" points="${f1(x2)},${f1(y2)} ${f1(bx - uy * w)},${f1(by + ux * w)} ${f1(bx + uy * w)},${f1(by - ux * w)}"/>`;
}
const txt = (x, y, s, cls = 'lb', anc = 'middle') => `<text class="${cls}" x="${f1(x)}" y="${f1(y)}" text-anchor="${anc}">${s}</text>`;
const sub = (b, i) => `${b}<tspan baseline-shift="sub" font-size="9">${i}</tspan>`;
const kNt = N => kN(N, 2);
const poly = (cls, pts, u) => `<polygon class="${cls}"${u != null ? ` style="--u:${f1(u)}%"` : ''} points="${pts.map(p => f1(p[0]) + ',' + f1(p[1])).join(' ')}"/>`;
const usoDe = (a, s) => a.na ? 0 : Math.min(1 / a.gov.razao, 1.2) * 100 * s;
/* quebra um texto em linhas de até n caracteres, para caber nas caixas do desenho */
function linhas(s, n) { const out = []; let l = ''; for (const w of s.split(' ')) { if ((l + ' ' + w).trim().length > n) { out.push(l); l = w; } else l = (l + ' ' + w).trim(); } if (l) out.push(l); return out; }

/* ---------- animador: um único laço para o desenho visível ---------- */
const ANIM = {
  fn: null, el: null, t0: 0, pausado: false, s: 1, per: 4200, raf: 0, onS: null,
  set(el, fn, onS) { this.el = el; this.fn = fn; this.onS = onS; this.desenha(); this.agenda(); },
  desenha(t = 0) { if (this.el && this.fn) { this.el.innerHTML = this.fn(this.s, t); if (this.onS) this.onS(this.s); } },
  agenda() {
    cancelAnimationFrame(this.raf);
    if (this.pausado || !this.fn) return;
    const loop = t => {
      if (!this.t0) this.t0 = t;
      const fase = ((t - this.t0) % this.per) / this.per;
      this.s = (1 - Math.cos(2 * Math.PI * fase)) / 2;
      this.desenha(t - this.t0);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  },
  alterna() { this.pausado = !this.pausado; if (this.pausado) { cancelAnimationFrame(this.raf); } else { this.t0 = 0; this.agenda(); } return this.pausado; },
  fixa(s) { this.pausado = true; cancelAnimationFrame(this.raf); this.s = s; this.desenha(); }
};

/* ---------- detalhe em corte da junta com o tipo de solda ----------
   (x0, y0) = canto superior esquerdo da caixa W × H. Desenha em escala real (mm → px). */
function detalheSolda(a, e, x0, y0, W, H, u) {
  const t = e.t, T = e.T, lados = a.tipo === 'total' ? 1 : e.lados;
  const h = a.tipo === 'filete' ? a.tam : a.tipo === 'parcial' ? a.tam : t;
  let g = `<rect class="frame" x="${x0}" y="${y0}" width="${W}" height="${H}" rx="4"/>`;
  g += txt(x0 + W / 2, y0 + 16, W < 200 ? TIPOS[a.tipo].curto.toLowerCase() : `corte da junta — ${TIPOS[a.tipo].curto.toLowerCase()}`, 'lb lbS');
  /* tipo que não cabe nesta junta: mostra o motivo no lugar do corte */
  if (a.na) return g + linhas(a.na, Math.floor(W / 7.2)).map((l, i) => txt(x0 + W / 2, y0 + H / 2 - 20 + i * 15, l, 'lb lbBad')).join('');
  if (e.junta === 'topo') {
    /* duas chapas alinhadas de espessura t; chanfro em V (um ou dois lados) */
    const sc = Math.min((W - 40) / (6 * t), (H - 70) / (t * 1.9)), cx = x0 + W / 2, yT = y0 + 34 + (H - 70 - t * sc) / 2 + 10, yB = yT + t * sc;
    const gap = 1.5 * sc, Lp = (W - 40) / 2;
    const sides = e.lados, Sd = (a.tipo === 'total' ? t / sides : a.tam) * sc, w = Math.tan(Math.PI / 6) * Sd, cutB = sides === 2;
    for (const sx of [-1, 1]) {
      const xi = cx + sx * gap, xo = cx + sx * Lp;
      g += poly('pl', [[xo, yT], [xi + sx * w, yT], [xi, yT + Sd], [xi, yB - (cutB ? Sd : 0)], [xi + sx * (cutB ? w : 0), yB], [xo, yB]]);
    }
    g += poly('wd', [[cx - gap - w, yT - 3], [cx + gap + w, yT - 3], [cx + gap, yT + Sd], [cx - gap, yT + Sd]], u);
    if (cutB) g += poly('wd', [[cx - gap - w, yB + 3], [cx + gap + w, yB + 3], [cx + gap, yB - Sd], [cx - gap, yB - Sd]], u);
    if (a.tipo === 'total' && !cutB) g += `<rect class="nut" x="${f1(cx - 3 * gap - 6)}" y="${f1(yB)}" width="${f1(6 * gap + 12)}" height="5"/>`;
    g += `<line class="dim" x1="${f1(cx + Lp * 0.7)}" y1="${f1(yT)}" x2="${f1(cx + Lp * 0.7)}" y2="${f1(yB)}"/>` + txt(cx + Lp * 0.7 + 4, (yT + yB) / 2 + 4, `t = ${fmt(t, 0)}`, 'lb lbS', 'start');
    g += txt(cx, y0 + H - 12, a.tipo === 'total' ? `E = t = ${fmt(t, 0)} mm` : `S = ${fmt(a.tam, 0)} → E = ${fmt(a.g.a, 1)} mm${lados > 1 ? ' (× 2 lados)' : ''}`, 'lb lbB');
    return g;
  }
  if (e.junta === 'sobreposta') {
    /* chapa inferior (T) e superior (t) sobrepostas; filete na borda da superior */
    const sc = Math.min((W - 40) / (8 * Math.max(t, h)), (H - 80) / (T + t + h)), yM = y0 + 40 + (H - 80 - (T + t) * sc) / 2 + t * sc;
    const xe = x0 + W * 0.55, hp = h * sc;
    g += `<rect class="pl pl2" x="${f1(x0 + 16)}" y="${f1(yM)}" width="${f1(W - 32)}" height="${f1(T * sc)}"/>`;
    g += `<rect class="pl" x="${f1(x0 + 16)}" y="${f1(yM - t * sc)}" width="${f1(xe - x0 - 16)}" height="${f1(t * sc)}"/>`;
    g += poly('wd', [[xe, yM], [xe + hp, yM], [xe, yM - hp]], u);
    g += `<line class="throat" x1="${f1(xe)}" y1="${f1(yM)}" x2="${f1(xe + hp / 2)}" y2="${f1(yM - hp / 2)}"/>`;
    g += txt(xe + hp / 2 + 6, yM - hp / 2 - 4, `a = ${fmt(a.g.a, 1)}`, 'lb lbB', 'start');
    g += txt(xe + hp / 2, yM + 14, `h = ${fmt(h, 0)}`, 'lb lbS');
    g += txt(x0 + W / 2, y0 + H - 12, `filete na borda${lados > 1 ? ' — o outro cordão na borda oposta' : ''}`, 'lb lbS');
    return g;
  }
  /* junta em T: chapa de base (T) e chapa encostada (t) */
  const ext = a.tipo === 'filete' ? 2.6 * h : a.tipo === 'misto' ? Math.max(0.6 * t, 1.8 * a.tam) : 0.6 * t;
  const sc = Math.min((W - 30) / (t + 2 * ext + 10), (H - 70) / (T + 2.2 * Math.max(t, h, a.tipo === 'misto' ? a.tam : 0))), cx = x0 + W / 2;
  const yb = y0 + 30 + 2.2 * Math.max(t, h) * sc, tp = t * sc, xl = cx - tp / 2, xr = cx + tp / 2;
  g += `<rect class="pl pl2" x="${f1(x0 + 14)}" y="${f1(yb)}" width="${f1(W - 28)}" height="${f1(Math.min(T * sc, y0 + H - 24 - yb))}"/>`;
  const topo = y0 + 28;
  if (a.tipo === 'filete') {
    g += `<rect class="pl" x="${f1(xl)}" y="${topo}" width="${f1(tp)}" height="${f1(yb - topo)}"/>`;
    const hp = h * sc;
    g += poly('wd', [[xr, yb], [xr + hp, yb], [xr, yb - hp]], u);
    if (lados > 1) g += poly('wd', [[xl, yb], [xl - hp, yb], [xl, yb - hp]], u);
    g += `<line class="throat" x1="${f1(xr)}" y1="${f1(yb)}" x2="${f1(xr + hp / 2)}" y2="${f1(yb - hp / 2)}"/>`;
    g += txt(xr + hp / 2 + 6, yb - hp / 2 - 6, `a = ${fmt(a.g.a, 1)}`, 'lb lbB', 'start');
    g += `<line class="dim" x1="${f1(xr + hp + 6)}" y1="${f1(yb)}" x2="${f1(xr + hp + 6)}" y2="${f1(yb - hp)}"/>` + txt(xr + hp + 10, yb - 3, `h = ${fmt(h, 0)}`, 'lb lbS', 'start');
  } else {
    /* chanfro a 45° na chapa encostada, a partir de cada face chanfrada (lt faces).
       CJP: os biseis atravessam a espessura toda — K (duplo bisel) com dois lados, bisel simples
       com cobre-junta com um lado — e levam filete de reforço t/4 (AWS D1.1).
       PJP: cada bisel tem profundidade S; o que sobra no meio é a raiz não fundida. */
    const misto = a.tipo === 'misto', total = a.tipo === 'total' || misto, lt = e.lados > 1 ? 2 : 1;
    const Sd = (total ? t / lt : a.tam) * sc, r = misto ? Math.max(a.tam * sc, 3) : total ? Math.max(tp / 4, 3) : Math.max(Sd * 0.3, 2);
    const pts = [[xl, topo], [xr, topo], [xr, yb - Sd], [xr - Sd, yb]];
    if (lt > 1) pts.push([xl + Sd, yb], [xl, yb - Sd]); else if (xr - Sd > xl + 0.5) pts.push([xl, yb]);
    g += poly('pl', pts);
    g += poly('wd', [[xr, yb - Sd - (total ? r : 0)], [xr + r, yb], [xr - Sd, yb]], u);
    if (lt > 1) g += poly('wd', [[xl, yb - Sd - (total ? r : 0)], [xl - r, yb], [xl + Sd, yb]], u);
    if (misto) {
      /* contorno do filete de reforço sobre o chanfro e a sua garganta */
      g += `<line class="throat" x1="${f1(xr)}" y1="${f1(yb)}" x2="${f1(xr + r / 2)}" y2="${f1(yb - r / 2)}"/>`;
      g += `<line class="dim" x1="${f1(xr + r + 6)}" y1="${f1(yb)}" x2="${f1(xr + r + 6)}" y2="${f1(yb - r)}"/>` + txt(xr + r + 10, yb - 3, `h = ${fmt(a.tam, 0)}`, 'lb lbS', 'start');
    }
    if (total && lt === 1) g += `<rect class="nut" x="${f1(xl - 9)}" y="${f1(yb - 9)}" width="9" height="9"/>` + (W < 200 ? '' : txt(xl - 12, yb - 2, 'cobre-junta', 'lb lbS', 'end'));
    if (!total) {
      const x1 = xr - Sd, x0r = lt > 1 ? xl + Sd : xl;
      g += `<line class="ring" x1="${f1(x0r)}" y1="${f1(yb - 1)}" x2="${f1(x1)}" y2="${f1(yb - 1)}"/>` + txt((x0r + x1) / 2, yb + 14, 'raiz não fundida', 'lb lbS');
    } else if (lt > 1) g += txt(cx, yb + 14, 'raiz goivada', 'lb lbS');
    g += `<line class="dim" x1="${f1(xl)}" y1="${topo + 10}" x2="${f1(xr)}" y2="${topo + 10}"/>` + txt(xr + 6, topo + 14, `t = ${fmt(t, 0)}`, 'lb lbS', 'start');
    if (!total) g += txt(xr + r + 6, yb - Sd / 2, `S = ${fmt(a.tam, 0)}`, 'lb lbS', 'start');
  }
  g += txt(cx, y0 + H - 10, a.tipo === 'filete' ? `${lados} cordão(ões) · a = 0,707·h`
    : a.tipo === 'parcial' ? `E = ${fmt(a.g.a, 1)} mm${lados > 1 ? ' × 2 lados' : ''}`
    : a.tipo === 'misto' ? `A_w = ${fmt(a.g.aTot, 1)} mm${W < 200 ? '' : ` (t + ${e.lados > 1 ? '2 filetes' : 'filete'} de ${fmt(a.tam, 0)})`}`
    : `E = t = ${fmt(t, 0)} mm${W < 200 ? '' : ' · ' + (e.lados > 1 ? 'duplo bisel (K)' : 'bisel simples')}`, 'lb lbB');
  return g;
}

/* ---------- junta direta: vista da junta + corte ---------- */
function desenhoSimples(e, dm, a, s) {
  const u = usoDe(a, s);
  let g = '';
  const x0 = 24, x1 = 330, Lpx = Math.min(250, x1 - x0 - 40), cx = (x0 + x1) / 2, xa = cx - Lpx / 2, xb = cx + Lpx / 2;
  const aP = 14 + 26 * s;
  if (e.junta === 'T') {
    const yb = 222;
    g += `<rect class="pl pl2" x="${x0}" y="${yb}" width="${x1 - x0}" height="22"/>`;
    g += `<rect class="pl" x="${f1(xa)}" y="${f1(102 - 4 * s)}" width="${f1(Lpx)}" height="${f1(yb - 102 + 4 * s - 6)}"/>`;
    const hb = a.na ? 0 : Math.min(Math.max((a.tipo === 'total' ? e.t : a.tipo === 'misto' ? e.t + a.tam : a.tam) * 0.9, 4), 26);
    if (hb) g += `<rect class="wd" style="--u:${f1(u)}%" x="${f1(xa)}" y="${f1(yb - hb)}" width="${f1(Lpx)}" height="${f1(hb)}"/>`;
    if (hb) g += txt(xb + 6, yb - hb / 2 + 4, a.tipo === 'filete' ? `h ${fmt(a.tam, 0)}` : a.tipo === 'parcial' ? `S ${fmt(a.tam, 0)}` : a.tipo === 'misto' ? `CJP+h${fmt(a.tam, 0)}` : 'CJP', 'lb lbS', 'start');
    if (e.P) for (const x of [xa + Lpx * 0.2, cx, xb - Lpx * 0.2]) g += seta(x, 100, x, 100 - aP, 'ar-load', 8);
    if (e.P) g += txt(xb, 66, `P = ${kNt(e.P * s)}`, 'lb lbA', 'end');
    if (e.V) g += seta(xa + 20, 160, xa + 20 + 40 + 40 * s, 160, 'ar-load', 9) + txt(xa + 24, 152, `V = ${kNt(e.V * s)}`, 'lb lbA', 'start');
  } else {
    /* sobreposta / topo: vista de cima, cordão vertical de comprimento L */
    const yt = 70, yb = yt + Lpx * 0.62, xm = cx;
    const ov = e.junta === 'sobreposta' ? 40 : 0, dx = 3 * s;
    g += `<rect class="pl pl2" x="${x0 + 6}" y="${yt}" width="${f1(xm + ov / 2 - x0 - 6 - dx)}" height="${f1(yb - yt)}"/>`;
    g += `<rect class="pl" x="${f1(xm - ov / 2 + dx)}" y="${yt}" width="${f1(x1 - 6 - xm + ov / 2 - dx)}" height="${f1(yb - yt)}"/>`;
    const xs = e.junta === 'sobreposta' ? [xm - ov / 2 + dx, ...(e.lados > 1 ? [xm + ov / 2 - dx] : [])] : [xm];
    for (const x of xs) g += `<line class="wl" style="--u:${f1(u)}%" x1="${f1(x)}" y1="${yt}" x2="${f1(x)}" y2="${f1(yb)}"/>`;
    if (e.P) {
      g += seta(x0 + 40, (yt + yb) / 2, x0 + 40 - aP, (yt + yb) / 2, 'ar-load', 9) + seta(x1 - 40, (yt + yb) / 2, x1 - 40 + aP, (yt + yb) / 2, 'ar-load', 9);
      g += txt(x1 - 8, (yt + yb) / 2 - 12, `P = ${kNt(e.P * s)}`, 'lb lbA', 'end');
    }
    if (e.V) g += seta(xm + 26, yb - 10, xm + 26, yb - 40 - 40 * s, 'ar-load', 9) + txt(xm + 32, yb - 20, `V = ${kNt(e.V * s)}`, 'lb lbA', 'start');
    g += `<line class="dim" x1="${f1(x1 - 18)}" y1="${yt}" x2="${f1(x1 - 18)}" y2="${f1(yb)}"/>` + txt(x1 - 22, yb + 16, `L = ${fmt(e.L, 0)} mm`, 'lb', 'end');
    g += txt(cx, yt - 14, `vista de cima — junta ${e.junta === 'sobreposta' ? 'sobreposta' : 'de topo'}`, 'lb lbS');
    g += txt(cx, 286, `f = ${fLin(dm.f * s)} por mm de junta`, 'lb lbB');
    return g + detalheSolda(a, e, 350, 30, 236, 240, u);
  }
  g += `<line class="dim" x1="${f1(xa)}" y1="262" x2="${f1(xb)}" y2="262"/>` + txt(cx, 278, `L = ${fmt(e.L, 0)} mm — f = ${fLin(dm.f * s)}`, 'lb lbB');
  g += txt(cx, 30, 'vista da junta em T', 'lb lbS');
  return g + detalheSolda(a, e, 350, 30, 236, 240, u);
}

/* ---------- grupo em torção: chapa sobre o apoio, cordões no contorno ---------- */
function desenhoTorcao(e, dm, a, s) {
  const gg = dm.g, u = usoDe(a, s);
  const R = gg.circ ? gg.R : 0, hb = gg.circ ? R : e.b / 2, hd = gg.circ ? R : e.d / 2;
  const xs = [-hb, hb, e.ax], ys = [-hd, hd, e.ay];
  const mg = Math.max(hb, hd) * 0.35 + 10;
  const X0 = Math.min(...xs) - mg, X1 = Math.max(...xs) + mg, Y0 = Math.min(...ys) - mg, Y1 = Math.max(...ys) + mg;
  const W = 420, H = 330, sc = Math.min((W - 30) / (X1 - X0), (H - 50) / (Y1 - Y0));
  const ox = W / 2 - (X0 + X1) / 2 * sc + 4, oy = H / 2 + 8 + (Y0 + Y1) / 2 * sc;
  const X = x => ox + x * sc, Y = y => oy - y * sc;
  const th = (dm.M === 0 ? 0 : Math.sign(dm.M)) * 2 * s;
  let g = txt(W / 2, 18, 'vista de frente — giro em torno do centroide G (exagerado)', 'lb lbS');
  /* apoio fixo (coluna) atrás */
  g += `<rect class="conc" x="${f1(X(-hb) - 16)}" y="${f1(Y(hd) - 16)}" width="${f1(2 * hb * sc + 32)}" height="${f1(2 * hd * sc + 32)}" rx="2"/>`;
  g += `<g transform="rotate(${f1(-th)} ${f1(X(gg.xc))} ${f1(Y(gg.yc))})">`;
  if (gg.circ) g += `<circle class="pl" cx="${f1(X(0))}" cy="${f1(Y(0))}" r="${f1(R * sc)}"/>`;
  else g += `<rect class="pl" x="${f1(X(-hb))}" y="${f1(Y(hd))}" width="${f1(e.b * sc)}" height="${f1(e.d * sc)}" rx="1"/>`;
  /* braço até o ponto de carga, se estiver fora */
  if (Math.abs(e.ax) > hb || Math.abs(e.ay) > hd) {
    const w = Math.min(hb, hd) * 0.7;
    if (Math.abs(e.ax) >= Math.abs(e.ay)) {
      const xa = e.ax > 0 ? hb : e.ax - w / 2, xb = e.ax > 0 ? e.ax + w / 2 : -hb;
      g += `<rect class="pl" x="${f1(X(xa))}" y="${f1(Y(e.ay + w))}" width="${f1((xb - xa) * sc)}" height="${f1(2 * w * sc)}"/>`;
    } else {
      const ya = e.ay > 0 ? hd : e.ay - w / 2, yb = e.ay > 0 ? e.ay + w / 2 : -hd;
      g += `<rect class="pl" x="${f1(X(e.ax - w))}" y="${f1(Y(yb))}" width="${f1(2 * w * sc)}" height="${f1((yb - ya) * sc)}"/>`;
    }
  }
  const F = Math.hypot(e.Fx, e.Fy) || 1, ux = e.Fx / F, uy = -e.Fy / F;
  /* seta do tamanho que couber entre o ponto de carga e a borda do quadro */
  let aL = 64;
  if (uy > 0.1) aL = Math.min(aL, (Y(e.ay) - 30) / uy); else if (uy < -0.1) aL = Math.min(aL, (H - 10 - Y(e.ay)) / -uy);
  if (ux > 0.1) aL = Math.min(aL, (X(e.ax) - 10) / ux); else if (ux < -0.1) aL = Math.min(aL, (W - 10 - X(e.ax)) / -ux);
  aL = Math.max(aL, 20);
  g += seta(X(e.ax) - ux * aL, Y(e.ay) - uy * aL, X(e.ax), Y(e.ay), 'ar-load', 10);
  g += txt(X(e.ax) - ux * aL + (ux >= 0 ? -6 : 6), Math.min(Math.max(Y(e.ay) - uy * aL - 6, 34), H - 8), `F = ${kNt(dm.F * s)}`, 'lb lbA', ux >= 0 ? 'end' : 'start');
  g += '</g>';
  /* cordões, coloridos pela força local */
  const fmax = Math.max(dm.f, 1e-9);
  if (gg.circ) g += `<circle class="wl" style="--u:${f1(u)}%" cx="${f1(X(0))}" cy="${f1(Y(0))}" r="${f1(R * sc)}" fill="none"/>`;
  else for (const sg of gg.segs) {
    const fl = Math.max(...gg.pts.filter(p => (Math.abs(p.x - sg.x1) < 1e-6 && Math.abs(p.y - sg.y1) < 1e-6) || (Math.abs(p.x - sg.x2) < 1e-6 && Math.abs(p.y - sg.y2) < 1e-6)).map(p => p.f));
    g += `<line class="wl" style="--u:${f1(u * fl / fmax)}%" x1="${f1(X(sg.x1))}" y1="${f1(Y(sg.y1))}" x2="${f1(X(sg.x2))}" y2="${f1(Y(sg.y2))}"/>`;
  }
  g += `<circle class="cg" cx="${f1(X(gg.xc))}" cy="${f1(Y(gg.yc))}" r="4"/>` + txt(X(gg.xc) + 7, Y(gg.yc) - 6, 'G', 'lb lbS', 'start');
  /* forças f', f'' e resultante nos pontos candidatos (no círculo, em 8 deles + o crítico) */
  const esc = Math.min(hb, hd, 60) * sc * 0.9 / fmax;
  const pts = gg.circ ? gg.pts.filter((p, i) => i % 9 === 0 || p === dm.crit) : gg.pts;
  for (const p of pts) {
    const cx = X(p.x), cy = Y(p.y), crit = p === dm.crit;
    g += seta(cx, cy, cx + p.p1[0] * esc * s, cy - p.p1[1] * esc * s, 'ar-p1', 6);
    g += seta(cx, cy, cx + p.p2[0] * esc * s, cy - p.p2[1] * esc * s, 'ar-p2', 6);
    g += seta(cx, cy, cx + p.v[0] * esc * s, cy - p.v[1] * esc * s, crit ? 'ar-res crit' : 'ar-res', 8);
    if (crit) g += `<circle class="ring" cx="${f1(cx)}" cy="${f1(cy)}" r="6"/>`;
  }
  return g + detalheSolda(a, e, 440, 40, 160, 220, u) + txt(520, 290, `f_max = ${fLin(dm.f * s)}`.replace('f_max', sub('f', 'max')), 'lb lbB');
}

/* ---------- console em flexão: vista lateral + seção dos cordões com a força normal ---------- */
function desenhoFlexao(e, dm, a, s) {
  const gg = dm.g, u = usoDe(a, s);
  const hb = gg.circ ? gg.R : e.b / 2, hd = gg.circ ? gg.R : e.d / 2;
  let g = txt(170, 18, 'vista lateral (giro exagerado)', 'lb lbS');
  /* em escala: o braço e e a altura da seção mudam o desenho */
  const xw = 70, yc = 160, k = Math.min(210 / Math.max(e.e, 1), 180 / (2 * hd));
  const dpx = Math.max(2 * hd * k, 12), Lpx = Math.max(e.e * k + 14, 34);
  g += `<rect class="conc" x="${xw - 34}" y="40" width="34" height="250"/>`;
  g += `<line class="gnd" x1="${xw}" y1="40" x2="${xw}" y2="290"/>`;
  const th = 1.6 * s * Math.sign(e.F || 1);
  g += `<g transform="rotate(${f1(th)} ${xw} ${f1(yc + dpx / 2)})">`;
  g += `<rect class="pole" x="${xw}" y="${f1(yc - dpx / 2)}" width="${f1(Lpx)}" height="${f1(dpx)}" rx="2"/>`;
  const xF = xw + Math.max(e.e * k, 20);
  g += seta(xF, yc - dpx / 2 - 64 + 20 * (1 - s), xF, yc - dpx / 2 - 2, 'ar-load', 10) + txt(xF + 8, yc - dpx / 2 - 44, `F = ${kNt(e.F * s)}`, 'lb lbA', 'start');
  if (e.N) g += (e.N > 0 ? seta(xw + Lpx + 2, yc, xw + Lpx + 40, yc, 'ar-load', 9) : seta(xw + Lpx + 40, yc, xw + Lpx + 2, yc, 'ar-load', 9)) + txt(xw + Lpx + 8, yc + 18, `N = ${kNt(e.N * s)}`, 'lb lbA', 'start');
  g += '</g>';
  g += `<rect class="wd" style="--u:${f1(u)}%" x="${xw - 1}" y="${f1(yc - dpx / 2)}" width="7" height="${f1(dpx)}"/>`;
  g += `<line class="dim" x1="${xw}" y1="${f1(yc + dpx / 2 + 26)}" x2="${f1(xF)}" y2="${f1(yc + dpx / 2 + 26)}"/>` + txt((xw + xF) / 2, yc + dpx / 2 + 40, `e = ${fmt(e.e, 0)} mm`, 'lb');

  /* seção: padrão dos cordões e distribuição da força normal f_n(y) */
  const PX = 405, PY = 160, sc = Math.min(90 / hb, 110 / hd, 1.4);
  const X = x => PX + x * sc, Y = y => PY - y * sc;
  g += txt(PX, 18, 'seção dos cordões — força normal', 'lb lbS');
  if (gg.circ) g += `<circle class="wl" style="--u:${f1(u)}%" cx="${PX}" cy="${PY}" r="${f1(gg.R * sc)}" fill="none"/>`;
  else {
    g += `<rect class="pole" x="${f1(X(-hb))}" y="${f1(Y(hd))}" width="${f1(2 * hb * sc)}" height="${f1(2 * hd * sc)}" opacity=".45"/>`;
    for (const sg of gg.segs) g += `<line class="wl" style="--u:${f1(u)}%" x1="${f1(X(sg.x1))}" y1="${f1(Y(sg.y1))}" x2="${f1(X(sg.x2))}" y2="${f1(Y(sg.y2))}"/>`;
  }
  g += `<line class="pivot" x1="${f1(X(-hb) - 14)}" y1="${f1(Y(gg.yc))}" x2="${f1(X(hb) + 14)}" y2="${f1(Y(gg.yc))}"/>` + txt(X(-hb) - 16, Y(gg.yc) + 4, 'LN', 'lb lbS', 'end');
  /* diagrama: f_n linear em y, desenhado à direita */
  const fmx = Math.max(Math.abs(dm.ftop), Math.abs(dm.fbot), 1e-9), ws = 60 / fmx, xd = X(hb) + 26;
  const yT = Math.max(...gg.pts.map(p => p.y)), yB = Math.min(...gg.pts.map(p => p.y));
  g += `<line class="ax" x1="${f1(xd)}" y1="${f1(Y(yT))}" x2="${f1(xd)}" y2="${f1(Y(yB))}"/>`;
  g += poly('diag', [[xd, Y(yT)], [xd + dm.ftop * ws * s, Y(yT)], [xd + dm.fbot * ws * s, Y(yB)], [xd, Y(yB)]]);
  g += txt(xd + Math.max(dm.ftop * ws * s, 0) + 4, Y(yT) + 4, fmt(dm.ftop * s, 0), 'lb lbS', 'start');
  g += txt(xd + Math.max(dm.fbot * ws * s, 0) + 4, Y(yB) + 4, fmt(dm.fbot * s, 0), 'lb lbS', 'start');
  const yk = dm.topo ? yT : yB, pk = gg.pts.filter(p => Math.abs(p.y - yk) < 1e-6).reduce((m, p) => Math.abs(p.x) > Math.abs(m.x) ? p : m, {x: 0, y: yk});
  g += `<circle class="ring" cx="${f1(X(pk.x))}" cy="${f1(Y(yk))}" r="7"/>`;
  g += txt(PX, 300, `${sub('f', 'n')} = ${fmt(dm.fn * s, 0)} · ${sub('f', 'v')} = ${fmt(dm.fv * s, 0)} · f = ${fLin(dm.f * s)}`, 'lb lbB');
  return g + detalheSolda(a, e, 630, 34, 180, 250, u);
}

/* ---------- perfil soldado: seção com os cordões e trecho em elevação ---------- */
function desenhoPerfil(e, dm, a, s) {
  const u = usoDe(a, s);
  const H = dm.H, sc = Math.min(230 / H, 200 / e.bf), cx = 130, cy = 165;
  const X = x => cx + x * sc, Y = y => cy - y * sc;
  const yf = e.hw / 2;
  let g = txt(cx, 18, 'seção — mesa (Q) que escorrega sobre a alma', 'lb lbS');
  g += `<rect class="pl" x="${f1(X(-e.bf / 2))}" y="${f1(Y(yf + e.tf))}" width="${f1(e.bf * sc)}" height="${f1(e.tf * sc)}"/>`;
  g += `<rect class="qarea" x="${f1(X(-e.bf / 2))}" y="${f1(Y(yf + e.tf))}" width="${f1(e.bf * sc)}" height="${f1(e.tf * sc)}"/>`;
  g += `<rect class="pl" x="${f1(X(-e.bf / 2))}" y="${f1(Y(-yf))}" width="${f1(e.bf * sc)}" height="${f1(e.tf * sc)}"/>`;
  g += `<rect class="pl" x="${f1(X(-e.tw / 2))}" y="${f1(Y(yf))}" width="${f1(e.tw * sc)}" height="${f1(e.hw * sc)}"/>`;
  const hp = a.na ? 0 : Math.max((a.tipo === 'filete' ? a.tam : a.tipo === 'parcial' ? a.tam * 0.8 : a.tipo === 'misto' ? e.tw * 0.5 + a.tam : e.tw * 0.5) * sc, 3);
  for (const sy of [1, -1]) for (const sx of [1, -1]) {
    const x = X(sx * e.tw / 2), y = Y(sy * yf);
    g += poly('wd', [[x, y], [x + sx * hp, y], [x, y + sy * hp]], u);
  }
  g += `<line class="pivot" x1="${f1(X(-e.bf / 2) - 10)}" y1="${cy}" x2="${f1(X(e.bf / 2) + 10)}" y2="${cy}"/>` + txt(X(-e.bf / 2) - 12, cy + 4, 'LN', 'lb lbS', 'end');
  g += txt(X(e.bf / 2) + 6, Y(yf + e.tf / 2) + 4, 'Q', 'lb lbB', 'start');
  if (e.conc) g += seta(cx, Y(yf + e.tf) - 40, cx, Y(yf + e.tf) - 3, 'ar-load', 9) + txt(cx + 8, Y(yf + e.tf) - 26, sub('P', 'c'), 'lb lbA', 'start');
  /* elevação: trecho de viga, cordões contínuos ou intermitentes e o escorregamento da mesa */
  const EX = 290, EW = 300, ey0 = 90, ey1 = 240;
  g += txt(EX + EW / 2, 18, 'elevação — fluxo de cisalhamento q = V·Q/I', 'lb lbS');
  const dx = 5 * s;
  g += `<rect class="pl" x="${EX}" y="${ey0 + 14}" width="${EW}" height="${ey1 - ey0 - 28}"/>`;
  g += `<rect class="pl pl2" x="${f1(EX + dx)}" y="${ey0}" width="${EW}" height="14"/>`;
  g += `<rect class="pl pl2" x="${f1(EX - dx)}" y="${ey1 - 14}" width="${EW}" height="14"/>`;
  const pas = e.interm ? Math.max(e.passo, 1) : 1, tr = e.interm ? e.trecho : 1, k = EW / Math.max(e.passo * 3, 300);
  for (const y of [ey0 + 14, ey1 - 18]) {
    if (!e.interm) g += `<rect class="wd" style="--u:${f1(u)}%" x="${EX}" y="${y}" width="${EW}" height="4"/>`;
    else for (let x = 0; x < EW; x += pas * k) g += `<rect class="wd" style="--u:${f1(u)}%" x="${f1(EX + x)}" y="${y}" width="${f1(Math.min(tr * k, EW - x))}" height="4"/>`;
  }
  g += seta(EX + 40, ey0 - 12, EX + 40 + 30 + 40 * s, ey0 - 12, 'ar-p2', 8) + seta(EX + EW - 40, ey1 + 12, EX + EW - 70 - 40 * s, ey1 + 12, 'ar-p2', 8);
  g += seta(EX + EW - 10, ey0 + 30, EX + EW - 10, ey0 + 30 + 40 * s + 10, 'ar-load', 9) + txt(EX + EW - 16, ey0 + 46, `V = ${kNt(e.V * s)}`, 'lb lbA', 'end');
  g += txt(EX + EW / 2, ey1 + 40, `q = ${fLin(dm.q * s)}${e.interm ? ` · no trecho: ${fLin(dm.fv * s)}` : ''}`, 'lb lbB');
  if (a.na) return g + linhas(a.na, 80).map((l, i) => txt(300, 292 + i * 15, l, 'lb lbBad')).join('');
  return g + txt(cx, 312, `${a.tipo === 'total' ? 'CJP na espessura da alma' : a.tipo === 'misto' ? `CJP na alma + filetes h = ${fmt(a.tam, 0)} mm` : `${TIPOS[a.tipo].curto} ${nomeTam(a.tipo, a.tam)} dos dois lados da alma`}`, 'lb lbB');
}
