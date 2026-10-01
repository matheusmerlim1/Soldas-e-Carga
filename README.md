# Solda & Carga

Escolha do tipo de solda e da garganta necessária a partir do carregamento — filete, penetração
parcial e penetração total — com memorial de cálculo completo e relatório em PDF e Word.

**Site:** https://matheusmerlim1.github.io/Soldas-e-Carga/

## Modelos

| Aba | O que verifica |
|---|---|
| Junta direta | Cordões em T, sobrepostos ou de topo com força normal e força ao longo do cordão (Shigley §9-2/9-3) |
| Grupo em torção | Carga excêntrica no plano: cisalhamento primário F/L e secundário M·r/J_u, com J_u calculado para os lados soldados ou para o tubo (Shigley §9-4) |
| Console em flexão | Console ou poste soldado no apoio: f_M = M·c/I_u na fibra extrema, f_v = F/L e normal N (Shigley §9-5) |
| Perfil soldado | Cordões alma–mesa de perfil I: q = V·Q/I, cordão intermitente e carga concentrada sobre a mesa |

O cálculo usa o método da linha: cada modelo dá a força por milímetro de junta no ponto crítico, e
cada tipo de solda a transforma em tensão pela sua garganta efetiva. Para cada tamanho (perna h,
chanfro S ou espessura t) e eletrodo (E60xx a E120xx) a página verifica metal de solda, metal base,
limites de dimensão (AWS D1.1, AISC J2.3) e, se pedido, fadiga (Goodman com K_fs da Tab. 9-5).
Indica o menor tamanho que atende em cada tipo, a garganta necessária e o tipo de menor massa
depositada. Um chanfro só vence o filete se economizar 30 % de metal.

Critérios: AISC (tensões admissíveis, Shigley Tab. 9-4), NBR 8800 (resistências de cálculo) ou
energia de distorção com n exigido.

## Estrutura

```
index.html
css/style.css          tema, layout, memorial e impressão
js/dados.js            eletrodos, metais base, tamanhos, critérios, limites normativos
js/calculo.js          cálculo (sem DOM)
js/memorial.js         memorial de cálculo passo a passo
js/desenho.js          desenhos e animações em SVG
js/relatorio.js        relatório PDF (impressão) e Word (.docx, gerado sem bibliotecas)
js/app.js              interface
```

HTML, CSS e JavaScript puros, sem build: basta abrir o `index.html`.

## Fontes

BUDYNAS, R. G.; NISBETT, J. K. *Elementos de Máquinas de Shigley*, 10ª ed. — cap. 9 e cap. 6.
AISC 360 (Tab. J2.1 e J2.3). AWS D1.1 (filete mínimo e máximo). ABNT NBR 8800, 6.2.5.

Ferramenta de pré-dimensionamento. Não substitui a verificação e a ART de um engenheiro responsável.
