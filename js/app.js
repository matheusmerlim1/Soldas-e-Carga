/* ---------- estado ---------- */
const store = {get(k){try{return localStorage.getItem(k)}catch(e){return null}}, set(k,v){try{localStorage.setItem(k,v)}catch(e){}}};
const $ = id => document.getElementById(id);
const S = {modo:'simples', tipo:'comparar', els:['E60', 'E70', 'E80'], mtipo:'filete', sel:null};
const CHAVE = 'solda-carga-v1';
const CAMPOS = [...document.querySelectorAll('#form input, #form select')].filter(el => el.id);

const MODO_INFO = {
  simples: {crumb:'Shigley §9-2 e §9-3', t:'Junta direta',
    d:'Cordões de comprimento L que transmitem uma força normal e uma ao longo do eixo, repartidas por igual. Mostra a garganta necessária e qual tipo de solda — filete, penetração parcial ou total — resolve a junta com menos metal depositado.',
    anim:'Carga subindo de zero ao máximo: vista da junta e corte do cordão'},
  torcao: {crumb:'Shigley §9-4 — cisalhamento excêntrico', t:'Grupo de cordões em torção',
    d:'Chapa soldada no contorno e carregada fora do centroide dos cordões. A força se decompõe em cisalhamento primário (F/L, translação) e secundário (M·r/J_u, rotação); o ponto crítico é o mais afastado do centroide no lado em que as duas parcelas se somam.',
    anim:'A chapa gira em torno do centroide dos cordões (exagerado) e cada ponto recebe a sua parcela'},
  flexao: {crumb:'Shigley §9-5 — solda em flexão', t:'Console soldado em flexão',
    d:'Console, suporte ou poste soldado de topo no apoio, com a força a uma distância e do cordão. A seção dos cordões trabalha como uma viga: o momento gera força normal máxima na fibra extrema e o cortante se divide por todo o cordão.',
    anim:'O console gira sobre o apoio (exagerado) e a força normal cresce linearmente até a fibra extrema'},
  perfil: {crumb:'Fluxo de cisalhamento — viga composta', t:'Perfil I soldado (alma–mesa)',
    d:'Os cordões entre alma e mesa impedem que a mesa escorregue sobre a alma quando a viga flete. Recebem o fluxo q = V·Q/I — concentrado no trecho soldado, se o cordão for intermitente — e a carga de uma roda sobre a mesa, se houver.',
    anim:'Seção do perfil e trecho em elevação: a mesa tende a escorregar e os cordões seguram'}
};

const COMO = `<ul>
  <li><b>Método da linha:</b> cada modelo dá a força por milímetro de junta no ponto crítico, <code>f = √(f<sub>n</sub>² + f<sub>v</sub>²)</code> em N/mm, sem depender do tipo nem do tamanho da solda.</li>
  <li><b>Torção:</b> <code>f' = F/L</code>, <code>f'' = M·r/J<sub>u</sub></code>, resultante vetorial; <code>J<sub>u</sub> = Σ[L³/12 + L·r²]</code> (Shigley, Tab. 9-1).</li>
  <li><b>Flexão:</b> <code>f<sub>M</sub> = M·c/I<sub>u</sub></code>, <code>f<sub>v</sub> = F/L</code> (Tab. 9-2). <b>Perfil:</b> <code>q = V·Q/I</code>.</li>
  <li><b>Filete:</b> <code>a = 0,707·h</code>; <code>τ = f/(n<sub>c</sub>·a)</code> tratada como cisalhamento na garganta; face de fusão <code>τ<sub>b</sub> = f/(n<sub>c</sub>·h)</code>.</li>
  <li><b>Penetração total + filete:</b> garganta do metal de solda <code>t + n<sub>c</sub>·0,707·h</code>; a chapa conectada continua verificada só com t; K<sub>fs</sub> cai de 2,0 para 1,5 em fadiga; filete de reforço ≥ t/4 (até 10 mm, AWS D1.1).</li>
  <li><b>Penetração parcial:</b> <code>E = S</code> (V 60°) ou <code>S − 3</code> (bisel 45°), AISC Tab. J2.1. <b>Total:</b> <code>E = t</code>, normal e cisalhamento separados com interação.</li>
  <li><b>Resistência:</b> AISC (0,30·S<sub>ut,e</sub> no metal de solda, 0,40·S<sub>y</sub> no metal base), NBR 8800 (0,60·f<sub>w</sub>/1,35 e 0,60·f<sub>y</sub>/1,10) ou von Mises com n exigido.</li>
  <li><b>Limites:</b> filete mínimo pela chapa mais grossa e máximo na borda (AWS D1.1); garganta mínima da PJP (AISC J2.3).</li>
  <li><b>Fadiga:</b> Goodman com K<sub>fs</sub> da Tab. 9-5 e S<sub>e</sub> de superfície forjada.</li>
  <li><b>Mais adequado:</b> em cada tipo, o menor tamanho que atende; no empate, o eletrodo mais simples. <b>Tipo indicado:</b> o de menor massa depositada — mas um chanfro só vence o filete (e a CJP só vence a PJP) se economizar pelo menos 30 % de metal, porque a preparação e a inspeção custam.</li></ul>`;

