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
  
  // Remove HTML tags
  let sanitized = input.replace(/<[^>]*>/g, "");
  
  // Remove potentially dangerous characters
  sanitized = sanitized.replace(/[<>\"'&]/g, "");
  
  // Remove script attempts
  sanitized = sanitized.replace(/javascript:/gi, "");
  sanitized = sanitized.replace(/on\w+\s*=/gi, "");
  
  // Trim whitespace
  sanitized = sanitized.trim();
  
  return sanitized;
}

function sanitizarEmail(email) {
  if (!email) return "";
  
  let sanitized = email.toLowerCase().trim();
  
  // Remove HTML tags and scripts
  sanitized = sanitized.replace(/<[^>]*>/g, "");
  sanitized = sanitized.replace(/javascript:/gi, "");
  
  // Basic email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(sanitized)) {
    return "";
  }
  
  return sanitized;
}

function sanitizarTelefone(telefone) {
  if (!telefone) return "";
  
  // Remove all non-numeric characters
  let sanitized = telefone.replace(/\D/g, "");
  
  // Keep only digits (11 for Brazil: 55 + 9 digits + 2 digits)
  if (sanitized.length > 11) {
    sanitized = sanitized.substring(0, 11);
  }
  
  return sanitized;
}

function sanitizarTexto(texto) {
  if (!texto) return "";
  
  // Remove HTML tags
  let sanitized = texto.replace(/<[^>]*>/g, "");
  
  // Remove script attempts
  sanitized = sanitized.replace(/javascript:/gi, "");
  sanitized = sanitized.replace(/on\w+\s*=/gi, "");
  
  // Trim whitespace
  sanitized = sanitized.trim();
  
  return sanitized;
}

// ===========================
// AUDIT LOGGING
// ===========================

