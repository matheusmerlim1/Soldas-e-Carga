/* ---------- cálculo (Shigley, cap. 9; AISC 360; AWS D1.1; NBR 8800) ----------
   Unidades internas: N, mm, MPa (N/mm²), N·mm. Nenhuma função aqui toca no DOM.

   Método da linha: o cordão é tratado como uma linha, e cada modelo de carregamento devolve a
   força por unidade de comprimento f (N/mm) no ponto crítico da junta — independente do tipo
   e do tamanho da solda. A tensão vem depois, dividindo f pela garganta efetiva:
   τ = f / (n_c·a), com a = 0,707·h no filete. É isso que permite comparar tipos e achar a
   garganta necessária diretamente: a ≥ f / (n_c·τ_adm). */

/* ---------- padrão de cordões (torção e flexão) ---------- */

/* lados soldados de um retângulo b (horizontal) × d (vertical) centrado na origem */
function segmentosRet(b, d, L) {
  const s = [];
  if (L.sup) s.push({id:'sup', nome:'superior', x1:-b / 2, y1: d / 2, x2: b / 2, y2: d / 2});
  if (L.inf) s.push({id:'inf', nome:'inferior', x1:-b / 2, y1:-d / 2, x2: b / 2, y2:-d / 2});
  if (L.esq) s.push({id:'esq', nome:'esquerdo', x1:-b / 2, y1:-d / 2, x2:-b / 2, y2: d / 2});
  if (L.dir) s.push({id:'dir', nome:'direito',  x1: b / 2, y1:-d / 2, x2: b / 2, y2: d / 2});
  return s;
}

/* propriedades unitárias do grupo de linhas (Shigley, Tab. 9-1 e 9-2, calculadas):
   comprimento L, centroide, momento polar J_u (no plano) e momento de inércia I_u em torno do
   eixo horizontal que passa pelo centroide. Pontos candidatos ao máximo: as extremidades dos
   cordões (o módulo de um campo linear é convexo ao longo da linha, então o máximo está numa
   ponta); no círculo, uma amostragem. */
function propsLinhas(p) {
  if (p.forma === 'circ') {
    const R = p.D / 2, L = Math.PI * p.D;
    const pts = Array.from({length: 72}, (_, i) => { const t = i / 72 * 2 * Math.PI; return {x: R * Math.cos(t), y: R * Math.sin(t)}; });
    return {circ: true, R, L, xc: 0, yc: 0, J: 2 * Math.PI * R ** 3, I: Math.PI * R ** 3, segs: [], pts};
  }
  const segs = segmentosRet(p.b, p.d, p.ladosR).map(s => ({...s, len: Math.hypot(s.x2 - s.x1, s.y2 - s.y1), xm: (s.x1 + s.x2) / 2, ym: (s.y1 + s.y2) / 2}));
  const L = segs.reduce((a, s) => a + s.len, 0);
  if (!(L > 0)) return {L: 0, segs, pts: []};
  const xc = segs.reduce((a, s) => a + s.len * s.xm, 0) / L, yc = segs.reduce((a, s) => a + s.len * s.ym, 0) / L;
  let J = 0, I = 0;
  for (const s of segs) {
    s.J = s.len ** 3 / 12 + s.len * ((s.xm - xc) ** 2 + (s.ym - yc) ** 2);
    s.I = (s.x1 === s.x2 ? s.len ** 3 / 12 : 0) + s.len * (s.ym - yc) ** 2;
    J += s.J; I += s.I;
  }
  const pts = [];
  for (const s of segs) for (const [x, y] of [[s.x1, s.y1], [s.x2, s.y2]])
    if (!pts.some(q => Math.abs(q.x - x) < 1e-6 && Math.abs(q.y - y) < 1e-6)) pts.push({x, y});
  return {circ: false, L, xc, yc, J, I, segs, pts};
}

/* ---------- força por unidade de comprimento em cada modelo ---------- */