const CRIT_HELP = {
  aisc: 'Cargas de serviço. A margem já está na tensão admissível (cerca de 1,4 a 1,7 sobre a ruptura do metal de solda); por isso basta n ≥ 1.',
  nbr: 'Informe as cargas de cálculo, já majoradas pelos coeficientes γ_f das combinações da NBR 8681 / NBR 8800. Resistência de cálculo ≥ solicitação de cálculo.',
  vm: 'Abordagem de projeto de máquinas: S_sy = 0,577·S_y do metal de solda e do metal base, com o coeficiente de segurança que você exigir.'
};

/* ---------- leitura das entradas ---------- */
const num = id => { const v = parseFloat(String($(id).value).replace(/\s/g, '').replace(',', '.')); return isFinite(v) ? v : NaN; };
const chk = id => $(id).checked;
function marcaInvalidos(ids, cond) {
  let ok = true;
  for (const id of ids) { const bad = !cond(num(id), id); $(id).classList.toggle('bad', bad); if (bad) ok = false; }
  return ok;
}
const ladosDe = p => ({sup: chk(p + '_sup'), inf: chk(p + '_inf'), esq: chk(p + '_esq'), dir: chk(p + '_dir')});
function lerEntradas(modo) {
  let ok = marcaInvalidos(['Sy', 'Sut'], v => v > 0) & marcaInvalidos(['nReq'], v => v >= 1) & marcaInvalidos(['R'], v => v >= -1 && v < 1);
  const base = METAIS.find(m => m.id === $('metal').value) || METAIS[0];
  const e = {mb: {...base, Sy: num('Sy'), Sut: num('Sut')}, criterio: $('criterio').value, nReq: num('nReq'), prep: $('prep').value,
    variavel: chk('var'), R: num('R')};
  if (modo !== 'perfil') {
    ok &= marcaInvalidos(['c_t', 'c_T'], v => v > 0);
    Object.assign(e, {t: num('c_t'), T: Math.max(num('c_t'), num('c_T')), lados: +$('c_lados').value});
  }
  if (modo === 'simples') {
    ok &= marcaInvalidos(['s_L'], v => v > 0) & marcaInvalidos(['s_P', 's_V'], v => v >= 0);
    Object.assign(e, {junta: $('s_junta').value, L: num('s_L'), P: num('s_P') * uF(), V: num('s_V') * uF()});
  } else if (modo === 'torcao') {
    ok &= marcaInvalidos(['t_b', 't_d', 't_D'], v => v > 0) & marcaInvalidos(['t_Fx', 't_Fy', 't_ax', 't_ay'], v => isFinite(v));
    Object.assign(e, {junta: $('t_junta').value, forma: $('t_forma').value, b: num('t_b'), d: num('t_d'), D: num('t_D'), ladosR: ladosDe('t'),
      Fx: num('t_Fx') * uF(), Fy: num('t_Fy') * uF(), ax: num('t_ax'), ay: num('t_ay')});
  } else if (modo === 'flexao') {
    ok &= marcaInvalidos(['f_b', 'f_d', 'f_D', 'f_e'], v => v > 0) & marcaInvalidos(['f_F', 'f_N'], v => isFinite(v));
    Object.assign(e, {junta: 'T', forma: $('f_forma').value, b: num('f_b'), d: num('f_d'), D: num('f_D'), ladosR: ladosDe('f'),
      F: num('f_F') * uF(), e: num('f_e'), N: num('f_N') * uF()});
  } else {
    ok &= marcaInvalidos(['p_bf', 'p_tf', 'p_hw', 'p_tw', 'p_Lv', 'p_trecho', 'p_passo', 'p_lc'], v => v > 0) & marcaInvalidos(['p_V', 'p_Pc'], v => v >= 0);
    if (num('p_trecho') > num('p_passo')) { $('p_trecho').classList.add('bad'); ok = false; }
    Object.assign(e, {junta: 'T', lados: 2, bf: num('p_bf'), tf: num('p_tf'), hw: num('p_hw'), tw: num('p_tw'), V: num('p_V') * uF(), Lv: num('p_Lv'),
      interm: chk('p_interm'), trecho: num('p_trecho'), passo: num('p_passo'), conc: chk('p_conc'), Pc: num('p_Pc') * uF(), lc: num('p_lc')});
    e.t = e.tw; e.T = Math.max(e.tw, e.tf);
  }
  return {ok: !!ok, e};
}

