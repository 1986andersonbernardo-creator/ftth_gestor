// ===========================
// CONTROLISP - APP PRINCIPAL
// Versão: 3.0 (Refatorado)
// ===========================

// ===========================
// GLOBAL VARIABLES
// ===========================

let clienteEditando = null;
let planoEditando = null;
let mensalidadeEditando = null;

// Pagination variables
let clientesLastDoc = null;
let recebimentosLastDoc = null;
let despesasLastDoc = null;
let clientesPageSize = 20;
let recebimentosPageSize = 20;
let despesasPageSize = 20;
let usuarioAtual = {
  uid: null,
  email: null,
  role: null,
  tenantId: null
};

function isMasterAdmin() {
  return usuarioAtual.role === 'MASTER_ADMIN';
}

function isProvedor() {
  return usuarioAtual.role === 'PROVEDOR';
}

function getTenantId() {
  return usuarioAtual.tenantId || usuarioAtual.uid || 'default';
}

async function carregarUsuarioAtual() {
  if (!auth.currentUser) return;

  usuarioAtual.uid = auth.currentUser.uid;
  usuarioAtual.email = auth.currentUser.email;
  usuarioAtual.tenantId = usuarioAtual.uid;
  usuarioAtual.role = 'cliente';

  try {
    const tokenResult = await auth.currentUser.getIdTokenResult(true);
    if (tokenResult.claims.role) usuarioAtual.role = tokenResult.claims.role;
    if (tokenResult.claims.tenantId) usuarioAtual.tenantId = tokenResult.claims.tenantId;
  } catch (erro) {
    console.warn('Não foi possível obter custom claims, usando dados do perfil:', erro);
  }

  try {
    const userDoc = await db.collection('usuarios').doc(usuarioAtual.uid).get();
    if (userDoc.exists) {
      const data = userDoc.data();
      if (data.role) usuarioAtual.role = data.role;
      if (data.tenantId) usuarioAtual.tenantId = data.tenantId;
    }
  } catch (erro) {
    console.warn('Erro ao buscar perfil de usuário:', erro);
  }

  mostrarAdminIfNeeded();
  return usuarioAtual;
}

function secureCollection(collectionName) {
  const tenantId = getTenantId();
  if (!tenantId || tenantId === 'default') {
    throw new Error('Tenant ID não definido. Verifique o login e as custom claims.');
  }
  return db.collection(collectionName).where('tenantId', '==', tenantId);
}

function secureData(data) {
  const tenantId = getTenantId();
  return {
    ...data,
    tenantId: tenantId,
    createdBy: usuarioAtual.uid,
    updatedBy: usuarioAtual.uid,
    updatedAt: new Date()
  };
}

function secureUpdate(data) {
  return {
    ...data,
    updatedBy: usuarioAtual.uid,
    updatedAt: new Date()
  };
}

function mostrarAdminIfNeeded() {
  const btnAdmin = document.getElementById('btnAdmin');
  if (!btnAdmin) return;

  if (isMasterAdmin()) {
    btnAdmin.style.display = 'flex';
  } else {
    btnAdmin.style.display = 'none';
  }
}

// Listener references for cleanup
let clientesListener = null;
let planosListener = null;
let financeiroListeners = [];
let fluxoCaixaListeners = [];
let recebimentosListener = null;
let despesasListener = null;
let inadimplentesListeners = [];
let whatsappListeners = [];
let adminListeners = [];
let clientesWhatsAppListener = null;
let historicoWhatsAppListener = null;
let adminDashboardListener = null;
let adminUsuariosListener = null;
let cobrancasWhatsAppListener = null;
let inadimplentesMensalidadesListener = null;
let inadimplentesRecebimentosListener = null;

// ===========================
// THEME MANAGEMENT
// ===========================

function toggleTheme() {
  const html = document.documentElement;
  const currentTheme = html.getAttribute('data-theme');
  const themeIcon = document.getElementById('themeIcon');

  if (currentTheme === 'light') {
    html.setAttribute('data-theme', 'dark');
    localStorage.setItem('theme', 'dark');
    if (themeIcon) {
      themeIcon.classList.remove('fa-sun');
      themeIcon.classList.add('fa-moon');
    }
  } else {
    html.setAttribute('data-theme', 'light');
    localStorage.setItem('theme', 'light');
    if (themeIcon) {
      themeIcon.classList.remove('fa-moon');
      themeIcon.classList.add('fa-sun');
    }
  }
}

function initializeTheme() {
  const savedTheme = localStorage.getItem('theme') || 'dark';
  const html = document.documentElement;
  const themeIcon = document.getElementById('themeIcon');

  html.setAttribute('data-theme', savedTheme);

  if (themeIcon) {
    if (savedTheme === 'light') {
      themeIcon.classList.remove('fa-moon');
      themeIcon.classList.add('fa-sun');
    } else {
      themeIcon.classList.remove('fa-sun');
      themeIcon.classList.add('fa-moon');
    }
  }
}

// ===========================
// SECURITY - INPUT SANITIZATION
// ===========================

