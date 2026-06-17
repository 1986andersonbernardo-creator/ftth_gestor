# AUDITORIA DE RESPONSIVIDADE - ControlISP Pro
## Data: 17/06/2026

---

## ARQUIVOS ANALISADOS
- `index.html` (1386 linhas)
- `design-system.css` (1468 linhas)  
- `style.css` (2271 linhas)

---

## PROBLEMAS ENCONTRADOS

### 🔴 CRÍTICOS

| # | Problema | Arquivo | Linhas | Impacto | Solução |
|---|----------|---------|--------|---------|---------|
| 1 | **Botão Hamburguer ausente** - O CSS tem classe `.mobile-menu-btn` mas não existe no HTML. Sidebar fica presa em mobile (768px) sem como abrir/fechar | `index.html` | - | Sidebar inacessível em telas < 768px | Adicionar botão hamburguer no topbarLeft |
| 2 | **Overlay da Sidebar ausente** - CSS referencia `.sidebar-overlay` mas não existe no HTML | `index.html` | - | Sem backdrop ao abrir sidebar mobile | Adicionar overlay no HTML |
| 3 | **Modal sem estilo** - HTML usa class `modal` e `modalContent` mas design-system.css só estiliza `.modal-premium` e `.modal-premium-content` | `design-system.css` + `index.html` | L337-375 | Modais sem fundo escuro, sem posicionamento, sem scroll | Adicionar estilos para `.modal` e `.modalContent` |
| 4 | **Estratégias de sidebar conflitantes** - style.css (600px) transforma sidebar em scroll horizontal, design-system.css (768px) tenta drawer off-screen | `style.css` L1221-1240 / `design-system.css` L1126-1138 | Duas abordagens diferentes | Sidebar quebra em resoluções entre 600-768px | Unificar estratégia - usar drawer em todas as telas < 768px |

### 🟡 ALTOS

| # | Problema | Arquivo | Linhas | Impacto | Solução |
|---|----------|---------|--------|---------|---------|
| 5 | **Topbar sem adaptação mobile adequada** - Em 768px, `.topbarRight` fica 100% mas profile-info pode sumir e botões quebram | `design-system.css` L1162-1169 | Perde funcionalidade em mobile | Ajustar flex-wrap e gaps |
| 6 | **Tabelas sem scroll em algumas seções** - Clientes, Planos, WhatsApp usam `<table>` sem `tableContainer` wrapper consistente | `index.html` L241-254, L274-286 | Tabelas vazam para fora da tela em < 600px | Garantir `tableContainer` com overflow-x |
| 7 | **WhatsApp Config Grid muito largo** - `minmax(380px,1fr)` força cards a terem 380px mínimo, quebrando em telas < 400px | `style.css` L1695 | Cards saem da tela em 320-375px | Reduzir para `minmax(280px,1fr)` |
| 8 | **Calculadora FTTH com largura fixa** - `grid-template-columns: 1fr 350px` com coluna fixa de 350px | `style.css` L1996 | Sidebar da calculadora quebra em telas < 700px | Já tem fallback em 1024px, mas 350px ainda força overflow |
| 9 | **Botões na tabela sem responsividade** - `td button` com `margin:4px` e `padding:10px 14px` em telas pequenas | `style.css` L1108-1115 | Botões de ação nas tabelas ficam gigantes e quebram layout | Reduzir padding em mobile |
| 10 | **HeaderAba sem wrap adequado** - Título e botões lado a lado sem quebrar corretamente em telas < 480px | `design-system.css` L833-852 | Botões podem sumir para fora da tela | Garantir `flex-wrap: wrap` e width 100% |

### 🟢 MÉDIOS

| # | Problema | Arquivo | Linhas | Impacto | Solução |
|---|----------|---------|--------|---------|---------|
| 11 | **Font-size 16px em inputs mobile** - Necessário para evitar zoom no iOS mas inconsistente | `style.css` L1317 | Zoom automático no iPhone | Manter 16px em inputs mobile (já implementado) |
| 12 | **Cards sem padding adequado em 320px** | `design-system.css` L1372-1415 | Cards ficam sem margem | Manter padding responsivo |
| 13 | **FinanceiroTabs em mobile** - `flex-direction: column` força tabs empilhadas | `design-system.css` L1191-1197 | OK mas sub-ótimo | Melhorar com grid 2 colunas |
| 14 | **Grid de filtros responsivo** - `filtrosFinanceiro` usa `auto-fit` que funciona bem | `design-system.css` L856-864 | Bom | Manter |
| 15 | **Duplicação de breakpoints entre CSS files** - style.css e design-system.css têm breakpoints similares que podem conflitar | Ambos | Multiplos | Unificar regras |

---

## PLANO DE AÇÃO

### Fase 1: Correções Críticas (HTML + CSS)
- [ ] 1. Adicionar botão hamburguer e overlay no index.html
- [ ] 2. Adicionar estilos para modals (.modal, .modalContent, .modalHeader, etc.) no design-system.css
- [ ] 3. Remover sidebar horizontal do style.css (manter drawer strategy)
- [ ] 4. Garantir tabelas com scroll horizontal em todas as seções

### Fase 2: Responsividade Mobile
- [ ] 5. Ajustar topbar para mobile (garantir botões visíveis e funcionais)
- [ ] 6. Ajustar headerAba buttons para wrap corretamente
- [ ] 7. Reduzir WhatsApp config grid para minmax(280px,1fr)
- [ ] 8. Ajustar calculadora FTTH para mobile
- [ ] 9. Ajustar botões em tabelas para mobile
- [ ] 10. Adicionar breakpoint 320px completo

### Fase 3: Compatibilidade iOS/Android
- [ ] 11. Garantir -webkit-overflow-scrolling: touch em todos os containers com scroll
- [ ] 12. Garantir input font-size 16px em mobile (evitar zoom iOS)
- [ ] 13. Garantir safe-area-inset para notch iOS
- [ ] 14. Testar todos os modais em mobile

### Fase 4: Testes e Validação
- [ ] 15. Verificar todas as resoluções (320px a 1920px)
- [ ] 16. Verificar que nenhuma funcionalidade foi alterada
- [ ] 17. Testar sidebar, topbar, dashboard, formulários, tabelas, modais