/* ---------- montagem inicial dos controles ---------- */
$('s_junta').innerHTML = Object.entries(JUNTAS).map(([k, n]) => `<option value="${k}">${n}</option>`).join('');
$('t_junta').innerHTML = ['sobreposta', 'T'].map(k => `<option value="${k}">${JUNTAS[k]}</option>`).join('');
$('metal').innerHTML = METAIS.map(m => `<option value="${m.id}">${m.nome}</option>`).join('');
$('prep').innerHTML = PREP_PJP.map(p => `<option value="${p.id}">${p.nome} — E = ${p.red ? 'S − 3' : 'S'}</option>`).join('');
$('criterio').innerHTML = Object.entries(CRITERIOS).map(([k, c]) => `<option value="${k}">${c.nome}</option>`).join('');
function renderEletrodos() {
  $('eletrodos').innerHTML = ELETRODOS.map(el => `<label class="tg" title="${el.ex} — S_ut = ${el.Sut} MPa"><input type="checkbox" value="${el.id}"${S.els.includes(el.id) ? ' checked' : ''}> ${el.nome}</label>`).join('');
}

/* restaura o que o usuário digitou na última visita */
try {
  const sv = JSON.parse(store.get(CHAVE) || '{}');
  for (const el of CAMPOS) if (sv.f && sv.f[el.id] != null) { if (el.type === 'checkbox') el.checked = sv.f[el.id]; else el.value = sv.f[el.id]; }
  if (MODO_INFO[sv.modo]) S.modo = sv.modo;
  if (['filete', 'parcial', 'total', 'misto', 'comparar'].includes(sv.tipo)) S.tipo = sv.tipo;
  if (Array.isArray(sv.els) && sv.els.length) S.els = sv.els.filter(id => ELETRODOS.some(c => c.id === id));
} catch (err) {}
function salvar() {
  const f = {};
  for (const el of CAMPOS) f[el.id] = el.type === 'checkbox' ? el.checked : el.value;
  store.set(CHAVE, JSON.stringify({f, modo: S.modo, tipo: S.tipo, els: S.els}));
}
renderEletrodos();

/* ---------- render ---------- */
function renderModoUI() {
  const info = MODO_INFO[S.modo];
  document.querySelectorAll('#modos .gbtn').forEach(b => b.setAttribute('aria-pressed', b.dataset.modo === S.modo));
  $('mcrumb').textContent = info.crumb; $('mtitulo').textContent = info.t; $('mdesc').innerHTML = mathHtml(info.d);
  $('atitulo').textContent = info.anim;
  document.querySelectorAll('#form [data-modos]').forEach(s => { s.hidden = !s.dataset.modos.split(' ').includes(S.modo); });
  document.querySelectorAll('#tipo button').forEach(b => b.setAttribute('aria-pressed', b.dataset.v === S.tipo));
  $('como').innerHTML = COMO;
}
function renderCondicionais() {
  document.querySelectorAll('[data-se]').forEach(el => { el.hidden = !chk(el.dataset.se); });
  document.querySelectorAll('[data-forma]').forEach(el => { const [p, f] = el.dataset.forma.split(' '); el.hidden = $(p + '_forma').value !== f; });
  $('nReq_fld').hidden = $('criterio').value !== 'vm';
  $('crit_help').innerHTML = mathHtml(CRIT_HELP[$('criterio').value]);
}