async function registrarAuditoria(acao, descricao) {
  if (!auth.currentUser) return;
  
  try {
    await db.collection("auditoria").add({
      usuarioId: auth.currentUser.uid,
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
    const doc = await db.collection("configuracoes").doc("sistema").get();
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
        .where("usuarioId", "==", auth.currentUser.uid)
        .get();
      
      backupData[collection] = snapshot.docs.map(doc => ({
        id: doc.id,
        data: doc.data()
      }));
    }
    
    await backupRef.set({
      usuarioId: auth.currentUser.uid,
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
  if (clientesListener) clientesListener();
  if (planosListener) planosListener();
  if (recebimentosListener) recebimentosListener();
  if (despesasListener) despesasListener();
  
  financeiroListeners.forEach(listener => listener());
  financeiroListeners = [];
  
  fluxoCaixaListeners.forEach(listener => listener());
  fluxoCaixaListeners = [];
  
  inadimplentesListeners.forEach(listener => listener());
  inadimplentesListeners = [];
  
  whatsappListeners.forEach(listener => listener());
  whatsappListeners = [];
  
  adminListeners.forEach(listener => listener());
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
      document.getElementById("loginTela").style.display = "none";
      document.getElementById("sistema").style.display = "flex";
      mostrarSecao("dashboard");
      
      // Initialize theme
      initializeTheme();
      
      await carregarConfiguracoesSistema();
      await registrarAuditoria("login", "Usuário fez login");
      
      carregarClientes();
      carregarPlanos();
      carregarFinanceiro();
      carregarPlanosSelect();
      carregarRecebimentos();
      carregarDespesas();
      atualizarFluxoCaixa();
      verificarGeracaoMensalidades();
    })
    .catch((erro) => {
      alert("Erro de login: " + erro.message);
    });
}

// ===========================
// MENU
// ===========================

function mostrarSecao(id) {
  document.querySelectorAll(".secao").forEach(secao => {
    secao.style.display = "none";
  });
  document.getElementById(id).style.display = "block";
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

  const cliente = {
    usuarioId: auth.currentUser.uid,
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
  };

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
  // Verificar se usuário está logado
  if (!auth.currentUser) {
    console.error("Usuário não está logado!");
    alert("Você precisa estar logado para visualizar clientes.");
    return;
  }

  console.log("Carregando clientes para usuarioId:", auth.currentUser.uid);

  // Clean up existing listener
  if (clientesListener) {
    clientesListener();
  }

  let query = db.collection("clientes")
    .where("usuarioId", "==", auth.currentUser.uid)
    .orderBy("nome")
    .limit(configuracoesSistema.paginacao.clientes);

  if (clientesLastDoc) {
    query = query.startAfter(clientesLastDoc);
  }

  clientesListener = query.onSnapshot((snapshot) => {
    const tabela = document.getElementById("listaClientes");
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
    }

    document.getElementById("totalClientes").innerText = totalClientes;
    document.getElementById("clientesAtivos").innerText = clientesAtivos;
    
    // Atualizar faturamento e ticket médio
    document.getElementById("faturamentoMensal").innerText = "R$ " + faturamentoTotal.toFixed(2);
    document.getElementById("receitaPrevista").innerText = "R$ " + faturamentoTotal.toFixed(2);
    document.getElementById("ticketMedio").innerText = "R$ " + 
      (clientesAtivos > 0 ? (faturamentoTotal / clientesAtivos).toFixed(2) : "0.00");
  }, (erro) => {
    console.error("Erro ao carregar clientes:", erro);
  });
}

async function editarCliente(id) {
  const docRef = await db.collection("clientes").doc(id).get();
  const cliente = docRef.data();

  clienteEditando = id;

  document.getElementById("nome").value = cliente.nome || "";
  document.getElementById("cpf").value = cliente.cpf || "";
  document.getElementById("telefone").value = cliente.telefone || "";
  document.getElementById("email").value = cliente.email || "";
  document.getElementById("endereco").value = cliente.endereco || "";
  document.getElementById("bairro").value = cliente.bairro || "";
  document.getElementById("cidade").value = cliente.cidade || "";
  document.getElementById("cep").value = cliente.cep || "";
  document.getElementById("status").value = cliente.status || "";
  document.getElementById("plano").value = cliente.plano || "";
  document.getElementById("valor").value = cliente.valor || "";
  document.getElementById("vencimento").value = cliente.vencimento || "";
}

async function atualizarCliente() {
  if (!clienteEditando) {
    alert("Selecione um cliente para editar.");
    return;
  }

  try {
    await db.collection("clientes")
      .doc(clienteEditando)
      .update({
        nome: document.getElementById("nome").value,
        cpf: document.getElementById("cpf").value,
        telefone: document.getElementById("telefone").value,
        email: document.getElementById("email").value,
        endereco: document.getElementById("endereco").value,
        bairro: document.getElementById("bairro").value,
        cidade: document.getElementById("cidade").value,
        cep: document.getElementById("cep").value,
        status: document.getElementById("status").value,
        plano: document.getElementById("plano").value,
        valor: Number(document.getElementById("valor").value),
        vencimento: document.getElementById("vencimento").value
      });

    alert("Cliente atualizado!");
    clienteEditando = null;
    limparFormulario();
    carregarFinanceiro();
  } catch (erro) {
    alert("Erro: " + erro.message);
  }
}

function excluirCliente(id) {
  if (!confirm("Deseja excluir este cliente?")) {
    return;
  }

  db.collection("clientes")
    .doc(id)
    .delete()
    .then(async () => {
      alert("Cliente removido!");
      carregarFinanceiro();
      await registrarAuditoria("cliente_excluido", `Cliente excluído: ID ${id}`);
    })
    .catch((erro) => {
      alert("Erro: " + erro.message);
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
  document.getElementById("status").selectedIndex = 0;
  document.getElementById("plano").selectedIndex = 0;
  document.getElementById("valor").value = "";
  document.getElementById("vencimento").value = "";
  clienteEditando = null;
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

  const plano = {
    usuarioId: auth.currentUser.uid,
    nome,
    velocidade,
    valor,
    dataCadastro: new Date()
  };

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
  db.collection("planos")
    .where("usuarioId", "==", auth.currentUser.uid)
    .orderBy("nome")
    .onSnapshot((snapshot) => {
      const tabela = document.getElementById("listaPlanos");
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

  db.collection("planos")
    .where("usuarioId", "==", auth.currentUser.uid)
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
  const docRef = await db.collection("planos").doc(id).get();
  const plano = docRef.data();

  planoEditando = id;

  document.getElementById("nomePlano").value = plano.nome || "";
  document.getElementById("velocidadePlano").value = plano.velocidade || "";
  document.getElementById("valorPlano").value = plano.valor || "";
}

async function atualizarPlano() {
  if (!planoEditando) {
    alert("Selecione um plano para editar.");
    return;
  }

  try {
    await db.collection("planos")
      .doc(planoEditando)
      .update({
        nome: document.getElementById("nomePlano").value,
        velocidade: document.getElementById("velocidadePlano").value,
        valor: Number(document.getElementById("valorPlano").value)
      });

    alert("Plano atualizado com sucesso!");
    planoEditando = null;
    limparFormularioPlano();
  } catch (erro) {
    alert("Erro: " + erro.message);
  }
}

function excluirPlano(id) {
  if (!confirm("Deseja excluir este plano?")) {
    return;
  }

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
}

function preencherValorPlano() {
  const nomePlano = document.getElementById("plano").value;

  if (!nomePlano) return;

  db.collection("planos")
    .where("nome", "==", nomePlano)
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

  // Verificar se já existe mensalidade para este cliente nesta competência
  db.collection("mensalidades")
    .where("clienteId", "==", clienteId)
    .where("competencia", "==", competencia)
    .get()
    .then((snapshot) => {
      if (snapshot.empty) {
        // Não existe, criar nova mensalidade
        const mensalidade = {
          usuarioId: auth.currentUser.uid,
          clienteId,
          clienteNome,
          plano,
          valor,
          vencimento: dataVencimento,
          competencia,
          status: "Em Aberto",
          dataGeracao: new Date(),
          tipo: "Recorrente"
        };

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

  // Buscar todos os clientes ativos
  db.collection("clientes")
    .where("usuarioId", "==", auth.currentUser.uid)
    .where("status", "==", "Ativo")
    .get()
    .then((snapshot) => {
      snapshot.forEach((clienteDoc) => {
        const cliente = clienteDoc.data();
        const clienteId = clienteDoc.id;

        // Verificar se já existe mensalidade para este cliente nesta competência
        db.collection("mensalidades")
          .where("clienteId", "==", clienteId)
          .where("competencia", "==", competencia)
          .get()
          .then((mensalidadeSnapshot) => {
            if (mensalidadeSnapshot.empty && cliente.valor > 0 && cliente.vencimento) {
              // Não existe, criar nova mensalidade
              const dataVencimento = calcularDataVencimento(cliente.vencimento, dataAtual);
              
              const mensalidade = {
                usuarioId: auth.currentUser.uid,
                clienteId,
                clienteNome: cliente.nome,
                plano: cliente.plano,
                valor: cliente.valor,
                vencimento: dataVencimento,
                competencia,
                status: "Em Aberto",
                dataGeracao: new Date(),
                tipo: "Recorrente"
              };

              db.collection("mensalidades")
                .add(mensalidade)
                .then(() => {
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
  
  // Formatar para YYYY-MM-DD
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const dia = String(data.getDate()).padStart(2, '0');
  
  return `${ano}-${mes}-${dia}`;
}

function verificarGeracaoMensalidades() {
  const dataAtual = new Date();
  const dia = dataAtual.getDate();
  
  // Gerar mensalidades no dia 1 de cada mês
  if (dia === 1) {
    gerarMensalidadesNovoMes();
  }
}

function marcarMensalidadePaga(mensalidadeId) {
  db.collection("mensalidades")
    .doc(mensalidadeId)
    .update({
      status: "Pago",
      dataPagamento: new Date()
    })
    .then(() => {
      alert("Mensalidade marcada como paga!");
      carregarMensalidades();
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
    .update({
      status: "Atrasado"
    })
    .then(() => {
      alert("Mensalidade marcada como atrasada!");
      carregarMensalidades();
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
      carregarMensalidades();
      carregarFinanceiro();
    })
    .catch((erro) => {
      alert("Erro: " + erro.message);
    });
}

function carregarMensalidades() {
  db.collection("mensalidades")
    .where("usuarioId", "==", auth.currentUser.uid)
    .orderBy("vencimento", "desc")
    .onSnapshot((snapshot) => {
      const tabela = document.getElementById("listaRecebimentos");
      tabela.innerHTML = "";

      snapshot.forEach((doc) => {
        const mens = doc.data();
        const statusClass = mens.status === "Pago" ? "status-pago" : mens.status === "Atrasado" ? "status-atrasado" : "status-pendente";
        
        tabela.innerHTML += `
          <tr>
            <td>${mens.clienteNome || ""}</td>
            <td>R$ ${mens.valor.toFixed(2)}</td>
            <td>${mens.vencimento}</td>
            <td><span class="${statusClass}">${mens.status}</span></td>
            <td>${mens.tipo || "Recorrente"}</td>
            <td>
              ${mens.status !== "Pago" ? `<button onclick="marcarMensalidadePaga('${doc.id}')"><i class="fas fa-check"></i></button>` : ""}
              ${mens.status === "Em Aberto" ? `<button onclick="marcarMensalidadeAtrasada('${doc.id}')"><i class="fas fa-exclamation"></i></button>` : ""}
              <button onclick="excluirMensalidade('${doc.id}')"><i class="fas fa-trash"></i></button>
            </td>
          </tr>
        `;
      });
    }, (erro) => {
      console.error("Erro ao carregar mensalidades:", erro);
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
  db.collection("clientes")
    .where("usuarioId", "==", auth.currentUser.uid)
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
    .add({
      usuarioId: auth.currentUser.uid,
      clienteId,
      valor,
      vencimento,
      pagamento,
      status,
      observacao,
      dataCadastro: new Date()
    })
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
  tabela.innerHTML = "";

  // Clean up existing listener
  if (recebimentosListener) {
    recebimentosListener();
  }

  // Carregar mensalidades recorrentes com paginação
  let queryMensalidades = db.collection("mensalidades")
    .where("usuarioId", "==", auth.currentUser.uid)
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
            ${mens.status !== "Pago" ? `<button onclick="marcarMensalidadePaga('${doc.id}')"><i class="fas fa-check"></i></button>` : ""}
            ${mens.status === "Em Aberto" ? `<button onclick="marcarMensalidadeAtrasada('${doc.id}')"><i class="fas fa-exclamation"></i></button>` : ""}
            <button onclick="excluirMensalidade('${doc.id}')"><i class="fas fa-trash"></i></button>
          </td>
        </tr>
      `;
    });
    tabela.innerHTML = htmlMensalidades;

    // Update last doc for pagination
    if (mensalidadeSnapshot.docs.length > 0) {
      recebimentosLastDoc = mensalidadeSnapshot.docs[mensalidadeSnapshot.docs.length - 1];
    }
  }, (erro) => {
    console.error("Erro ao carregar mensalidades:", erro);
  });

  // Carregar recebimentos manuais (sem paginação para não duplicar)
  db.collection("recebimentos")
    .where("usuarioId", "==", auth.currentUser.uid)
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
            const cliente = clienteDoc.data();
            const statusClass = receb.status === "Pago" ? "status-pago" : receb.status === "Atrasado" ? "status-atrasado" : "status-pendente";
            
            tabela.innerHTML += `
              <tr>
                <td>${cliente.nome || ""}</td>
                <td>R$ ${receb.valor.toFixed(2)}</td>
                <td>${receb.vencimento}</td>
                <td><span class="${statusClass}">${receb.status}</span></td>
                <td>${receb.pagamento}</td>
                <td>
                  <button onclick="editarRecebimento('${doc.id}')"><i class="fas fa-pencil"></i></button>
                  <button onclick="excluirRecebimento('${doc.id}')"><i class="fas fa-trash"></i></button>
                </td>
              </tr>
            `;
          });
      });
    })
    .catch((erro) => {
      console.error("Erro ao carregar recebimentos:", erro);
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

function editarRecebimento(id) {
  // Implementar edição se necessário
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
    .add({
      usuarioId: auth.currentUser.uid,
      descricao,
      categoria,
      valor,
      vencimento,
      status,
      observacao,
      dataCadastro: new Date()
    })
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
  // Clean up existing listener
  if (despesasListener) {
    despesasListener();
  }

  let query = db.collection("despesas")
    .where("usuarioId", "==", auth.currentUser.uid)
    .orderBy("vencimento", "desc")
    .limit(configuracoesSistema.paginacao.despesas);

  if (despesasLastDoc) {
    query = query.startAfter(despesasLastDoc);
  }

  despesasListener = query.onSnapshot((snapshot) => {
    const tabela = document.getElementById("listaDespesas");
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

    // Update last doc for pagination
    if (snapshot.docs.length > 0) {
      despesasLastDoc = snapshot.docs[snapshot.docs.length - 1];
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
  document.getElementById("desp_categoria").selectedIndex = 0;
  document.getElementById("desp_valor").value = "";
  document.getElementById("desp_vencimento").value = "";
  document.getElementById("desp_status").selectedIndex = 0;
  document.getElementById("desp_observacao").value = "";
}

// ===========================
// FINANCEIRO - FLUXO DE CAIXA
// ===========================

function atualizarFluxoCaixa() {
  const dataInicio = document.getElementById("dataInicio").value;
  const dataFim = document.getElementById("dataFim").value;

  // Clean up existing listeners
  fluxoCaixaListeners.forEach(listener => listener());
  fluxoCaixaListeners = [];

  // Use Promise.all to fetch all data at once instead of nested onSnapshot
  Promise.all([
    db.collection("recebimentos").where("usuarioId", "==", auth.currentUser.uid).get(),
    db.collection("despesas").where("usuarioId", "==", auth.currentUser.uid).get(),
    db.collection("mensalidades").where("usuarioId", "==", auth.currentUser.uid).get()
  ]).then(([recebSnapshot, despSnapshot, mensalidadeSnapshot]) => {
    let totalEntradas = 0;
    let totalSaidas = 0;
    let fluxoHTML = "";

    // Processar recebimentos manuais
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

    // Processar mensalidades pagas
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

    // Processar despesas
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

    document.getElementById("totalEntradas").innerText = "R$ " + totalEntradas.toFixed(2);
    document.getElementById("totalSaidas").innerText = "R$ " + totalSaidas.toFixed(2);
    document.getElementById("saldoAtual").innerText = "R$ " + saldo.toFixed(2);
    document.getElementById("listaFluxoCaixa").innerHTML = fluxoHTML;
  }).catch((erro) => {
    console.error("Erro ao atualizar fluxo de caixa:", erro);
  });
}

// ===========================
// WHATSAPP INADIMPLENTE
// ===========================

function enviarWhatsAppInadimplente(nome, valor, vencimento, telefone = "") {
  // Se não tiver telefone, buscar do cliente
  if (!telefone) {
    db.collection("clientes")
      .where("nome", "==", nome)
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
  // Formatar telefone (remover caracteres não numéricos)
  const telefoneLimpo = telefone.replace(/\D/g, '');
  
  // Formatar mensagem
  const mensagem = `Olá, ${nome}!

Identificamos uma mensalidade em aberto no valor de R$ ${valor}, vencida em ${vencimento}.

Caso já tenha efetuado o pagamento, desconsidere esta mensagem.

Em caso de dúvidas, entre em contato conosco.

Atenciosamente,
ControlISP`;

  // Codificar mensagem para URL
  const mensagemCodificada = encodeURIComponent(mensagem);
  
  // Abrir WhatsApp
  const url = `https://wa.me/55${telefoneLimpo}?text=${mensagemCodificada}`;
  window.open(url, '_blank');
}

// ===========================
// FINANCEIRO - DASHBOARD
// ===========================

function carregarFinanceiro() {
  // Clean up existing listeners
  financeiroListeners.forEach(listener => listener());
  financeiroListeners = [];

  // Use Promise.all to fetch all data at once instead of nested onSnapshot
  Promise.all([
    db.collection("clientes").where("usuarioId", "==", auth.currentUser.uid).get(),
    db.collection("recebimentos").where("usuarioId", "==", auth.currentUser.uid).get(),
    db.collection("despesas").where("usuarioId", "==", auth.currentUser.uid).get(),
    db.collection("mensalidades").where("usuarioId", "==", auth.currentUser.uid).get()
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
    let receitaPendente = 0;
    let receitaAtraso = 0;

    const dataAtual = new Date();
    const mesAtual = dataAtual.getMonth();
    const anoAtual = dataAtual.getFullYear();

    // Calcular faturamento mensal (clientes ativos)
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

    // Processar recebimentos manuais
    recebSnapshot.forEach((doc) => {
      const receb = doc.data();
      if (receb.status === "Pago") {
        totalRecebido += receb.valor;
        recebidoQtd++;
        
        // Verificar se é do mês atual
        const dataPagamento = new Date(receb.vencimento);
        if (dataPagamento.getMonth() === mesAtual && dataPagamento.getFullYear() === anoAtual) {
          receitaRecebidaMes += receb.valor;
        }
      } else if (receb.status === "Pendente") {
        totalAberto += receb.valor;
        abertoQtd++;
        receitaPendente += receb.valor;
      } else if (receb.status === "Atrasado") {
        totalVencido += receb.valor;
        valorInadimplente += receb.valor;
        vencidoQtd++;
        receitaAtraso += receb.valor;
      }
    });

    // Processar mensalidades recorrentes
    mensalidadeSnapshot.forEach((doc) => {
      const mens = doc.data();
      if (mens.status === "Pago") {
        totalRecebido += mens.valor;
        recebidoQtd++;
        
        // Verificar se é do mês atual
        const dataPagamento = new Date(mens.dataPagamento || mens.vencimento);
        if (dataPagamento.getMonth() === mesAtual && dataPagamento.getFullYear() === anoAtual) {
          receitaRecebidaMes += mens.valor;
        }
      } else if (mens.status === "Em Aberto") {
        totalAberto += mens.valor;
        abertoQtd++;
        receitaPendente += mens.valor;
        
        // Verificar se está vencido
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

    // Processar despesas
    despSnapshot.forEach((doc) => {
      const desp = doc.data();
      if (desp.status === "Pago") {
        totalDespesas += desp.valor;
      } else {
        despesasQtd++;
      }
    });

    const lucroLiquido = totalRecebido - totalDespesas;

    // Atualizar elementos do Dashboard Financeiro
    document.getElementById("faturamentoMes").innerText = "R$ " + faturamentoMes.toFixed(2);
    document.getElementById("totalRecebido").innerText = "R$ " + totalRecebido.toFixed(2);
    document.getElementById("totalAberto").innerText = "R$ " + totalAberto.toFixed(2);
    document.getElementById("totalDespesas").innerText = "R$ " + totalDespesas.toFixed(2);
    document.getElementById("lucroLiquido").innerText = "R$ " + lucroLiquido.toFixed(2);
    document.getElementById("totalInadimplentes").innerText = clientesInadimplentes;
    document.getElementById("valorInadimplentes").innerText = "R$ " + valorInadimplente.toFixed(2) + " em atraso";
    document.getElementById("recebidoQtd").innerText = recebidoQtd + " cobranças pagas";
    document.getElementById("abertoQtd").innerText = abertoQtd + " cobranças pendentes";
    document.getElementById("despesasQtd").innerText = despesasQtd + " despesas este mês";

    // Atualizar novos elementos do Dashboard Principal
    document.getElementById("receitaRecebidaMes").innerText = "R$ " + receitaRecebidaMes.toFixed(2);
    document.getElementById("receitaPendente").innerText = "R$ " + receitaPendente.toFixed(2);
    document.getElementById("receitaAtraso").innerText = "R$ " + receitaAtraso.toFixed(2);

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
  tabela.innerHTML = "";

  let totalInadimplentes = 0;
  let valorTotal = 0;
  const clientesUnicos = new Set();

  // Carregar mensalidades atrasadas
  db.collection("mensalidades")
    .where("usuarioId", "==", auth.currentUser.uid)
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
      });

      document.getElementById("qntInadimplentes").innerText = clientesUnicos.size;
      document.getElementById("valorTotalAtraso").innerText = "R$ " + valorTotal.toFixed(2);
      document.getElementById("ticketMedioAtraso").innerText = "R$ " +
        (totalInadimplentes > 0 ? (valorTotal / totalInadimplentes).toFixed(2) : "0.00");
    }, (erro) => {
      console.error("Erro ao carregar mensalidades atrasadas:", erro);
    });

  // Carregar recebimentos manuais atrasados
  db.collection("recebimentos")
    .where("usuarioId", "==", auth.currentUser.uid)
    .where("status", "==", "Atrasado")
    .onSnapshot((snapshot) => {
      snapshot.forEach((doc) => {
        const receb = doc.data();
        totalInadimplentes++;
        valorTotal += receb.valor;
        clientesUnicos.add(receb.clienteId);

        db.collection("clientes")
          .doc(receb.clienteId)
          .get()
          .then((clienteDoc) => {
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
          });
      });

      document.getElementById("qntInadimplentes").innerText = clientesUnicos.size;
      document.getElementById("valorTotalAtraso").innerText = "R$ " + valorTotal.toFixed(2);
      document.getElementById("ticketMedioAtraso").innerText = "R$ " +
        (totalInadimplentes > 0 ? (valorTotal / totalInadimplentes).toFixed(2) : "0.00");
    }, (erro) => {
      console.error("Erro ao carregar inadimplentes:", erro);
    });
}

function marcarComoPago(id) {
  db.collection("recebimentos")
    .doc(id)
    .update({ status: "Pago" })
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
  abaElement.style.display = "block";
  abaElement.classList.add("ativa");

  document.querySelectorAll(".tabBtn").forEach(btn => {
    btn.classList.remove("active");
  });
  event.target.classList.add("active");

  if (aba === "fluxo-caixa") {
    atualizarFluxoCaixa();
  }
}

// ===========================
// LOGOUT & AUTH
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

auth.onAuthStateChanged((user) => {
  if (user) {
    // Carregar dados do usuário atual
    carregarDadosUsuario(user.uid).then((dadosUsuario) => {
      usuarioAtual = {
        uid: user.uid,
        nome: dadosUsuario.nome || user.displayName || "",
        email: user.email,
        role: dadosUsuario.role || "cliente"
      };

      document.getElementById("loginTela").style.display = "none";
      document.getElementById("sistema").style.display = "flex";
      mostrarSecao("dashboard");
      
      // Mostrar menu de admin se for admin
      if (usuarioAtual.role === "admin") {
        document.getElementById("btnAdmin").style.display = "flex";
        carregarDashboardAdmin();
        carregarUsuariosAdmin();
      }
      
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
    });
  } else {
    document.getElementById("loginTela").style.display = "flex";
    document.getElementById("sistema").style.display = "none";
  }
});

// ===========================
// WHATSAPP MODULE
// ===========================

// Global variables for WhatsApp
let clientesWhatsApp = [];
let clientesSelecionadosWhatsApp = new Set();
let configuracoesWhatsApp = {
  templates: {},
  nomeEmpresa: "Sua Empresa",
  apiProvider: "",
  apiKey: "",
  apiUrl: ""
};

// Global variables for Admin
let usuarioEditando = null;
let usuarioAtual = {
  uid: "",
  nome: "",
  email: "",
  role: "cliente"
};

// ===========================
// WHATSAPP TAB NAVIGATION
// ===========================

function mostrarAbaWhatsApp(aba) {
  document.querySelectorAll(".abaWhatsApp").forEach(abaw => {
    abaw.style.display = "none";
    abaw.classList.remove("ativa");
  });
  
  const abaElement = document.getElementById("whatsapp-" + aba);
  abaElement.style.display = "block";
  abaElement.classList.add("ativa");

  document.querySelectorAll(".whatsappTabBtn").forEach(btn => {
    btn.classList.remove("active");
  });
  event.target.classList.add("active");

  if (aba === "cobrancas") {
    identificarCobrancasPendentes();
  }
}

// ===========================
// WHATSAPP CLIENT LOADING
// ===========================

function carregarClientesWhatsApp() {
  db.collection("clientes")
    .where("usuarioId", "==", auth.currentUser.uid)
    .orderBy("nome")
    .onSnapshot((snapshot) => {
      clientesWhatsApp = [];
      const tabela = document.getElementById("listaClientesWhatsApp");
      const selectIndividual = document.getElementById("wa_cliente_individual");
      
      tabela.innerHTML = "";
      selectIndividual.innerHTML = '<option value="">Selecione um cliente</option>';

      snapshot.forEach((doc) => {
        const cliente = doc.data();
        cliente.id = doc.id;
        clientesWhatsApp.push(cliente);

        // Add to select
        const option = document.createElement("option");
        option.value = doc.id;
        option.textContent = cliente.nome;
        selectIndividual.appendChild(option);

        // Add to table
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

    // Filter by status
    if (filtroStatus && cliente.status !== filtroStatus) {
      mostrar = false;
    }

    // Filter by name
    if (filtroNome && !cliente.nome.toLowerCase().includes(filtroNome)) {
      mostrar = false;
    }

    // Filter by due date
    if (filtroVencimento) {
      const dataAtual = new Date();
      const diaVencimento = parseInt(cliente.vencimento);
      
      if (filtroVencimento === "hoje") {
        if (dataAtual.getDate() !== diaVencimento) {
          mostrar = false;
        }
      } else if (filtroVencimento === "3dias") {
        const diasAteVencimento = diaVencimento - dataAtual.getDate();
        if (diasAteVencimento < 0 || diasAteVencimento > 3) {
          mostrar = false;
        }
      } else if (filtroVencimento === "7dias") {
        const diasAteVencimento = diaVencimento - dataAtual.getDate();
        if (diasAteVencimento < 0 || diasAteVencimento > 7) {
          mostrar = false;
        }
      } else if (filtroVencimento === "atrasado") {
        const diasAteVencimento = diaVencimento - dataAtual.getDate();
        if (diasAteVencimento >= 0) {
          mostrar = false;
        }
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
  document.getElementById("wa_select_all").checked = true;
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
      .then(() => {
        alert("Modelo salvo com sucesso!");
      })
      .catch((erro) => {
        alert("Erro ao salvar modelo: " + erro.message);
      });
  }
}

function salvarNomeEmpresa() {
  const nomeEmpresa = document.getElementById("wa_nome_empresa").value;
  configuracoesWhatsApp.nomeEmpresa = nomeEmpresa;
  
  db.collection("configuracoes")
    .doc("whatsapp")
    .set({
      nomeEmpresa: nomeEmpresa,
      updatedAt: new Date()
    }, { merge: true })
    .then(() => {
      alert("Nome da empresa salvo com sucesso!");
    })
    .catch((erro) => {
      alert("Erro ao salvar nome: " + erro.message);
    });
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
    .set({
      apiProvider: apiProvider,
      apiKey: apiKey,
      apiUrl: apiUrl,
      updatedAt: new Date()
    }, { merge: true })
    .then(() => {
      alert("Configuração de API salva com sucesso!");
    })
    .catch((erro) => {
      alert("Erro ao salvar configuração: " + erro.message);
    });
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
  
  if (tipo === "aviso_vencimento" && configuracoesWhatsApp.templates.aviso_vencimento) {
    template = configuracoesWhatsApp.templates.aviso_vencimento;
  } else if (tipo === "cobranca_vencimento" && configuracoesWhatsApp.templates.cobranca_vencimento) {
    template = configuracoesWhatsApp.templates.cobranca_vencimento;
  } else if (tipo === "cobranca_atraso" && configuracoesWhatsApp.templates.cobranca_atraso) {
    template = configuracoesWhatsApp.templates.cobranca_atraso;
  } else if (tipo === "cobranca_amigavel" && configuracoesWhatsApp.templates.cobranca_amigavel) {
    template = configuracoesWhatsApp.templates.cobranca_amigavel;
  }
  
  if (template) {
    document.getElementById(textareaId).value = template;
  }
}

// ===========================
// WHATSAPP INDIVIDUAL MESSAGE
// ===========================

function enviarMensagemIndividual() {
  const clienteId = document.getElementById("wa_cliente_individual").value;
  const templateTipo = document.getElementById("wa_template_individual").value;
  const mensagemCustomizada = document.getElementById("wa_mensagem_individual").value;
  
  if (!clienteId) {
    alert("Selecione um cliente!");
    return;
  }
  
  const cliente = clientesWhatsApp.find(c => c.id === clienteId);
  if (!cliente) {
    alert("Cliente não encontrado!");
    return;
  }
  
  if (!cliente.telefone) {
    alert("Cliente não possui telefone cadastrado!");
    return;
  }
  
  let mensagem = "";
  let tipoMensagem = templateTipo === "personalizado" ? "personalizado" : templateTipo;
  
  if (templateTipo === "personalizado") {
    mensagem = mensagemCustomizada;
  } else {
    const template = configuracoesWhatsApp.templates[templateTipo] || "";
    const vencimento = formatarDataVencimento(cliente.vencimento);
    mensagem = substituirVariaveis(template, cliente, cliente.valor, vencimento);
  }
  
  if (!mensagem) {
    alert("Digite uma mensagem ou selecione um modelo!");
    return;
  }
  
  // Open WhatsApp with message
  const telefoneFormatado = formatarTelefoneWhatsApp(cliente.telefone);
  const mensagemCodificada = encodeURIComponent(mensagem);
  const whatsappURL = `https://wa.me/${telefoneFormatado}?text=${mensagemCodificada}`;
  
  // Save to history
  salvarHistoricoWhatsApp(cliente, mensagem, tipoMensagem, "Enviado");
  
  window.open(whatsappURL, "_blank");
}

// ===========================
// WHATSAPP BULK MESSAGE
// ===========================

function enviarMensagemMassa() {
  const templateTipo = document.getElementById("wa_template_massa").value;
  const mensagemCustomizada = document.getElementById("wa_mensagem_massa").value;
  
  if (clientesSelecionadosWhatsApp.size === 0) {
    alert("Selecione pelo menos um cliente!");
    return;
  }
  
  let tipoMensagem = templateTipo === "personalizado" ? "personalizado" : templateTipo;
  let templateBase = "";
  
  if (templateTipo === "personalizado") {
    templateBase = mensagemCustomizada;
  } else {
    templateBase = configuracoesWhatsApp.templates[templateTipo] || "";
  }
  
  if (!templateBase) {
    alert("Digite uma mensagem ou selecione um modelo!");
    return;
  }
  
  let contador = 0;
  
  clientesSelecionadosWhatsApp.forEach((clienteId) => {
    const cliente = clientesWhatsApp.find(c => c.id === clienteId);
    
    if (cliente && cliente.telefone) {
      const vencimento = formatarDataVencimento(cliente.vencimento);
      const mensagem = substituirVariaveis(templateBase, cliente, cliente.valor, vencimento);
      
      // Save to history
      salvarHistoricoWhatsApp(cliente, mensagem, tipoMensagem, "Enviado");
      
      contador++;
    }
  });
  
  alert(`${contador} mensagens preparadas! O WhatsApp será aberto para cada cliente.`);
  
  // Open WhatsApp for each selected client
  clientesSelecionadosWhatsApp.forEach((clienteId) => {
    const cliente = clientesWhatsApp.find(c => c.id === clienteId);
    
    if (cliente && cliente.telefone) {
      const vencimento = formatarDataVencimento(cliente.vencimento);
      const mensagem = substituirVariaveis(templateBase, cliente, cliente.valor, vencimento);
      
      const telefoneFormatado = formatarTelefoneWhatsApp(cliente.telefone);
      const mensagemCodificada = encodeURIComponent(mensagem);
      const whatsappURL = `https://wa.me/${telefoneFormatado}?text=${mensagemCodificada}`;
      
      setTimeout(() => {
        window.open(whatsappURL, "_blank");
      }, contador * 1000);
    }
  });
  
  // Clear selection
  clientesSelecionadosWhatsApp.clear();
  document.querySelectorAll(".wa-cliente-checkbox").forEach(cb => cb.checked = false);
  document.getElementById("wa_select_all").checked = false;
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
  tabela.innerHTML = "";
  
  db.collection("mensalidades")
    .where("usuarioId", "==", auth.currentUser.uid)
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
        
        if (diferencaDias === 0) {
          vencendoHoje++;
          categoria = "hoje";
        } else if (diferencaDias > 0 && diferencaDias <= 3) {
          vencendo3Dias++;
          categoria = "3dias";
        } else if (diferencaDias > 0 && diferencaDias <= 7) {
          vencendo7Dias++;
          categoria = "7dias";
        } else if (diferencaDias < 0) {
          emAtraso++;
          categoria = "atrasado";
        }
        
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
      
      document.getElementById("wa_vencendo_hoje").innerText = vencendoHoje;
      document.getElementById("wa_vencendo_3dias").innerText = vencendo3Dias;
      document.getElementById("wa_vencendo_7dias").innerText = vencendo7Dias;
      document.getElementById("wa_em_atraso").innerText = emAtraso;
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
      
      if (!cliente || !cliente.telefone) {
        alert("Cliente não encontrado ou sem telefone!");
        return;
      }
      
      let templateTipo = "";
      let tipoMensagem = "";
      
      if (categoria === "3dias") {
        templateTipo = "aviso_vencimento";
        tipoMensagem = "aviso_vencimento";
      } else if (categoria === "hoje") {
        templateTipo = "cobranca_vencimento";
        tipoMensagem = "cobranca_vencimento";
      } else if (categoria === "atrasado") {
        templateTipo = "cobranca_atraso";
        tipoMensagem = "cobranca_atraso";
      }
      
      const template = configuracoesWhatsApp.templates[templateTipo] || "";
      const mensagem = substituirVariaveis(template, cliente, mens.valor, mens.vencimento);
      
      // Save to history
      salvarHistoricoWhatsApp(cliente, mensagem, tipoMensagem, "Enviado");
      
      // Open WhatsApp
      const telefoneFormatado = formatarTelefoneWhatsApp(cliente.telefone);
      const mensagemCodificada = encodeURIComponent(mensagem);
      const whatsappURL = `https://wa.me/${telefoneFormatado}?text=${mensagemCodificada}`;
      
      window.open(whatsappURL, "_blank");
    })
    .catch((erro) => {
      alert("Erro: " + erro.message);
    });
}

function enviarAvisoVencimento3Dias() {
  const linhas = document.querySelectorAll("#listaCobrancasWhatsApp tr[data-categoria='3dias']");
  
  if (linhas.length === 0) {
    alert("Não há clientes vencendo em 3 dias!");
    return;
  }
  
  if (!confirm(`Enviar aviso para ${linhas.length} clientes?`)) {
    return;
  }
  
  linhas.forEach((linha) => {
    const botoes = linha.querySelectorAll("button");
    if (botoes.length > 0) {
      botoes[0].click();
    }
  });
}

function enviarCobrancaHoje() {
  const linhas = document.querySelectorAll("#listaCobrancasWhatsApp tr[data-categoria='hoje']");
  
  if (linhas.length === 0) {
    alert("Não há clientes vencendo hoje!");
    return;
  }
  
  if (!confirm(`Enviar cobrança para ${linhas.length} clientes?`)) {
    return;
  }
  
  linhas.forEach((linha) => {
    const botoes = linha.querySelectorAll("button");
    if (botoes.length > 0) {
      botoes[0].click();
    }
  });
}

function enviarCobrancaAtraso() {
  const linhas = document.querySelectorAll("#listaCobrancasWhatsApp tr[data-categoria='atrasado']");
  
  if (linhas.length === 0) {
    alert("Não há clientes em atraso!");
    return;
  }
  
  if (!confirm(`Enviar cobrança para ${linhas.length} clientes?`)) {
    return;
  }
  
  linhas.forEach((linha) => {
    const botoes = linha.querySelectorAll("button");
    if (botoes.length > 0) {
      botoes[0].click();
    }
  });
}

function enviarCobrancaAmigavel() {
  const linhas = document.querySelectorAll("#listaCobrancasWhatsApp tr[data-categoria='atrasado']");
  
  if (linhas.length === 0) {
    alert("Não há clientes em atraso!");
    return;
  }
  
  if (!confirm(`Enviar cobrança amigável para ${linhas.length} clientes?`)) {
    return;
  }
  
  linhas.forEach((linha) => {
    const clienteNome = linha.cells[0].textContent;
    const cliente = clientesWhatsApp.find(c => c.nome === clienteNome);
    
    if (cliente && cliente.telefone) {
      const template = configuracoesWhatsApp.templates.cobranca_amigavel || "";
      const vencimento = formatarDataVencimento(cliente.vencimento);
      const mensagem = substituirVariaveis(template, cliente, cliente.valor, vencimento);
      
      // Save to history
      salvarHistoricoWhatsApp(cliente, mensagem, "cobranca_amigavel", "Enviado");
      
      // Open WhatsApp
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
    .add({
      usuarioId: auth.currentUser.uid,
      clienteId: cliente.id,
      clienteNome: cliente.nome,
      clienteTelefone: cliente.telefone,
      mensagem: mensagem,
      tipo: tipo,
      status: status,
      data: data,
      hora: hora,
      timestamp: dataAtual
    })
    .catch((erro) => {
      console.error("Erro ao salvar histórico:", erro);
    });
}

function carregarHistoricoWhatsApp() {
  db.collection("whatsapp_historico")
    .where("usuarioId", "==", auth.currentUser.uid)
    .orderBy("timestamp", "desc")
    .limit(100)
    .onSnapshot((snapshot) => {
      const tabela = document.getElementById("listaHistoricoWhatsApp");
      tabela.innerHTML = "";
      
      snapshot.forEach((doc) => {
        const hist = doc.data();
        
        tabela.innerHTML += `
          <tr>
            <td>${hist.clienteNome}</td>
            <td>${hist.data}</td>
            <td>${hist.hora}</td>
            <td>${hist.tipo}</td>
            <td><span class="status-${hist.status.toLowerCase()}">${hist.status}</span></td>
            <td>
              <button onclick="verMensagemHistorico('${doc.id}')">
                <i class="fas fa-eye"></i> Ver
              </button>
            </td>
          </tr>
        `;
      });
    }, (erro) => {
      console.error("Erro ao carregar histórico:", erro);
    });
}

function filtrarHistoricoWhatsApp() {
  const busca = document.getElementById("wa_busca_historico").value.toLowerCase();
  const tipo = document.getElementById("wa_filtro_tipo_historico").value;
  const status = document.getElementById("wa_filtro_status_historico").value;
  
  const linhas = document.querySelectorAll("#listaHistoricoWhatsApp tr");
  
  linhas.forEach((linha) => {
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
      const hist = doc.data();
      alert(`Mensagem enviada para ${hist.clienteNome}:\n\n${hist.mensagem}`);
    })
    .catch((erro) => {
      alert("Erro: " + erro.message);
    });
}

function limparHistoricoWhatsApp() {
  if (!confirm("Deseja limpar todo o histórico de mensagens?")) {
    return;
  }
  
  db.collection("whatsapp_historico")
    .where("usuarioId", "==", auth.currentUser.uid)
    .get()
    .then((snapshot) => {
      const batch = db.batch();
      
      snapshot.forEach((doc) => {
        batch.delete(doc.ref);
      });
      
      return batch.commit();
    })
    .then(() => {
      alert("Histórico limpo com sucesso!");
    })
    .catch((erro) => {
      alert("Erro: " + erro.message);
    });
}

// ===========================
// WHATSAPP CONFIGURATIONS
// ===========================

function carregarConfiguracoesWhatsApp() {
  db.collection("configuracoes")
    .doc("whatsapp")
    .get()
    .then((doc) => {
      if (doc.exists) {
        const config = doc.data();
        
        if (config.templates) {
          configuracoesWhatsApp.templates = config.templates;
          
          // Load templates into textareas
          Object.keys(config.templates).forEach((tipo) => {
            const textarea = document.getElementById("wa_template_" + tipo);
            if (textarea) {
              textarea.value = config.templates[tipo];
            }
          });
        }
        
        if (config.nomeEmpresa) {
          configuracoesWhatsApp.nomeEmpresa = config.nomeEmpresa;
          document.getElementById("wa_nome_empresa").value = config.nomeEmpresa;
        }
        
        if (config.apiProvider) {
          configuracoesWhatsApp.apiProvider = config.apiProvider;
          document.getElementById("wa_api_provider").value = config.apiProvider;
        }
        
        if (config.apiKey) {
          configuracoesWhatsApp.apiKey = config.apiKey;
          document.getElementById("wa_api_key").value = config.apiKey;
        }
        
        if (config.apiUrl) {
          configuracoesWhatsApp.apiUrl = config.apiUrl;
          document.getElementById("wa_api_url").value = config.apiUrl;
        }
      }
    })
    .catch((erro) => {
      console.error("Erro ao carregar configurações:", erro);
    });
}

// ===========================
// WHATSAPP HELPER FUNCTIONS
// ===========================

function formatarTelefoneWhatsApp(telefone) {
  // Remove non-numeric characters
  let telefoneLimpo = telefone.replace(/\D/g, '');
  
  // Remove country code if present (Brazil +55)
  if (telefoneLimpo.startsWith('55') && telefoneLimpo.length === 12) {
    telefoneLimpo = telefoneLimpo.substring(2);
  }
  
  // Add country code for Brazil
  return '55' + telefoneLimpo;
}

function formatarDataVencimento(diaVencimento) {
  const dataAtual = new Date();
  const dia = parseInt(diaVencimento);
  dataAtual.setDate(dia);
  
  return dataAtual.toLocaleDateString('pt-BR');
}

// Template change handlers
document.addEventListener("DOMContentLoaded", function() {
  const templateIndividual = document.getElementById("wa_template_individual");
  const templateMassa = document.getElementById("wa_template_massa");
  
  if (templateIndividual) {
    templateIndividual.addEventListener("change", function() {
      if (this.value !== "personalizado") {
        carregarTemplateNaTextarea(this.value, "wa_mensagem_individual");
      }
    });
  }
  
  if (templateMassa) {
    templateMassa.addEventListener("change", function() {
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
  document.querySelectorAll(".abaAdmin").forEach(abaa => {
    abaa.style.display = "none";
    abaa.classList.remove("ativa");
  });
  
  const abaElement = document.getElementById("admin-" + aba);
  abaElement.style.display = "block";
  abaElement.classList.add("ativa");

  document.querySelectorAll(".adminTabBtn").forEach(btn => {
    btn.classList.remove("active");
  });
  event.target.classList.add("active");

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
      // Se não existir, criar documento básico
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
    return {
      uid: uid,
      email: auth.currentUser.email,
      role: "cliente",
      status: "Ativo"
    };
  }
}

// ===========================
// ADMIN DASHBOARD
// ===========================

function carregarDashboardAdmin() {
  db.collection("usuarios")
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
      tabelaUltimos.innerHTML = "";

      snapshot.forEach((doc) => {
        const usuario = doc.data();
        totalUsuarios++;

        if (usuario.status === "Ativo") {
          usuariosAtivos++;
        } else if (usuario.status === "Bloqueado") {
          usuariosBloqueados++;
        }

        // Calcular receita mensal usando configuracoesSistema
        const valorPlano = configuracoesSistema.planos[usuario.plano] || 0;
        receitaMensal += valorPlano;

        // Verificar se é cadastro novo do mês atual
        if (usuario.criadoEm) {
          const dataCadastro = usuario.criadoEm.toDate ? usuario.criadoEm.toDate() : new Date(usuario.criadoEm);
          if (dataCadastro.getMonth() === mesAtual && dataCadastro.getFullYear() === anoAtual) {
            novosCadastros++;
          }
        }
      });

      // Atualizar indicadores
      document.getElementById("admin_total_usuarios").innerText = totalUsuarios;
      document.getElementById("admin_usuarios_ativos").innerText = usuariosAtivos;
      document.getElementById("admin_usuarios_bloqueados").innerText = usuariosBloqueados;
      document.getElementById("admin_receita_mensal").innerText = "R$ " + receitaMensal.toFixed(2);
      document.getElementById("admin_novos_cadastros").innerText = novosCadastros;

      // Carregar últimos 5 usuários
      snapshot.docs.slice(-5).reverse().forEach((doc) => {
        const usuario = doc.data();
        tabelaUltimos.innerHTML += `
          <tr>
            <td>${usuario.nome || ""}</td>
            <td>${usuario.empresa || ""}</td>
            <td>${usuario.email || ""}</td>
            <td>${usuario.plano || ""}</td>
            <td><span class="status-${usuario.status.toLowerCase()}">${usuario.status}</span></td>
            <td>${usuario.criadoEm ? new Date(usuario.criadoEm.toDate ? usuario.criadoEm.toDate() : usuario.criadoEm).toLocaleDateString('pt-BR') : ""}</td>
          </tr>
        `;
      });
    }, (erro) => {
      console.error("Erro ao carregar dashboard admin:", erro);
    });
}

// ===========================
// ADMIN USER MANAGEMENT
// ===========================

function carregarUsuariosAdmin() {
  db.collection("usuarios")
    .orderBy("criadoEm", "desc")
    .onSnapshot((snapshot) => {
      const tabela = document.getElementById("listaUsuariosAdmin");
      tabela.innerHTML = "";

      snapshot.forEach((doc) => {
        const usuario = doc.data();
        
        tabela.innerHTML += `
          <tr>
            <td>${usuario.nome || ""}</td>
            <td>${usuario.empresa || ""}</td>
            <td>${usuario.email || ""}</td>
            <td>${usuario.telefone || ""}</td>
            <td>${usuario.plano || ""}</td>
            <td><span class="status-${usuario.status.toLowerCase()}">${usuario.status}</span></td>
            <td>${usuario.role || "cliente"}</td>
            <td>${usuario.criadoEm ? new Date(usuario.criadoEm.toDate ? usuario.criadoEm.toDate() : usuario.criadoEm).toLocaleDateString('pt-BR') : ""}</td>
            <td>
              <button onclick="editarUsuario('${doc.id}')" title="Editar">
                <i class="fas fa-pencil"></i>
              </button>
              <button onclick="redefinirSenhaUsuario('${doc.id}')" title="Redefinir Senha">
                <i class="fas fa-key"></i>
              </button>
              ${usuario.status === "Ativo" ? 
                `<button onclick="bloquearUsuario('${doc.id}')" title="Bloquear">
                  <i class="fas fa-lock"></i>
                </button>` :
                `<button onclick="ativarUsuario('${doc.id}')" title="Ativar">
                  <i class="fas fa-unlock"></i>
                </button>`
              }
              <button onclick="excluirUsuario('${doc.id}')" title="Excluir">
                <i class="fas fa-trash"></i>
              </button>
            </td>
          </tr>
        `;
      });
    }, (erro) => {
      console.error("Erro ao carregar usuários admin:", erro);
    });
}

function filtrarUsuarios() {
  const busca = document.getElementById("admin_busca_usuario").value.toLowerCase();
  const status = document.getElementById("admin_filtro_status").value;
  const plano = document.getElementById("admin_filtro_plano").value;
  
  const linhas = document.querySelectorAll("#listaUsuariosAdmin tr");
  
  linhas.forEach((linha) => {
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
  document.getElementById("modalUsuario").style.display = "flex";
  document.getElementById("modalUsuarioTitulo").innerText = "Novo Usuário";
  limparFormularioUsuario();
  usuarioEditando = null;
}

function fecharModalUsuario() {
  document.getElementById("modalUsuario").style.display = "none";
  limparFormularioUsuario();
  usuarioEditando = null;
}

function limparFormularioUsuario() {
  document.getElementById("admin_usuario_id").value = "";
  document.getElementById("admin_usuario_nome").value = "";
  document.getElementById("admin_usuario_empresa").value = "";
  document.getElementById("admin_usuario_email").value = "";
  document.getElementById("admin_usuario_telefone").value = "";
  document.getElementById("admin_usuario_plano").selectedIndex = 0;
  document.getElementById("admin_usuario_role").selectedIndex = 0;
  document.getElementById("admin_usuario_status").selectedIndex = 0;
}

async function salvarUsuario() {
  const id = document.getElementById("admin_usuario_id").value;
  const nome = document.getElementById("admin_usuario_nome").value;
  const empresa = document.getElementById("admin_usuario_empresa").value;
  const email = document.getElementById("admin_usuario_email").value;
  const telefone = document.getElementById("admin_usuario_telefone").value;
  const plano = document.getElementById("admin_usuario_plano").value;
  const role = document.getElementById("admin_usuario_role").value;
  const status = document.getElementById("admin_usuario_status").value;

  if (!nome || !email) {
    alert("Preencha pelo menos: Nome e E-mail!");
    return;
  }

  try {
    if (id) {
      // Editar usuário existente
      await db.collection("usuarios").doc(id).update({
        nome,
        empresa,
        telefone,
        plano,
        role,
        status
      });
      alert("Usuário atualizado com sucesso!");
    } else {
      // Criar novo usuário no Firebase Auth
      const senhaGerada = Math.random().toString(36).slice(-8);
      const userCredential = await auth.createUserWithEmailAndPassword(email, senhaGerada);
      
      // Salvar dados na coleção usuarios
      await db.collection("usuarios").doc(userCredential.user.uid).set({
        uid: userCredential.user.uid,
        nome,
        empresa,
        email,
        telefone,
        plano,
        role,
        status,
        criadoEm: new Date()
      });
      
      alert(`Usuário criado com sucesso!\nE-mail: ${email}\nSenha temporária: ${senhaGerada}`);
    }

    fecharModalUsuario();
    carregarUsuariosAdmin();
    carregarDashboardAdmin();
  } catch (erro) {
    alert("Erro: " + erro.message);
  }
}

async function editarUsuario(id) {
  try {
    const doc = await db.collection("usuarios").doc(id).get();
    const usuario = doc.data();

    usuarioEditando = id;
    document.getElementById("modalUsuario").style.display = "flex";
    document.getElementById("modalUsuarioTitulo").innerText = "Editar Usuário";
    
    document.getElementById("admin_usuario_id").value = id;
    document.getElementById("admin_usuario_nome").value = usuario.nome || "";
    document.getElementById("admin_usuario_empresa").value = usuario.empresa || "";
    document.getElementById("admin_usuario_email").value = usuario.email || "";
    document.getElementById("admin_usuario_telefone").value = usuario.telefone || "";
    document.getElementById("admin_usuario_plano").value = usuario.plano || "";
    document.getElementById("admin_usuario_role").value = usuario.role || "cliente";
    document.getElementById("admin_usuario_status").value = usuario.status || "";
  } catch (erro) {
    alert("Erro: " + erro.message);
  }
}

async function bloquearUsuario(id) {
  if (!confirm("Deseja bloquear este usuário?")) {
    return;
  }

  try {
    await db.collection("usuarios").doc(id).update({
      status: "Bloqueado"
    });
    await auth.updateUser(id, { disabled: true });
    alert("Usuário bloqueado com sucesso!");
    carregarUsuariosAdmin();
    carregarDashboardAdmin();
  } catch (erro) {
    alert("Erro: " + erro.message);
  }
}

async function ativarUsuario(id) {
  if (!confirm("Deseja ativar este usuário?")) {
    return;
  }

  try {
    await db.collection("usuarios").doc(id).update({
      status: "Ativo"
    });
    await auth.updateUser(id, { disabled: false });
    alert("Usuário ativado com sucesso!");
    carregarUsuariosAdmin();
    carregarDashboardAdmin();
  } catch (erro) {
    alert("Erro: " + erro.message);
  }
}

async function excluirUsuario(id) {
  if (!confirm("Deseja excluir este usuário? Esta ação não pode ser desfeita.")) {
    return;
  }

  try {
    await db.collection("usuarios").doc(id).delete();
    await auth.deleteUser(id);
    alert("Usuário excluído com sucesso!");
    carregarUsuariosAdmin();
    carregarDashboardAdmin();
  } catch (erro) {
    alert("Erro: " + erro.message);
  }
}

async function redefinirSenhaUsuario(id) {
  try {
    const doc = await db.collection("usuarios").doc(id).get();
    const usuario = doc.data();
    
    if (!confirm(`Deseja enviar e-mail de redefinição de senha para ${usuario.email}?`)) {
      return;
    }

    await auth.sendPasswordResetEmail(usuario.email);
    alert(`E-mail de redefinição de senha enviado para ${usuario.email}`);
  } catch (erro) {
    alert("Erro: " + erro.message);
  }
}

// ===========================
// DIAGNÓSTICO DE DADOS
// ===========================

async function diagnosticarDados() {
  if (!auth.currentUser) {
    alert("Você precisa estar logado para executar o diagnóstico.");
    return;
  }

  const uid = auth.currentUser.uid;
  console.log("=== DIAGNÓSTICO DE DADOS ===");
  console.log("Usuário atual UID:", uid);
  console.log("Usuário atual Email:", auth.currentUser.email);
  console.log("Usuário atual Role:", usuarioAtual.role);

  try {
    // Verificar total de clientes no banco
    const todosClientes = await db.collection("clientes").get();
    console.log("Total de clientes no banco (sem filtro):", todosClientes.size);

    // Verificar clientes com usuarioId do usuário atual
    const clientesUsuario = await db.collection("clientes").where("usuarioId", "==", uid).get();
    console.log("Clientes com seu usuarioId:", clientesUsuario.size);

    // Verificar clientes sem usuarioId
    const clientesSemUsuarioId = await db.collection("clientes").get();
    let semUsuarioId = 0;
    clientesSemUsuarioId.forEach((doc) => {
      const cliente = doc.data();
      if (!cliente.usuarioId) {
        semUsuarioId++;
      }
    });
    console.log("Clientes sem usuarioId:", semUsuarioId);

    // Exibir resultado
    const mensagem = 
      "=== DIAGNÓSTICO DE DADOS ===\n\n" +
      `Usuário UID: ${uid}\n` +
      `Usuário Email: ${auth.currentUser.email}\n` +
      `Usuário Role: ${usuarioAtual.role}\n\n` +
      `Total de clientes no banco: ${todosClientes.size}\n` +
      `Clientes com seu usuarioId: ${clientesUsuario.size}\n` +
      `Clientes sem usuarioId: ${semUsuarioId}\n\n` +
      "Verifique o console do navegador (F12) para mais detalhes.";
    
    alert(mensagem);

    // Se houver clientes sem usuarioId, perguntar se quer migrar
    if (semUsuarioId > 0 && usuarioAtual.role === "admin") {
      if (confirm(`Há ${semUsuarioId} clientes sem usuarioId.\n\nDeseja migrá-los para o seu usuário administrador?`)) {
        await migrarDadosExistentes();
      }
    } else if (semUsuarioId > 0) {
      alert(`Há ${semUsuarioId} clientes sem usuarioId.\n\nEntre em contato com o administrador para executar a migração.`);
    }

  } catch (erro) {
    console.error("Erro no diagnóstico:", erro);
    alert("Erro ao executar diagnóstico: " + erro.message);
  }
}

// ===========================
// DATA MIGRATION (ADMIN ONLY)
// ===========================

async function migrarDadosExistentes() {
  // Verificar se o usuário está logado
  if (!auth.currentUser) {
    alert("Você precisa estar logado para executar a migração.");
    return;
  }

  // Verificar se o usuário é administrador
  if (usuarioAtual.role !== "admin") {
    alert("Apenas administradores podem executar a migração de dados.");
    return;
  }

  // Confirmar migração
  if (!confirm(
    "⚠️ ATENÇÃO: Migração de Dados Antigos\n\n" +
    "Esta ação irá associar TODOS os registros sem usuarioId ao seu usuário administrador.\n\n" +
    "Coleções que serão migradas:\n" +
    "• clientes\n" +
    "• planos\n" +
    "• mensalidades\n" +
    "• recebimentos\n" +
    "• despesas\n" +
    "• whatsapp_historico\n\n" +
    "Esta ação é irreversível. Deseja continuar?"
  )) {
    return;
  }

  const uid = auth.currentUser.uid;
  const resultados = {
    clientes: 0,
    planos: 0,
    mensalidades: 0,
    recebimentos: 0,
    despesas: 0,
    whatsapp_historico: 0,
    total: 0,
    erros: []
  };

  try {
    // Migrar clientes
    console.log("Migrando clientes...");
    const clientesSnapshot = await db.collection("clientes").get();
    const batchClientes = db.batch();
    
    clientesSnapshot.forEach((doc) => {
      const cliente = doc.data();
      if (!cliente.usuarioId) {
        batchClientes.update(doc.ref, { usuarioId: uid });
        resultados.clientes++;
      }
    });
    
    if (resultados.clientes > 0) {
      await batchClientes.commit();
      console.log(`${resultados.clientes} clientes migrados.`);
    }

    // Migrar planos
    console.log("Migrando planos...");
    const planosSnapshot = await db.collection("planos").get();
    const batchPlanos = db.batch();
    
    planosSnapshot.forEach((doc) => {
      const plano = doc.data();
      if (!plano.usuarioId) {
        batchPlanos.update(doc.ref, { usuarioId: uid });
        resultados.planos++;
      }
    });
    
    if (resultados.planos > 0) {
      await batchPlanos.commit();
      console.log(`${resultados.planos} planos migrados.`);
    }

    // Migrar mensalidades
    console.log("Migrando mensalidades...");
    const mensalidadesSnapshot = await db.collection("mensalidades").get();
    const batchMensalidades = db.batch();
    
    mensalidadesSnapshot.forEach((doc) => {
      const mensalidade = doc.data();
      if (!mensalidade.usuarioId) {
        batchMensalidades.update(doc.ref, { usuarioId: uid });
        resultados.mensalidades++;
      }
    });
    
    if (resultados.mensalidades > 0) {
      await batchMensalidades.commit();
      console.log(`${resultados.mensalidades} mensalidades migradas.`);
    }

    // Migrar recebimentos
    console.log("Migrando recebimentos...");
    const recebimentosSnapshot = await db.collection("recebimentos").get();
    const batchRecebimentos = db.batch();
    
    recebimentosSnapshot.forEach((doc) => {
      const recebimento = doc.data();
      if (!recebimento.usuarioId) {
        batchRecebimentos.update(doc.ref, { usuarioId: uid });
        resultados.recebimentos++;
      }
    });
    
    if (resultados.recebimentos > 0) {
      await batchRecebimentos.commit();
      console.log(`${resultados.recebimentos} recebimentos migrados.`);
    }

    // Migrar despesas
    console.log("Migrando despesas...");
    const despesasSnapshot = await db.collection("despesas").get();
    const batchDespesas = db.batch();
    
    despesasSnapshot.forEach((doc) => {
      const despesa = doc.data();
      if (!despesa.usuarioId) {
        batchDespesas.update(doc.ref, { usuarioId: uid });
        resultados.despesas++;
      }
    });
    
    if (resultados.despesas > 0) {
      await batchDespesas.commit();
      console.log(`${resultados.despesas} despesas migradas.`);
    }

    // Migrar whatsapp_historico
    console.log("Migrando whatsapp_historico...");
    const whatsappSnapshot = await db.collection("whatsapp_historico").get();
    const batchWhatsapp = db.batch();
    
    whatsappSnapshot.forEach((doc) => {
      const historico = doc.data();
      if (!historico.usuarioId) {
        batchWhatsapp.update(doc.ref, { usuarioId: uid });
        resultados.whatsapp_historico++;
      }
    });
    
    if (resultados.whatsapp_historico > 0) {
      await batchWhatsapp.commit();
      console.log(`${resultados.whatsapp_historico} registros de WhatsApp migrados.`);
    }

    // Calcular total
    resultados.total = resultados.clientes + resultados.planos + resultados.mensalidades + 
                      resultados.recebimentos + resultados.despesas + resultados.whatsapp_historico;

    // Exibir resultado
    const mensagem = 
      "✅ Migração Concluída com Sucesso!\n\n" +
      "Resumo da Migração:\n" +
      `• Clientes: ${resultados.clientes}\n` +
      `• Planos: ${resultados.planos}\n` +
      `• Mensalidades: ${resultados.mensalidades}\n` +
      `• Recebimentos: ${resultados.recebimentos}\n` +
      `• Despesas: ${resultados.despesas}\n` +
      `• WhatsApp Histórico: ${resultados.whatsapp_historico}\n\n` +
      `Total de registros migrados: ${resultados.total}\n\n` +
      "Todos os registros antigos agora pertencem ao seu usuário administrador.";
    
    alert(mensagem);
    
    // Registrar auditoria
    await registrarAuditoria("migracao_dados", `Migração de ${resultados.total} registros antigos para admin ${uid}`);
    
    // Recarregar dados
    location.reload();
  } catch (erro) {
    console.error("Erro durante a migração:", erro);
    alert("❌ Erro durante a migração: " + erro.message);
  }
}

// ===========================
// CALCULADORA ÓPTICA FTTH
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

  document.getElementById("calc_splitters").appendChild(div);
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

  // Validação
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

  // fibra
  let perdaTotal = km * lossKm;

  // conectores
  perdaTotal += conn * lossConn;

  // splitters em cascata
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
