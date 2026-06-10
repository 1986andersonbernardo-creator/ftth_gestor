# RELATÓRIO COMPLETO DE ANÁLISE - FTTH Gestor

## ERROS CRÍTICOS ENCONTRADOS

---

### ERRO #1 - Código Inacessível (CRÍTICO - QUEBRA O SISTEMA)
**Arquivo:** app.js
**Linha:** 475-478
**Problema:** A função `carregarClientes()` possui `return` antes de todo o código real de carregamento (linha 476). Código após `return` (linhas 478-580) é **inatingível**.
**Impacto:** Clientes NUNCA carregam. Tabela de clientes sempre vazia. Dashboard mostra 0 clientes.
```javascript
if (!lista) {
    console.error("Elemento listaClientes não encontrado!");
    return;  // <--- AQUI SAI DA FUNÇÃO
    lista.innerHTML = "";  // <--- INATINGÍVEL
```

---

### ERRO #2 - Query Firestore com campo ERRADO (CRÍTICO)
**Arquivo:** app.js
**Linha:** 468
**Problema:** `carregarClientes()` filtra por `.where("usuarioId", "==", uid)` mas `salvarCliente()` salva com `tenantId` (linha 417) e NÃO salva `usuarioId`.
**Impacto:** NENHUM cliente é retornado pela query porque o campo `usuarioId` não existe nos documentos. Clientes nunca aparecem.
```javascript
// salva com tenantId (linha 417)
tenantId: getTenantId(), createdBy: usuarioAtual.uid,

// consulta com usuarioId (linha 468) - CAMPO INEXISTENTE!
.where("usuarioId", "==", uid)
```

---

### ERRO #3 - Funções Aninhadas Dentro de Bloco Morto (CRÍTICO)
**Arquivo:** app.js
**Linhas:** 585-3370
**Problema:** Devido ao ERRO #1, todas as funções do sistema (~150 funções) estão aninhadas DENTRO do escopo da `carregarClientes()`, dentro de um bloco de código morto. Isso cria dependência de escopo quebrada.
**Funções afetadas:** editarCliente, atualizarCliente, excluirCliente, limparFormulario, salvarPlano, carregarPlanos, carregarPlanosSelect, editarPlano, atualizarPlano, excluirPlano, preencherValorPlano, gerarMensalidadeInicial, gerarMensalidadesNovoMes, marcarMensalidadePaga, carregarMensalidades, abrirModalRecebimento, salvarRecebimento, carregarRecebimentos, filtrarRecebimentos, editarRecebimento, excluirRecebimento, abrirModalDespesa, salvarDespesa, carregarDespesas, filtrarDespesas, excluirDespesa, limparFormularioDespesa, atualizarFluxoCaixa, enviarWhatsAppInadimplente, abrirWhatsApp, carregarFinanceiro, carregarInadimplentes, atualizarTabelaReceitaAtraso, enviarCobranca, marcarComoPago, mostrarAbaFinanceira, logout, mostrarAbaWhatsApp, carregarClientesWhatsApp, filtrarClientesWhatsApp, toggleSelectAllWhatsApp, selecionarTodosWhatsApp, salvarTemplate, salvarNomeEmpresa, salvarConfiguracaoAPI, substituirVariaveis, carregarTemplateNaTextarea, enviarMensagemIndividual, enviarMensagemMassa, identificarCobrancasPendentes, enviarCobrancaIndividual, enviarAvisoVencimento3Dias, enviarCobrancaHoje, enviarCobrancaAtraso, enviarCobrancaAmigavel, salvarHistoricoWhatsApp, carregarHistoricoWhatsApp, filtrarHistoricoWhatsApp, verMensagemHistorico, limparHistoricoWhatsApp, carregarConfiguracoesWhatsApp, formatarTelefoneWhatsApp, formatarDataVencimento, mostrarAbaAdmin, carregarDadosUsuario, carregarDashboardAdmin, carregarUsuariosAdmin, filtrarUsuarios, abrirModalUsuario, fecharModalUsuario, limparFormularioUsuario, salvarUsuario, editarUsuario, bloquearUsuario, ativarUsuario, excluirUsuario, redefinirSenhaUsuario, diagnosticarDados, migrarDadosExistentes, addSplitter, removeSplitter, calcularFTTH
**Impacto:** Nenhuma dessas funções é acessível globalmente (pois estão dentro de um closure não executado). O HTML chama essas funções (onclick="editarCliente(...)") mas elas NÃO EXISTEM no escopo global.

---

### ERRO #4 - Duas inscrições `auth.onAuthStateChanged` (GRAVE)
**Arquivo:** app.js
**Linhas:** 1934 e 3373
**Problema:** Existem DOIS listeners `auth.onAuthStateChanged` no escopo global. Ambos disparam no login/logout.
**Impacto:** Duplicação de operações, race conditions, dados carregados duas vezes, possíveis erros de Firestore, duplicação de dados na tela.

---

### ERRO #5 - Planos filtrados por campo `usuarioId` ausente (GRAVE)
**Arquivo:** app.js
**Linhas:** 722-724 (carregarPlanos), 763 (carregarPlanosSelect)
**Problema:** As funções verificam `if (!plano.usuarioId) return;` mas os planos são salvos com `tenantId`, não `usuarioId`.
**Impacto:** NENHUM plano é exibido. Select de planos fica vazio.

---

### ERRO #6 - `mostrarAbaFinanceira` usa `event.target` sem parâmetro (GRAVE)
**Arquivo:** app.js
**Linha:** 1913
**Problema:** A função usa `event.target.classList.add("active")` mas `event` não é passado como argumento no HTML: `onclick="mostrarAbaFinanceira('contas-receber')"`
**Impacto:** Botão ativo da aba financeira não fica destacado.