const tituloSolda = a => `${TIPOS[a.tipo].nome} — ${nomeTam(a.tipo, a.tam)} · ${a.el.nome}`;
function chipsDe(a, e) {
  const tn = tamanhoNecessario(a.tipo, a.aReq, e);
  const c = [a.tipo === 'misto' ? `<span class="chip">A<sub>w</sub> <strong>${fmt(a.g.aTot, 1)} mm</strong></span>` : `<span class="chip">${a.tipo === 'filete' ? 'a' : 'E'} <strong>${fmt(a.g.a, 1)} mm</strong></span>`,
    `<span class="chip">necessária <strong>${fmt(a.aReq, 2)} mm</strong></span>`,
    `<span class="chip">massa <strong>${fmt(a.massa, 2)} kg</strong></span>`];
  if (comFilete(a.tipo)) c.push(`<span class="chip">${a.tipo === 'misto' ? 'filete em ' : ''}${a.tam <= PASSE_UNICO ? 'passe único' : 'multipasse'}</span>`);
  if (a.gov) c.push(`<span class="chip">governa: ${a.gov.nome.toLowerCase()} <strong>n = ${fatorTxt(a.gov.n)}</strong></span>`);
  return c.join('');
}
const subDe = (a, e, modo) => {
  const nc = a.tipo === 'total' || a.tipo === 'misto' ? '' : `${modo === 'perfil' ? 2 : e.lados} cordão(ões) · `;
  return a.tipo === 'filete' ? `${nc}garganta a = 0,707 × ${fmt(a.tam, 0)} = ${fmt(a.g.a, 2)} mm`
    : a.tipo === 'parcial' ? `${nc}${a.g.pr.nome.toLowerCase()}, garganta E = ${fmt(a.g.a, 1)} mm`
    : a.tipo === 'misto' ? `CJP ${e.lados > 1 ? 'em K' : 'com cobre-junta'} + ${e.lados > 1 ? '2 filetes' : '1 filete'} de reforço h = ${fmt(a.tam, 0)} mm · metal de solda t + ${fmt(a.g.aF, 1)} = ${fmt(a.g.aTot, 1)} mm · exige UT/RT`
    : `chanfro ${prepCJP(e.t)} · garganta = t = ${fmt(e.t, 0)} mm · exige UT/RT`;
};
function porQueNao(tipo, e, lista) {
  if (!aplicavel(tipo, e.junta) && tipo === 'misto') return 'O filete de reforço precisa de um canto: a penetração total com filete só existe na junta em T.';
  if (tipo === 'misto' && lista.length) {
    /* o que nenhum filete corrige: a chapa conectada e a fadiga dependem só de t */
    const a = lista[lista.length - 1], ch = a.ver.find(v => v.id === 'chapa'), fd = a.ver.find(v => v.id === 'fad');
    if (!ch.ok) return `Quem rompe é a própria chapa conectada (n = ${fatorTxt(ch.n)} na seção t = ${fmt(e.t, 0)} mm): nenhuma solda resolve. Aumente t, o comprimento do cordão ou a resistência do aço.`;
    if (fd && !fd.ok) return `A fadiga na chapa conectada não fecha nem com o filete de reforço (n_f = ${fatorTxt(fd.n)}): aumente t ou reduza a amplitude da carga.`;
  }
  if (!aplicavel(tipo, e.junta)) return tipo === 'filete' ? 'O filete não se aplica à junta de topo: as chapas estão alinhadas, sem canto para o cordão.'
    : 'Na junta sobreposta não há chanfro possível: use filete (ou solda de tampão).';
  if (!lista.length) return `A chapa de ${fmt(e.t, 0)} mm é fina demais para um chanfro parcial com ${e.lados} lado(s) e a garganta mínima.`;
  if (tipo === 'total') return 'Nem a penetração total na espessura toda resiste: aumente a espessura da chapa, o comprimento do cordão ou a resistência do aço.';
  return `Nenhum tamanho até ${tipo === 'filete' ? 'h = 25 mm' : 'o limite da chapa'} com os eletrodos marcados atende. Aumente o comprimento, os lados soldados ou mude o tipo.`;
}
function renderRec(listas, tipos, e, modo) {
  const recs = {};
  for (const t of tipos) recs[t] = recomendar(listas[t]);
  const melhor = tipos.length > 1 ? melhorTipo(recs) : null;
  let h = '';
  if (tipos.length > 1) {
    if (melhor) {
      const outros = tipos.filter(t => t !== melhor.tipo && recs[t]).map(t => `${TIPOS[t].curto.toLowerCase()} ${fmt(recs[t].massa, 2)} kg`);
      h += `<div class="rec best"><div class="k">Tipo indicado — menor metal depositado</div>
        <div class="nm">${tituloSolda(melhor)}</div>
        <div class="sb">${fmt(melhor.massa, 2)} kg de solda${outros.length ? ` contra ${outros.join(' e ')}` : ''}. ${melhor.tipo === 'filete' ? 'Sem preparação de chanfro.' : melhor.tipo === 'parcial' ? 'Exige chanfro; evite sob fadiga ou tração transversal cíclica.' : melhor.tipo === 'misto' ? 'A penetração total sozinha não basta: o filete de reforço completa o metal de solda e tira o canto vivo. Exige chanfro, goivagem e ensaio volumétrico.' : 'Exige chanfro, goivagem e ensaio volumétrico.'}</div>
        <button type="button" class="ver" data-t="${melhor.tipo}" data-d="${melhor.tam}" data-c="${melhor.el.id}">Ver memorial de cálculo</button></div>`;
    } else h += `<div class="rec none best"><div class="k">Tipo indicado</div><div class="nm">Nenhum tipo atende</div><div class="sb">Revise a geometria da junta ou as cargas.</div></div>`;
  }
  h += tipos.map(t => {
    const best = recs[t], por = melhorPorEletrodo(listas[t]);
    if (!best) return `<div class="rec none"><div class="k">${TIPOS[t].nome}</div><div class="nm">${aplicavel(t, e.junta) && listas[t].length ? 'Nenhum atende' : 'Não se aplica'}</div>
      <div class="sb">${porQueNao(t, e, listas[t])}</div></div>`;
    const alt = S.els.filter(id => por[id] && por[id] !== best).map(id => `<button type="button" data-t="${t}" data-d="${por[id].tam}" data-c="${id}">${nomeTam(t, por[id].tam)} · ${por[id].el.nome}</button>`).join('');
    return `<div class="rec"><div class="k">${TIPOS[t].nome}</div><div class="nm">${nomeTam(t, best.tam)} — ${best.el.nome}</div>
      <div class="sb">${subDe(best, e, modo)}</div><div class="chips">${chipsDe(best, e)}</div>
      ${blocoComercial(listas[t], best, t)}
      ${alt ? `<div class="alt">Menor por eletrodo: ${alt}</div>` : ''}
      <button type="button" class="ver" data-t="${t}" data-d="${best.tam}" data-c="${best.el.id}">Ver memorial de cálculo</button></div>`;
  }).join('');
  $('rec').innerHTML = `<div class="recs">${h}</div>`;
  return {recs, melhor};
}
function blocoComercial(lista, best, t) {
  if (usoFrequente(best)) return `<div class="com"><i class="dot"></i> ${comFilete(t) ? 'Eletrodo comum e filete de passe único.' : 'Eletrodo de uso frequente.'}</div>`;
  const c = recomendarComercial(lista);
  if (!c) return `<div class="com"><i class="dot"></i> Nenhuma opção de uso frequente atende: ${comFilete(t) ? 'o filete precisa de multipasse ou de eletrodo especial' : 'marque E60/E70'}.</div>`;
  return `<div class="com"><i class="dot"></i> Opção de uso frequente:
    <button type="button" data-t="${t}" data-d="${c.tam}" data-c="${c.el.id}">${nomeTam(t, c.tam)} · ${c.el.nome}</button> n = ${fatorTxt(c.gov.n)}</div>`;
}
const curtoVer = v => v.nome.split(' (')[0].replace('Metal de solda', 'garganta').replace('Metal base', 'metal base').replace('Interação normal + cisalhamento', 'interação').replace('Chapa conectada', 'chapa').toLowerCase();
function renderMatriz(lista, tipo, best, e) {
  const soFreq = $('soFreq').checked;
  const els = ELETRODOS.filter(c => S.els.includes(c.id) && (!soFreq || eletrodoFreq(c.id)));
  const tams = tamanhos(tipo, e).filter(x => !soFreq || !comFilete(tipo) || x <= PASSE_UNICO);
  const com = recomendarComercial(lista);
  if (!els.length) { $('matriz').innerHTML = '<div class="empty">Nenhum dos eletrodos marcados é de uso frequente.</div>'; return; }
  if (!lista.length) { $('matriz').innerHTML = `<div class="empty">${porQueNao(tipo, e, lista)}</div>`; return; }
  const by = {}; for (const a of lista) by[a.tam + '|' + a.el.id] = a;
  let h = `<table class="mx"><thead><tr><th>${TIPOS[tipo].tam}</th>${els.map(c => eletrodoFreq(c.id)
    ? `<th class="cf" title="${c.ex}"><i class="dot"></i>${c.nome}</th>` : `<th class="cn" title="${c.ex}">${c.nome}</th>`).join('')}</tr></thead><tbody>`;
  for (const x of tams) {
    const freq = !comFilete(tipo) || x <= PASSE_UNICO;
    h += `<tr class="${freq ? '' : 'r2'}"><td>${freq && comFilete(tipo) ? '<i class="dot"></i>' : ''}${fmt(x, 0)} mm${freq ? '' : '<small>multipasse</small>'}</td>`;
    for (const c of els) {
      const a = by[x + '|' + c.id], sel = S.sel && S.sel.t === tipo && S.sel.d === x && S.sel.c === c.id;
      h += `<td class="c${a.ok ? ' ok' : ''}${sel ? ' sel' : ''}${a === best ? ' best' : ''}${a === com ? ' com' : ''}" data-t="${tipo}" data-d="${x}" data-c="${c.id}" title="${a.gov.nome}: n = ${fatorTxt(a.gov.n)}">${fatorTxt(a.gov.razao)}<small>${curtoVer(a.gov)}</small></td>`;
    }
    h += '</tr>';
  }
  $('matriz').innerHTML = h + '</tbody></table>';
}
function renderChecks(ver) {
  $('checks').innerHTML = `<div class="checks">${ver.map(v => {
    const uso = Math.min(v.req / v.n, 1);
    return `<div class="ck ${v.ok ? '' : 'fail'}"><span>${v.nome}</span><span class="bar" title="aproveitamento ${fmt(uso * 100, 0)} %"><i style="width:${fmt(uso * 100, 1).replace(',', '.')}%"></i></span>
      <span class="v">${fatorTxt(v.n)}</span><span class="st">${v.ok ? 'atende ✓' : 'não atende ✗'}</span></div>`;
  }).join('')}</div>`;
}
function legenda(modo) {
  const L = {
    simples: [['var(--mark)', 'cordão (fica vermelho ao chegar a n = 1)'], ['var(--load)', 'carga'], ['var(--accent)', 'garganta a']],
    torcao: [['var(--p1)', "cisalhamento primário f'"], ['var(--good)', "secundário f''"], ['var(--accent)', 'resultante'], ['var(--bad)', 'ponto crítico'], ['var(--mark)', 'cordão']],
    flexao: [['var(--load)', 'carga e força normal f_n(y)'], ['var(--mark)', 'cordão'], ['var(--bad)', 'fibra crítica'], ['var(--ink)', 'linha neutra']],
    perfil: [['var(--accent)', 'mesa (momento estático Q)'], ['var(--mark)', 'cordões alma–mesa'], ['var(--good)', 'escorregamento da mesa'], ['var(--load)', 'cortante V']]
  }[modo];
  $('leg').innerHTML = L.map(([c, t]) => `<span><i style="background:${c}"></i>${mathHtml(t)}</span>`).join('');
}

