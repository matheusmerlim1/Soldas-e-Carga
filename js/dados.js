/* ---------- dados normalizados ---------- */

/* Pernas comerciais do filete (mm). Até 8 mm o filete sai em um passe na posição
   horizontal (AWS D1.1, tamanho máximo de passe único); acima disso, multipasse. */
const PERNAS = [3, 4, 5, 6, 8, 10, 12, 14, 16, 18, 20, 22, 25];
const PASSE_UNICO = 8;
/* Profundidades de chanfro S da penetração parcial (mm) */
const CHANFROS = [3, 4, 5, 6, 8, 10, 12, 14, 16, 18, 20, 22, 25, 28, 32, 36, 40];

/* Metal de adição: resistências mínimas do metal depositado (Shigley, Tab. 9-3; AWS A5.1/A5.5).
   O número da classe é a resistência à tração em ksi: E70 → 70 ksi ≈ 482 MPa. */
const ELETRODOS = [
  {id:'E60',  nome:'E60xx',  ex:'E6010, E6013',       Sut:427, Sy:345},
  {id:'E70',  nome:'E70xx',  ex:'E7018, ER70S-6',     Sut:482, Sy:393},
  {id:'E80',  nome:'E80xx',  ex:'E8018-C3, ER80S-D2', Sut:551, Sy:462},
  {id:'E90',  nome:'E90xx',  ex:'E9018-M',            Sut:620, Sy:531},
  {id:'E100', nome:'E100xx', ex:'E10018-M',           Sut:689, Sy:600},
  {id:'E120', nome:'E120xx', ex:'E12018-M',           Sut:827, Sy:737}
];
/* Uso frequente no mercado brasileiro — orientação, não dado de catálogo:
   E6013 (eletrodo de uso geral) e E7018 / ER70S-6 (estrutural, baixo hidrogênio / MAG). */
const ELETRODOS_FREQ = ['E60', 'E70'];
const eletrodoFreq = id => ELETRODOS_FREQ.includes(id);

/* Metal base (aços estruturais soldáveis). Sy e Sut mínimos, MPa. */
const METAIS = [
  {id:'a36',  nome:'ASTM A36',                    Sy:250, Sut:400},
  {id:'a572', nome:'ASTM A572 Gr.50',             Sy:345, Sut:450},
  {id:'a516', nome:'ASTM A516 Gr.70 (vasos)',     Sy:260, Sut:485},
  {id:'s235', nome:'EN S235JR',                   Sy:235, Sut:360},
  {id:'s355', nome:'EN S355JR',                   Sy:355, Sut:470},
  {id:'1020', nome:'SAE 1020 laminado a quente',  Sy:210, Sut:380}
];

/* Tipos de solda e as juntas em que cada um se aplica */
const TIPOS = {
  filete:  {nome:'Solda de filete',          curto:'Filete',             sim:'h', tam:'perna h',
    juntas:['T', 'sobreposta']},
  parcial: {nome:'Penetração parcial (PJP)', curto:'Penetração parcial', sim:'S', tam:'chanfro S',
    juntas:['T', 'topo']},
  total:   {nome:'Penetração total (CJP)',   curto:'Penetração total',   sim:'t', tam:'espessura t',
    juntas:['T', 'topo']},
  /* CJP com filete de reforço dimensionado (casos extremos: fadiga, eletrodo abaixo do metal
     base). O filete aumenta a garganta do metal de solda e tira o canto vivo da junta em T;
     a chapa conectada continua resistindo só com a espessura t. */
  misto:   {nome:'Penetração total + filete', curto:'CJP + filete',       sim:'h', tam:'filete h',
    juntas:['T']}
};
const ORDEM_TIPOS = ['filete', 'parcial', 'total', 'misto'];
const JUNTAS = {
  T:          'Em T / em ângulo',
  sobreposta: 'Sobreposta (filete na borda)',
  topo:       'De topo (chapas alinhadas)'
};

/* Preparação da penetração parcial: garganta efetiva E em função da profundidade S
   (AISC 360, Tab. J2.1 — SMAW/GMAW) e área do chanfro (metal depositado). */
const PREP_PJP = [
  {id:'v60', nome:'Chanfro em V 60° (ou J / U)', red:0, area: S => Math.tan(Math.PI / 6) * S * S, af:'S²·tg 30°'},
  {id:'b45', nome:'Bisel simples 45°',           red:3, area: S => S * S / 2,                    af:'S²/2'}
];
/* Penetração total: chanfro em V 60° com fresta de 3 mm até 20 mm; acima, X (duplo V) */
const areaCJP = t => t <= 20 ? Math.tan(Math.PI / 6) * t * t + 3 * t : 2 * Math.tan(Math.PI / 6) * (t / 2) ** 2 + 3 * t;
const prepCJP = t => t <= 20 ? 'V 60° com fresta de 3 mm' : 'X (duplo V 60°) com fresta de 3 mm';

/* Filete mínimo (AWS D1.1, Tab. 5.8): cresce com a chapa mais grossa, para evitar
   resfriamento rápido e trinca a frio. */
