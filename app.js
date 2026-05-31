// ===========================
// GLOBAL VARIABLES
// ===========================

let clienteEditando = null;
let planoEditando = null;
let mensalidadeEditando = null;

// ===========================
// LOGIN
// ===========================

function fazerLogin() {
  const email = document.getElementById("usuario").value;
  const senha = document.getElementById("senha").value;

  if (!email || !senha) {
    alert("Por favor, preencha e-mail e senha!");
    return;
  }

  auth.signInWithEmailAndPassword(email, senha)
    .then(() => {
      document.getElementById("loginTela").style.display = "none";
      document.getElementById("sistema").style.display = "flex";
      mostrarSecao("dashboard");
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
  const nome = document.getElementById("nome").value;
  const cpf = document.getElementById("cpf").value;
  const telefone = document.getElementById("telefone").value;
  const email = document.getElementById("email").value;
  const endereco = document.getElementById("endereco").value;
  const bairro = document.getElementById("bairro").value;
  const cidade = document.getElementById("cidade").value;
  const cep = document.getElementById("cep").value;
  const status = document.getElementById("status").value;
  const plano = document.getElementById("plano").value;
  const valor = Number(document.getElementById("valor").value);
  const vencimento = document.getElementById("vencimento").value;

  if (!nome || !telefone || !email) {
    alert("Preencha pelo menos: Nome, Telefone e E-mail!");
    return;
  }

  const cliente = {
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
    .then((docRef) => {
      alert("Cliente cadastrado com sucesso!");
      limparFormulario();
      carregarFinanceiro();
      
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
  db.collection("clientes")
    .orderBy("nome")
    .onSnapshot((snapshot) => {
      const tabela = document.getElementById("listaClientes");
      tabela.innerHTML = "";

      let totalClientes = 0;
      let clientesAtivos = 0;
      let faturamentoTotal = 0;

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
    .then(() => {
      alert("Cliente removido!");
      carregarFinanceiro();
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
  const nome = document.getElementById("nomePlano").value;
  const velocidade = document.getElementById("velocidadePlano").value;
  const valor = Number(document.getElementById("valorPlano").value);

  if (!nome || !velocidade || !valor) {
    alert("Preencha todos os campos do plano!");
    return;
  }

  const plano = {
    nome,
    velocidade,
    valor,
    dataCadastro: new Date()
  };

  db.collection("planos")
    .add(plano)
    .then(() => {
      alert("Plano cadastrado com sucesso!");
      limparFormularioPlano();
    })
    .catch((erro) => {
      alert("Erro ao salvar: " + erro.message);
    });
}

function carregarPlanos() {
  db.collection("planos")
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
    .then(() => {
      alert("Plano removido!");
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
  const observacao = document.getElementById("receb_observacao").value;

  if (!clienteId || !valor || !vencimento || !pagamento) {
    alert("Preencha todos os campos obrigatórios!");
    return;
  }

  db.collection("recebimentos")
    .add({
      clienteId,
      valor,
      vencimento,
      pagamento,
      status,
      observacao,
      dataCadastro: new Date()
    })
    .then(() => {
      alert("Cobrança cadastrada com sucesso!");
      fecharModalRecebimento();
      carregarRecebimentos();
      carregarFinanceiro();
    })
    .catch((erro) => {
      alert("Erro: " + erro.message);
    });
}

function carregarRecebimentos() {
  const tabela = document.getElementById("listaRecebimentos");
  tabela.innerHTML = "";

  // Carregar mensalidades recorrentes
  db.collection("mensalidades")
    .orderBy("vencimento", "desc")
    .onSnapshot((mensalidadeSnapshot) => {
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
    }, (erro) => {
      console.error("Erro ao carregar mensalidades:", erro);
    });

  // Carregar recebimentos manuais
  db.collection("recebimentos")
    .orderBy("vencimento", "desc")
    .onSnapshot((snapshot) => {
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
    }, (erro) => {
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
    .then(() => {
      alert("Recebimento removido!");
      carregarRecebimentos();
      carregarFinanceiro();
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
  const descricao = document.getElementById("desp_descricao").value;
  const categoria = document.getElementById("desp_categoria").value;
  const valor = Number(document.getElementById("desp_valor").value);
  const vencimento = document.getElementById("desp_vencimento").value;
  const status = document.getElementById("desp_status").value;
  const observacao = document.getElementById("desp_observacao").value;

  if (!descricao || !categoria || !valor || !vencimento) {
    alert("Preencha todos os campos obrigatórios!");
    return;
  }

  db.collection("despesas")
    .add({
      descricao,
      categoria,
      valor,
      vencimento,
      status,
      observacao,
      dataCadastro: new Date()
    })
    .then(() => {
      alert("Despesa cadastrada com sucesso!");
      fecharModalDespesa();
      limparFormularioDespesa();
      carregarDespesas();
      carregarFinanceiro();
    })
    .catch((erro) => {
      alert("Erro: " + erro.message);
    });
}

function carregarDespesas() {
  db.collection("despesas")
    .orderBy("vencimento", "desc")
    .onSnapshot((snapshot) => {
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
    .then(() => {
      alert("Despesa removida!");
      carregarDespesas();
      carregarFinanceiro();
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

  db.collection("recebimentos")
    .onSnapshot((recebSnapshot) => {
      db.collection("despesas")
        .onSnapshot((despSnapshot) => {
          db.collection("mensalidades")
            .onSnapshot((mensalidadeSnapshot) => {
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
            }, (erro) => {
              console.error("Erro ao atualizar fluxo de caixa com mensalidades:", erro);
            });
        }, (erro) => {
          console.error("Erro ao atualizar fluxo de caixa:", erro);
        });
    }, (erro) => {
      console.error("Erro ao atualizar fluxo de caixa:", erro);
    });
}

// ===========================
// FINANCEIRO - DASHBOARD
// ===========================

function carregarFinanceiro() {
  db.collection("clientes")
    .onSnapshot((clienteSnapshot) => {
      db.collection("recebimentos")
        .onSnapshot((recebSnapshot) => {
          db.collection("despesas")
            .onSnapshot((despSnapshot) => {
              db.collection("mensalidades")
                .onSnapshot((mensalidadeSnapshot) => {
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
            }, (erro) => {
              console.error("Erro ao carregar mensalidades:", erro);
            });
          }, (erro) => {
            console.error("Erro ao carregar despesas:", erro);
          });
        }, (erro) => {
          console.error("Erro ao carregar recebimentos:", erro);
        });
    }, (erro) => {
      console.error("Erro ao carregar clientes:", erro);
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
    document.getElementById("loginTela").style.display = "none";
    document.getElementById("sistema").style.display = "flex";
    mostrarSecao("dashboard");
    carregarClientes();
    carregarPlanos();
    carregarFinanceiro();
    carregarPlanosSelect();
    carregarRecebimentos();
    carregarDespesas();
    atualizarFluxoCaixa();
    verificarGeracaoMensalidades();
  } else {
    document.getElementById("loginTela").style.display = "flex";
    document.getElementById("sistema").style.display = "none";
  }
});