let ATUAL = null;               // último modelo de memorial e desenho, para o relatório
function limpa(msg) {
  $('rec').innerHTML = `<div class="warn bad">${msg}</div>`;
  $('matriz').innerHTML = $('memorial').innerHTML = $('checks').innerHTML = $('aviso').innerHTML = $('mtipo').innerHTML = '';
  ATUAL = null;
}
function calcular() {
  renderCondicionais(); salvar();
  const {ok, e: e0} = lerEntradas(S.modo);
  if (!ok) return limpa('Há campos com valor inválido (destacados em vermelho).');
  if (!S.els.length) return limpa('Marque ao menos um eletrodo.');
  const e = e0, dm = DEMANDAS[S.modo](e);
  if (dm.erro) return limpa(dm.erro);
  const tipos = S.tipo === 'comparar' ? ORDEM_TIPOS : [S.tipo];

  const avisos = [];
  if (!(dm.f > 0)) avisos.push('Sem carga no cordão: informe as forças.');
  if (S.modo === 'simples' && e.junta === 'T' && e.lados === 1 && e.P > 0) avisos.push('Filete de um lado só em junta em T tracionada: a raiz fica aberta e flete. Prefira soldar os dois lados.');
  if (S.modo === 'torcao' && e.forma === 'ret' && Object.values(e.ladosR).filter(Boolean).length === 1 && dm.M) avisos.push('Um único cordão reto resiste mal a momento no plano (J_u pequeno): solde mais lados.');
  if (e.variavel && tipos.includes('parcial')) avisos.push('Sob fadiga, a raiz não fundida da penetração parcial funciona como trinca inicial: K_fs = 2,0 é otimista se a carga for transversal.');
  if (S.modo === 'perfil' && e.interm && e.conc) avisos.push('Com carga concentrada sobre a mesa, use cordão contínuo nessa região.');
  if (e.mb.Sut > 480 && S.els.every(id => (ELETRODOS.find(x => x.id === id) || {}).Sut < e.mb.Sut)) avisos.push('Todos os eletrodos marcados têm resistência abaixo do metal base (undermatching). Para penetração total, use eletrodo compatível.');
  $('aviso').innerHTML = avisos.map(a => `<div class="warn">${mathHtml(a)}</div>`).join('');

  const listas = {};
  for (const t of tipos) listas[t] = aplicavel(t, e.junta) ? varrer(e, dm, t, S.els) : [];
  const {recs} = renderRec(listas, tipos, e, S.modo);
  const comLista = tipos.filter(t => listas[t].length);
  if (!comLista.includes(S.mtipo)) S.mtipo = comLista[0] || tipos[0];
  $('mtipo').innerHTML = tipos.length > 1 ? tipos.map(t => `<button type="button" data-v="${t}" aria-pressed="${t === S.mtipo}"${listas[t].length ? '' : ' disabled'}>${TIPOS[t].curto}</button>`).join('') : '';

  /* seleção: a que o usuário clicou, se ainda existir; senão, a do tipo indicado */
  const acha = s => s && listas[s.t] && listas[s.t].find(a => a.tam === s.d && a.el.id === s.c);
  let a = acha(S.sel);
  if (!a) {
    const ind = tipos.length > 1 ? melhorTipo(recs) : recs[tipos[0]];
    a = ind || (listas[S.mtipo] || [])[0];
    if (a) S.sel = {t: a.tipo, d: a.tam, c: a.el.id, auto: true};
  }
  renderMatriz(listas[S.mtipo] || [], S.mtipo, recs[S.mtipo], e);
  if (!a) {
    /* o tipo escolhido não cabe nesta junta: o desenho continua seguindo as cargas e mostra o motivo */
    const t0 = tipos[0], motivo = porQueNao(t0, e, listas[t0]);
    $('dtitulo').textContent = TIPOS[t0].nome + ' — não se aplica'; $('checks').innerHTML = '';
    $('memorial').innerHTML = `<div class="empty">${motivo}</div>`;
    desenhar(e, dm, {...analisar(e, dm, 'filete', PERNAS[0], ELETRODOS[0]), tipo: t0, na: motivo});
    ATUAL = null; return;
  }
  $('dtitulo').textContent = tituloSolda(a);
  renderChecks(a.ver);
  const m = modeloSolda(S.modo, e, dm, a);
  $('memorial').innerHTML = renderModelo(m);

  const {fn, VB} = desenhar(e, dm, a);
  const legendas = {simples: 'junta direta: vista da junta e corte do cordão sob a carga máxima',
    torcao: 'grupo de cordões em torção: cisalhamento primário, secundário e resultante nos pontos do cordão',
    flexao: 'console soldado: vista lateral e distribuição da força normal na seção dos cordões',
    perfil: 'perfil soldado: seção com os cordões alma–mesa e fluxo de cisalhamento em elevação'};
  ATUAL = {m, fn, viewBox: VB, legenda: legendas[S.modo], modo: S.modo,
    slug: `${a.tipo}-${a.tam}mm-${a.el.id}`, alternativas: alternativas(tipos.map(t => [TIPOS[t].curto, t, listas[t]]))};
}