/* junta direta: cordões de comprimento L; P normal ao eixo do cordão, V ao longo dele */
function demandaSimples(e) {
  const fn = e.P / e.L, fv = e.V / e.L;
  return {fn, fv, f: Math.hypot(fn, fv), Lsolda: e.L, Lcord: e.L};
}

/* grupo em torção (Shigley §9-4): carga (Fx, Fy) no ponto (ax, ay), coordenadas a partir do
   centro do retângulo b × d. Cisalhamento primário f' = F/L igual em todo o cordão;
   secundário f'' = M·r/J_u, perpendicular ao raio; resultante = soma vetorial. */
function demandaTorcao(e) {
  const g = propsLinhas(e);
  if (!(g.L > 0)) return {erro: 'Marque ao menos um lado soldado.'};
  const M = (e.ax - g.xc) * e.Fy - (e.ay - g.yc) * e.Fx;
  const p1 = [e.Fx / g.L, e.Fy / g.L];
  for (const p of g.pts) {
    const rx = p.x - g.xc, ry = p.y - g.yc;
    p.r = Math.hypot(rx, ry);
    p.p1 = p1;
    p.p2 = [-M * ry / g.J, M * rx / g.J];
    p.v = [p1[0] + p.p2[0], p1[1] + p.p2[1]];
    p.f = Math.hypot(...p.v);
  }
  const crit = g.pts.reduce((a, b) => b.f > a.f ? b : a, g.pts[0]);
  return {fn: 0, fv: crit.f, f: crit.f, g, M, p1, crit, F: Math.hypot(e.Fx, e.Fy), Lsolda: g.L,
    rmax: Math.max(...g.pts.map(p => p.r))};
}

/* console (ou poste) em flexão (Shigley §9-5): força F perpendicular ao elemento, a uma
   distância e do plano da solda, e normal N (+ tração). O cordão é a seção resistente:
   f' = F/L (cisalhamento), f_M = M·c/I_u (normal, máxima na fibra extrema), f_N = N/L. */
function demandaFlexao(e) {
  const g = propsLinhas(e);
  if (!(g.L > 0)) return {erro: 'Marque ao menos um lado soldado.'};
  const M = e.F * e.e;
  const ytop = Math.max(...g.pts.map(p => p.y)), ybot = Math.min(...g.pts.map(p => p.y));
  const ct = ytop - g.yc, cb = g.yc - ybot;
  const fN = e.N / g.L;
  const fMt = g.I > 0 ? M * ct / g.I : (M ? Infinity : 0), fMb = g.I > 0 ? M * cb / g.I : (M ? Infinity : 0);
  const ftop = fN + fMt, fbot = fN - fMb;
  const topo = Math.abs(ftop) >= Math.abs(fbot);
  const fn = topo ? ftop : fbot, fv = Math.abs(e.F) / g.L;
  return {fn, fv, f: Math.hypot(fn, fv), g, M, ct, cb, fN, fMt, fMb, ftop, fbot, topo, Lsolda: g.L};
}

/* perfil soldado (alma–mesa): fluxo de cisalhamento q = V·Q/I na interface, dividido pelos
   dois cordões; cordão intermitente concentra o fluxo no trecho soldado (fator passo/trecho).
   Carga concentrada sobre a mesa (roda de ponte rolante) gera força normal P_c/ℓ_c. */
function demandaPerfil(e) {
  const H = e.hw + 2 * e.tf;
  const I = (e.bf * H ** 3 - (e.bf - e.tw) * e.hw ** 3) / 12;
  const Q = e.bf * e.tf * (e.hw + e.tf) / 2;
  const q = e.V * Q / I;
  const k = e.interm ? e.passo / e.trecho : 1;
  const fv = q * k, fn = e.conc ? e.Pc / e.lc : 0;
  return {fn, fv, f: Math.hypot(fn, fv), H, I, Q, q, k, Lsolda: 2 * e.Lv / k};
}