const pernaMin = T => T <= 6 ? 3 : T <= 13 ? 5 : T <= 19 ? 6 : 8;
/* Filete máximo ao longo da borda de uma chapa (AWS D1.1 §2.4.2.9 / AISC J2.2b) */
const pernaMax = t => t < 6 ? t : t - 2;
/* Filete de reforço da CJP em junta em T: t/4, sem precisar passar de 10 mm (AWS D1.1),
   e nunca abaixo do filete mínimo pela chapa mais grossa */
const reforcoMin = (t, T) => Math.max(pernaMin(T), Math.min(t / 4, 10));
/* Garganta efetiva mínima da penetração parcial (AISC 360, Tab. J2.3) — pela chapa mais fina */
const gargMinPJP = t => t <= 6 ? 3 : t <= 13 ? 5 : t <= 19 ? 6 : t <= 38 ? 8 : t <= 57 ? 10 : 13;

/* Critérios de verificação. Cada um dá a resistência (MPa) de cada modo de falha e o n exigido.
   aisc — tensões admissíveis do AISC reproduzidas no Shigley (Tab. 9-4): cargas de serviço.
   nbr  — NBR 8800 (6.2.5, Tab. 8): resistências de cálculo, cargas JÁ majoradas (γf).
   vm   — energia de distorção (Shigley §9-3): S_sy = 0,577·S_y, com n exigido pelo usuário. */
const CRITERIOS = {
  aisc: {nome:'AISC — tensões admissíveis (Shigley, Tab. 9-4)', curto:'AISC (admissíveis)',
    gargW: el => [0.30 * el.Sut, '0,30·S_ut,e'],
    faceB: mb => [0.40 * mb.Sy, '0,40·S_y,b'],
    normCJP: (mb, el) => [0.60 * Math.min(mb.Sy, el.Sy), '0,60·min(S_y,b; S_y,e)'],
    cisCJP: (mb, el) => [Math.min(0.40 * mb.Sy, 0.30 * el.Sut), 'min(0,40·S_y,b; 0,30·S_ut,e)'],
    normB: mb => [0.60 * mb.Sy, '0,60·S_y,b'], cisB: mb => [0.40 * mb.Sy, '0,40·S_y,b'],
    normW: el => [0.60 * el.Sy, '0,60·S_y,e'], cisW: el => [0.30 * el.Sut, '0,30·S_ut,e']},
  nbr: {nome:'NBR 8800 — resistências de cálculo (carga majorada)', curto:'NBR 8800',
    gargW: el => [0.60 * el.Sut / 1.35, '0,60·f_w / γ_w2'],
    faceB: mb => [0.60 * mb.Sy / 1.10, '0,60·f_y / γ_a1'],
    normCJP: (mb, el) => [Math.min(mb.Sy, el.Sy) / 1.10, 'min(f_y,b; f_y,e) / γ_a1'],
    cisCJP: (mb, el) => [Math.min(0.60 * mb.Sy / 1.10, 0.60 * el.Sut / 1.35), 'min(0,60·f_y/γ_a1; 0,60·f_w/γ_w2)'],
    normB: mb => [mb.Sy / 1.10, 'f_y / γ_a1'], cisB: mb => [0.60 * mb.Sy / 1.10, '0,60·f_y / γ_a1'],
    normW: el => [el.Sy / 1.10, 'f_y,e / γ_a1'], cisW: el => [0.60 * el.Sut / 1.35, '0,60·f_w / γ_w2']},
  vm: {nome:'Energia de distorção com n exigido (Shigley §9-3)', curto:'von Mises · n exigido',
    gargW: el => [0.577 * el.Sy, '0,577·S_y,e'],
    faceB: mb => [0.577 * mb.Sy, '0,577·S_y,b'],
    normCJP: (mb, el) => [Math.min(mb.Sy, el.Sy), 'min(S_y,b; S_y,e)'],
    cisCJP: (mb, el) => [0.577 * Math.min(mb.Sy, el.Sy), '0,577·min(S_y,b; S_y,e)'],
    normB: mb => [mb.Sy, 'S_y,b'], cisB: mb => [0.577 * mb.Sy, '0,577·S_y,b'],
    normW: el => [el.Sy, 'S_y,e'], cisW: el => [0.577 * el.Sy, '0,577·S_y,e']}
};

/* Fatores de concentração de tensão em fadiga (Shigley, Tab. 9-5) */
const KFS = {
  topo:    [1.2, 'solda de topo reforçada'],
  trans:   [1.5, 'pé de filete transversal'],
  paral:   [2.7, 'extremidade de filete paralelo'],
  Tcanto:  [2.0, 'topo em T com cantos vivos']
};
/* Fator de superfície de Marin "como forjado" (Shigley, Tab. 6-2), a e b em MPa */
const KA_FORJADO = {a:272, b:-0.995};

/* massa específica do aço, kg/mm³ */
const DENS = 7.85e-6;