/* animação do modelo atual com a solda a (ou com o aviso de que o tipo não se aplica) */
function desenhar(e, dm, a) {
  legenda(S.modo);
  const svg = $('svg');
  const VB = {simples: '0 0 600 300', torcao: '0 0 610 330', flexao: '0 0 820 320', perfil: '0 0 600 320'}[S.modo];
  const DES = {simples: desenhoSimples, torcao: desenhoTorcao, flexao: desenhoFlexao, perfil: desenhoPerfil}[S.modo];
  svg.setAttribute('viewBox', VB);
  const fn = s => DES(e, dm, a, s);
  ANIM.set(svg, fn, s => { $('sl').value = s; $('slo').textContent = fmt(s * 100, 0) + ' %'; });
  return {fn, VB};
}

/* menor tamanho aprovado em cada tipo e eletrodo, para a tabela de alternativas do relatório */
function alternativas(grupos) {
  const out = [];
  for (const [nome, t, lista] of grupos) {
    if (!lista.length) { out.push([nome, '—', 'não se aplica', '—', '—', '—']); continue; }
    const por = melhorPorEletrodo(lista);
    for (const id of S.els) {
      const a = por[id], el = ELETRODOS.find(x => x.id === id);
      out.push([nome, el.nome, a ? nomeTam(t, a.tam) : 'nenhum atende', a ? fatorTxt(a.gov.n) : '—', a ? a.gov.nome : '—', a ? fmt(a.massa, 3) : '—']);
    }
  }
  return out;
}