const DEMANDAS = {simples: demandaSimples, torcao: demandaTorcao, flexao: demandaFlexao, perfil: demandaPerfil};

/* ---------- tipo de solda × tamanho × eletrodo ---------- */

const aplicavel = (tipo, junta) => TIPOS[tipo].juntas.includes(junta);
const prepDe = e => PREP_PJP.find(p => p.id === e.prep) || PREP_PJP[0];

/* tamanhos possíveis de cada tipo nesta junta */
function tamanhos(tipo, e) {
  if (tipo === 'filete') return PERNAS;
  if (tipo === 'parcial') { const pr = prepDe(e); return CHANFROS.filter(S => S * e.lados < e.t && S - pr.red > 0); }
  if (tipo === 'misto') return PERNAS;
  return [e.t];
}

/* geometria do cordão: garganta efetiva a, área resistente por mm (n_c·a), área da face de
   fusão por mm e área de metal depositado por mm de junta */
function geometriaSolda(tipo, tam, e) {
  if (tipo === 'filete') return {a: 0.707 * tam, aTot: e.lados * 0.707 * tam, aFus: e.lados * tam, area: e.lados * tam * tam / 2};
  if (tipo === 'parcial') {
    const pr = prepDe(e), a = tam - pr.red;
    return {a, aTot: e.lados * a, aFus: e.lados * a, area: e.lados * pr.area(tam), pr};
  }
  if (tipo === 'misto') {
    /* garganta do metal de solda: a da CJP (t) mais a dos filetes de reforço, n_c·0,707·h */
    const aF = e.lados * 0.707 * tam;
    return {a: e.t, aF, aTot: e.t + aF, aFus: e.t + e.lados * tam, area: areaCJP(e.t) + e.lados * tam * tam / 2};
  }
  return {a: e.t, aTot: e.t, aFus: e.t, area: areaCJP(e.t)};
}

/* fator de concentração de fadiga do tipo (Shigley, Tab. 9-5) */
function kfsDe(tipo, dm, e) {
  if (tipo === 'filete') return dm.fv >= Math.abs(dm.fn) ? KFS.paral : KFS.trans;
  if (tipo === 'parcial') return KFS.Tcanto;
  if (tipo === 'misto') return KFS.trans;              // o filete tira o canto vivo: pé de filete
  return e.junta === 'topo' ? KFS.topo : KFS.Tcanto;
}