---

### ERRO #7 - `mostrarAbaAdmin` usa `event.target` sem parâmetro (GRAVE)
**Arquivo:** app.js
**Linha:** 2846-2847
**Problema:** A função espera `(aba, event)` mas HTML chama sem event: `onclick="mostrarAbaAdmin('dashboard')"`
**Impacto:** Botão ativo da aba admin não fica destacado.

---

### ERRO #8 - `mostrarAbaWhatsApp` usa `event.target` sem parâmetro (GRAVE)
**Arquivo:** app.js
**Linha:** 2009
**Problema:** A função usa `event.target.classList.add("active")` sem ter recebido o event.
**Impacto:** Botão ativo da aba WhatsApp não fica destacado.

---

### ERRO #9 - Security Rules inconsistentes com modelo de dados
**Arquivo:** firestore.rules
**Linhas:** 11, 31-35
**Problema:** As rules verificam `resource.data.tenantId == request.auth.uid` mas o sistema `getTenantId()` pode retornar valor diferente de `auth.uid` (quando claims customizadas definem tenantId diferente do uid). Para MASTER_ADMIN, o tenantId pode não corresponder ao uid.
**Impacto:** Queries podem falhar com "permission denied" para usuários com tenantId diferente do uid.

---

### ERRO #10 - Duplicação de template de mensalidades
**Arquivo:** app.js
**Linhas:** 1035-1065 (carregarMensalidades) e 1138-1223 (carregarRecebimentos)
**Problema:** `carregarMensalidades()` e `carregarRecebimentos()` ambos carregam mensalidades na mesma tabela `listaRecebimentos`, causando duplicação.
**Impacto:** Mensalidades aparecem duplicadas na lista de contas a receber.

---

### ERRO #11 - `DOMContentLoaded` aninhado e funcionalidade duplicada
**Arquivo:** app.js
**Linha:** 2792
**Problema:** Listener DOMContentLoaded está aninhado DENTRO de outras funções e chama `carregarClientes()`, que já é chamado em outros lugares.
**Impacto:** Inconsistências de timing, carregamento duplicado.

---

### ERRO #12 - Perda de dados em `atualizarCliente`
**Arquivo:** app.js
**Linhas:** 605-636
**Problema:** `atualizarCliente()` não usa `secureData()` nem sanitiza inputs. Não salva `tenantId` nem `updatedBy`.
**Impacto:** Violação das regras de segurança do Firestore, perda de tenantId.

---

### ERRO #13 - `atualizarPlano` não salva tenantId
**Arquivo:** app.js
**Linhas:** 788-808
**Problema:** O update não preserva tenantId. Pode quebrar regras de segurança.
**Impacto:** Violação de segurança do Firestore.

---

### ERRO #14 - Vazamento de memória: listeners não limpos ao trocar seções
**Arquivo:** app.js
**Linhas:** 315-335 (função limparListeners existe mas nunca é chamada)
**Problema:** `limparListeners()` nunca é chamada no ciclo de vida normal. Cada navegação entre abas adiciona novos listeners sem remover os antigos.
**Impacto:** Listeners acumulados, consumo excessivo de banda, dados desatualizados sendo processados.

---

### ERRO #15 - Função `secureCollection` não utilizada
**Arquivo:** app.js
**Linhas:** 66-72
**Problema:** A função `secureCollection()` é definida mas NUNCA usada. As queries usam filtros manuais.
**Impacto:** Código morto, inconsistência na filtragem por tenant.

---

### ERRO #16 - Inconsistência de maiúsculas/minúsculas: `usuarioAtual.role`
**Arquivo:** app.js
**Linhas:** 24, 28, etc.
**Problema:** Código verifica `role === 'MASTER_ADMIN'` e `role === 'PROVEDOR'` (maiúsculo) mas no firestore.rules e functions usa `'PROVEDOR'`. No entanto, `carregarUsuarioAtual()` define `role` como `'cliente'` (minúsculo) como fallback.
**Impacto:** Usuários podem não ser reconhecidos corretamente.

---

## LISTA DE CORREÇÕES A APLICAR

### Correção 1: Reescrever `carregarClientes()` - Remover código inacessível, corrigir query
- Remover `return` antes do código real
- Mover query para usar `.where("tenantId", "==", getTenantId())`
- Corrigir estrutura para que todas as funções estejam no escopo global

### Correção 2: Mover TODAS as funções para o escopo global do módulo
- Extrair aproximadamente 150 funções de dentro do bloco morto
- Organizar em seções lógicas por módulo

### Correção 3: Remover listener `auth.onAuthStateChanged` duplicado
- Manter apenas um listener
- Unificar lógica de inicialização

### Correção 4: Corrigir filtro de planos (`usuarioId` -> `tenantId`)
- Substituir `if (!plano.usuarioId) return;` por verificação correta

### Correção 5: Adicionar parâmetro `event` aos handlers de aba
- Passar `event` nos onclick do HTML
- Usar event de forma segura com fallback

### Correção 6: Aplicar `secureData()` em `atualizarCliente` e `atualizarPlano`
- Garantir que updates preservem tenantId

### Correção 7: Chamar `limparListeners()` ao navegar entre seções
- Prevenir vazamento de memória

### Correção 8: Unificar carregamento de mensalidades
- Remover duplicação entre carregarMensalidades e carregarRecebimentos

### Correção 9: Atualizar Security Rules para suportar tenantId dinâmico
- Adicionar suporte para claims de tenantId

### Correção 10: Remover código morto (DOMContentLoaded aninhado)