// ===========================
// GLOBAL VARIABLES
// ===========================

let clienteEditando = null;
let planoEditando = null;

// ===========================
// LOGIN
// ===========================

function fazerLogin() {
  const email = document.getElementById("usuario").value;
  const senha = document.getElementById("senha").value;

  auth.signInWithEmailAndPassword(email, senha)
    .then(() => {
      document.getElementById("loginTela").style.display = "none";
      document.getElementById("sistema").style.display = "flex";
      mostrarSecao("dashboard");
      carregarClientes();
      carregarPlanos();
      carregarFinanceiro();
      carregarPlanosSelect();
    })
    .catch((erro) => {
      alert("Erro: " + erro.message);
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
  const cliente = {
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
    vencimento: document.getElementById("vencimento").value,
    dataCadastro: new Date()
  };

  db.collection("clientes")
    .add(cliente)
    .then(() => {
      alert("Cliente cadastrado com sucesso!");
      limparFormulario();
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

      snapshot.forEach((doc) => {
        const cliente = doc.data();
        totalClientes++;

        if (cliente.status === "Ativo") {
          clientesAtivos++;
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
                ✏️ Editar
              </button>
              <button onclick="excluirCliente('${doc.id}')">
                🗑️ Excluir
              </button>
            </td>
          </tr>
        `;
      });

      document.getElementById("totalClientes").innerText = totalClientes;
      document.getElementById("clientesAtivos").innerText = clientesAtivos;
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
  const plano = {
    nome: document.getElementById("nomePlano").value,
    velocidade: document.getElementById("velocidadePlano").value,
    valor: Number(document.getElementById("valorPlano").value),
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
                ✏️ Editar
              </button>
              <button onclick="excluirPlano('${doc.id}')">
                🗑️ Excluir
              </button>
            </td>
          </tr>
        `;
      });
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
    });
}

// ===========================
// FINANCEIRO
// ===========================

function carregarFinanceiro() {
  db.collection("clientes")
    .onSnapshot((snapshot) => {
      const tabela = document.getElementById("financeiroTabela");
      tabela.innerHTML = "";

      let faturamento = 0;
      let totalClientes = 0;

      snapshot.forEach((doc) => {
        const cliente = doc.data();
        const valor = Number(cliente.valor) || 0;

        faturamento += valor;
        totalClientes++;

        tabela.innerHTML += `
          <tr>
            <td>${cliente.nome || ""}</td>
            <td>${cliente.plano || ""}</td>
            <td>R$ ${valor.toFixed(2)}</td>
          </tr>
        `;
      });

      document.getElementById("faturamentoMensal").innerText =
        "R$ " + faturamento.toFixed(2);

      document.getElementById("ticketMedio").innerText =
        "R$ " +
        (totalClientes > 0 ? (faturamento / totalClientes).toFixed(2) : "0.00");
    });
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
  }
});