function sanitizarInput(input) {
  if (!input) return "";
  let sanitized = input.replace(/<[^>]*>/g, "");
  sanitized = sanitized.replace(/[<>\"'&]/g, "");
  sanitized = sanitized.replace(/javascript:/gi, "");
  sanitized = sanitized.replace(/on\w+\s*=/gi, "");
  return sanitized.trim();
}

function sanitizarEmail(email) {
  if (!email) return "";
  let sanitized = email.toLowerCase().trim();
  sanitized = sanitized.replace(/<[^>]*>/g, "");
  sanitized = sanitized.replace(/javascript:/gi, "");
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(sanitized)) return "";
  return sanitized;
}

function sanitizarTelefone(telefone) {
  if (!telefone) return "";
  let sanitized = telefone.replace(/\D/g, "");
  if (sanitized.length > 11) sanitized = sanitized.substring(0, 11);
  return sanitized;
}

function sanitizarTexto(texto) {
  if (!texto) return "";
  let sanitized = texto.replace(/<[^>]*>/g, "");
  sanitized = sanitized.replace(/javascript:/gi, "");
  sanitized = sanitized.replace(/on\w+\s*=/gi, "");
  return sanitized.trim();
}

// ===========================
// AUDIT LOGGING
// ===========================

async function registrarAuditoria(acao, descricao) {
  if (!auth.currentUser) return;
  try {
    await db.collection("auditoria").add({
      tenantId: getTenantId(),
      createdBy: usuarioAtual.uid,
      usuarioEmail: auth.currentUser.email,
      acao: acao,
      descricao: descricao,
      dataHora: new Date(),
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
  } catch (erro) {
    console.error("Erro ao registrar auditoria:", erro);
  }
}

// ===========================
// SYSTEM CONFIGURATION
// ===========================

let configuracoesSistema = {
  planos: {
    "Básico": 49.90,
    "Pro": 99.90,
    "Enterprise": 199.90
  },
  paginacao: {
    clientes: 20,
    recebimentos: 20,
    despesas: 20
  }
};

async function carregarConfiguracoesSistema() {
  try {
    const configDocId = isMasterAdmin() ? 'sistema' : usuarioAtual.tenantId;
    const doc = await db.collection("configuracoes").doc(configDocId).get();
    if (doc.exists) {
      configuracoesSistema = { ...configuracoesSistema, ...doc.data() };
    }
  } catch (erro) {
    console.error("Erro ao carregar configurações do sistema:", erro);
  }
}

// ===========================
// BACKUP SYSTEM
// ===========================

async function criarBackup() {
  if (!auth.currentUser) return;
  try {
    const backupId = `backup_${auth.currentUser.uid}_${new Date().toISOString()}`;
    const backupRef = db.collection("backups").doc(backupId);
    const collections = ["clientes", "planos", "recebimentos", "despesas", "mensalidades", "whatsapp_historico"];
    const backupData = {};
    for (const collection of collections) {
      const snapshot = await db.collection(collection)
        .where("tenantId", "==", getTenantId())
        .get();
      backupData[collection] = snapshot.docs.map(doc => ({
        id: doc.id,
        data: doc.data()
      }));
    }
    await backupRef.set({
      tenantId: getTenantId(),
      createdBy: usuarioAtual.uid,
      data: backupData,
      criadoEm: new Date(),
      tamanho: JSON.stringify(backupData).length
    });
    console.log("Backup criado com sucesso:", backupId);
    await registrarAuditoria("backup", "Backup criado: " + backupId);
  } catch (erro) {
    console.error("Erro ao criar backup:", erro);
  }
}

// ===========================
// LISTENER CLEANUP
// ===========================

function limparListeners() {
  if (clientesListener) { clientesListener(); clientesListener = null; }
  if (planosListener) { planosListener(); planosListener = null; }
  if (recebimentosListener) { recebimentosListener(); recebimentosListener = null; }
  if (despesasListener) { despesasListener(); despesasListener = null; }
  if (clientesWhatsAppListener) { clientesWhatsAppListener(); clientesWhatsAppListener = null; }
  if (historicoWhatsAppListener) { historicoWhatsAppListener(); historicoWhatsAppListener = null; }
  if (adminDashboardListener) { adminDashboardListener(); adminDashboardListener = null; }
  if (adminUsuariosListener) { adminUsuariosListener(); adminUsuariosListener = null; }
  if (cobrancasWhatsAppListener) { cobrancasWhatsAppListener(); cobrancasWhatsAppListener = null; }
  if (inadimplentesMensalidadesListener) { inadimplentesMensalidadesListener(); inadimplentesMensalidadesListener = null; }
  if (inadimplentesRecebimentosListener) { inadimplentesRecebimentosListener(); inadimplentesRecebimentosListener = null; }

  financeiroListeners.forEach(listener => { if (listener) listener(); });
  financeiroListeners = [];

  fluxoCaixaListeners.forEach(listener => { if (listener) listener(); });
  fluxoCaixaListeners = [];

  inadimplentesListeners.forEach(listener => { if (listener) listener(); });
  inadimplentesListeners = [];

  whatsappListeners.forEach(listener => { if (listener) listener(); });
  whatsappListeners = [];

  adminListeners.forEach(listener => { if (listener) listener(); });
  adminListeners = [];
}

// ===========================
// LOGIN
// ===========================

function fazerLogin() {
  const email = sanitizarEmail(document.getElementById("usuario").value);
  const senha = document.getElementById("senha").value;

  if (!email || !senha) {
    alert("Por favor, preencha e-mail e senha!");
    return;
  }

  auth.signInWithEmailAndPassword(email, senha)
    .then(async () => {
      await carregarUsuarioAtual();
      document.getElementById("loginTela").style.display = "none";
      document.getElementById("sistema").style.display = "flex";
      mostrarSecao("dashboard");

      initializeTheme();
      await carregarConfiguracoesSistema();
      await registrarAuditoria("login", "Usuário fez login");

      carregarDadosIniciais();
    })
    .catch((erro) => {
      alert("Erro de login: " + erro.message);
    });
}

// ===========================
// INITIAL DATA LOAD
// ===========================

function carregarDadosIniciais() {
  carregarClientes();
  carregarPlanos();
  carregarFinanceiro();
  carregarPlanosSelect();
  carregarRecebimentos();
  carregarDespesas();
  atualizarFluxoCaixa();
  verificarGeracaoMensalidades();
  carregarClientesWhatsApp();
  carregarConfiguracoesWhatsApp();
  carregarHistoricoWhatsApp();

  if (usuarioAtual.role === "admin" || isMasterAdmin()) {
    const btnAdmin = document.getElementById("btnAdmin");
    if (btnAdmin) btnAdmin.style.display = "flex";
    carregarDashboardAdmin();
    carregarUsuariosAdmin();
  }
}

// ===========================
// MENU
// ===========================

function mostrarSecao(id) {
  if (id === 'administracao' && !isMasterAdmin()) {
    alert('Acesso negado: seção administrativa disponível somente para MASTER_ADMIN.');
    return;
  }

  document.querySelectorAll(".secao").forEach(secao => {
    secao.style.display = "none";
  });
  const el = document.getElementById(id);
  if (el) el.style.display = "block";
}

// ===========================
// CLIENTES
// ===========================

function salvarCliente() {
  const nome = sanitizarInput(document.getElementById("nome").value);
  const cpf = sanitizarInput(document.getElementById("cpf").value);
  const telefone = sanitizarTelefone(document.getElementById("telefone").value);
  const email = sanitizarEmail(document.getElementById("email").value);
  const endereco = sanitizarInput(document.getElementById("endereco").value);
  const bairro = sanitizarInput(document.getElementById("bairro").value);
  const cidade = sanitizarInput(document.getElementById("cidade").value);
  const cep = sanitizarInput(document.getElementById("cep").value);
  const status = document.getElementById("status").value;
  const plano = document.getElementById("plano").value;
  const valor = Number(document.getElementById("valor").value);
  const vencimento = document.getElementById("vencimento").value;

  if (!nome || !telefone || !email) {
    alert("Preencha pelo menos: Nome, Telefone e E-mail!");
    return;
  }

  const cliente = secureData({
    nome,
    cpf,
    telefone,
    email,
    endereco,
    bairro,
    cidade,
    cep,
    status,
    plano,
    valor,
    vencimento,
    dataCadastro: new Date()
  });

  db.collection("clientes")
    .add(cliente)
    .then(async (docRef) => {
      alert("Cliente cadastrado com sucesso!");
      limparFormulario();
      carregarFinanceiro();
      await registrarAuditoria("cliente_criado", `Cliente cadastrado: ${nome}`);

      // Gerar primeira mensalidade automaticamente se cliente estiver Ativo
      if (status === "Ativo" && valor > 0 && vencimento) {
        gerarMensalidadeInicial(docRef.id, nome, plano, valor, vencimento);
      }
    })
    .catch((erro) => {
      alert("Erro ao salvar: " + erro.message);
    });
}

function carregarClientes() {
  if (!auth.currentUser) {
    console.error("Usuário não está logado!");
    return;
  }

  console.log("Carregando clientes para tenantId:", getTenantId());

  // limpa listener antigo
  if (clientesListener) {
    clientesListener();
  }

  let query = db.collection("clientes")
    .where("tenantId", "==", getTenantId())
    .orderBy("nome")
    .limit(configuracoesSistema.paginacao.clientes);

  if (clientesLastDoc) {
    query = query.startAfter(clientesLastDoc);
  }

  clientesListener = query.onSnapshot((snapshot) => {
    const tabela = document.getElementById("listaClientes");
    if (!tabela) {
      console.error("Elemento listaClientes não encontrado!");
      return;
    }
    tabela.innerHTML = "";

    let totalClientes = 0;
    let clientesAtivos = 0;
    let faturamentoTotal = 0;

    console.log("Snapshot de clientes recebido:", snapshot.size, "registros");

    snapshot.forEach((doc) => {
      const cliente = doc.data();
      totalClientes++;

      if (cliente.status === "Ativo") {
        clientesAtivos++;
        faturamentoTotal += Number(cliente.valor) || 0;
      }

      tabela.innerHTML += `
        <tr>
          <td>${cliente.nome || ""}</td>
          <td>${cliente.telefone || ""}</td>
          <td>${cliente.status || ""}</td>
          <td>${cliente.plano || ""}</td>
          <td>${cliente.vencimento || ""}</td>
          <td>
            <button onclick="editarCliente('${doc.id}')">
              <i class="fas fa-pencil"></i> Editar
            </button>
            <button onclick="excluirCliente('${doc.id}')">
              <i class="fas fa-trash"></i> Excluir
            </button>
          </td>
        </tr>
      `;
    });

    // Update last doc for pagination
    if (snapshot.docs.length > 0) {
      clientesLastDoc = snapshot.docs[snapshot.docs.length - 1];
    } else {
      clientesLastDoc = null;
    }

    const totalClientesEl = document.getElementById("totalClientes");
    if (totalClientesEl) totalClientesEl.innerText = totalClientes;

    const clientesAtivosEl = document.getElementById("clientesAtivos");
    if (clientesAtivosEl) clientesAtivosEl.innerText = clientesAtivos;

    const faturamentoMensalEl = document.getElementById("faturamentoMensal");
    if (faturamentoMensalEl) {
      faturamentoMensalEl.innerText = "R$ " + faturamentoTotal.toFixed(2);
    }

    const ticketMedioEl = document.getElementById("ticketMedio");
    if (ticketMedioEl) {
      ticketMedioEl.innerText = "R$ " + (clientesAtivos > 0 ? (faturamentoTotal / clientesAtivos).toFixed(2) : "0.00");
    }
  }, (erro) => {
    console.error("Erro ao carregar clientes:", erro);
  });
}

async function editarCliente(id) {
  try {
    const docRef = await db.collection("clientes").doc(id).get();
    if (!docRef.exists) {
      alert("Cliente não encontrado!");
      return;
    }
    const cliente = docRef.data();

    clienteEditando = id;
    sessionStorage.setItem('clienteEditandoId', id);

    document.getElementById("nome").value = cliente.nome || "";
    document.getElementById("cpf").value = cliente.cpf || "";
    document.getElementById("telefone").value = cliente.telefone || "";
    document.getElementById("email").value = cliente.email || "";
    document.getElementById("endereco").value = cliente.endereco || "";
    document.getElementById("bairro").value = cliente.bairro || "";
    document.getElementById("cidade").value = cliente.cidade || "";
    document.getElementById("cep").value = cliente.cep || "";
    document.getElementById("status").value = cliente.status || "Ativo";
    document.getElementById("plano").value = cliente.plano || "";
    document.getElementById("valor").value = cliente.valor || "";
    document.getElementById("vencimento").value = cliente.vencimento || "";
  } catch (erro) {
    console.error("Erro ao editar cliente:", erro);
    alert("Erro ao carregar dados do cliente: " + erro.message);
  }
}

async function atualizarCliente() {
  const id = clienteEditando || sessionStorage.getItem('clienteEditandoId');
  if (!id) {
    alert("Selecione um cliente para editar.");
    return;
  }

  try {
    const updateData = secureUpdate({
      nome: sanitizarInput(document.getElementById("nome").value),
      cpf: sanitizarInput(document.getElementById("cpf").value),
      telefone: sanitizarTelefone(document.getElementById("telefone").value),
      email: sanitizarEmail(document.getElementById("email").value),
      endereco: sanitizarInput(document.getElementById("endereco").value),
      bairro: sanitizarInput(document.getElementById("bairro").value),
      cidade: sanitizarInput(document.getElementById("cidade").value),
      cep: sanitizarInput(document.getElementById("cep").value),
      status: document.getElementById("status").value,
      plano: document.getElementById("plano").value,
      valor: Number(document.getElementById("valor").value),
      vencimento: document.getElementById("vencimento").value
    });

    await db.collection("clientes").doc(id).update(updateData);

    alert("Cliente atualizado!");
    clienteEditando = null;
    sessionStorage.removeItem('clienteEditandoId');
    limparFormulario();
    carregarFinanceiro();
    await registrarAuditoria("cliente_atualizado", `Cliente atualizado: ID ${id}`);
  } catch (erro) {
    alert("Erro ao atualizar: " + erro.message);
  }
}

function excluirCliente(id) {
  if (!confirm("Deseja excluir este cliente?")) return;

  db.collection("clientes")
    .doc(id)
    .delete()
    .then(async () => {
      alert("Cliente removido!");
      carregarFinanceiro();
      await registrarAuditoria("cliente_excluido", `Cliente excluído: ID ${id}`);
    })
    .catch((erro) => {
      console.error("ERRO FIREBASE:", erro);
      alert("Erro ao excluir: " + erro.message);
    });
}

function limparFormulario() {
  document.getElementById("nome").value = "";
  document.getElementById("cpf").value = "";
  document.getElementById("telefone").value = "";
  document.getElementById("email").value = "";
  document.getElementById("endereco").value = "";
  document.getElementById("bairro").value = "";
  document.getElementById("cidade").value = "";
  document.getElementById("cep").value = "";
  if (document.getElementById("status")) document.getElementById("status").selectedIndex = 0;
  if (document.getElementById("plano")) document.getElementById("plano").selectedIndex = 0;
  document.getElementById("valor").value = "";
  document.getElementById("vencimento").value = "";
  clienteEditando = null;
  sessionStorage.removeItem('clienteEditandoId');
}

// ===========================
// PLANOS
// ===========================

function salvarPlano() {
  const nome = sanitizarInput(document.getElementById("nomePlano").value);
  const velocidade = sanitizarInput(document.getElementById("velocidadePlano").value);
  const valor = Number(document.getElementById("valorPlano").value);

  if (!nome || !velocidade || !valor) {
    alert("Preencha todos os campos do plano!");
    return;
  }

  const plano = secureData({
    nome,
    velocidade,
    valor,
    dataCadastro: new Date()
  });

  db.collection("planos")
    .add(plano)
    .then(async () => {
      alert("Plano cadastrado com sucesso!");
      limparFormularioPlano();
      await registrarAuditoria("plano_criado", `Plano cadastrado: ${nome}`);
    })
    .catch((erro) => {
      alert("Erro ao salvar: " + erro.message);
    });
}

function carregarPlanos() {
  if (planosListener) planosListener();

  let query = db.collection("planos")
    .where("tenantId", "==", getTenantId())
    .orderBy("nome");

  planosListener = query.onSnapshot((snapshot) => {
    const tabela = document.getElementById("listaPlanos");
    if (!tabela) return;
    tabela.innerHTML = "";

    snapshot.forEach((doc) => {
      const plano = doc.data();
      tabela.innerHTML += `
        <tr>
          <td>${plano.nome || ""}</td>
          <td>${plano.velocidade || ""}</td>
          <td>R$ ${Number(plano.valor).toFixed(2)}</td>
          <td>
            <button onclick="editarPlano('${doc.id}')">
              <i class="fas fa-pencil"></i> Editar
            </button>
            <button onclick="excluirPlano('${doc.id}')">
              <i class="fas fa-trash"></i> Excluir
            </button>
          </td>
        </tr>
      `;
    });
  }, (erro) => {
    console.error("Erro ao carregar planos:", erro);
  });
}

function carregarPlanosSelect() {
  const select = document.getElementById("plano");
  if (!select) return;

  db.collection("planos")
    .where("tenantId", "==", getTenantId())
    .orderBy("nome")
    .onSnapshot((snapshot) => {
      select.innerHTML = '<option value="">Selecione um plano</option>';

      snapshot.forEach((doc) => {
        const plano = doc.data();
        const option = document.createElement("option");
        option.value = plano.nome;
        option.textContent = `${plano.nome} - ${plano.velocidade} - R$ ${Number(plano.valor).toFixed(2)}`;
        select.appendChild(option);
      });
    }, (erro) => {
      console.error("Erro ao carregar planos select:", erro);
    });
}

async function editarPlano(id) {
  try {
    const docRef = await db.collection("planos").doc(id).get();
    if (!docRef.exists) {
      alert("Plano não encontrado!");
      return;
    }
    const plano = docRef.data();

    planoEditando = id;
    sessionStorage.setItem('planoEditandoId', id);

    document.getElementById("nomePlano").value = plano.nome || "";
    document.getElementById("velocidadePlano").value = plano.velocidade || "";
    document.getElementById("valorPlano").value = plano.valor || "";
  } catch (erro) {
    console.error("Erro ao editar plano:", erro);
    alert("Erro ao carregar dados do plano: " + erro.message);
  }
}

async function atualizarPlano() {
  const id = planoEditando || sessionStorage.getItem('planoEditandoId');
  if (!id) {
    alert("Selecione um plano para editar.");
    return;
  }

  try {
    await db.collection("planos").doc(id).update(secureUpdate({
      nome: document.getElementById("nomePlano").value,
      velocidade: document.getElementById("velocidadePlano").value,
      valor: Number(document.getElementById("valorPlano").value)
    }));

    alert("Plano atualizado com sucesso!");
    planoEditando = null;
    sessionStorage.removeItem('planoEditandoId');
    limparFormularioPlano();
    await registrarAuditoria("plano_atualizado", `Plano atualizado: ID ${id}`);
  } catch (erro) {
    alert("Erro ao atualizar: " + erro.message);
  }
}

function excluirPlano(id) {
  if (!confirm("Deseja excluir este plano?")) return;

  db.collection("planos")
    .doc(id)
    .delete()
    .then(async () => {
      alert("Plano removido!");
      await registrarAuditoria("plano_excluido", `Plano excluído: ID ${id}`);
    })
    .catch((erro) => {
      alert("Erro: " + erro.message);
    });
}

function limparFormularioPlano() {
  document.getElementById("nomePlano").value = "";
  document.getElementById("velocidadePlano").value = "";
  document.getElementById("valorPlano").value = "";
  planoEditando = null;
  sessionStorage.removeItem('planoEditandoId');
}

function preencherValorPlano() {
  const nomePlano = document.getElementById("plano").value;
  if (!nomePlano) return;

  db.collection("planos")
    .where("nome", "==", nomePlano)
    .where("tenantId", "==", getTenantId())
    .limit(1)
    .get()
    .then((snapshot) => {
      if (!snapshot.empty) {
        const plano = snapshot.docs[0].data();
        document.getElementById("valor").value = plano.valor || "";
      }
    })
    .catch((erro) => {
      console.error("Erro ao preencher valor do plano:", erro);
    });
}

// ===========================
// MENSALIDADES RECURRENTES
// ===========================

function gerarMensalidadeInicial(clienteId, clienteNome, plano, valor, vencimento) {
  const dataAtual = new Date();
  const competencia = formatarCompetencia(dataAtual);
  const dataVencimento = calcularDataVencimento(vencimento, dataAtual);

  db.collection("mensalidades")
    .where("clienteId", "==", clienteId)
    .where("competencia", "==", competencia)
    .get()
    .then((snapshot) => {
      if (snapshot.empty) {
        const mensalidade = secureData({
          clienteId,
          clienteNome,
          plano,
          valor,
          vencimento: dataVencimento,
          competencia,
          status: "Em Aberto",
          dataGeracao: new Date(),
          tipo: "Recorrente"
        });

        db.collection("mensalidades")
          .add(mensalidade)
          .then(() => {
            console.log("Primeira mensalidade gerada automaticamente para cliente:", clienteNome);
          })
          .catch((erro) => {
            console.error("Erro ao gerar mensalidade inicial:", erro);
          });
      }
    })
    .catch((erro) => {
      console.error("Erro ao verificar mensalidade existente:", erro);
    });
}

function gerarMensalidadesNovoMes() {
  const dataAtual = new Date();
  const competencia = formatarCompetencia(dataAtual);

  db.collection("clientes")
    .where("tenantId", "==", getTenantId())
    .where("status", "==", "Ativo")
    .get()
    .then((snapshot) => {
      let processadas = 0;
      snapshot.forEach((clienteDoc) => {
        const cliente = clienteDoc.data();
        const clienteId = clienteDoc.id;

        db.collection("mensalidades")
          .where("clienteId", "==", clienteId)
          .where("competencia", "==", competencia)
          .get()
          .then((mensalidadeSnapshot) => {
            if (mensalidadeSnapshot.empty && cliente.valor > 0 && cliente.vencimento) {
              const dataVencimento = calcularDataVencimento(cliente.vencimento, dataAtual);

              const mensalidade = secureData({
                clienteId,
                clienteNome: cliente.nome,
                plano: cliente.plano,
                valor: cliente.valor,
                vencimento: dataVencimento,
                competencia,
                status: "Em Aberto",
                dataGeracao: new Date(),
                tipo: "Recorrente"
              });

              db.collection("mensalidades")
                .add(mensalidade)
                .then(() => {
                  processadas++;
                  console.log("Mensalidade gerada para cliente:", cliente.nome);
                })
                .catch((erro) => {
                  console.error("Erro ao gerar mensalidade:", erro);
                });
            }
          })
          .catch((erro) => {
            console.error("Erro ao verificar mensalidade existente:", erro);
          });
      });
      if (snapshot.size > 0) {
        setTimeout(() => {
          alert(`${processadas} mensalidades geradas com sucesso!`);
          carregarRecebimentos();
          carregarFinanceiro();
        }, 2000);
      }
    })
    .catch((erro) => {
      console.error("Erro ao buscar clientes ativos:", erro);
    });
}

function formatarCompetencia(data) {
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const ano = data.getFullYear();
  return `${mes}/${ano}`;
}

function calcularDataVencimento(diaVencimento, dataReferencia) {
  const data = new Date(dataReferencia);
  data.setDate(parseInt(diaVencimento));
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const dia = String(data.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

function verificarGeracaoMensalidades() {
  const dataAtual = new Date();
  const dia = dataAtual.getDate();
  if (dia === 1) {
    gerarMensalidadesNovoMes();
  }
}

function marcarMensalidadePaga(mensalidadeId) {
  db.collection("mensalidades")
    .doc(mensalidadeId)
    .update(secureUpdate({
      status: "Pago",
      dataPagamento: new Date()
    }))
    .then(() => {
      alert("Mensalidade marcada como paga!");
      carregarRecebimentos();
      carregarFinanceiro();
      atualizarFluxoCaixa();
    })
    .catch((erro) => {
      alert("Erro: " + erro.message);
    });
}

function marcarMensalidadeAtrasada(mensalidadeId) {
  db.collection("mensalidades")
    .doc(mensalidadeId)
    .update(secureUpdate({
      status: "Atrasado"
    }))
    .then(() => {
      alert("Mensalidade marcada como atrasada!");
      carregarRecebimentos();
      carregarFinanceiro();
    })
    .catch((erro) => {
      alert("Erro: " + erro.message);
    });
}

function excluirMensalidade(mensalidadeId) {
  if (!confirm("Deseja excluir esta mensalidade?")) return;

  db.collection("mensalidades")
    .doc(mensalidadeId)
    .delete()
    .then(() => {
      alert("Mensalidade removida!");
      carregarRecebimentos();
      carregarFinanceiro();
    })
    .catch((erro) => {
      alert("Erro: " + erro.message);
    });
}

// ===========================
// FINANCEIRO - CONTAS A RECEBER
// ===========================

function abrirModalRecebimento() {
  document.getElementById("modalRecebimento").style.display = "flex";
  carregarClientesRecebimento();
}

function fecharModalRecebimento() {
  document.getElementById("modalRecebimento").style.display = "none";
}

function carregarClientesRecebimento() {
  const select = document.getElementById("receb_cliente");
  if (!select) return;

  db.collection("clientes")
    .where("tenantId", "==", getTenantId())
    .where("status", "==", "Ativo")
    .orderBy("nome")
    .get()
    .then((snapshot) => {
      select.innerHTML = '<option value="">-- Selecione um cliente --</option>';
      snapshot.forEach((doc) => {
        const cliente = doc.data();
        const option = document.createElement("option");
        option.value = doc.id;
        option.textContent = cliente.nome;
        select.appendChild(option);
      });
    })
    .catch((erro) => {
      console.error("Erro ao carregar clientes:", erro);
    });
}

function salvarRecebimento() {
  const clienteId = document.getElementById("receb_cliente").value;
  const valor = Number(document.getElementById("receb_valor").value);
  const vencimento = document.getElementById("receb_vencimento").value;
  const pagamento = document.getElementById("receb_pagamento").value;
  const status = document.getElementById("receb_status").value;
  const observacao = sanitizarTexto(document.getElementById("receb_observacao").value);

  if (!clienteId || !valor || !vencimento || !pagamento) {
    alert("Preencha todos os campos obrigatórios!");
    return;
  }

  db.collection("recebimentos")
    .add(secureData({
      clienteId,
      valor,
      vencimento,
      pagamento,
      status,
      observacao,
      dataCadastro: new Date()
    }))
    .then(async () => {
      alert("Cobrança cadastrada com sucesso!");
      fecharModalRecebimento();
      carregarRecebimentos();
      carregarFinanceiro();
      await registrarAuditoria("recebimento_criado", `Cobrança criada: R$ ${valor}`);
    })
    .catch((erro) => {
      alert("Erro: " + erro.message);
    });
}

function carregarRecebimentos() {
  const tabela = document.getElementById("listaRecebimentos");
  if (!tabela) return;
  tabela.innerHTML = "";

  if (recebimentosListener) {
    recebimentosListener();
  }

  let queryMensalidades = db.collection("mensalidades")
    .where("tenantId", "==", getTenantId())
    .orderBy("vencimento", "desc")
    .limit(configuracoesSistema.paginacao.recebimentos);

  if (recebimentosLastDoc) {
    queryMensalidades = queryMensalidades.startAfter(recebimentosLastDoc);
  }

  recebimentosListener = queryMensalidades.onSnapshot((mensalidadeSnapshot) => {
    let htmlMensalidades = "";
    mensalidadeSnapshot.forEach((doc) => {
      const mens = doc.data();
      const statusClass = mens.status === "Pago" ? "status-pago" : mens.status === "Atrasado" ? "status-atrasado" : "status-pendente";

      htmlMensalidades += `
        <tr>
          <td>${mens.clienteNome || ""}</td>
          <td>R$ ${mens.valor.toFixed(2)}</td>
          <td>${mens.vencimento}</td>
          <td><span class="${statusClass}">${mens.status}</span></td>
          <td>${mens.tipo || "Recorrente"}</td>
          <td>
            ${mens.status !== "Pago" ? `<button onclick="marcarMensalidadePaga('${doc.id}')"><i class="fas fa-check"></i> Pago</button>` : ""}
            ${mens.status === "Em Aberto" ? `<button onclick="marcarMensalidadeAtrasada('${doc.id}')"><i class="fas fa-exclamation"></i> Atrasado</button>` : ""}
            <button onclick="excluirMensalidade('${doc.id}')"><i class="fas fa-trash"></i></button>
          </td>
        </tr>
      `;
    });

    // Carregar recebimentos manuais e adicionar abaixo
    db.collection("recebimentos")
      .where("tenantId", "==", getTenantId())
      .orderBy("vencimento", "desc")
      .limit(20)
      .get()
      .then((snapshot) => {
        snapshot.forEach((doc) => {
          const receb = doc.data();
          db.collection("clientes")
            .doc(receb.clienteId)
            .get()
            .then((clienteDoc) => {
              if (clienteDoc.exists) {
                const cliente = clienteDoc.data();
                const statusClass = receb.status === "Pago" ? "status-pago" : receb.status === "Atrasado" ? "status-atrasado" : "status-pendente";

                htmlMensalidades += `
                  <tr>
                    <td>${cliente.nome || ""}</td>
                    <td>R$ ${receb.valor.toFixed(2)}</td>
                    <td>${receb.vencimento}</td>
                    <td><span class="${statusClass}">${receb.status}</span></td>
                    <td>${receb.pagamento}</td>
                    <td>
                      <button onclick="excluirRecebimento('${doc.id}')"><i class="fas fa-trash"></i></button>
                    </td>
                  </tr>
                `;
              }
              tabela.innerHTML = htmlMensalidades;
            })
            .catch(() => {
              tabela.innerHTML = htmlMensalidades;
            });
        });
        if (snapshot.size === 0) {
          tabela.innerHTML = htmlMensalidades;
        }
      })
      .catch((erro) => {
        console.error("Erro ao carregar recebimentos:", erro);
        tabela.innerHTML = htmlMensalidades;
      });

    if (mensalidadeSnapshot.docs.length > 0) {
      recebimentosLastDoc = mensalidadeSnapshot.docs[mensalidadeSnapshot.docs.length - 1];
    } else {
      recebimentosLastDoc = null;
    }
  }, (erro) => {
    console.error("Erro ao carregar mensalidades:", erro);
  });
}

function filtrarRecebimentos() {
  const busca = document.getElementById("buscaClienteReceb").value.toLowerCase();
  const status = document.getElementById("filtroStatusReceb").value;

  const linhas = document.querySelectorAll("#listaRecebimentos tr");
  linhas.forEach((linha) => {
    if (linha.cells.length === 0) return;
    const cliente = linha.cells[0].textContent.toLowerCase();
    const statusLinha = linha.cells[3].textContent;
    const matchBusca = cliente.includes(busca);
    const matchStatus = status === "" || statusLinha.includes(status);
    linha.style.display = matchBusca && matchStatus ? "" : "none";
  });
}

function excluirRecebimento(id) {
  if (!confirm("Deseja excluir este recebimento?")) return;

  db.collection("recebimentos")
    .doc(id)
    .delete()
    .then(async () => {
      alert("Recebimento removido!");
      carregarRecebimentos();
      carregarFinanceiro();
      await registrarAuditoria("recebimento_excluido", `Recebimento excluído: ID ${id}`);
    })
    .catch((erro) => {
      alert("Erro: " + erro.message);
    });
}

// ===========================
// FINANCEIRO - CONTAS A PAGAR
// ===========================

function abrirModalDespesa() {
  document.getElementById("modalDespesa").style.display = "flex";
}

function fecharModalDespesa() {
  document.getElementById("modalDespesa").style.display = "none";
}

function salvarDespesa() {
  const descricao = sanitizarInput(document.getElementById("desp_descricao").value);
  const categoria = document.getElementById("desp_categoria").value;
  const valor = Number(document.getElementById("desp_valor").value);
  const vencimento = document.getElementById("desp_vencimento").value;
  const status = document.getElementById("desp_status").value;
  const observacao = sanitizarTexto(document.getElementById("desp_observacao").value);

  if (!descricao || !categoria || !valor || !vencimento) {
    alert("Preencha todos os campos obrigatórios!");
    return;
  }

  db.collection("despesas")
    .add(secureData({
      descricao,
      categoria,
      valor,
      vencimento,
      status,
      observacao,
      dataCadastro: new Date()
    }))
    .then(async () => {
      alert("Despesa cadastrada com sucesso!");
      fecharModalDespesa();
      limparFormularioDespesa();
      carregarDespesas();
      carregarFinanceiro();
      await registrarAuditoria("despesa_criada", `Despesa criada: ${descricao} - R$ ${valor}`);
    })
    .catch((erro) => {
      alert("Erro: " + erro.message);
    });
}

function carregarDespesas() {
  if (despesasListener) despesasListener();

  let query = db.collection("despesas")
    .where("tenantId", "==", getTenantId())
    .orderBy("vencimento", "desc")
    .limit(configuracoesSistema.paginacao.despesas);

  if (despesasLastDoc) {
    query = query.startAfter(despesasLastDoc);
  }

  despesasListener = query.onSnapshot((snapshot) => {
    const tabela = document.getElementById("listaDespesas");
    if (!tabela) return;
    tabela.innerHTML = "";

    snapshot.forEach((doc) => {
      const desp = doc.data();
      const statusClass = desp.status === "Pago" ? "status-pago" : "status-pendente";

      tabela.innerHTML += `
        <tr>
          <td>${desp.descricao}</td>
          <td>${desp.categoria}</td>
          <td>R$ ${desp.valor.toFixed(2)}</td>
          <td>${desp.vencimento}</td>
          <td><span class="${statusClass}">${desp.status}</span></td>
          <td>
            <button onclick="editarDespesa('${doc.id}')"><i class="fas fa-pencil"></i></button>
            <button onclick="excluirDespesa('${doc.id}')"><i class="fas fa-trash"></i></button>
          </td>
        </tr>
      `;
    });

    if (snapshot.docs.length > 0) {
      despesasLastDoc = snapshot.docs[snapshot.docs.length - 1];
    } else {
      despesasLastDoc = null;
    }
  }, (erro) => {
    console.error("Erro ao carregar despesas:", erro);
  });
}

function filtrarDespesas() {
  const busca = document.getElementById("buscaDespesa").value.toLowerCase();
  const categoria = document.getElementById("filtroCategoriaDespesa").value;
  const status = document.getElementById("filtroStatusDespesa").value;

  const linhas = document.querySelectorAll("#listaDespesas tr");
  linhas.forEach((linha) => {
    if (linha.cells.length === 0) return;
    const descricao = linha.cells[0].textContent.toLowerCase();
    const categLinha = linha.cells[1].textContent;
    const statusLinha = linha.cells[4].textContent;

    const matchBusca = descricao.includes(busca);
    const matchCateg = categoria === "" || categLinha === categoria;
    const matchStatus = status === "" || statusLinha.includes(status);

    linha.style.display = matchBusca && matchCateg && matchStatus ? "" : "none";
  });
}

function editarDespesa(id) {
  // Implementar edição se necessário
  alert("Edição de despesa será implementada em breve.");
}

function excluirDespesa(id) {
  if (!confirm("Deseja excluir esta despesa?")) return;

  db.collection("despesas")
    .doc(id)
    .delete()
    .then(async () => {
      alert("Despesa removida!");
      carregarDespesas();
      carregarFinanceiro();
      await registrarAuditoria("despesa_excluida", `Despesa excluída: ID ${id}`);
    })
    .catch((erro) => {
      alert("Erro: " + erro.message);
    });
}

function limparFormularioDespesa() {
  document.getElementById("desp_descricao").value = "";
  if (document.getElementById("desp_categoria")) document.getElementById("desp_categoria").selectedIndex = 0;
  document.getElementById("desp_valor").value = "";
  document.getElementById("desp_vencimento").value = "";
  if (document.getElementById("desp_status")) document.getElementById("desp_status").selectedIndex = 0;
  document.getElementById("desp_observacao").value = "";
}

// ===========================
// FINANCEIRO - FLUXO DE CAIXA
// ===========================

function atualizarFluxoCaixa() {
  const dataInicio = document.getElementById("dataInicio").value;
  const dataFim = document.getElementById("dataFim").value;

  fluxoCaixaListeners.forEach(listener => { if (listener) listener(); });
  fluxoCaixaListeners = [];

  Promise.all([
    db.collection("recebimentos").where("tenantId", "==", getTenantId()).get(),
    db.collection("despesas").where("tenantId", "==", getTenantId()).get(),
    db.collection("mensalidades").where("tenantId", "==", getTenantId()).get()
  ]).then(([recebSnapshot, despSnapshot, mensalidadeSnapshot]) => {
    let totalEntradas = 0;
    let totalSaidas = 0;
    let fluxoHTML = "";

    recebSnapshot.forEach((doc) => {
      const receb = doc.data();
      if (receb.status === "Pago") {
        const data = receb.vencimento;
        if ((!dataInicio || data >= dataInicio) && (!dataFim || data <= dataFim)) {
          totalEntradas += receb.valor;
          fluxoHTML += `
            <tr>
              <td>${data}</td>
              <td>Entrada</td>
              <td>Recebimento Manual</td>
              <td class="valor-entrada">+R$ ${receb.valor.toFixed(2)}</td>
            </tr>
          `;
        }
      }
    });

    mensalidadeSnapshot.forEach((doc) => {
      const mens = doc.data();
      if (mens.status === "Pago") {
        const data = mens.dataPagamento || mens.vencimento;
        if ((!dataInicio || data >= dataInicio) && (!dataFim || data <= dataFim)) {
          totalEntradas += mens.valor;
          fluxoHTML += `
            <tr>
              <td>${data}</td>
              <td>Entrada</td>
              <td>Mensalidade - ${mens.clienteNome}</td>
              <td class="valor-entrada">+R$ ${mens.valor.toFixed(2)}</td>
            </tr>
          `;
        }
      }
    });

    despSnapshot.forEach((doc) => {
      const desp = doc.data();
      if (desp.status === "Pago") {
        const data = desp.vencimento;
        if ((!dataInicio || data >= dataInicio) && (!dataFim || data <= dataFim)) {
          totalSaidas += desp.valor;
          fluxoHTML += `
            <tr>
              <td>${data}</td>
              <td>Saída</td>
              <td>${desp.descricao}</td>
              <td class="valor-saida">-R$ ${desp.valor.toFixed(2)}</td>
            </tr>
          `;
        }
      }
    });

    const saldo = totalEntradas - totalSaidas;

    const totalEntradasEl = document.getElementById("totalEntradas");
    const totalSaidasEl = document.getElementById("totalSaidas");
    const saldoAtualEl = document.getElementById("saldoAtual");
    const listaFluxoEl = document.getElementById("listaFluxoCaixa");

    if (totalEntradasEl) totalEntradasEl.innerText = "R$ " + totalEntradas.toFixed(2);
    if (totalSaidasEl) totalSaidasEl.innerText = "R$ " + totalSaidas.toFixed(2);
    if (saldoAtualEl) saldoAtualEl.innerText = "R$ " + saldo.toFixed(2);
    if (listaFluxoEl) listaFluxoEl.innerHTML = fluxoHTML;
  }).catch((erro) => {
    console.error("Erro ao atualizar fluxo de caixa:", erro);
  });
}

// ===========================
// WHATSAPP INADIMPLENTE
// ===========================

function enviarWhatsAppInadimplente(nome, valor, vencimento, telefone = "") {
  if (!telefone) {
    db.collection("clientes")
      .where("nome", "==", nome)
      .where("tenantId", "==", getTenantId())
      .limit(1)
      .get()
      .then((snapshot) => {
        if (!snapshot.empty) {
          const cliente = snapshot.docs[0].data();
          abrirWhatsApp(cliente.telefone, nome, valor, vencimento);
        } else {
          alert("Cliente não encontrado para obter telefone.");
        }
      })
      .catch((erro) => {
        alert("Erro ao buscar telefone: " + erro.message);
      });
  } else {
    abrirWhatsApp(telefone, nome, valor, vencimento);
  }
}

function abrirWhatsApp(telefone, nome, valor, vencimento) {
  const telefoneLimpo = telefone.replace(/\D/g, '');
  const mensagem = `Olá, ${nome}!

Identificamos uma mensalidade em aberto no valor de R$ ${valor}, vencida em ${vencimento}.

Caso já tenha efetuado o pagamento, desconsidere esta mensagem.

Em caso de dúvidas, entre em contato conosco.

Atenciosamente,
ControlISP`;

  const mensagemCodificada = encodeURIComponent(mensagem);
  const url = `https://wa.me/55${telefoneLimpo}?text=${mensagemCodificada}`;
  window.open(url, '_blank');
}

// ===========================
// FINANCEIRO - DASHBOARD
// ===========================

function carregarFinanceiro() {
  financeiroListeners.forEach(listener => { if (listener) listener(); });
  financeiroListeners = [];

  Promise.all([
    db.collection("clientes").where("tenantId", "==", getTenantId()).get(),
    db.collection("recebimentos").where("tenantId", "==", getTenantId()).get(),
    db.collection("despesas").where("tenantId", "==", getTenantId()).get(),
    db.collection("mensalidades").where("tenantId", "==", getTenantId()).get()
  ]).then(([clienteSnapshot, recebSnapshot, despSnapshot, mensalidadeSnapshot]) => {
    let faturamentoMes = 0;
    let totalRecebido = 0;
    let totalAberto = 0;
    let totalVencido = 0;
    let totalDespesas = 0;
    let clientesInadimplentes = 0;
    let valorInadimplente = 0;
    let recebidoQtd = 0;
    let abertoQtd = 0;
    let vencidoQtd = 0;
    let despesasQtd = 0;
    let receitaPrevista = 0;
    let receitaRecebidaMes = 0;
    let receitaAnualProjetada = 0;
    let receitaAtraso = 0;

    const dataAtual = new Date();
    const mesAtual = dataAtual.getMonth();
    const anoAtual = dataAtual.getFullYear();

    clienteSnapshot.forEach((doc) => {
      const cliente = doc.data();
      if (cliente.status === "Ativo") {
        faturamentoMes += Number(cliente.valor) || 0;
        receitaPrevista += Number(cliente.valor) || 0;
      }
      if (cliente.status === "Inadimplente") {
        clientesInadimplentes++;
      }
    });

    receitaAnualProjetada = faturamentoMes * 12;

    recebSnapshot.forEach((doc) => {
      const receb = doc.data();
      if (receb.status === "Pago") {
        totalRecebido += receb.valor;
        recebidoQtd++;
        const dataPagamento = new Date(receb.vencimento);
        if (dataPagamento.getMonth() === mesAtual && dataPagamento.getFullYear() === anoAtual) {
          receitaRecebidaMes += receb.valor;
        }
      } else if (receb.status === "Pendente") {
        totalAberto += receb.valor;
        abertoQtd++;
      } else if (receb.status === "Atrasado") {
        totalVencido += receb.valor;
        valorInadimplente += receb.valor;
        vencidoQtd++;
        receitaAtraso += receb.valor;
      }
    });

    mensalidadeSnapshot.forEach((doc) => {
      const mens = doc.data();
      if (mens.status === "Pago") {
        totalRecebido += mens.valor;
        recebidoQtd++;
        const dataPagamento = new Date(mens.dataPagamento || mens.vencimento);
        if (dataPagamento.getMonth() === mesAtual && dataPagamento.getFullYear() === anoAtual) {
          receitaRecebidaMes += mens.valor;
        }
      } else if (mens.status === "Em Aberto") {
        totalAberto += mens.valor;
        abertoQtd++;
        const dataVencimento = new Date(mens.vencimento);
        if (dataVencimento < dataAtual) {
          totalVencido += mens.valor;
          vencidoQtd++;
          receitaAtraso += mens.valor;
        }
      } else if (mens.status === "Atrasado") {
        totalVencido += mens.valor;
        valorInadimplente += mens.valor;
        vencidoQtd++;
        receitaAtraso += mens.valor;
      }
    });

    despSnapshot.forEach((doc) => {
      const desp = doc.data();
      if (desp.status === "Pago") {
        totalDespesas += desp.valor;
      } else {
        despesasQtd++;
      }
    });

    const lucroLiquido = totalRecebido - totalDespesas;

    const setText = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.innerText = val;
    };

    setText("faturamentoMes", "R$ " + faturamentoMes.toFixed(2));
    setText("totalRecebido", "R$ " + totalRecebido.toFixed(2));
    setText("totalAberto", "R$ " + totalAberto.toFixed(2));
    setText("totalDespesas", "R$ " + totalDespesas.toFixed(2));
    setText("lucroLiquido", "R$ " + lucroLiquido.toFixed(2));
    setText("totalInadimplentes", String(clientesInadimplentes));
    setText("valorInadimplentes", "R$ " + valorInadimplente.toFixed(2) + " em atraso");
    setText("recebidoQtd", recebidoQtd + " cobranças pagas");
    setText("abertoQtd", abertoQtd + " cobranças pendentes");
    setText("despesasQtd", despesasQtd + " despesas este mês");
    setText("receitaRecebidaMes", "R$ " + receitaRecebidaMes.toFixed(2));
    setText("receitaAnualProjetada", "R$ " + receitaAnualProjetada.toFixed(2));
    setText("receitaAtraso", "R$ " + receitaAtraso.toFixed(2));

    carregarInadimplentes();
  }).catch((erro) => {
    console.error("Erro ao carregar financeiro:", erro);
  });
}

// ===========================
// FINANCEIRO - INADIMPLÊNCIA
// ===========================

function carregarInadimplentes() {
  const tabela = document.getElementById("listaInadimplentes");
  if (!tabela) return;
  tabela.innerHTML = "";

  let totalInadimplentes = 0;
  let valorTotal = 0;
  const clientesUnicos = new Set();
  const receitasAtraso = [];
  let dadosCarregados = 0;
  const totalEsperado = 2; // mensalidades + recebimentos

  // Limpar listeners antigos
  if (inadimplentesMensalidadesListener) inadimplentesMensalidadesListener();
  if (inadimplentesRecebimentosListener) inadimplentesRecebimentosListener();

  function atualizarIndicadores() {
    const qntEl = document.getElementById("qntInadimplentes");
    const valorEl = document.getElementById("valorTotalAtraso");
    const ticketEl = document.getElementById("ticketMedioAtraso");
    if (qntEl) qntEl.innerText = clientesUnicos.size;
    if (valorEl) valorEl.innerText = "R$ " + valorTotal.toFixed(2);
    if (ticketEl) {
      ticketEl.innerText = "R$ " + (totalInadimplentes > 0 ? (valorTotal / totalInadimplentes).toFixed(2) : "0.00");
    }
    atualizarTabelaReceitaAtraso(receitasAtraso);
  }

  // Mensalidades atrasadas
  inadimplentesMensalidadesListener = db.collection("mensalidades")
    .where("tenantId", "==", getTenantId())
    .where("status", "==", "Atrasado")
    .onSnapshot((mensalidadeSnapshot) => {
      mensalidadeSnapshot.forEach((doc) => {
        const mens = doc.data();
        totalInadimplentes++;
        valorTotal += mens.valor;
        clientesUnicos.add(mens.clienteId);

        const dataAtrasada = new Date(mens.vencimento);
        const dataHoje = new Date();
        const diasAtraso = Math.floor((dataHoje - dataAtrasada) / (1000 * 60 * 60 * 24));

        tabela.innerHTML += `
          <tr>
            <td>${mens.clienteNome}</td>
            <td>R$ ${mens.valor.toFixed(2)}</td>
            <td>${mens.vencimento}</td>
            <td>${diasAtraso} dias</td>
            <td>Mensalidade</td>
            <td>
              <button onclick="enviarWhatsAppInadimplente('${mens.clienteNome}', '${mens.valor}', '${mens.vencimento}')" style="background: #25D366; margin-right: 5px;">
                <i class="fab fa-whatsapp"></i>
              </button>
              <button onclick="marcarMensalidadePaga('${doc.id}')">
                <i class="fas fa-check"></i> Marcar Pago
              </button>
            </td>
          </tr>
        `;

        receitasAtraso.push({
          clienteNome: mens.clienteNome,
          valor: mens.valor,
          vencimento: mens.vencimento,
          diasAtraso: diasAtraso,
          tipo: 'Mensalidade',
          id: doc.id,
          telefone: null
        });
      });
      dadosCarregados++;
      if (dadosCarregados >= totalEsperado) atualizarIndicadores();
    }, (erro) => {
      console.error("Erro ao carregar mensalidades atrasadas:", erro);
      dadosCarregados++;
      if (dadosCarregados >= totalEsperado) atualizarIndicadores();
    });

  // Recebimentos manuais atrasados
  inadimplentesRecebimentosListener = db.collection("recebimentos")
    .where("tenantId", "==", getTenantId())
    .where("status", "==", "Atrasado")
    .onSnapshot((snapshot) => {
      let processados = 0;
      const totalProcessar = snapshot.size;

      if (totalProcessar === 0) {
        dadosCarregados++;
        if (dadosCarregados >= totalEsperado) atualizarIndicadores();
        return;
      }

      snapshot.forEach((doc) => {
        const receb = doc.data();
        totalInadimplentes++;
        valorTotal += receb.valor;
        clientesUnicos.add(receb.clienteId);

        db.collection("clientes")
          .doc(receb.clienteId)
          .get()
          .then((clienteDoc) => {
            if (clienteDoc.exists) {
              const cliente = clienteDoc.data();
              const dataAtrasada = new Date(receb.vencimento);
              const dataHoje = new Date();
              const diasAtraso = Math.floor((dataHoje - dataAtrasada) / (1000 * 60 * 60 * 24));

              tabela.innerHTML += `
                <tr>
                  <td>${cliente.nome}</td>
                  <td>R$ ${receb.valor.toFixed(2)}</td>
                  <td>${receb.vencimento}</td>
                  <td>${diasAtraso} dias</td>
                  <td>${cliente.telefone}</td>
                  <td>
                    <button onclick="enviarWhatsAppInadimplente('${cliente.nome}', '${receb.valor}', '${receb.vencimento}', '${cliente.telefone}')" style="background: #25D366; margin-right: 5px;">
                      <i class="fab fa-whatsapp"></i>
                    </button>
                    <button onclick="marcarComoPago('${doc.id}')">
                      <i class="fas fa-check"></i> Marcar Pago
                    </button>
                  </td>
                </tr>
              `;

              receitasAtraso.push({
                clienteNome: cliente.nome,
                valor: receb.valor,
                vencimento: receb.vencimento,
                diasAtraso: diasAtraso,
                tipo: 'Manual',
                id: doc.id,
                telefone: cliente.telefone
              });
            }
            processados++;
            if (processados >= totalProcessar) {
              dadosCarregados++;
              if (dadosCarregados >= totalEsperado) atualizarIndicadores();
            }
          })
          .catch(() => {
            processados++;
            if (processados >= totalProcessar) {
              dadosCarregados++;
              if (dadosCarregados >= totalEsperado) atualizarIndicadores();
            }
          });
      });
    }, (erro) => {
      console.error("Erro ao carregar inadimplentes:", erro);
      dadosCarregados++;
      if (dadosCarregados >= totalEsperado) atualizarIndicadores();
    });
}

function atualizarTabelaReceitaAtraso(receitasAtraso) {
  const tabela = document.getElementById("listaReceitaAtraso");
  if (!tabela) return;

  if (receitasAtraso.length === 0) {
    tabela.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; color: var(--text-muted);">
          Nenhum registro em atraso
        </td>
      </tr>
    `;
    return;
  }

  tabela.innerHTML = "";
  receitasAtraso.sort((a, b) => b.diasAtraso - a.diasAtraso);

  receitasAtraso.forEach((receita) => {
    const telefoneFormatado = receita.telefone ? receita.telefone.replace(/\D/g, '') : '';
    const whatsappLink = telefoneFormatado ? `https://wa.me/55${telefoneFormatado}` : '#';

    tabela.innerHTML += `
      <tr>
        <td>${receita.clienteNome}</td>
        <td>R$ ${receita.valor.toFixed(2)}</td>
        <td>${receita.vencimento}</td>
        <td><span style="color: var(--danger); font-weight: 600;">${receita.diasAtraso} dias</span></td>
        <td>
          <a href="${whatsappLink}" target="_blank" class="btn-premium" style="padding: 6px 12px; font-size: 12px; text-decoration: none; display: inline-block;">
            <i class="fab fa-whatsapp"></i> WhatsApp
          </a>
        </td>
        <td>
          <button class="btn-premium" onclick="enviarCobranca('${receita.clienteNome}', '${receita.valor}', '${receita.vencimento}', '${receita.diasAtraso}')" style="padding: 6px 12px; font-size: 12px;">
            <i class="fas fa-envelope"></i> Cobrar
          </button>
        </td>
      </tr>
    `;
  });
}

function enviarCobranca(clienteNome, valor, vencimento, diasAtraso) {
  const mensagem = `Olá ${clienteNome},\n\nGostaríamos de lembrar que você tem uma cobrança de R$ ${Number(valor).toFixed(2)} em atraso há ${diasAtraso} dias (vencimento: ${vencimento}).\n\nPor favor, entre em contato para regularizar sua situação.\n\nObrigado!`;

  navigator.clipboard.writeText(mensagem).then(() => {
    alert("Mensagem de cobrança copiada para a área de transferência!\n\nCole no WhatsApp para enviar.");
  }).catch((erro) => {
    console.error("Erro ao copiar mensagem:", erro);
    alert("Erro ao copiar mensagem. Tente novamente.");
  });
}

function marcarComoPago(id) {
  db.collection("recebimentos")
    .doc(id)
    .update(secureUpdate({ status: "Pago" }))
    .then(() => {
      alert("Marcado como pago!");
      carregarInadimplentes();
      carregarFinanceiro();
    })
    .catch((erro) => {
      alert("Erro: " + erro.message);
    });
}

// ===========================
// MODALS FUNCTIONS
// ===========================

function mostrarAbaFinanceira(aba) {
  document.querySelectorAll(".abaFinanceira").forEach(abaf => {
    abaf.style.display = "none";
    abaf.classList.remove("ativa");
  });

  const abaElement = document.getElementById(aba);
  if (abaElement) {
    abaElement.style.display = "block";
    abaElement.classList.add("ativa");
  }

  document.querySelectorAll(".tabBtn").forEach(btn => {
    btn.classList.remove("active");
    if (btn.getAttribute("onclick") && btn.getAttribute("onclick").includes(aba)) {
      btn.classList.add("active");
    }
  });

  if (aba === "fluxo-caixa") {
    atualizarFluxoCaixa();
  }
}

// ===========================
// LOGOUT & AUTH - UNIFIED LISTENER
// ===========================

function logout() {
  auth.signOut()
    .then(() => {
      location.reload();
    })
    .catch((erro) => {
      alert(erro.message);
    });
}

// ===========================
// WHATSAPP MODULE
// ===========================

let clientesWhatsApp = [];
let clientesSelecionadosWhatsApp = new Set();
let configuracoesWhatsApp = {
  templates: {},
  nomeEmpresa: "Sua Empresa",
  apiProvider: "",
  apiKey: "",
  apiUrl: ""
};

let usuarioEditando = null;

// ===========================
// WHATSAPP TAB NAVIGATION
// ===========================

function mostrarAbaWhatsApp(aba) {
  document.querySelectorAll(".abaWhatsApp").forEach(abaw => {
    abaw.style.display = "none";
    abaw.classList.remove("ativa");
  });

  const abaElement = document.getElementById("whatsapp-" + aba);
  if (abaElement) {
    abaElement.style.display = "block";
    abaElement.classList.add("ativa");
  }

  document.querySelectorAll(".whatsappTabBtn").forEach(btn => {
    btn.classList.remove("active");
    if (btn.getAttribute("onclick") && btn.getAttribute("onclick").includes(aba)) {
      btn.classList.add("active");
    }
  });

  if (aba === "cobrancas") {
    identificarCobrancasPendentes();
  }
}

// ===========================
// WHATSAPP CLIENT LOADING
// ===========================

function carregarClientesWhatsApp() {
  if (clientesWhatsAppListener) clientesWhatsAppListener();

  clientesWhatsAppListener = db.collection("clientes")
    .where("tenantId", "==", getTenantId())
    .orderBy("nome")
    .onSnapshot((snapshot) => {
      clientesWhatsApp = [];
      const tabela = document.getElementById("listaClientesWhatsApp");
      const selectIndividual = document.getElementById("wa_cliente_individual");
      if (!tabela || !selectIndividual) return;

      tabela.innerHTML = "";
      selectIndividual.innerHTML = '<option value="">Selecione um cliente</option>';

      snapshot.forEach((doc) => {
        const cliente = doc.data();
        cliente.id = doc.id;
        clientesWhatsApp.push(cliente);

        const option = document.createElement("option");
        option.value = doc.id;
        option.textContent = cliente.nome;
        selectIndividual.appendChild(option);

        tabela.innerHTML += `
          <tr data-cliente-id="${doc.id}">
            <td><input type="checkbox" class="wa-cliente-checkbox" value="${doc.id}"></td>
            <td>${cliente.nome || ""}</td>
            <td>${cliente.telefone || ""}</td>
            <td>${cliente.status || ""}</td>
            <td>${cliente.plano || ""}</td>
            <td>${cliente.vencimento || ""}</td>
            <td>R$ ${Number(cliente.valor || 0).toFixed(2)}</td>
          </tr>
        `;
      });

      filtrarClientesWhatsApp();
    }, (erro) => {
      console.error("Erro ao carregar clientes WhatsApp:", erro);
    });
}

// ===========================
// WHATSAPP FILTERS
// ===========================

function filtrarClientesWhatsApp() {
  const filtroStatus = document.getElementById("wa_filtro_status").value;
  const filtroVencimento = document.getElementById("wa_filtro_vencimento").value;
  const filtroNome = document.getElementById("wa_filtro_nome").value.toLowerCase();

  const linhas = document.querySelectorAll("#listaClientesWhatsApp tr");
  linhas.forEach((linha) => {
    const clienteId = linha.getAttribute("data-cliente-id");
    const cliente = clientesWhatsApp.find(c => c.id === clienteId);
    if (!cliente) return;

    let mostrar = true;

    if (filtroStatus && cliente.status !== filtroStatus) mostrar = false;
    if (filtroNome && !cliente.nome.toLowerCase().includes(filtroNome)) mostrar = false;

    if (filtroVencimento) {
      const dataAtual = new Date();
      const diaVencimento = parseInt(cliente.vencimento);

      if (filtroVencimento === "hoje") {
        if (dataAtual.getDate() !== diaVencimento) mostrar = false;
      } else if (filtroVencimento === "3dias") {
        const diasAteVencimento = diaVencimento - dataAtual.getDate();
        if (diasAteVencimento < 0 || diasAteVencimento > 3) mostrar = false;
      } else if (filtroVencimento === "7dias") {
        const diasAteVencimento = diaVencimento - dataAtual.getDate();
        if (diasAteVencimento < 0 || diasAteVencimento > 7) mostrar = false;
      } else if (filtroVencimento === "atrasado") {
        const diasAteVencimento = diaVencimento - dataAtual.getDate();
        if (diasAteVencimento >= 0) mostrar = false;
      }
    }

    linha.style.display = mostrar ? "" : "none";
  });
}

// ===========================
// WHATSAPP SELECTION
// ===========================

function toggleSelectAllWhatsApp() {
  const selectAll = document.getElementById("wa_select_all").checked;
  const checkboxes = document.querySelectorAll(".wa-cliente-checkbox");

  checkboxes.forEach((checkbox) => {
    checkbox.checked = selectAll;
    if (selectAll) {
      clientesSelecionadosWhatsApp.add(checkbox.value);
    } else {
      clientesSelecionadosWhatsApp.delete(checkbox.value);
    }
  });
}

function selecionarTodosWhatsApp() {
  const checkboxes = document.querySelectorAll(".wa-cliente-checkbox");
  checkboxes.forEach((checkbox) => {
    checkbox.checked = true;
    clientesSelecionadosWhatsApp.add(checkbox.value);
  });
  const selectAllEl = document.getElementById("wa_select_all");
  if (selectAllEl) selectAllEl.checked = true;
}

// ===========================
// WHATSAPP TEMPLATES
// ===========================

function carregarTemplate(tipo) {
  const templateId = "wa_template_" + tipo;
  const textarea = document.getElementById(templateId);
  if (textarea && configuracoesWhatsApp.templates[tipo]) {
    textarea.value = configuracoesWhatsApp.templates[tipo];
  }
}

function salvarTemplate(tipo) {
  const templateId = "wa_template_" + tipo;
  const textarea = document.getElementById(templateId);
  if (textarea) {
    configuracoesWhatsApp.templates[tipo] = textarea.value;
    db.collection("configuracoes")
      .doc("whatsapp")
      .set({
        templates: configuracoesWhatsApp.templates,
        updatedAt: new Date()
      }, { merge: true })
      .then(() => alert("Modelo salvo com sucesso!"))
      .catch((erro) => alert("Erro ao salvar modelo: " + erro.message));
  }
}

function salvarNomeEmpresa() {
  const nomeEmpresa = document.getElementById("wa_nome_empresa").value;
  configuracoesWhatsApp.nomeEmpresa = nomeEmpresa;
  db.collection("configuracoes")
    .doc("whatsapp")
    .set({ nomeEmpresa: nomeEmpresa, updatedAt: new Date() }, { merge: true })
    .then(() => alert("Nome da empresa salvo com sucesso!"))
    .catch((erro) => alert("Erro ao salvar nome: " + erro.message));
}

function salvarConfiguracaoAPI() {
  const apiProvider = document.getElementById("wa_api_provider").value;
  const apiKey = document.getElementById("wa_api_key").value;
  const apiUrl = document.getElementById("wa_api_url").value;

  configuracoesWhatsApp.apiProvider = apiProvider;
  configuracoesWhatsApp.apiKey = apiKey;
  configuracoesWhatsApp.apiUrl = apiUrl;

  db.collection("configuracoes")
    .doc("whatsapp")
    .set({ apiProvider, apiKey, apiUrl, updatedAt: new Date() }, { merge: true })
    .then(() => alert("Configuração de API salva com sucesso!"))
    .catch((erro) => alert("Erro ao salvar configuração: " + erro.message));
}

// ===========================
// WHATSAPP MESSAGE VARIABLES
// ===========================

function substituirVariaveis(mensagem, cliente, valor, vencimento) {
  let mensagemProcessada = mensagem;
  mensagemProcessada = mensagemProcessada.replace(/{nome_cliente}/g, cliente.nome || "");
  mensagemProcessada = mensagemProcessada.replace(/{valor}/g, "R$ " + Number(valor || 0).toFixed(2));
  mensagemProcessada = mensagemProcessada.replace(/{vencimento}/g, vencimento || "");
  mensagemProcessada = mensagemProcessada.replace(/{plano}/g, cliente.plano || "");
  mensagemProcessada = mensagemProcessada.replace(/{empresa}/g, configuracoesWhatsApp.nomeEmpresa || "Sua Empresa");
  mensagemProcessada = mensagemProcessada.replace(/{telefone}/g, cliente.telefone || "");
  return mensagemProcessada;
}

function carregarTemplateNaTextarea(tipo, textareaId) {
  let template = "";
  const tipos = ["aviso_vencimento", "cobranca_vencimento", "cobranca_atraso", "cobranca_amigavel"];
  if (tipos.includes(tipo) && configuracoesWhatsApp.templates[tipo]) {
    template = configuracoesWhatsApp.templates[tipo];
  }
  if (template) {
    const ta = document.getElementById(textareaId);
    if (ta) ta.value = template;
  }
}

// ===========================
// WHATSAPP INDIVIDUAL MESSAGE
// ===========================

function enviarMensagemIndividual() {
  const clienteId = document.getElementById("wa_cliente_individual").value;
  const templateTipo = document.getElementById("wa_template_individual").value;
  const mensagemCustomizada = document.getElementById("wa_mensagem_individual").value;

  if (!clienteId) { alert("Selecione um cliente!"); return; }
  const cliente = clientesWhatsApp.find(c => c.id === clienteId);
  if (!cliente) { alert("Cliente não encontrado!"); return; }
  if (!cliente.telefone) { alert("Cliente não possui telefone cadastrado!"); return; }

  let mensagem = "";
  let tipoMensagem = templateTipo === "personalizado" ? "personalizado" : templateTipo;

  if (templateTipo === "personalizado") {
    mensagem = mensagemCustomizada;
  } else {
    const template = configuracoesWhatsApp.templates[templateTipo] || "";
    const vencimento = formatarDataVencimento(cliente.vencimento);
    mensagem = substituirVariaveis(template, cliente, cliente.valor, vencimento);
  }

  if (!mensagem) { alert("Digite uma mensagem ou selecione um modelo!"); return; }

  const telefoneFormatado = formatarTelefoneWhatsApp(cliente.telefone);
  const mensagemCodificada = encodeURIComponent(mensagem);
  const whatsappURL = `https://wa.me/${telefoneFormatado}?text=${mensagemCodificada}`;

  salvarHistoricoWhatsApp(cliente, mensagem, tipoMensagem, "Enviado");
  window.open(whatsappURL, "_blank");
}

// ===========================
// WHATSAPP BULK MESSAGE
// ===========================

function enviarMensagemMassa() {
  const templateTipo = document.getElementById("wa_template_massa").value;
  const mensagemCustomizada = document.getElementById("wa_mensagem_massa").value;

  if (clientesSelecionadosWhatsApp.size === 0) { alert("Selecione pelo menos um cliente!"); return; }

  let tipoMensagem = templateTipo === "personalizado" ? "personalizado" : templateTipo;
  let templateBase = "";
  if (templateTipo === "personalizado") {
    templateBase = mensagemCustomizada;
  } else {
    templateBase = configuracoesWhatsApp.templates[templateTipo] || "";
  }
  if (!templateBase) { alert("Digite uma mensagem ou selecione um modelo!"); return; }

  let contador = 0;
  clientesSelecionadosWhatsApp.forEach((clienteId) => {
    const cliente = clientesWhatsApp.find(c => c.id === clienteId);
    if (cliente && cliente.telefone) {
      const vencimento = formatarDataVencimento(cliente.vencimento);
      const mensagem = substituirVariaveis(templateBase, cliente, cliente.valor, vencimento);
      salvarHistoricoWhatsApp(cliente, mensagem, tipoMensagem, "Enviado");
      contador++;
    }
  });

  alert(`${contador} mensagens preparadas! O WhatsApp será aberto para cada cliente.`);

  clientesSelecionadosWhatsApp.forEach((clienteId) => {
    const cliente = clientesWhatsApp.find(c => c.id === clienteId);
    if (cliente && cliente.telefone) {
      const vencimento = formatarDataVencimento(cliente.vencimento);
      const mensagem = substituirVariaveis(templateBase, cliente, cliente.valor, vencimento);
      const telefoneFormatado = formatarTelefoneWhatsApp(cliente.telefone);
      const mensagemCodificada = encodeURIComponent(mensagem);
      const whatsappURL = `https://wa.me/${telefoneFormatado}?text=${mensagemCodificada}`;
      setTimeout(() => { window.open(whatsappURL, "_blank"); }, contador * 1000);
    }
  });

  clientesSelecionadosWhatsApp.clear();
  document.querySelectorAll(".wa-cliente-checkbox").forEach(cb => cb.checked = false);
  const selectAllEl = document.getElementById("wa_select_all");
  if (selectAllEl) selectAllEl.checked = false;
}

// ===========================
// WHATSAPP AUTOMATIC BILLING
// ===========================

function identificarCobrancasPendentes() {
  const dataAtual = new Date();
  let vencendoHoje = 0;
  let vencendo3Dias = 0;
  let vencendo7Dias = 0;
  let emAtraso = 0;

  const tabela = document.getElementById("listaCobrancasWhatsApp");
  if (!tabela) return;
  tabela.innerHTML = "";

  if (cobrancasWhatsAppListener) cobrancasWhatsAppListener();

  cobrancasWhatsAppListener = db.collection("mensalidades")
    .where("tenantId", "==", getTenantId())
    .where("status", "==", "Em Aberto")
    .onSnapshot((snapshot) => {
      tabela.innerHTML = "";
      vencendoHoje = 0;
      vencendo3Dias = 0;
      vencendo7Dias = 0;
      emAtraso = 0;

      snapshot.forEach((doc) => {
        const mens = doc.data();
        const dataVencimento = new Date(mens.vencimento);
        const diferencaDias = Math.floor((dataVencimento - dataAtual) / (1000 * 60 * 60 * 24));

        let categoria = "";
        if (diferencaDias === 0) { vencendoHoje++; categoria = "hoje"; }
        else if (diferencaDias > 0 && diferencaDias <= 3) { vencendo3Dias++; categoria = "3dias"; }
        else if (diferencaDias > 0 && diferencaDias <= 7) { vencendo7Dias++; categoria = "7dias"; }
        else if (diferencaDias < 0) { emAtraso++; categoria = "atrasado"; }

        if (categoria) {
          const cliente = clientesWhatsApp.find(c => c.id === mens.clienteId);
          if (cliente) {
            tabela.innerHTML += `
              <tr data-categoria="${categoria}">
                <td>${mens.clienteNome}</td>
                <td>${cliente.telefone || ""}</td>
                <td>R$ ${mens.valor.toFixed(2)}</td>
                <td>${mens.vencimento}</td>
                <td>${diferencaDias} dias</td>
                <td>${categoria}</td>
                <td>
                  <button onclick="enviarCobrancaIndividual('${doc.id}', '${categoria}')">
                    <i class="fab fa-whatsapp"></i> Enviar
                  </button>
                </td>
              </tr>
            `;
          }
        }
      });

      const setText = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.innerText = String(val);
      };
      setText("wa_vencendo_hoje", vencendoHoje);
      setText("wa_vencendo_3dias", vencendo3Dias);
      setText("wa_vencendo_7dias", vencendo7Dias);
      setText("wa_em_atraso", emAtraso);
    }, (erro) => {
      console.error("Erro ao identificar cobranças:", erro);
    });
}

function enviarCobrancaIndividual(mensalidadeId, categoria) {
  db.collection("mensalidades")
    .doc(mensalidadeId)
    .get()
    .then((doc) => {
      const mens = doc.data();
      const cliente = clientesWhatsApp.find(c => c.id === mens.clienteId);
      if (!cliente || !cliente.telefone) { alert("Cliente não encontrado ou sem telefone!"); return; }

      let templateTipo = "";
      if (categoria === "3dias") templateTipo = "aviso_vencimento";
      else if (categoria === "hoje") templateTipo = "cobranca_vencimento";
      else if (categoria === "atrasado") templateTipo = "cobranca_atraso";

      const template = configuracoesWhatsApp.templates[templateTipo] || "";
      const mensagem = substituirVariaveis(template, cliente, mens.valor, mens.vencimento);
      salvarHistoricoWhatsApp(cliente, mensagem, templateTipo, "Enviado");

      const telefoneFormatado = formatarTelefoneWhatsApp(cliente.telefone);
      const mensagemCodificada = encodeURIComponent(mensagem);
      const whatsappURL = `https://wa.me/${telefoneFormatado}?text=${mensagemCodificada}`;
      window.open(whatsappURL, "_blank");
    })
    .catch((erro) => { alert("Erro: " + erro.message); });
}

function enviarAvisoVencimento3Dias() {
  const linhas = document.querySelectorAll("#listaCobrancasWhatsApp tr[data-categoria='3dias']");
  if (linhas.length === 0) { alert("Não há clientes vencendo em 3 dias!"); return; }
  if (!confirm(`Enviar aviso para ${linhas.length} clientes?`)) return;
  linhas.forEach((linha) => {
    const botoes = linha.querySelectorAll("button");
    if (botoes.length > 0) botoes[0].click();
  });
}

function enviarCobrancaHoje() {
  const linhas = document.querySelectorAll("#listaCobrancasWhatsApp tr[data-categoria='hoje']");
  if (linhas.length === 0) { alert("Não há clientes vencendo hoje!"); return; }
  if (!confirm(`Enviar cobrança para ${linhas.length} clientes?`)) return;
  linhas.forEach((linha) => {
    const botoes = linha.querySelectorAll("button");
    if (botoes.length > 0) botoes[0].click();
  });
}

function enviarCobrancaAtraso() {
  const linhas = document.querySelectorAll("#listaCobrancasWhatsApp tr[data-categoria='atrasado']");
  if (linhas.length === 0) { alert("Não há clientes em atraso!"); return; }
  if (!confirm(`Enviar cobrança para ${linhas.length} clientes?`)) return;
  linhas.forEach((linha) => {
    const botoes = linha.querySelectorAll("button");
    if (botoes.length > 0) botoes[0].click();
  });
}

function enviarCobrancaAmigavel() {
  const linhas = document.querySelectorAll("#listaCobrancasWhatsApp tr[data-categoria='atrasado']");
  if (linhas.length === 0) { alert("Não há clientes em atraso!"); return; }
  if (!confirm(`Enviar cobrança amigável para ${linhas.length} clientes?`)) return;
  linhas.forEach((linha) => {
    const clienteNome = linha.cells[0].textContent;
    const cliente = clientesWhatsApp.find(c => c.nome === clienteNome);
    if (cliente && cliente.telefone) {
      const template = configuracoesWhatsApp.templates.cobranca_amigavel || "";
      const vencimento = formatarDataVencimento(cliente.vencimento);
      const mensagem = substituirVariaveis(template, cliente, cliente.valor, vencimento);
      salvarHistoricoWhatsApp(cliente, mensagem, "cobranca_amigavel", "Enviado");
      const telefoneFormatado = formatarTelefoneWhatsApp(cliente.telefone);
      const mensagemCodificada = encodeURIComponent(mensagem);
      const whatsappURL = `https://wa.me/${telefoneFormatado}?text=${mensagemCodificada}`;
      window.open(whatsappURL, "_blank");
    }
  });
}

// ===========================
// WHATSAPP HISTORY
// ===========================

function salvarHistoricoWhatsApp(cliente, mensagem, tipo, status) {
  const dataAtual = new Date();
  const data = dataAtual.toLocaleDateString('pt-BR');
  const hora = dataAtual.toLocaleTimeString('pt-BR');

  db.collection("whatsapp_historico")
    .add(secureData({
      clienteId: cliente.id,
      clienteNome: cliente.nome,
      clienteTelefone: cliente.telefone,
      mensagem: mensagem,
      tipo: tipo,
      status: status,
      data: data,
      hora: hora,
      timestamp: dataAtual
    }))
    .catch((erro) => { console.error("Erro ao salvar histórico:", erro); });
}

function carregarHistoricoWhatsApp() {
  if (historicoWhatsAppListener) historicoWhatsAppListener();

  historicoWhatsAppListener = db.collection("whatsapp_historico")
    .where("tenantId", "==", getTenantId())
    .orderBy("timestamp", "desc")
    .limit(100)
    .onSnapshot((snapshot) => {
      const tabela = document.getElementById("listaHistoricoWhatsApp");
      if (!tabela) return;
      tabela.innerHTML = "";

      snapshot.forEach((doc) => {
        const hist = doc.data();
        const statusLower = (hist.status || "").toLowerCase();
        tabela.innerHTML += `
          <tr>
            <td>${hist.clienteNome}</td>
            <td>${hist.data}</td>
            <td>${hist.hora}</td>
            <td>${hist.tipo}</td>
            <td><span class="status-${statusLower}">${hist.status}</span></td>
            <td>
              <button onclick="verMensagemHistorico('${doc.id}')">
                <i class="fas fa-eye"></i> Ver
              </button>
            </td>
          </tr>
        `;
      });
    }, (erro) => { console.error("Erro ao carregar histórico:", erro); });
}

function filtrarHistoricoWhatsApp() {
  const busca = document.getElementById("wa_busca_historico").value.toLowerCase();
  const tipo = document.getElementById("wa_filtro_tipo_historico").value;
  const status = document.getElementById("wa_filtro_status_historico").value;

  const linhas = document.querySelectorAll("#listaHistoricoWhatsApp tr");
  linhas.forEach((linha) => {
    if (linha.cells.length < 5) return;
    const cliente = linha.cells[0].textContent.toLowerCase();
    const tipoLinha = linha.cells[3].textContent;
    const statusLinha = linha.cells[4].textContent.toLowerCase();
    const matchBusca = cliente.includes(busca);
    const matchTipo = tipo === "" || tipoLinha === tipo;
    const matchStatus = status === "" || statusLinha.includes(status.toLowerCase());
    linha.style.display = matchBusca && matchTipo && matchStatus ? "" : "none";
  });
}

function verMensagemHistorico(historicoId) {
  db.collection("whatsapp_historico")
    .doc(historicoId)
    .get()
    .then((doc) => {
      if (doc.exists) {
        const hist = doc.data();
        alert(`Mensagem enviada para ${hist.clienteNome}:\n\n${hist.mensagem}`);
      }
    })
    .catch((erro) => { alert("Erro: " + erro.message); });
}

function limparHistoricoWhatsApp() {
  if (!confirm("Deseja limpar todo o histórico de mensagens?")) return;

  db.collection("whatsapp_historico")
    .where("tenantId", "==", getTenantId())
    .get()
    .then((snapshot) => {
      const batch = db.batch();
      snapshot.forEach((doc) => { batch.delete(doc.ref); });
      return batch.commit();
    })
    .then(() => { alert("Histórico limpo com sucesso!"); })
    .catch((erro) => { alert("Erro: " + erro.message); });
}

// ===========================
// WHATSAPP CONFIGURATIONS
// ===========================

function carregarConfiguracoesWhatsApp() {
  db.collection("configuracoes")
    .doc("whatsapp")
    .get()
    .then((doc) => {
      if (!doc.exists) return;
      const config = doc.data();

      if (config.templates) {
        configuracoesWhatsApp.templates = config.templates;
        Object.keys(config.templates).forEach((tipo) => {
          const textarea = document.getElementById("wa_template_" + tipo);
          if (textarea) textarea.value = config.templates[tipo];
        });
      }
      if (config.nomeEmpresa) {
        configuracoesWhatsApp.nomeEmpresa = config.nomeEmpresa;
        const el = document.getElementById("wa_nome_empresa");
        if (el) el.value = config.nomeEmpresa;
      }
      if (config.apiProvider) {
        configuracoesWhatsApp.apiProvider = config.apiProvider;
        const el = document.getElementById("wa_api_provider");
        if (el) el.value = config.apiProvider;
      }
      if (config.apiKey) {
        configuracoesWhatsApp.apiKey = config.apiKey;
        const el = document.getElementById("wa_api_key");
        if (el) el.value = config.apiKey;
      }
      if (config.apiUrl) {
        configuracoesWhatsApp.apiUrl = config.apiUrl;
        const el = document.getElementById("wa_api_url");
        if (el) el.value = config.apiUrl;
      }
    })
    .catch((erro) => { console.error("Erro ao carregar configurações:", erro); });
}

// ===========================
// WHATSAPP HELPER FUNCTIONS
// ===========================

function formatarTelefoneWhatsApp(telefone) {
  let telefoneLimpo = telefone.replace(/\D/g, '');
  if (telefoneLimpo.startsWith('55') && telefoneLimpo.length === 12) {
    telefoneLimpo = telefoneLimpo.substring(2);
  }
  return '55' + telefoneLimpo;
}

function formatarDataVencimento(diaVencimento) {
  const dataAtual = new Date();
  const dia = parseInt(diaVencimento);
  dataAtual.setDate(dia);
  return dataAtual.toLocaleDateString('pt-BR');
}

// Template change handlers
document.addEventListener("DOMContentLoaded", () => {
  const templateIndividual = document.getElementById("wa_template_individual");
  const templateMassa = document.getElementById("wa_template_massa");

  if (templateIndividual) {
    templateIndividual.addEventListener("change", function () {
      if (this.value !== "personalizado") {
        carregarTemplateNaTextarea(this.value, "wa_mensagem_individual");
      }
    });
  }

  if (templateMassa) {
    templateMassa.addEventListener("change", function () {
      if (this.value !== "personalizado") {
        carregarTemplateNaTextarea(this.value, "wa_mensagem_massa");
      }
    });
  }
});

// ===========================
// ADMIN MODULE
// ===========================

// ===========================
// ADMIN TAB NAVIGATION
// ===========================

function mostrarAbaAdmin(aba) {
  if (!isMasterAdmin()) {
    alert('Acesso negado: painel administrativo disponível somente para MASTER_ADMIN.');
    return;
  }

  document.querySelectorAll(".abaAdmin").forEach(abaa => {
    abaa.style.display = "none";
    abaa.classList.remove("ativa");
  });

  const abaElement = document.getElementById("admin-" + aba);
  if (!abaElement) {
    console.warn(`Aba administrativa inválida: ${aba}`);
    return;
  }

  abaElement.style.display = "block";
  abaElement.classList.add("ativa");

  document.querySelectorAll(".adminTabBtn").forEach(btn => {
    btn.classList.remove("active");
    if (btn.getAttribute("onclick") && btn.getAttribute("onclick").includes(aba)) {
      btn.classList.add("active");
    }
  });

  if (aba === "dashboard") {
    carregarDashboardAdmin();
  } else if (aba === "usuarios") {
    carregarUsuariosAdmin();
  }
}

// ===========================
// ADMIN USER DATA LOADING
// ===========================

async function carregarDadosUsuario(uid) {
  try {
    const doc = await db.collection("usuarios").doc(uid).get();
    if (doc.exists) {
      return doc.data();
    } else {
      const dadosBasicos = {
        uid: uid,
        nome: "",
        email: auth.currentUser.email,
        role: "cliente",
        status: "Ativo",
        plano: "Básico",
        criadoEm: new Date()
      };
      await db.collection("usuarios").doc(uid).set(dadosBasicos);
      return dadosBasicos;
    }
  } catch (erro) {
    console.error("Erro ao carregar dados do usuário:", erro);
    return { uid, email: auth.currentUser.email, role: "cliente", status: "Ativo" };
  }
}

// ===========================
// ADMIN DASHBOARD
// ===========================

function carregarDashboardAdmin() {
  if (adminDashboardListener) adminDashboardListener();

  adminDashboardListener = db.collection("usuarios")
    .onSnapshot((snapshot) => {
      let totalUsuarios = 0;
      let usuariosAtivos = 0;
      let usuariosBloqueados = 0;
      let receitaMensal = 0;
      let novosCadastros = 0;

      const dataAtual = new Date();
      const mesAtual = dataAtual.getMonth();
      const anoAtual = dataAtual.getFullYear();

      const tabelaUltimos = document.getElementById("listaUltimosUsuarios");
      if (!tabelaUltimos) return;
      tabelaUltimos.innerHTML = "";

      const todosUsuarios = [];
      snapshot.forEach((doc) => {
        const usuario = doc.data();
        usuario._id = doc.id;
        todosUsuarios.push(usuario);
        totalUsuarios++;

        if (usuario.status === "Ativo") usuariosAtivos++;
        else if (usuario.status === "Bloqueado") usuariosBloqueados++;

        const valorPlano = configuracoesSistema.planos[usuario.plano] || 0;
        receitaMensal += valorPlano;

        if (usuario.criadoEm) {
          const dataCadastro = usuario.criadoEm.toDate ? usuario.criadoEm.toDate() : new Date(usuario.criadoEm);
          if (dataCadastro.getMonth() === mesAtual && dataCadastro.getFullYear() === anoAtual) {
            novosCadastros++;
          }
        }
      });

      const setText = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.innerText = String(val);
      };
      setText("admin_total_usuarios", totalUsuarios);
      setText("admin_usuarios_ativos", usuariosAtivos);
      setText("admin_usuarios_bloqueados", usuariosBloqueados);
      setText("admin_receita_mensal", "R$ " + receitaMensal.toFixed(2));
      setText("admin_novos_cadastros", novosCadastros);

      // Últimos 5 usuários
      todosUsuarios.slice(-5).reverse().forEach((usuario) => {
        const dataCriacao = usuario.criadoEm
          ? new Date(usuario.criadoEm.toDate ? usuario.criadoEm.toDate() : usuario.criadoEm).toLocaleDateString('pt-BR')
          : "";
        const statusLower = (usuario.status || "").toLowerCase();
        tabelaUltimos.innerHTML += `
          <tr>
            <td>${usuario.nome || ""}</td>
            <td>${usuario.empresa || ""}</td>
            <td>${usuario.email || ""}</td>
            <td>${usuario.plano || ""}</td>
            <td><span class="status-${statusLower}">${usuario.status}</span></td>
            <td>${dataCriacao}</td>
          </tr>
        `;
      });
    }, (erro) => { console.error("Erro ao carregar dashboard admin:", erro); });
}

// ===========================
// ADMIN USER MANAGEMENT
// ===========================

function carregarUsuariosAdmin() {
  if (adminUsuariosListener) adminUsuariosListener();

  adminUsuariosListener = db.collection("usuarios")
    .orderBy("criadoEm", "desc")
    .onSnapshot((snapshot) => {
      const tabela = document.getElementById("listaUsuariosAdmin");
      if (!tabela) return;
      tabela.innerHTML = "";

      snapshot.forEach((doc) => {
        const usuario = doc.data();
        const dataCriacao = usuario.criadoEm
          ? new Date(usuario.criadoEm.toDate ? usuario.criadoEm.toDate() : usuario.criadoEm).toLocaleDateString('pt-BR')
          : "";
        const statusLower = (usuario.status || "").toLowerCase();

        tabela.innerHTML += `
          <tr>
            <td>${usuario.nome || ""}</td>
            <td>${usuario.empresa || ""}</td>
            <td>${usuario.email || ""}</td>
            <td>${usuario.telefone || ""}</td>
            <td>${usuario.plano || ""}</td>
            <td><span class="status-${statusLower}">${usuario.status}</span></td>
            <td>${usuario.role || "cliente"}</td>
            <td>${dataCriacao}</td>
            <td>
              <button onclick="editarUsuario('${doc.id}')" title="Editar"><i class="fas fa-pencil"></i></button>
              <button onclick="redefinirSenhaUsuario('${doc.id}')" title="Redefinir Senha"><i class="fas fa-key"></i></button>
              ${usuario.status === "Ativo"
                ? `<button onclick="bloquearUsuario('${doc.id}')" title="Bloquear"><i class="fas fa-lock"></i></button>`
                : `<button onclick="ativarUsuario('${doc.id}')" title="Ativar"><i class="fas fa-unlock"></i></button>`
              }
              <button onclick="excluirUsuario('${doc.id}')" title="Excluir"><i class="fas fa-trash"></i></button>
            </td>
          </tr>
        `;
      });
    }, (erro) => { console.error("Erro ao carregar usuários admin:", erro); });
}

function filtrarUsuarios() {
  const busca = document.getElementById("admin_busca_usuario").value.toLowerCase();
  const status = document.getElementById("admin_filtro_status").value;
  const plano = document.getElementById("admin_filtro_plano").value;

  const linhas = document.querySelectorAll("#listaUsuariosAdmin tr");
  linhas.forEach((linha) => {
    if (linha.cells.length < 8) return;
    const nome = linha.cells[0].textContent.toLowerCase();
    const empresa = linha.cells[1].textContent.toLowerCase();
    const email = linha.cells[2].textContent.toLowerCase();
    const statusLinha = linha.cells[5].textContent;
    const planoLinha = linha.cells[4].textContent;

    const matchBusca = nome.includes(busca) || empresa.includes(busca) || email.includes(busca);
    const matchStatus = status === "" || statusLinha.includes(status);
    const matchPlano = plano === "" || planoLinha === plano;

    linha.style.display = matchBusca && matchStatus && matchPlano ? "" : "none";
  });
}

// ===========================
// ADMIN USER MODAL
// ===========================

function abrirModalUsuario() {
  const modal = document.getElementById("modalUsuario");
  if (modal) modal.style.display = "flex";
  const titulo = document.getElementById("modalUsuarioTitulo");
  if (titulo) titulo.innerText = "Novo Usuário";
  limparFormularioUsuario();
  usuarioEditando = null;
}

function fecharModalUsuario() {
  const modal = document.getElementById("modalUsuario");
  if (modal) modal.style.display = "none";
  limparFormularioUsuario();
  usuarioEditando = null;
}

function limparFormularioUsuario() {
  document.getElementById("admin_usuario_id").value = "";
  document.getElementById("admin_usuario_nome").value = "";
  document.getElementById("admin_usuario_empresa").value = "";
  document.getElementById("admin_usuario_email").value = "";
  document.getElementById("admin_usuario_telefone").value = "";
  const plano = document.getElementById("admin_usuario_plano");
  if (plano) plano.selectedIndex = 0;
  const role = document.getElementById("admin_usuario_role");
  if (role) role.selectedIndex = 0;
  const status = document.getElementById("admin_usuario_status");
  if (status) status.selectedIndex = 0;
}

async function salvarUsuario() {
  if (!isMasterAdmin()) { alert("Ação reservada para MASTER_ADMIN."); return; }

  const id = document.getElementById("admin_usuario_id").value;
  const nome = document.getElementById("admin_usuario_nome").value;
  const empresa = document.getElementById("admin_usuario_empresa").value;
  const email = document.getElementById("admin_usuario_email").value;
  const telefone = document.getElementById("admin_usuario_telefone").value;
  const plano = document.getElementById("admin_usuario_plano").value;
  const status = document.getElementById("admin_usuario_status").value;

  if (!nome || !email) { alert("Preencha pelo menos: Nome e E-mail!"); return; }

  try {
    if (id) {
      await db.collection("usuarios").doc(id).update(secureUpdate({ nome, empresa, telefone, plano, status }));
      alert("Usuário atualizado com sucesso!");
    } else {
      const createProvider = functions.httpsCallable('createProvider');
      const response = await createProvider({ email, nome, empresa, telefone, plano, status });
      alert(`Usuário criado com sucesso!\nE-mail: ${email}\nSenha temporária: ${response.data.senha}`);
    }
    fecharModalUsuario();
    carregarUsuariosAdmin();
    carregarDashboardAdmin();
  } catch (erro) {
    alert("Erro: " + (erro.message || erro));
  }
}

async function editarUsuario(id) {
  try {
    const doc = await db.collection("usuarios").doc(id).get();
    if (!doc.exists) { alert("Usuário não encontrado!"); return; }
    const usuario = doc.data();

    usuarioEditando = id;
    const modal = document.getElementById("modalUsuario");
    if (modal) modal.style.display = "flex";
    const titulo = document.getElementById("modalUsuarioTitulo");
    if (titulo) titulo.innerText = "Editar Usuário";

    document.getElementById("admin_usuario_id").value = id;
    document.getElementById("admin_usuario_nome").value = usuario.nome || "";
    document.getElementById("admin_usuario_empresa").value = usuario.empresa || "";
    document.getElementById("admin_usuario_email").value = usuario.email || "";
    document.getElementById("admin_usuario_telefone").value = usuario.telefone || "";
    if (document.getElementById("admin_usuario_plano")) document.getElementById("admin_usuario_plano").value = usuario.plano || "";
    if (document.getElementById("admin_usuario_role")) document.getElementById("admin_usuario_role").value = usuario.role || "cliente";
    if (document.getElementById("admin_usuario_status")) document.getElementById("admin_usuario_status").value = usuario.status || "";
  } catch (erro) { alert("Erro: " + erro.message); }
}

async function bloquearUsuario(id) {
  if (!isMasterAdmin()) { alert("Ação reservada para MASTER_ADMIN."); return; }
  if (!confirm("Deseja bloquear este usuário?")) return;
  try {
    const updateUserStatus = functions.httpsCallable('updateUserStatus');
    await updateUserStatus({ uid: id, status: "Bloqueado" });
    alert("Usuário bloqueado com sucesso!");
    carregarUsuariosAdmin();
    carregarDashboardAdmin();
  } catch (erro) { alert("Erro: " + (erro.message || erro)); }
}

async function ativarUsuario(id) {
  if (!isMasterAdmin()) { alert("Ação reservada para MASTER_ADMIN."); return; }
  if (!confirm("Deseja ativar este usuário?")) return;
  try {
    const updateUserStatus = functions.httpsCallable('updateUserStatus');
    await updateUserStatus({ uid: id, status: "Ativo" });
    alert("Usuário ativado com sucesso!");
    carregarUsuariosAdmin();
    carregarDashboardAdmin();
  } catch (erro) { alert("Erro: " + (erro.message || erro)); }
}

async function excluirUsuario(id) {
  if (!isMasterAdmin()) { alert("Ação reservada para MASTER_ADMIN."); return; }
  if (!confirm("Deseja excluir este usuário? Esta ação não pode ser desfeita.")) return;
  try {
    const deleteUserAccount = functions.httpsCallable('deleteUserAccount');
    await deleteUserAccount({ uid: id });
    alert("Usuário excluído com sucesso!");
    carregarUsuariosAdmin();
    carregarDashboardAdmin();
  } catch (erro) { alert("Erro: " + (erro.message || erro)); }
}

async function redefinirSenhaUsuario(id) {
  if (!isMasterAdmin()) { alert("Ação reservada para MASTER_ADMIN."); return; }
  try {
    const doc = await db.collection("usuarios").doc(id).get();
    if (!doc.exists) { alert("Usuário não encontrado!"); return; }
    const usuario = doc.data();
    if (!confirm(`Deseja gerar link de redefinição de senha para ${usuario.email}?`)) return;
    const sendPasswordReset = functions.httpsCallable('sendPasswordReset');
    const response = await sendPasswordReset({ email: usuario.email });
    alert(`Link de redefinição gerado. Envie este link para o usuário:\n${response.data.link}`);
  } catch (erro) { alert("Erro: " + (erro.message || erro)); }
}

// ===========================
// DIAGNÓSTICO DE DADOS
// ===========================

async function diagnosticarDados() {
  if (!auth.currentUser) { alert("Você precisa estar logado para executar o diagnóstico."); return; }
  if (!usuarioAtual.tenantId) { alert("Tenant ID não encontrado. Faça login novamente."); return; }

  const uid = auth.currentUser.uid;
  console.log("=== DIAGNÓSTICO DE DADOS ===");
  console.log("Usuário atual UID:", uid);
  console.log("Usuário atual Email:", auth.currentUser.email);
  console.log("Usuário atual Role:", usuarioAtual.role);
  console.log("Usuário atual Tenant ID:", usuarioAtual.tenantId);

  try {
    const results = await Promise.all([
      db.collection("clientes").where("tenantId", "==", getTenantId()).get(),
      db.collection("planos").where("tenantId", "==", getTenantId()).get(),
      db.collection("recebimentos").where("tenantId", "==", getTenantId()).get(),
      db.collection("despesas").where("tenantId", "==", getTenantId()).get(),
      db.collection("mensalidades").where("tenantId", "==", getTenantId()).get(),
      db.collection("whatsapp_historico").where("tenantId", "==", getTenantId()).get()
    ]);

    const mensagem =
      "=== DIAGNÓSTICO DE DADOS ===\n\n" +
      `Usuário UID: ${uid}\n` +
      `Usuário Email: ${auth.currentUser.email}\n` +
      `Usuário Role: ${usuarioAtual.role}\n` +
      `Tenant ID: ${usuarioAtual.tenantId}\n\n` +
      `Clientes no tenant: ${results[0].size}\n` +
      `Planos no tenant: ${results[1].size}\n` +
      `Recebimentos no tenant: ${results[2].size}\n` +
      `Despesas no tenant: ${results[3].size}\n` +
      `Mensalidades no tenant: ${results[4].size}\n` +
      `Histórico WhatsApp no tenant: ${results[5].size}\n\n` +
      "Verifique o console do navegador (F12) para mais detalhes.";

    alert(mensagem);
  } catch (erro) {
    console.error("Erro no diagnóstico:", erro);
    alert("Erro ao executar diagnóstico: " + (erro.message || erro));
  }
}

// ===========================
// DATA MIGRATION (ADMIN ONLY)
// ===========================

async function migrarDadosExistentes() {
  alert("Migração de dados antigo deve ser realizada por um procedimento backend seguro.\n\nEntre em contato com a equipe de TI para executar a migração centralizada.");
}

// ===========================
// ENGENHARIA FTTH
// ===========================

function addSplitter() {
  const div = document.createElement("div");
  div.className = "splitter-container";
  div.innerHTML = `
    <select class="splitter">
      <option value="0">Sem splitter</option>
      <option value="3.5">1:2</option>
      <option value="7">1:4</option>
      <option value="10.5">1:8</option>
      <option value="13.5">1:16</option>
      <option value="17">1:32</option>
    </select>
    <button class="remove-btn" onclick="removeSplitter(this)">✕</button>
  `;
  const container = document.getElementById("calc_splitters");
  if (container) container.appendChild(div);
}

function removeSplitter(btn) {
  const container = btn.parentElement;
  if (document.querySelectorAll("#calc_splitters .splitter-container").length > 1) {
    container.remove();
  }
}

function calcularFTTH() {
  const olt = parseFloat(document.getElementById("calc_olt").value);
  const km = parseFloat(document.getElementById("calc_km").value);
  const lossKm = parseFloat(document.getElementById("calc_lossKm").value);
  const conn = parseInt(document.getElementById("calc_conn").value);
  const lossConn = parseFloat(document.getElementById("calc_lossConn").value);
  const threshold = parseFloat(document.getElementById("calc_threshold").value);

  if (isNaN(olt) || isNaN(km) || isNaN(lossKm) || isNaN(conn) || isNaN(lossConn)) {
    document.getElementById("calc_resultado").innerHTML = `
      <div class="calcResultado calcResultadoErro">
        <p>⚠️ Preencha todos os campos com valores válidos</p>
      </div>
    `;
    return;
  }

  if (km < 0 || conn < 0 || lossKm < 0 || lossConn < 0) {
    document.getElementById("calc_resultado").innerHTML = `
      <div class="calcResultado calcResultadoErro">
        <p>⚠️ Valores negativos não são permitidos</p>
      </div>
    `;
    return;
  }

  let perdaTotal = km * lossKm;
  perdaTotal += conn * lossConn;

  const splitters = document.querySelectorAll("#calc_splitters .splitter");
  let cadeia = [];

  splitters.forEach(s => {
    const val = parseFloat(s.value);
    if (val > 0) {
      perdaTotal += val;
      cadeia.push(val);
    }
  });

  const final = olt - perdaTotal;
  let status = final >= threshold ? "🟢 OK (Dentro do padrão)" : "🔴 RUIM (Perda alta)";
  let statusClass = final >= threshold ? "calcResultadoSucesso" : "calcResultadoErro";

  document.getElementById("calc_resultado").innerHTML = `
    <div class="calcResultado ${statusClass}">
      <p>📡 OLT: ${olt} dBm</p>
      <p>📉 Perda fibra: ${(km * lossKm).toFixed(2)} dB</p>
      <p>🔌 Conectores: ${(conn * lossConn).toFixed(2)} dB</p>
      <p>🔀 Splitters: ${cadeia.join(" + ") || 0} dB</p>
      <hr style="margin: 15px 0; border: none; border-top: 1px solid rgba(255,255,255,0.1);">
      <h3>⚡ Potência final: ${final.toFixed(2)} dBm</h3>
      <h3>${status}</h3>
      <p style="margin-top: 10px; font-size: 12px; color: rgba(255,255,255,0.7);">Perda total: ${perdaTotal.toFixed(2)} dB</p>
    </div>
  `;
}

// ===========================
// AUTH STATE LISTENER - UNIFICADO
// ===========================

auth.onAuthStateChanged(async (user) => {
  limparListeners();

  if (user) {
    try {
      await carregarUsuarioAtual();
      mostrarAdminIfNeeded();

      // Se já está logado (login via fazerLogin já tratou), verificar se tela de login está oculta
      const loginTela = document.getElementById("loginTela");
      const sistema = document.getElementById("sistema");

      if (loginTela && loginTela.style.display !== "none") {
        // Usuário já autenticado, recarregar dados
        loginTela.style.display = "none";
        if (sistema) sistema.style.display = "flex";
        mostrarSecao("dashboard");
        initializeTheme();
        await carregarConfiguracoesSistema();
        carregarDadosIniciais();
      }
    } catch (erro) {
      console.error("Erro ao inicializar sessão:", erro);
    }
  } else {
    usuarioAtual = { uid: null, email: null, role: null, tenantId: null };
    const btnAdmin = document.getElementById('btnAdmin');
    if (btnAdmin) btnAdmin.style.display = 'none';
  }
});