function analisar(e, dm, tipo, tam, el) {
  const mb = e.mb, cr = CRITERIOS[e.criterio], req = e.criterio === 'vm' ? e.nReq : 1;
  const g = geometriaSolda(tipo, tam, e);
  const ver = [];
  const add = (id, nome, n, rq, sol, res, extra) => ver.push({id, nome, n, req: rq, sol, res, ...extra});
  const st = {};                                            // tensões, para o memorial

  const interacao = (sig, tau, Rs, Rt) => 1 / Math.hypot(sig / Rs, tau / Rt);
  if (tipo === 'misto') {
    /* chapa conectada na seção da junta: só a espessura t resiste, o filete não ajuda */
    st.sig = Math.abs(dm.fn) / e.t; st.tau = dm.fv / e.t;
    const [Rs, Rsf] = cr.normB(mb), [Rt, Rtf] = cr.cisB(mb);
    st.Rs = Rs; st.Rt = Rt;
    add('chapa', 'Chapa conectada (seção t)', interacao(st.sig, st.tau, Rs, Rt), req,
      ['σ; τ', st.sig, st.tau], [`${Rsf}; ${Rtf}`, Rs, Rt], {par: true});
    /* metal de solda: CJP + filetes de reforço */
    st.sigw = Math.abs(dm.fn) / g.aTot; st.tauw = dm.fv / g.aTot;
    const [Rsw, Rswf] = cr.normW(el), [Rtw, Rtwf] = cr.cisW(el);
    st.Rsw = Rsw; st.Rtw = Rtw;
    add('wmet', 'Metal de solda (CJP + filetes)', interacao(st.sigw, st.tauw, Rsw, Rtw), req,
      ['σ_w; τ_w', st.sigw, st.tauw], [`${Rswf}; ${Rtwf}`, Rsw, Rtw], {par: true, tensaoW: true});
  } else if (tipo !== 'total') {
    /* filete e PJP: a resultante é tratada como cisalhamento na garganta (simplificação de
       norma, a favor da segurança, mesmo quando a carga é normal ao cordão) */
    st.tau = dm.f / g.aTot;
    const [Rw, Rwf] = cr.gargW(el);
    add('garg', 'Metal de solda (garganta)', Rw / st.tau, req, ['τ', st.tau], [Rwf, Rw], {tensao: true});
    st.taub = dm.f / g.aFus;
    const [Rb, Rbf] = cr.faceB(mb);
    add('face', 'Metal base (face de fusão)', Rb / st.taub, req, ['τ_b', st.taub], [Rbf, Rb], {tensao: true});
    st.Rw = Rw; st.Rb = Rb;
  } else {
    st.sig = Math.abs(dm.fn) / g.a; st.tau = dm.fv / g.a;
    const [Rs, Rsf] = cr.normCJP(mb, el), [Rt, Rtf] = cr.cisCJP(mb, el);
    st.Rs = Rs; st.Rt = Rt;
    if (st.sig > 0) add('norm', dm.fn < 0 ? 'Compressão normal ao cordão' : 'Tração normal ao cordão', Rs / st.sig, req, ['σ', st.sig], [Rsf, Rs], {tensao: true});
    if (st.tau > 0) add('cis', 'Cisalhamento no cordão', Rt / st.tau, req, ['τ', st.tau], [Rtf, Rt], {tensao: true});
    if (st.sig > 0 && st.tau > 0) {
      const ni = 1 / Math.hypot(st.sig / Rs, st.tau / Rt);
      add('inter', 'Interação normal + cisalhamento', ni, req, ['(σ/σ_adm)² + (τ/τ_adm)²', 1 / ni ** 2], ['1', 1], {tensao: true, adim: true});
    }
  }

  /* limites de dimensão */
  if (tipo === 'filete') {
    const hmin = pernaMin(e.T);
    add('hmin', 'Perna mínima (AWS D1.1)', tam / hmin, 1, ['h', tam], ['h_min', hmin], {geo: true});
    if (e.junta === 'sobreposta') {
      const hmax = pernaMax(e.t);
      add('hmax', 'Perna máxima na borda (AWS D1.1)', hmax / tam, 1, ['h', tam], ['h_max', hmax], {geo: true});
    }
  } else if (tipo === 'misto') {
    const hmin = reforcoMin(e.t, e.T);
    add('hmin', 'Filete de reforço mínimo (AWS D1.1)', tam / hmin, 1, ['h', tam], ['h_min', hmin], {geo: true});
  } else if (tipo === 'parcial') {
    const amin = gargMinPJP(e.t);
    add('amin', 'Garganta mínima da PJP (AISC J2.3)', g.a / amin, 1, ['E', g.a], ['E_min', amin], {geo: true});
  }

  /* fadiga: Goodman em cisalhamento com S_e corrigido (Shigley §9-6, Ex. 9-5) */
  let fad = null;
  if (e.variavel) {
    const [Kfs, kfsTxt] = kfsDe(tipo, dm, e);
    const Sut = Math.min(el.Sut, mb.Sut), ka = KA_FORJADO.a * Sut ** KA_FORJADO.b;
    const cis = tipo === 'filete' || tipo === 'parcial';
    const kc = cis ? 0.59 : 1;
    const Se = ka * kc * 0.5 * Sut, Sref = cis ? 0.67 * Sut : Sut;
    const smax = cis ? st.tau : Math.hypot(st.sig, Math.sqrt(3) * st.tau);   // CJP: von Mises
    const sa = Kfs * Math.abs(1 - e.R) / 2 * smax, sm = Kfs * Math.abs(1 + e.R) / 2 * smax;
    const nf = 1 / (sa / Se + sm / Sref);
    fad = {Kfs, kfsTxt, Sut, ka, kc, Se, Sref, smax, sa, sm, nf, cis};
    add('fad', 'Fadiga (Goodman)', nf, req, [cis ? 'τ_a' : 'σ_a', sa], ['S_e', Se], {tensao: true});
  }

  let gov = null;
  for (const v of ver) {
    v.ok = v.n >= v.req; v.razao = v.n / v.req;
    if (!gov || v.razao < gov.razao) gov = v;
  }
  /* garganta que zera a folga de cada verificação de tensão: n é proporcional a a */
  const rz = ver.filter(v => v.tensao).map(v => g.a / v.razao);
  let aReq = rz.length ? Math.max(...rz) : 0;
  /* CJP + filete: garganta total de metal de solda exigida (a chapa e a fadiga não dependem de h) */
  if (tipo === 'misto') aReq = g.aTot / ver.find(v => v.id === 'wmet').razao;
  return {tipo, tam, el, mb, g, st, fad, ver, gov, aReq, massa: g.area * dm.Lsolda * DENS,
    ok: ver.every(v => v.ok)};
}

