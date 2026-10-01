/* ================= MEMORIAL DE CÁLCULO =================
   O passo a passo é descrito uma única vez, como dados, por modeloSolda().
   renderModelo() transforma essa estrutura no memorial da tela e do relatório impresso.
   Notação: "f_v", "S_ut,e" viram subscrito no HTML (mathHtml). Unicode direto para ², √, ·, Σ. */

const RE_SUB = /([A-Za-zΔλχδπσμτγ'″])_([A-Za-z0-9,]+)/g;
const mathHtml = s => String(s).replace(RE_SUB, '$1<sub>$2</sub>');
const fmt = (v, d = 2) => !isFinite(v) ? (v > 0 ? '∞' : '—')
  : Number(v).toLocaleString('pt-BR', {minimumFractionDigits: d, maximumFractionDigits: d});
/* unidade de força escolhida pelo usuário: kN ou tf (1 tf = 9,80665 kN) */
const UN = {f: 'kN'};
const FATOR_F = {kN: 1000, tf: 9806.65};
const uF = () => FATOR_F[UN.f];                          // N por unidade de força
const fF = (N, d = 3) => fmt(N / uF(), d);               // só o número, na unidade escolhida
const fM = (Nmm, d = 3) => fmt(Nmm / uF() / 1000, d);    // momento: N·mm → kN·m ou tf·m
const kN = (N, d = 2) => fF(N, d) + ' ' + UN.f;
const kNm = (Nmm, d = 2) => fM(Nmm, d) + ' ' + UN.f + '·m';
const fLin = (v, d = 1) => fmt(v, d) + ' N/mm';          // força por unidade de comprimento
const MPa = (v, d = 1) => fmt(v, d) + ' MPa';
const mm = (v, d = 1) => fmt(v, d) + ' mm';
const fatorTxt = n => !isFinite(n) ? '∞' : n > 99 ? '> 99' : fmt(n, 2);
const MODOS = {
  simples: 'Junta direta — cordões com carga repartida',
  torcao:  'Grupo de cordões em torção — carga excêntrica no plano',
  flexao:  'Console soldado em flexão',
  perfil:  'Perfil soldado — cordões alma–mesa'
};
const nomeTam = (tipo, tam) => tipo === 'filete' || tipo === 'misto' ? `h = ${fmt(tam, 0)} mm` : tipo === 'parcial' ? `S = ${fmt(tam, 0)} mm` : `t = ${fmt(tam, 0)} mm`;
const nomeSolda = a => `${TIPOS[a.tipo].nome} ${nomeTam(a.tipo, a.tam)} — ${a.el.nome}`;

function numerarPassos(secoes) {
  let n = 0;
  secoes.forEach((sec, si) => { sec.num = si + 1; sec.passos.forEach(ps => { ps.num = ++n; }); });
}
const ladosTxt = L => ['sup', 'inf', 'esq', 'dir'].filter(k => L[k]).map(k => ({sup: 'superior', inf: 'inferior', esq: 'esquerdo', dir: 'direito'})[k]).join(', ');
const padraoTxt = e => e.forma === 'circ' ? `circular, D = ${fmt(e.D, 0)} mm` : `retângulo ${fmt(e.b, 0)} × ${fmt(e.d, 0)} mm — lados ${ladosTxt(e.ladosR)}`;

/* ---------------- modelo ---------------- */
function modeloSolda(modo, e, dm, a) {
  const {g, st, el, mb} = a, T = TIPOS[a.tipo], cr = CRITERIOS[e.criterio];
  const nome = nomeSolda(a);
  const nc = a.tipo === 'total' ? 1 : e.lados;

  /* A · entradas */
  const entradas = [['—', 'Modelo de carregamento', MODOS[modo], 'selecionado pelo usuário']];
  if (modo === 'simples') {
    entradas.push(['—', 'Tipo de junta', JUNTAS[e.junta], 'selecionado']);
    entradas.push(['L', 'Comprimento de cada cordão', mm(e.L, 0), 'informado']);
    entradas.push(['P', 'Força normal ao eixo do cordão', kN(e.P), 'informado']);
    entradas.push(['V', 'Força ao longo do cordão', kN(e.V), 'informado']);
  } else if (modo === 'torcao') {
    entradas.push(['—', 'Tipo de junta', JUNTAS[e.junta], 'selecionado']);
    entradas.push(['—', 'Padrão dos cordões', padraoTxt(e), 'informado']);
    entradas.push(['F_x, F_y', 'Componentes da força no plano', `${kN(e.Fx)}, ${kN(e.Fy)}`, 'informado']);
    entradas.push(['a_x, a_y', 'Ponto de aplicação (origem no centro do retângulo)', `${fmt(e.ax, 0)} mm, ${fmt(e.ay, 0)} mm`, 'informado']);
  } else if (modo === 'flexao') {
    entradas.push(['—', 'Padrão dos cordões na seção engastada', padraoTxt(e), 'informado']);
    entradas.push(['F', 'Força perpendicular ao console', kN(e.F), 'informado']);
    entradas.push(['e', 'Braço da força até o plano da solda', mm(e.e, 0), 'informado']);
    entradas.push(['N', 'Força normal (+ tração, afasta o console do apoio)', kN(e.N), 'informado']);
  } else {
    entradas.push(['b_f × t_f', 'Mesa', `${fmt(e.bf, 0)} × ${fmt(e.tf, 1)} mm`, 'informado']);
    entradas.push(['h_w × t_w', 'Alma (altura livre × espessura)', `${fmt(e.hw, 0)} × ${fmt(e.tw, 1)} mm`, 'informado']);
    entradas.push(['V', 'Força cortante máxima', kN(e.V), 'informado']);
    entradas.push(['—', 'Cordões', e.interm ? `intermitentes: trecho ${fmt(e.trecho, 0)} mm a cada ${fmt(e.passo, 0)} mm` : 'contínuos', 'informado']);
    if (e.conc) entradas.push(['P_c / ℓ_c', 'Carga concentrada sobre a mesa e comprimento de distribuição', `${kN(e.Pc)} em ${fmt(e.lc, 0)} mm`, 'informado']);
    entradas.push(['L_v', 'Comprimento da viga (só para a massa de solda)', mm(e.Lv, 0), 'informado']);
  }
  entradas.push(
    ['—', 'Metal base', `${mb.nome} (S_y = ${fmt(mb.Sy, 0)} MPa, S_ut = ${fmt(mb.Sut, 0)} MPa)`, 'selecionado'],
    ['t', 'Espessura da parte mais fina (garganta da CJP)', mm(e.t, 1), modo === 'perfil' ? 'min(t_w, t_f)' : 'informado'],
    ['T', 'Espessura da parte mais grossa (filete mínimo)', mm(e.T, 1), modo === 'perfil' ? 'max(t_w, t_f)' : 'informado'],
    ['n_c', a.tipo === 'misto' ? 'Filetes de reforço (lados da junta)' : 'Cordões por junta (lados soldados)', a.tipo === 'total' ? '1 (a CJP ocupa a espessura toda)' : String(e.lados), modo === 'perfil' ? 'dois lados da alma' : 'informado'],
    ['—', 'Elemento verificado', nome, a.tipo === 'parcial' ? g.pr.nome : a.tipo === 'total' ? prepCJP(e.t) : a.tipo === 'misto' ? `${e.lados > 1 ? 'duplo bisel (K)' : 'bisel simples com cobre-junta'} + filete de reforço` : 'filete de pernas iguais a 90°'],
    ['—', 'Critério de verificação', cr.nome + (e.criterio === 'vm' ? ` — n ≥ ${fmt(e.nReq, 2)}` : ''), 'selecionado']
  );
  if (e.variavel) entradas.push(['R', 'Razão de carga do ciclo F_min / F_max', fmt(e.R, 2), 'informado']);

  /* B · constantes */
  const constantes = [
    ['0,707', 'Garganta do filete de pernas iguais: a = h·cos 45°', '1/√2', 'Shigley, eq. 9-1'],
    ['—', 'Tensão no filete', 'resultante tratada como cisalhamento na garganta', 'Shigley §9-3 (a favor da segurança)']
  ];
  if (e.criterio === 'nbr') constantes.push(['γ_a1, γ_w2', 'Coeficientes de ponderação da resistência (metal base, solda)', '1,10; 1,35', 'NBR 8800, Tab. 3 e 8']);
  if (e.criterio === 'vm') constantes.push(['0,577', 'Razão de von Mises em cisalhamento puro', '1/√3', 'energia de distorção'], ['n', 'Coeficiente de segurança exigido', fmt(e.nReq, 2), 'informado']);
  else constantes.push(['n ≥ 1', e.criterio === 'nbr' ? 'Solicitação de cálculo ≤ resistência de cálculo' : 'Tensão atuante ≤ tensão admissível (a margem está na norma)', '1,00', e.criterio === 'nbr' ? 'NBR 8800' : 'AISC / Shigley Tab. 9-4']);
  constantes.push(['ρ', 'Massa específica do aço (massa depositada)', '7 850 kg/m³', '—']);

  /* C · propriedades */
  const props = [
    ['S_ut,e', `Resistência à tração do metal depositado (${el.nome})`, MPa(el.Sut, 0), 'Shigley, Tab. 9-3 (AWS A5.1)'],
    ['S_y,e', 'Escoamento do metal depositado', MPa(el.Sy, 0), 'Shigley, Tab. 9-3'],
    ['S_y,b', `Escoamento do metal base (${mb.nome})`, MPa(mb.Sy, 0), 'norma do material'],
    ['S_ut,b', 'Resistência à tração do metal base', MPa(mb.Sut, 0), 'norma do material'],
    ['—', 'Eletrodos típicos da classe', el.ex, 'AWS A5.1 / A5.18']
  ];

  const secoes = [];

  /* 1 · força por unidade de comprimento */
  if (modo === 'simples') {
    secoes.push({titulo: 'Força por unidade de comprimento no cordão', passos: [
      {t: 'Componente normal ao cordão', f: 'f_n = P / L', s: `f_n = ${fmt(e.P, 0)} N / ${fmt(e.L, 0)} mm`, r: `f_n = ${fLin(dm.fn)}`,
        n: 'Método da linha: o cordão é uma linha e a carga é dada por milímetro de junta. Os n_c cordões da junta dividem esse valor.'},
      {t: 'Componente ao longo do cordão', f: 'f_v = V / L', s: `f_v = ${fmt(e.V, 0)} N / ${fmt(e.L, 0)} mm`, r: `f_v = ${fLin(dm.fv)}`},
      {t: 'Resultante por milímetro de junta', f: 'f = √(f_n² + f_v²)', s: `f = √(${fmt(dm.fn, 1)}² + ${fmt(dm.fv, 1)}²)`, r: `f = ${fLin(dm.f)}`}
    ]});
  } else if (modo === 'torcao') {
    const gg = dm.g, c = dm.crit, ps = [
      {t: 'Comprimento total e centroide dos cordões', f: gg.circ ? 'L = π·D     centroide no centro' : 'L = ΣL_i     x̄ = ΣL_i·x_i / L     ȳ = ΣL_i·y_i / L',
        s: gg.circ ? `L = π × ${fmt(e.D, 0)}` : `${gg.segs.length} cordão(ões): ${gg.segs.map(s => `${s.nome} ${fmt(s.len, 0)}`).join(' + ')} mm`,
        r: `L = ${mm(gg.L, 0)}     x̄ = ${fmt(gg.xc, 1)} mm     ȳ = ${fmt(gg.yc, 1)} mm`},
      {t: 'Momento polar unitário do grupo', f: gg.circ ? 'J_u = 2π·r³' : 'J_u = Σ[L_i³/12 + L_i·r_i²]',
        s: gg.circ ? `J_u = 2π × ${fmt(gg.R, 1)}³` : gg.segs.map(s => fmt(s.J, 0)).join(' + '), r: `J_u = ${fmt(gg.J, 0)} mm³`,
        n: 'Propriedade da linha (Shigley, Tab. 9-1). O momento polar da solda real é J = 0,707·h·J_u; com o método da linha não é preciso conhecê-lo antes de escolher h.'},
      {t: 'Momento da carga em relação ao centroide', f: 'M = (a_x − x̄)·F_y − (a_y − ȳ)·F_x',
        s: `M = ${fmt((e.ax - gg.xc) / 1000, 4)} m × ${fF(e.Fy)} − ${fmt((e.ay - gg.yc) / 1000, 4)} m × ${fF(e.Fx)}`, r: `M = ${kNm(dm.M, 3)}`},
      {t: 'Cisalhamento primário (igual em todo o cordão)', f: "f' = F / L", s: `f' = ${fmt(dm.F, 0)} / ${fmt(gg.L, 0)}`, r: `f' = ${fLin(Math.hypot(...dm.p1))}`},
      {t: 'Cisalhamento secundário no ponto mais afastado', f: "f'' = M·r_max / J_u", s: `f'' = ${fmt(Math.abs(dm.M), 0)} × ${fmt(dm.rmax, 1)} / ${fmt(gg.J, 0)}`,
        r: `f'' = ${fLin(Math.abs(dm.M) * dm.rmax / gg.J)}`, n: 'Perpendicular ao raio que liga o ponto ao centroide, no sentido da rotação.'},
      {t: `Resultante no ponto crítico (x = ${fmt(c.x, 0)}, y = ${fmt(c.y, 0)} mm)`, f: "f = |f' + f''|",
        s: `f = √[(${fmt(c.v[0] - c.p2[0], 1)} + ${fmt(c.p2[0], 1)})² + (${fmt(c.v[1] - c.p2[1], 1)} + ${fmt(c.p2[1], 1)})²]`, r: `f = ${fLin(dm.f)}`,
        n: 'É o ponto mais distante do centroide no lado em que os dois cisalhamentos apontam no mesmo sentido. A tabela mostra os pontos candidatos.'}
    ];
    secoes.push({titulo: 'Força no cordão — torção no plano (Shigley §9-4)', passos: ps,
      tabela: gg.circ ? null : {cab: ['Ponto', 'x (mm)', 'y (mm)', 'r (mm)', "f'' (N/mm)", 'f (N/mm)'],
        linhas: gg.pts.map((p, i) => [i + 1, fmt(p.x, 0), fmt(p.y, 0), fmt(p.r, 1), fmt(Math.hypot(...p.p2), 1), (p === c ? '▶ ' : '') + fmt(p.f, 1)])}});
  } else if (modo === 'flexao') {
    const gg = dm.g, ps = [
      {t: 'Comprimento total e centroide dos cordões', f: gg.circ ? 'L = π·D' : 'L = ΣL_i     ȳ = ΣL_i·y_i / L',
        s: gg.circ ? `L = π × ${fmt(e.D, 0)}` : gg.segs.map(s => `${s.nome} ${fmt(s.len, 0)}`).join(' + ') + ' mm',
        r: `L = ${mm(gg.L, 0)}     ȳ = ${fmt(gg.yc, 1)} mm`},
      {t: 'Momento de inércia unitário em torno do eixo de flexão', f: gg.circ ? 'I_u = π·r³' : 'I_u = Σ[L_v³/12 + L_i·(y_i − ȳ)²]',
        s: gg.circ ? `I_u = π × ${fmt(gg.R, 1)}³` : gg.segs.map(s => fmt(s.I, 0)).join(' + '), r: `I_u = ${fmt(gg.I, 0)} mm³`,
        n: 'Propriedade da linha (Shigley, Tab. 9-2): cordões horizontais contribuem só com L·y²; os verticais, também com L³/12.'},
      {t: 'Momento no plano da solda', f: 'M = F·e', s: `M = ${kN(e.F, 3)} × ${fmt(e.e / 1000, 3)} m`, r: `M = ${kNm(dm.M, 3)}`},
      {t: 'Força normal pela flexão nas fibras extremas', f: 'f_M = M·c / I_u', s: `topo: ${fmt(dm.M, 0)} × ${fmt(dm.ct, 1)} / ${fmt(gg.I, 0)}     base: c = ${fmt(dm.cb, 1)} mm`,
        r: `f_M,topo = ${fLin(dm.fMt)}     f_M,base = ${fLin(dm.fMb)}`}
    ];
    if (e.N) ps.push({t: 'Força normal pela carga axial', f: 'f_N = N / L', s: `f_N = ${fmt(e.N, 0)} / ${fmt(gg.L, 0)}`, r: `f_N = ${fLin(dm.fN)}`});
    ps.push(
      {t: 'Força normal na fibra crítica', f: 'f_n = f_N ± f_M', s: `topo: ${fmt(dm.ftop, 1)}     base: ${fmt(dm.fbot, 1)}`,
        r: `f_n = ${fLin(dm.fn)} (${dm.topo ? 'topo' : 'base'}${dm.fn < 0 ? ', compressão' : ', tração'})`},
      {t: 'Cisalhamento direto (todo o cordão)', f: "f_v = F / L", s: `f_v = ${fmt(Math.abs(e.F), 0)} / ${fmt(gg.L, 0)}`, r: `f_v = ${fLin(dm.fv)}`,
        n: 'Como no Shigley, o cortante se divide por todo o comprimento do cordão.'},
      {t: 'Resultante na fibra crítica', f: 'f = √(f_n² + f_v²)', s: `f = √(${fmt(dm.fn, 1)}² + ${fmt(dm.fv, 1)}²)`, r: `f = ${fLin(dm.f)}`}
    );
    secoes.push({titulo: 'Força no cordão — flexão (Shigley §9-5)', passos: ps,
      tabela: gg.circ ? null : {cab: ['Cordão', 'L (mm)', 'y médio (mm)', 'I_u parcial (mm³)'], linhas: gg.segs.map(s => [s.nome, fmt(s.len, 0), fmt(s.ym, 1), fmt(s.I, 0)])}});
  } else {
    const ps = [
      {t: 'Momento de inércia do perfil', f: 'I = [b_f·H³ − (b_f − t_w)·h_w³] / 12     H = h_w + 2·t_f',
        s: `I = [${fmt(e.bf, 0)} × ${fmt(dm.H, 1)}³ − ${fmt(e.bf - e.tw, 1)} × ${fmt(e.hw, 0)}³] / 12`, r: `I = ${fmt(dm.I / 1e4, 0)} cm⁴`},
      {t: 'Momento estático da mesa em relação à linha neutra', f: 'Q = b_f·t_f·(h_w + t_f) / 2', s: `Q = ${fmt(e.bf, 0)} × ${fmt(e.tf, 1)} × ${fmt(e.hw + e.tf, 1)} / 2`, r: `Q = ${fmt(dm.Q / 1e3, 1)} cm³`},
      {t: 'Fluxo de cisalhamento na interface alma–mesa', f: 'q = V·Q / I', s: `q = ${fmt(e.V, 0)} × ${fmt(dm.Q, 0)} / ${fmt(dm.I, 0)}`, r: `q = ${fLin(dm.q)}`,
        n: 'Força longitudinal por milímetro que a mesa tenta escorregar sobre a alma; os cordões devem transmiti-la.'}
    ];
    if (e.interm) ps.push({t: 'Concentração no cordão intermitente', f: 'f_v = q·(passo / trecho)', s: `f_v = ${fmt(dm.q, 1)} × ${fmt(e.passo, 0)} / ${fmt(e.trecho, 0)}`, r: `f_v = ${fLin(dm.fv)}`});
    if (e.conc) ps.push({t: 'Força normal da carga concentrada sobre a mesa', f: 'f_n = P_c / ℓ_c', s: `f_n = ${fmt(e.Pc, 0)} / ${fmt(e.lc, 0)}`, r: `f_n = ${fLin(dm.fn)}`,
      n: 'Roda de ponte rolante ou apoio sobre a mesa: a carga passa da mesa para a alma através dos cordões.'});
    ps.push({t: 'Resultante por milímetro de junta', f: 'f = √(f_n² + f_v²)', s: `f = √(${fmt(dm.fn, 1)}² + ${fmt(dm.fv, 1)}²)`, r: `f = ${fLin(dm.f)}`});
    secoes.push({titulo: 'Fluxo de cisalhamento na ligação alma–mesa', passos: ps});
  }

  /* 2 · garganta */
  const pg = [];
  if (a.tipo === 'filete') pg.push(
    {t: 'Garganta efetiva do filete', f: 'a = 0,707·h', s: `a = 0,707 × ${fmt(a.tam, 0)}`, r: `a = ${mm(g.a, 2)}`,
      n: 'Menor seção do cordão, a 45° das pernas: é por ela que o filete rompe.'},
    {t: 'Área resistente por milímetro de junta', f: 'A_w = n_c·a', s: `A_w = ${e.lados} × ${fmt(g.a, 2)}`, r: `A_w = ${fmt(g.aTot, 2)} mm²/mm`});
  else if (a.tipo === 'parcial') pg.push(
    {t: 'Garganta efetiva da penetração parcial', f: g.pr.red ? 'E = S − 3 mm' : 'E = S', s: g.pr.red ? `E = ${fmt(a.tam, 0)} − 3` : `E = ${fmt(a.tam, 0)}`, r: `E = ${mm(g.a, 1)}`,
      n: `AISC 360, Tab. J2.1 — ${g.pr.nome}. A raiz não fundida funciona como um entalhe: a PJP é ruim em fadiga e em tração transversal cíclica.`},
    {t: 'Área resistente por milímetro de junta', f: 'A_w = n_c·E', s: `A_w = ${e.lados} × ${fmt(g.a, 1)}`, r: `A_w = ${fmt(g.aTot, 1)} mm²/mm`});
  else if (a.tipo === 'misto') pg.push(
    {t: 'Garganta da penetração total', f: 'E = t', s: `E = ${fmt(e.t, 1)}`, r: `E = ${mm(e.t, 1)}`},
    {t: 'Garganta dos filetes de reforço', f: 'a_f = n_c·0,707·h', s: `a_f = ${e.lados} × 0,707 × ${fmt(a.tam, 0)}`, r: `a_f = ${mm(g.aF, 2)}`,
      n: 'Filete aplicado sobre o chanfro já preenchido, nos dois cantos da junta em T (ou no lado chanfrado, com um lado só).'},
    {t: 'Garganta total do metal de solda', f: 'A_w = E + a_f', s: `A_w = ${fmt(e.t, 1)} + ${fmt(g.aF, 2)}`, r: `A_w = ${fmt(g.aTot, 2)} mm²/mm`,
      n: 'Aproximação usual para CJP com reforço: o filete soma garganta ao metal de solda e alarga a face de fusão na chapa de apoio. A chapa conectada continua com a seção t — o filete não a reforça.'});
  else pg.push({t: 'Garganta efetiva da penetração total', f: 'E = t (parte mais fina)', s: `E = ${fmt(e.t, 1)}`, r: `E = ${mm(g.a, 1)}`,
    n: 'Com eletrodo compatível, a CJP resiste como a própria chapa: a verificação recai sobre o metal base. Exige chanfro, goivagem da raiz (ou cobre-junta) e ensaio volumétrico (UT/RT).'});
  pg.push({t: 'Metal depositado na junta', f: a.tipo === 'filete' ? 'A_dep = n_c·h²/2' : a.tipo === 'parcial' ? `A_dep = n_c·${g.pr.af}` : a.tipo === 'misto' ? 'A_dep = chanfro + fresta + n_c·h²/2' : 'A_dep = área do chanfro + fresta',
    s: `A_dep = ${fmt(g.area, 1)} mm²     L_solda = ${fmt(dm.Lsolda, 0)} mm`, r: `m = ${fmt(a.massa, 3)} kg`,
    n: 'Seção teórica, sem reforço nem perdas: serve para comparar o custo dos tipos.'});
  secoes.push({titulo: 'Geometria da solda', passos: pg});

  /* 3 · resistência */
  const v = id => a.ver.find(x => x.id === id), pr = [];
  if (a.tipo === 'misto') {
    const vc = v('chapa'), vw = v('wmet'), rc = vc.res[0].split('; '), rw = vw.res[0].split('; ');
    pr.push(
      {t: 'Tensões na chapa conectada (seção t)', f: 'σ = |f_n| / t     τ = f_v / t', s: `σ = ${fmt(Math.abs(dm.fn), 1)} / ${fmt(e.t, 1)}     τ = ${fmt(dm.fv, 1)} / ${fmt(e.t, 1)}`, r: `σ = ${MPa(st.sig)}     τ = ${MPa(st.tau)}`},
      {t: 'Chapa conectada', f: `n = 1 / √[(σ / ${rc[0]})² + (τ / ${rc[1]})²]`, s: `n = 1 / √[(${fmt(st.sig, 1)}/${fmt(st.Rs, 1)})² + (${fmt(st.tau, 1)}/${fmt(st.Rt, 1)})²]`, r: `n = ${fatorTxt(vc.n)}`, ok: vc.ok,
        n: 'Limite físico da junta: se a chapa conectada não resiste, nenhuma solda resolve — aumente t ou o comprimento do cordão.'},
      {t: 'Tensões no metal de solda', f: 'σ_w = |f_n| / A_w     τ_w = f_v / A_w', s: `σ_w = ${fmt(Math.abs(dm.fn), 1)} / ${fmt(g.aTot, 2)}     τ_w = ${fmt(dm.fv, 1)} / ${fmt(g.aTot, 2)}`, r: `σ_w = ${MPa(st.sigw)}     τ_w = ${MPa(st.tauw)}`},
      {t: 'Metal de solda (CJP + filetes)', f: `n = 1 / √[(σ_w / ${rw[0]})² + (τ_w / ${rw[1]})²]`, s: `n = 1 / √[(${fmt(st.sigw, 1)}/${fmt(st.Rsw, 1)})² + (${fmt(st.tauw, 1)}/${fmt(st.Rtw, 1)})²]`, r: `n = ${fatorTxt(vw.n)}`, ok: vw.ok,
        n: el.Sut < mb.Sut ? 'Eletrodo abaixo do metal base: é aqui que o filete de reforço compensa.' : ''});
  } else if (a.tipo !== 'total') {
    pr.push(
      {t: 'Tensão de cisalhamento na garganta', f: 'τ = f / (n_c·a)', s: `τ = ${fmt(dm.f, 1)} / ${fmt(g.aTot, 2)}`, r: `τ = ${MPa(st.tau)}`},
      {t: 'Resistência do metal de solda', f: `τ_adm = ${v('garg').res[0]}`, s: `${v('garg').res[0]} com S_ut,e = ${fmt(el.Sut, 0)}, S_y,e = ${fmt(el.Sy, 0)} MPa`, r: `τ_adm = ${MPa(st.Rw)}`},
      {t: 'Metal de solda', f: 'n = τ_adm / τ', s: `n = ${fmt(st.Rw, 1)} / ${fmt(st.tau, 1)}`, r: `n = ${fatorTxt(v('garg').n)}`, ok: v('garg').ok},
      {t: 'Tensão na face de fusão (metal base)', f: a.tipo === 'filete' ? 'τ_b = f / (n_c·h)' : 'τ_b = f / (n_c·E)', s: `τ_b = ${fmt(dm.f, 1)} / ${fmt(g.aFus, 1)}`, r: `τ_b = ${MPa(st.taub)}`},
      {t: 'Metal base junto ao cordão', f: `n = ${v('face').res[0]} / τ_b`, s: `n = ${fmt(st.Rb, 1)} / ${fmt(st.taub, 1)}`, r: `n = ${fatorTxt(v('face').n)}`, ok: v('face').ok,
        n: 'A perna do filete está na face de fusão; com metal base de baixo escoamento, é ele que governa.'});
  } else {
    if (v('norm')) pr.push({t: 'Tensão normal ao cordão', f: 'σ = |f_n| / t', s: `σ = ${fmt(Math.abs(dm.fn), 1)} / ${fmt(e.t, 1)}`, r: `σ = ${MPa(st.sig)}`},
      {t: v('norm').nome, f: `n = ${v('norm').res[0]} / σ`, s: `n = ${fmt(st.Rs, 1)} / ${fmt(st.sig, 1)}`, r: `n = ${fatorTxt(v('norm').n)}`, ok: v('norm').ok});
    if (v('cis')) pr.push({t: 'Tensão de cisalhamento', f: 'τ = f_v / t', s: `τ = ${fmt(dm.fv, 1)} / ${fmt(e.t, 1)}`, r: `τ = ${MPa(st.tau)}`},
      {t: 'Cisalhamento no cordão', f: `n = ${v('cis').res[0]} / τ`, s: `n = ${fmt(st.Rt, 1)} / ${fmt(st.tau, 1)}`, r: `n = ${fatorTxt(v('cis').n)}`, ok: v('cis').ok});
    if (v('inter')) pr.push({t: 'Interação normal + cisalhamento', f: 'n = 1 / √[(σ/σ_adm)² + (τ/τ_adm)²]',
      s: `n = 1 / √[(${fmt(st.sig, 1)}/${fmt(st.Rs, 1)})² + (${fmt(st.tau, 1)}/${fmt(st.Rt, 1)})²]`, r: `n = ${fatorTxt(v('inter').n)}`, ok: v('inter').ok});
    if (el.Sut < mb.Sut) pr.push({t: 'Compatibilidade do eletrodo', f: 'S_ut,e ≥ S_ut,b', s: `${fmt(el.Sut, 0)} < ${fmt(mb.Sut, 0)} MPa`, r: 'eletrodo abaixo do metal base (undermatching)',
      n: 'A resistência foi limitada pelo metal de solda; para CJP use eletrodo compatível (AWS D1.1, Tab. 5.3).'});
  }
  secoes.push({titulo: 'Resistência — ' + cr.curto, passos: pr});

  /* 4 · limites */
  const pl = [];
  if (a.tipo === 'filete') {
    pl.push({t: 'Perna mínima pela chapa mais grossa', f: 'T ≤ 6 → 3 · ≤ 13 → 5 · ≤ 19 → 6 · > 19 → 8 mm', s: `T = ${fmt(e.T, 1)} mm`, r: `h_min = ${fmt(pernaMin(e.T), 0)} mm  (h = ${fmt(a.tam, 0)})`, ok: v('hmin').ok,
      n: 'Abaixo do mínimo o cordão resfria rápido demais sobre a chapa grossa e trinca a frio, mesmo que a tensão seja baixa.'});
    if (v('hmax')) pl.push({t: 'Perna máxima na borda da chapa', f: 't < 6 → t · t ≥ 6 → t − 2 mm', s: `t = ${fmt(e.t, 1)} mm`, r: `h_max = ${fmt(pernaMax(e.t), 0)} mm  (h = ${fmt(a.tam, 0)})`, ok: v('hmax').ok,
      n: 'Na borda, a perna precisa ser menor que a espessura para que o soldador veja a aresta e não a funda.'});
    pl.push({t: 'Número de passes (posição horizontal)', f: `h ≤ ${PASSE_UNICO} mm → passe único`, s: `h = ${fmt(a.tam, 0)} mm`, r: a.tam <= PASSE_UNICO ? 'passe único' : 'multipasse — mais tempo e mais aporte térmico'});
  } else if (a.tipo === 'misto') {
    pl.push({t: 'Filete de reforço mínimo', f: 'h ≥ max(h_min pela chapa grossa; min(t/4; 10 mm))', s: `t = ${fmt(e.t, 1)} mm     T = ${fmt(e.T, 1)} mm`, r: `h_min = ${fmt(reforcoMin(e.t, e.T), 1)} mm  (h = ${fmt(a.tam, 0)})`, ok: v('hmin').ok,
      n: 'AWS D1.1: a CJP em T leva filete de reforço de pelo menos t/4, sem precisar passar de 10 mm.'});
    pl.push({t: 'Número de passes do filete (posição horizontal)', f: `h ≤ ${PASSE_UNICO} mm → passe único`, s: `h = ${fmt(a.tam, 0)} mm`, r: a.tam <= PASSE_UNICO ? 'passe único' : 'multipasse'});
  } else if (a.tipo === 'parcial') {
    pl.push({t: 'Garganta efetiva mínima', f: 'pela parte mais fina (AISC J2.3)', s: `t = ${fmt(e.t, 1)} mm`, r: `E_min = ${fmt(gargMinPJP(e.t), 0)} mm  (E = ${fmt(g.a, 1)})`, ok: v('amin').ok});
    pl.push({t: 'Profundidade do chanfro', f: 'n_c·S < t (senão é penetração total)', s: `${e.lados} × ${fmt(a.tam, 0)} < ${fmt(e.t, 1)}`, r: 'atende'});
  }
  if (pl.length) secoes.push({titulo: 'Limites de dimensão (AWS D1.1 / AISC 360)', passos: pl});

  /* 5 · fadiga */
  if (a.fad) {
    const f = a.fad, vf = v('fad'), sy = f.cis ? 'τ' : 'σ';
    secoes.push({titulo: 'Fadiga — Goodman (Shigley §9-6)', passos: [
      {t: 'Fator de concentração de tensão em fadiga', f: 'K_fs (Shigley, Tab. 9-5)', s: f.kfsTxt, r: `K_fs = ${fmt(f.Kfs, 1)}`,
        n: a.tipo === 'misto' ? 'O filete de reforço suaviza o canto da junta em T: o concentrador passa de 2,0 (canto vivo) para 1,5 (pé de filete). A tensão é a da chapa conectada.' : ''},
      {t: 'Limite de fadiga corrigido', f: f.cis ? 'S_e = k_a·k_c·0,5·S_ut     k_a = 272·S_ut^−0,995 (forjado)     k_c = 0,59' : 'S_e = k_a·0,5·S_ut     k_a = 272·S_ut^−0,995',
        s: `S_ut = min(${fmt(el.Sut, 0)}; ${fmt(mb.Sut, 0)}) = ${fmt(f.Sut, 0)} MPa     k_a = ${fmt(f.ka, 3)}`, r: `S_e = ${MPa(f.Se)}`,
        n: 'Superfície do cordão tratada como "como forjada" e k_b = 1 (tensão uniforme na garganta), como no Ex. 9-5 do Shigley.'},
      {t: 'Tensões alternada e média com o concentrador', f: `${sy}_a = K_fs·|1 − R|/2·${sy}_max     ${sy}_m = K_fs·|1 + R|/2·${sy}_max`,
        s: `${sy}_max = ${fmt(f.smax, 1)} MPa     R = ${fmt(e.R, 2)}`, r: `${sy}_a = ${MPa(f.sa)}     ${sy}_m = ${MPa(f.sm)}`},
      {t: 'Fator de segurança à fadiga', f: f.cis ? 'n_f = 1 / (τ_a/S_e + τ_m/S_su)     S_su = 0,67·S_ut' : 'n_f = 1 / (σ_a/S_e + σ_m/S_ut)',
        s: `n_f = 1 / (${fmt(f.sa, 1)}/${fmt(f.Se, 1)} + ${fmt(f.sm, 1)}/${fmt(f.Sref, 1)})`, r: `n_f = ${fatorTxt(f.nf)}`, ok: vf.ok,
        n: 'Para estruturas sob fadiga de alto ciclo, confirme pelas categorias de detalhe da AWS D1.1 (cap. 2, parte C) ou do Eurocódigo 3-1-9.'}
    ]});
  }

  /* 6 · dimensionamento direto */
  const tn = tamanhoNecessario(a.tipo, a.aReq, e);
  const pd = a.tipo === 'misto'
    ? [{t: 'Garganta de metal de solda que zera a folga', f: 'A_w,req = A_w·n_req / n_w', s: `A_w,req = ${fmt(g.aTot, 2)} × ${fmt(v('wmet').req, 2)} / ${fmt(v('wmet').n, 3)}`, r: `A_w,req = ${mm(a.aReq, 2)}`,
        n: 'Só o metal de solda depende de h; a chapa conectada e a fadiga dependem de t e não melhoram com um filete maior.'}]
    : [{t: 'Garganta que zera a folga da verificação de tensão mais exigente', f: 'a_req = a·n_req / n  (n é proporcional a a)',
    s: a.ver.filter(x => x.tensao).map(x => `${x.nome.toLowerCase()}: ${fmt(g.a * x.req / x.n, 2)}`).join(' · '), r: `a_req = ${mm(a.aReq, 2)}`}];
  if (a.tipo === 'filete') pd.push({t: 'Perna necessária', f: 'h ≥ max(a_req / 0,707; h_min)  → comercial', s: `h ≥ max(${fmt(a.aReq / 0.707, 2)}; ${fmt(pernaMin(e.T), 0)}) = ${fmt(tn.cont, 2)} mm`,
    r: tn.com ? `h = ${fmt(tn.com, 0)} mm` : 'acima de 25 mm — aumente o comprimento ou mude o tipo', ok: !!tn.com});
  else if (a.tipo === 'parcial') pd.push({t: 'Profundidade de chanfro necessária', f: 'S ≥ max(a_req; E_min)' + (g.pr.red ? ' + 3 mm' : ''), s: `S ≥ ${fmt(tn.cont, 2)} mm`,
    r: tn.com ? `S = ${fmt(tn.com, 0)} mm` : `não cabe: n_c·S teria de chegar a t = ${fmt(e.t, 1)} mm — use penetração total`, ok: !!tn.com});
  else if (a.tipo === 'misto') {
    const vc = v('chapa'), vf = v('fad');
    pd.push({t: 'Filete de reforço necessário', f: 'h ≥ max[(A_w,req − t) / (n_c·0,707); h_min]  → comercial', s: `h ≥ ${fmt(tn.cont, 2)} mm`,
      r: tn.com ? `h = ${fmt(tn.com, 0)} mm` : 'acima de 25 mm', ok: !!tn.com});
    if (!vc.ok || (vf && !vf.ok)) pd.push({t: 'Limite da chapa conectada', f: 'independe do filete', s: !vc.ok ? `chapa: n = ${fatorTxt(vc.n)}` : `fadiga: n_f = ${fatorTxt(vf.n)}`,
      r: 'aumente a espessura t, o comprimento do cordão ou a resistência do aço', ok: false});
  }
  else pd.push({t: 'Espessura necessária', f: 'E_req ≤ t', s: `${fmt(a.aReq, 2)} ≤ ${fmt(e.t, 1)}`, r: tn.com ? 'a CJP na espessura t atende' : 'a chapa é fina demais para a carga — nem a CJP resolve', ok: !!tn.com});
  secoes.push({titulo: 'Dimensionamento direto da garganta', passos: pd});

  numerarPassos(secoes);

  const un = x => x.adim ? (y => fmt(y, 3)) : x.geo ? (y => mm(y, 1)) : (y => MPa(y));
  const par = (p, f) => p[0].split('; ').map((nm, i) => `${nm} = ${f(p[i + 1])}`).join('; ');
  const resumo = a.ver.map(x => [x.nome, x.par ? par(x.sol, MPa) : `${x.sol[0]} = ${un(x)(x.sol[1])}`, x.par ? par(x.res, MPa) : `${x.res[0]} = ${un(x)(x.res[1])}`, fatorTxt(x.n),
    x.ok ? '<span class="ok">ATENDE</span>' : '<span class="fail">NÃO ATENDE</span>']);
  const saidas = [
    ['f', 'Força por mm de junta no ponto crítico', fLin(dm.f)],
    [a.tipo === 'filete' ? 'a' : a.tipo === 'misto' ? 'A_w' : 'E', a.tipo === 'misto' ? 'Garganta do metal de solda (CJP + filetes)' : 'Garganta efetiva adotada', mm(a.tipo === 'misto' ? g.aTot : g.a, 2)],
    ['a_req', 'Garganta necessária pelas tensões', mm(a.aReq, 2)],
    ['m', 'Massa de metal depositado (teórica)', `${fmt(a.massa, 3)} kg`]
  ];
  if (a.gov) saidas.push(['n_gov', `Verificação que governa: ${a.gov.nome.toLowerCase()}`, fatorTxt(a.gov.n)]);
  const conclusao = a.ok
    ? `${nome} ATENDE a todas as verificações; governa ${a.gov.nome.toLowerCase()} (n = ${fatorTxt(a.gov.n)}).`
    : `${nome} NÃO ATENDE: ${a.ver.filter(x => !x.ok).map(x => x.nome.toLowerCase()).join(', ')}.`;
  return {
    titulo: `Memorial de cálculo — ${MODOS[modo].split(' —')[0].toLowerCase()}`,
    subtitulo: `${nome} · ${MODOS[modo]}`, entradas, constantes, props, propsTitulo: `C · Propriedades — ${el.nome} sobre ${mb.nome}`,
    secoes, resumo, saidas, conclusao, ok: a.ok
  };
}

/* ---------------- render ---------------- */
function mtabela(cab, linhas, classes) {
  const th = cab.map(c => `<th>${mathHtml(c)}</th>`).join('');
  const tr = linhas.map(l => `<tr>${l.map((c, i) => `<td class="${classes[i] || ''}">${mathHtml(c)}</td>`).join('')}</tr>`).join('');
  return `<div class="mtable-wrap"><table class="mtable"><thead><tr>${th}</tr></thead><tbody>${tr}</tbody></table></div>`;
}
const okBadge = ok => `<span class="cmp ${ok ? 'ok' : 'fail'}">${ok ? '✓ atende' : '✗ não atende'}</span>`;
function renderModelo(m) {
  const secoes = m.secoes.map(sec => `<div class="msection"><h4>${sec.num} · ${mathHtml(sec.titulo)}</h4>
    ${sec.passos.map(ps => `<div class="mstep">
      <div class="mtitle">Passo ${ps.num} · ${mathHtml(ps.t)}</div>
      <div class="mformula">${mathHtml(ps.f)}</div>
      <div class="msub">${mathHtml(ps.s)}</div>
      <div class="mres">${mathHtml(ps.r)}${ps.ok === undefined || ps.ok === null ? '' : ' ' + okBadge(ps.ok)}</div>
      ${ps.n ? `<div class="mnote">${mathHtml(ps.n)}</div>` : ''}</div>`).join('')}
    ${sec.tabela ? mtabela(sec.tabela.cab, sec.tabela.linhas, sec.tabela.cab.map(() => 'val')) : ''}</div>`).join('');
  return `
    <div class="msection"><h4>Resumo da verificação</h4>
      ${mtabela(['Verificação', 'Solicitante', 'Resistente', 'n', 'Situação'], m.resumo, ['', 'val', 'val', 'val', 'sit'])}</div>
    <div class="msection"><h4>A · Variáveis de entrada</h4>${mtabela(['Símbolo', 'Descrição', 'Valor', 'Origem'], m.entradas, ['sym', '', 'val', 'src'])}</div>
    <div class="msection"><h4>B · Constantes e critérios adotados</h4>${mtabela(['Símbolo', 'Descrição', 'Valor', 'Fonte'], m.constantes, ['sym', '', 'val', 'src'])}</div>
    <div class="msection"><h4>${mathHtml(m.propsTitulo)}</h4>${mtabela(['Símbolo', 'Descrição', 'Valor', 'Fonte'], m.props, ['sym', '', 'val', 'src'])}</div>
    ${secoes}
    <div class="msection"><h4>D · Resumo das variáveis de saída</h4>${mtabela(['Símbolo', 'Descrição', 'Valor'], m.saidas, ['sym', '', 'val'])}
      <div class="mconclusao ${m.ok ? 'ok' : 'fail'}">${mathHtml(m.conclusao)}</div></div>`;
}