/* ---------- unidade de força (kN ↔ tf) ---------- */
function aplicaUnidade(u, converter) {
  if (converter && u !== UN.f) {
    const k = FATOR_F[UN.f] / FATOR_F[u];
    document.querySelectorAll('#form .un').forEach(w => {
      const sp = w.querySelector('.uF, .uM'), inp = w.querySelector('input');
      if (!sp || !inp) return;
      const v = num(inp.id);
      if (isFinite(v)) inp.value = fmt(v * k, Math.abs(v * k) >= 100 ? 1 : 3).replace(/\./g, '').replace(/,?0+$/, '');
    });
  }
  UN.f = u;
  document.querySelectorAll('.uF').forEach(el => { el.textContent = u; });
  document.querySelectorAll('.uM').forEach(el => { el.textContent = u + '·m'; });
  document.querySelectorAll('#unid button').forEach(b => b.setAttribute('aria-pressed', b.dataset.v === u));
  store.set('solda-unidade', u);
}
aplicaUnidade(store.get('solda-unidade') === 'tf' ? 'tf' : 'kN', false);
$('unid').addEventListener('click', ev => { const b = ev.target.closest('button'); if (!b) return; aplicaUnidade(b.dataset.v, true); calcular(); });

/* ---------- eventos ---------- */
$('modos').addEventListener('click', ev => {
  const b = ev.target.closest('.gbtn'); if (!b) return;
  S.modo = b.dataset.modo; S.sel = null;
  history.replaceState(null, '', '#' + S.modo);
  renderModoUI(); calcular();
});
$('tipo').addEventListener('click', ev => {
  const b = ev.target.closest('button'); if (!b) return;
  S.tipo = b.dataset.v; S.sel = null; if (S.tipo !== 'comparar') S.mtipo = S.tipo;
  renderModoUI(); calcular();
});
$('soFreq').checked = store.get('solda-sofreq') === '1';
$('soFreq').addEventListener('change', () => { store.set('solda-sofreq', $('soFreq').checked ? '1' : '0'); calcular(); });
$('mtipo').addEventListener('click', ev => { const b = ev.target.closest('button'); if (!b || b.disabled) return; S.mtipo = b.dataset.v; calcular(); });
$('eletrodos').addEventListener('change', () => {
  S.els = [...$('eletrodos').querySelectorAll('input:checked')].map(i => i.value); calcular();
});
$('metal').addEventListener('change', () => { const m = METAIS.find(x => x.id === $('metal').value); $('Sy').value = m.Sy; $('Sut').value = m.Sut; });
$('form').addEventListener('input', ev => { if (ev.target.closest('#eletrodos')) return; if (S.sel && S.sel.auto) S.sel = null; calcular(); });
$('form').addEventListener('change', ev => { if (ev.target.tagName === 'SELECT' || ev.target.type === 'checkbox') { if (!ev.target.closest('#eletrodos')) { if (S.sel && S.sel.auto) S.sel = null; calcular(); } } });
function selecionar(ev) {
  const el = ev.target.closest('[data-d]'); if (!el) return;
  S.sel = {t: el.dataset.t, d: +el.dataset.d, c: el.dataset.c};
  S.mtipo = el.dataset.t;
  calcular();
  if (el.classList.contains('ver')) $('detCard').scrollIntoView({behavior: 'smooth', block: 'start'});
}
$('rec').addEventListener('click', selecionar);
$('matriz').addEventListener('click', selecionar);
$('play').addEventListener('click', () => { const p = ANIM.alterna(); $('play').textContent = p ? '▶' : '⏸'; $('play').setAttribute('aria-label', p ? 'Continuar animação' : 'Pausar animação'); });
$('sl').addEventListener('input', () => { ANIM.fixa(+$('sl').value); $('play').textContent = '▶'; });