/* todas as combinações, do menor tamanho para o maior e, no mesmo tamanho, do eletrodo mais
   simples para o mais resistente */
function varrer(e, dm, tipo, eletrodos) {
  const out = [];
  for (const tam of tamanhos(tipo, e)) for (const el of ELETRODOS) if (eletrodos.includes(el.id)) out.push(analisar(e, dm, tipo, tam, el));
  return out;
}
const recomendar = lista => lista.find(a => a.ok) || null;
const comFilete = tipo => tipo === 'filete' || tipo === 'misto';
const usoFrequente = a => eletrodoFreq(a.el.id) && (!comFilete(a.tipo) || a.tam <= PASSE_UNICO);
const recomendarComercial = lista => lista.find(a => a.ok && usoFrequente(a)) || null;
function melhorPorEletrodo(lista) {
  const m = {};
  for (const a of lista) if (a.ok && !m[a.el.id]) m[a.el.id] = a;
  return m;
}
/* tipo mais econômico: o de menor massa depositada entre as recomendações de cada tipo.
   O chanfro custa preparação (e, na CJP, goivagem e ensaio volumétrico): um tipo de preparação
   mais trabalhosa só vence o anterior (filete → PJP → CJP) se economizar ECON_CHANFRO de metal. */
const ECON_CHANFRO = 0.30;
function melhorTipo(recs) {
  let b = null;
  for (const t of ORDEM_TIPOS) { const a = recs[t]; if (a && (!b || a.massa < b.massa * (1 - ECON_CHANFRO))) b = a; }
  return b;
}

/* tamanho comercial necessário a partir da garganta exigida pelas tensões e dos limites */
function tamanhoNecessario(tipo, aReq, e) {
  if (tipo === 'filete') {
    const h = Math.max(aReq / 0.707, pernaMin(e.T));
    return {cont: h, com: PERNAS.find(x => x >= h - 1e-9) || null};
  }
  if (tipo === 'misto') {
    const h = Math.max((aReq - e.t) / (e.lados * 0.707), reforcoMin(e.t, e.T));
    return {cont: h, com: PERNAS.find(x => x >= h - 1e-9) || null};
  }
  if (tipo === 'parcial') {
    const pr = prepDe(e), S = Math.max(aReq, gargMinPJP(e.t)) + pr.red;
    return {cont: S, com: tamanhos('parcial', e).find(x => x >= S - 1e-9) || null};
  }
  return {cont: aReq, com: aReq <= e.t + 1e-9 ? e.t : null};
}