/* relatórios: PDF pela impressão do navegador e Word (.docx) editável */
/* identificação do documento (faixa do topo) */
const IDENT = ['id_proj', 'id_tag', 'id_rev', 'id_resp', 'id_data'];
const hojeISO = () => { const d = new Date(); return new Date(d - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); };
for (const id of IDENT) {
  const v = store.get('solda-' + id);
  if (v != null) $(id).value = v;
  $(id).addEventListener('input', () => store.set('solda-' + id, $(id).value));
}
if (!$('id_data').value) $('id_data').value = hojeISO();
function identificacao() {
  const v = id => $(id).value.trim(), d = v('id_data');
  return {projeto: v('id_proj'), tag: v('id_tag'), rev: v('id_rev'), resp: v('id_resp'),
    data: d ? d.split('-').reverse().join('/') : ''};
}
const dadosRelatorio = () => ATUAL && {...ATUAL, ...identificacao()};
$('printBtn').addEventListener('click', () => { const R = dadosRelatorio(); if (R) relatorioPdf(R); });
$('wordBtn').addEventListener('click', async () => {
  const R = dadosRelatorio(); if (!R) return;
  $('rstat').textContent = 'Gerando documento…';
  try { await relatorioWord(R); $('rstat').textContent = 'Documento Word baixado.'; }
  catch (err) { $('rstat').textContent = 'Não foi possível gerar o documento.'; }
});

/* tema */
const themeBtn = $('themeBtn');
function applyTheme(t) {
  document.documentElement.setAttribute('data-theme', t);
  $('themeIcon').textContent = t === 'dark' ? '☾' : '☀'; $('themeText').textContent = t === 'dark' ? 'Tela escura' : 'Tela clara';
}
applyTheme(store.get('solda-tema') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
themeBtn.addEventListener('click', () => {
  const t = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  applyTheme(t); store.set('solda-tema', t);
});

const hashModo = () => { const h = location.hash.slice(1); return MODO_INFO[h] ? h : null; };
if (hashModo()) S.modo = hashModo();
addEventListener('hashchange', () => { const h = hashModo(); if (h && h !== S.modo) { S.modo = h; S.sel = null; renderModoUI(); calcular(); } });

renderModoUI();
calcular();
