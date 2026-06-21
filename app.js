// ===========================
// CONTROLISP - APP PRINCIPAL v4.0
// Versão Premium SaaS - Logo Fix + Block System
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

// Chart instances
let chartReceitaMensal = null;
let chartClientesPorPlano = null;
let chartReceitaPorPlano = null;
let chartEvolucaoClientes = null;
let chartInadimplenciaMensal = null;

// ===========================
// AUTH & TENANT HELPERS
// ===========================

function isMasterAdmin() {
  return usuarioAtual.role === 'MASTER_ADMIN' || usuarioAtual.role === 'superadmin';
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
    console.warn('Não foi possível obter custom claims:', erro);
  }

  try {
    // Try empresas collection first (used in signup)
    const empresaDoc = await db.collection('empresas').doc(usuarioAtual.uid).get();
    if (empresaDoc.exists) {
      const data = empresaDoc.data();
      // Check if company is blocked
      if (data.status === 'blocked' || data.status === 'suspended' || data.status === 'cancelled') {
        throw { code: 'EMPRESA_BLOQUEADA', message: 'Seu acesso foi bloqueado. Entre em contato com o suporte.', data: data };
      }
      if (data.role) usuarioAtual.role = data.role;
      if (data.tenantId) usuarioAtual.tenantId = data.tenantId;
    } else {
      // Fallback to usuarios collection
      const userDoc = await db.collection('usuarios').doc(usuarioAtual.uid).get();
      if (userDoc.exists) {
        const data = userDoc.data();
        if (data.role) usuarioAtual.role = data.role;
        if (data.tenantId) usuarioAtual.tenantId = data.tenantId;
      }
    }
  } catch (erro) {
    if (erro.code === 'EMPRESA_BLOQUEADA') throw erro;
    console.warn('Erro ao buscar perfil:', erro);
  }

  mostrarAdminIfNeeded();
  return usuarioAtual;
}

async function verificarStatusEmpresa(uid) {
  try {
    const empresaDoc = await db.collection('empresas').doc(uid).get();
    if (empresaDoc.exists) {
      const data = empresaDoc.data();
      if (data.status === 'blocked' || data.status === 'suspended' || data.status === 'cancelled') {
        return { bloqueado: true, motivo: data.blockedReason || data.suspensionReason || 'Conta bloqueada', status: data.status };
      }
    }
    return { bloqueado: false };
  } catch (e) {
    return { bloqueado: false };
  }
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
  btnAdmin.style.display = isMasterAdmin() ? 'flex' : 'none';
}

// ===========================
// LISTENER REFERENCES
// ===========================

let clientesListener = null;
let planosListener = null;
let financeiroListeners = [];
let recebimentosListener = null;
let despesasListener = null;
let clientesWhatsAppListener = null;
let historicoWhatsAppListener = null;
let cobrancasWhatsAppListener = null;
let inadimplentesMensalidadesListener = null;
let inadimplentesRecebimentosListener = null;
let adminDashboardListener = null;
let adminUsuariosListener = null;

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
  financeiroListeners.forEach(l => { if (l) l(); });
  financeiroListeners = [];
}

// ===========================
// THEME
// ===========================

function initializeTheme() {
  const savedTheme = localStorage.getItem('theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);
}

// ===========================
// PROVIDER IDENTITY
// ===========================

function carregarProviderData() {
  if (!auth.currentUser) return;
  const providerRef = db.collection("providers").doc(getTenantId());

  providerRef.onSnapshot((doc) => {
    const providerNameEl = document.getElementById("providerNameText");
    const providerLogoEl = document.getElementById("providerLogo");

    if (doc.exists) {
      const data = doc.data();
      if (data.providerName && providerNameEl) {
        providerNameEl.textContent = data.providerName.substring(0, 50);
      } else if (providerNameEl) {
        providerNameEl.textContent = "Meu Provedor";
      }

      // Apenas o logo do provedor (topbar) é alterado
      // Sidebar e login mantêm a logo do ControlISP
      if (data.logoUrl) {
        const logoUrl = data.logoUrl;
        if (providerLogoEl) { providerLogoEl.src = logoUrl; providerLogoEl.onerror = function() { this.src = "img/logo.png"; }; }
      } else {
        if (providerLogoEl) providerLogoEl.src = "img/logo.png";
      }
    } else {
      if (providerNameEl) providerNameEl.textContent = "Meu Provedor";
      criarProviderDoc();
    }
  }, () => {
    const el = document.getElementById("providerNameText");
    if (el) el.textContent = "Meu Provedor";
  });
}

async function criarProviderDoc() {
  if (!auth.currentUser) return;
  try {
    let nomeProvedor = "Meu Provedor";
    try {
      const empresaDoc = await db.collection("empresas").doc(getTenantId()).get();
      if (empresaDoc.exists && empresaDoc.data().nomeProvedor) {
        nomeProvedor = empresaDoc.data().nomeProvedor;
      }
    } catch (e) {}
    
    // Also check usuarios collection
    try {
      const userDoc = await db.collection("usuarios").doc(getTenantId()).get();
      if (userDoc.exists) {
        const data = userDoc.data();
        if (data.nomeEmpresa) nomeProvedor = data.nomeEmpresa;
        else if (data.nomeProvedor) nomeProvedor = data.nomeProvedor;
      }
    } catch (e) {}
    
    await db.collection("providers").doc(getTenantId()).set({
      providerName: nomeProvedor, logoUrl: "", tenantId: getTenantId(),
      updatedAt: new Date(), updatedBy: usuarioAtual.uid
    }, { merge: true });
    const el = document.getElementById("providerNameText");
    if (el) el.textContent = nomeProvedor;
  } catch (erro) {
    console.error("Erro ao criar provider doc:", erro);
  }
}

async function uploadProviderLogo(event) {
  const file = event.target.files[0];
  if (!file) return;
  const tiposPermitidos = ["image/jpeg", "image/png", "image/webp", "image/svg+xml"];
  if (!tiposPermitidos.includes(file.type)) {
    showToast("Formato inválido. Use JPG, PNG ou WEBP.", "error", "Erro");
    return;
  }
  if (file.size > 2 * 1024 * 1024) {
    showToast("A imagem deve ter no máximo 2MB.", "error", "Erro");
    return;
  }
  try {
    showToast("Processando logo...", "info", "Upload");
    
    // Converte a imagem para Base64 (simples, sem Firebase Storage)
    const base64 = await fileToBase64(file);
    
    // Comprime reduzindo qualidade se for muito grande
    const imagemFinal = await comprimirBase64(base64, 400, 0.7);
    
    const tenantId = getTenantId();
    
    // Salva diretamente no Firestore como string Base64
    await db.collection("providers").doc(tenantId).set({
      logoUrl: imagemFinal,
      logoMimeType: file.type,
      updatedAt: new Date(),
      updatedBy: usuarioAtual.uid
    }, { merge: true });
    
    // Também salva na empresa para compatibilidade
    try {
      await db.collection("empresas").doc(tenantId).set({
        logoUrl: imagemFinal,
        updatedAt: new Date()
      }, { merge: true });
    } catch (e) {}
    
    // Atualiza apenas o logo do provedor na topbar
    // Sidebar e login mantêm a logo do ControlISP
    const providerLogoEl = document.getElementById("providerLogo");
    if (providerLogoEl) providerLogoEl.src = imagemFinal;
    
    showToast("Logo atualizada com sucesso!", "success", "Sucesso");
    await registrarAuditoria("logo_atualizada", "Logo do provedor alterada");
  } catch (erro) {
    console.error("Erro ao salvar logo:", erro);
    showToast("Erro ao salvar logo. Tente novamente.", "error", "Erro");
  }
  event.target.value = "";
}

// Converte arquivo para Base64
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Falha ao ler arquivo"));
    reader.readAsDataURL(file);
  });
}

// Comprime imagem Base64 para um tamanho menor
function comprimirBase64(base64, maxSize, qualidade) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = function() {
      const canvas = document.createElement("canvas");
      let width = img.width, height = img.height;
      
      if (width > maxSize || height > maxSize) {
        if (width > height) {
          height = Math.round(height * (maxSize / width));
          width = maxSize;
        } else {
          width = Math.round(width * (maxSize / height));
          height = maxSize;
        }
      }
      
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, width, height);
      
      const dataUrl = canvas.toDataURL("image/jpeg", qualidade);
      resolve(dataUrl);
    };
    img.onerror = () => reject(new Error("Falha ao comprimir imagem"));
    img.src = base64;
  });
}

function editarNomeProvedor() {
  const currentName = document.getElementById("providerNameText")?.textContent || "Meu Provedor";
  const novoNome = prompt("Digite o nome do seu provedor (máx. 50 caracteres):", currentName);
  if (novoNome === null || novoNome.trim() === "") return;
  const nomeLimpo = sanitizarInput(novoNome).substring(0, 50);
  if (!nomeLimpo) { showToast("O nome não pode ficar vazio.", "error", "Erro"); return; }
  db.collection("providers").doc(getTenantId()).set({
    providerName: nomeLimpo, updatedAt: new Date(), updatedBy: usuarioAtual.uid
  }, { merge: true })
  .then(() => {
    document.getElementById("providerNameText").textContent = nomeLimpo;
    showToast("Nome atualizado com sucesso!", "success", "Sucesso");
    registrarAuditoria("nome_provedor_atualizado", `Nome alterado para: ${nomeLimpo}`);
  })
  .catch(() => showToast("Erro ao salvar nome.", "error", "Erro"));
}

// ===========================
// INPUT SANITIZATION
// ===========================

function sanitizarInput(input) {
  if (!input) return "";
  return input.replace(/<[^>]*>/g, "").replace(/[<>\"'&]/g, "").replace(/javascript:/gi, "").replace(/on\w+\s*=/gi, "").trim();
}

function sanitizarEmail(email) {
  if (!email) return "";
  const sanitized = email.toLowerCase().trim().replace(/<[^>]*>/g, "").replace(/javascript:/gi, "");
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sanitized) ? sanitized : "";
}

function sanitizarTelefone(telefone) {
  if (!telefone) return "";
  return telefone.replace(/\D/g, "").substring(0, 11);
}

function sanitizarTexto(texto) {
  if (!texto) return "";
  return texto.replace(/<[^>]*>/g, "").replace(/javascript:/gi, "").replace(/on\w+\s*=/gi, "").trim();
}

// ===========================
// AUDIT LOGGING
// ===========================

async function registrarAuditoria(acao, descricao) {
  if (!auth.currentUser) return;
  try {
    await db.collection("auditoria").add({
      tenantId: getTenantId(), createdBy: usuarioAtual.uid,
      usuarioEmail: auth.currentUser.email, acao: acao,
      descricao: descricao, dataHora: new Date(),
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
  } catch (erro) { console.error("Erro ao registrar auditoria:", erro); }
}

async function registrarAuditLog(empresaId, acao, detalhes) {
  if (!auth.currentUser) return;
  try {
    await db.collection("auditLogs").add({
      userId: auth.currentUser.uid,
      empresaId: empresaId || getTenantId(),
      acao: acao,
      data: new Date(),
      detalhes: detalhes,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
  } catch (erro) { console.error("Erro ao registrar auditLog:", erro); }
}

// ===========================
// SYSTEM CONFIG
// ===========================

let configuracoesSistema = {
  planos: { "Básico": 49.90, "Pro": 99.90, "Enterprise": 199.90 },
  paginacao: { clientes: 20, recebimentos: 20, despesas: 20 }
};

async function carregarConfiguracoesSistema() {
  try {
    const configDocId = isMasterAdmin() ? 'sistema' : usuarioAtual.tenantId;
    const doc = await db.collection("configuracoes").doc(configDocId).get();
    if (doc.exists) configuracoesSistema = { ...configuracoesSistema, ...doc.data() };
  } catch (erro) { console.error("Erro ao carregar config:", erro); }
}

// ===========================
// TOAST NOTIFICATION SYSTEM
// ===========================

function showToast(message, type = 'info', title = '') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const icons = {
    success: 'fa-check-circle', error: 'fa-exclamation-circle',
    info: 'fa-info-circle', warning: 'fa-exclamation-triangle'
  };
  const titles = {
    success: 'Sucesso', error: 'Erro', warning: 'Atenção', info: 'Informação'
  };

  const toast = document.createElement('div');
  toast.className = 'toast toast-' + type;
  toast.innerHTML = `
    <div class="toast-icon"><i class="fas ${icons[type] || icons.info}"></i></div>
    <div class="toast-content">
      <div class="toast-title">${title || titles[type] || 'Info'}</div>
      <div class="toast-message">${message}</div>
    </div>
    <button class="toast-close" onclick="this.parentElement.remove()"><i class="fas fa-times"></i></button>`;

  container.appendChild(toast);
  container.style.display = 'block';

  setTimeout(() => {
    if (toast.parentElement) {
      toast.classList.add('toast-out');
      setTimeout(() => {
        if (toast.parentElement) { toast.remove(); if (container.children.length === 0) container.style.display = 'none'; }
      }, 300);
    }
  }, 4000);
}

// ===========================
// INPUT MASKS
// ===========================

function aplicarMascaraWhatsApp(input) {
  input.addEventListener('input', function () {
    let value = this.value.replace(/\D/g, '').substring(0, 11);
    if (value.length > 6) this.value = '(' + value.substring(0, 2) + ') ' + value.substring(2, 7) + '-' + value.substring(7);
    else if (value.length > 2) this.value = '(' + value.substring(0, 2) + ') ' + value.substring(2);
    else if (value.length > 0) this.value = '(' + value;
  });
}

function aplicarMascaraCpfCnpj(input) {
  input.addEventListener('input', function () {
    let value = this.value.replace(/\D/g, '').substring(0, 14);
    if (value.length <= 11) {
      if (value.length > 9) this.value = value.substring(0,3)+'.'+value.substring(3,6)+'.'+value.substring(6,9)+'-'+value.substring(9);
      else if (value.length > 6) this.value = value.substring(0,3)+'.'+value.substring(3,6)+'.'+value.substring(6);
      else if (value.length > 3) this.value = value.substring(0,3)+'.'+value.substring(3);
    } else {
      if (value.length > 12) this.value = value.substring(0,2)+'.'+value.substring(2,5)+'.'+value.substring(5,8)+'/'+value.substring(8,12)+'-'+value.substring(12);
      else if (value.length > 8) this.value = value.substring(0,2)+'.'+value.substring(2,5)+'.'+value.substring(5,8)+'/'+value.substring(8);
      else if (value.length > 5) this.value = value.substring(0,2)+'.'+value.substring(2,5)+'.'+value.substring(5);
      else if (value.length > 2) this.value = value.substring(0,2)+'.'+value.substring(2);
    }
  });
}

function toggleSenhaVisibilidade(inputId, btnElement) {
  const input = document.getElementById(inputId);
  if (!input) return;
  const icon = btnElement.querySelector('i');
  if (input.type === 'password') {
    input.type = 'text';
    if (icon) { icon.classList.remove('fa-eye'); icon.classList.add('fa-eye-slash'); }
  } else {
    input.type = 'password';
    if (icon) { icon.classList.remove('fa-eye-slash'); icon.classList.add('fa-eye'); }
  }
}

// ===========================
// BLOCKED SCREEN
// ===========================

function mostrarTelaBloqueio(motivo, status) {
  const loginTela = document.getElementById("loginTela");
  const sistema = document.getElementById("sistema");
  const blockedTela = document.getElementById("blockedTela");
  
  if (loginTela) loginTela.style.display = "none";
  if (sistema) sistema.style.display = "none";
  if (blockedTela) {
    const motivoEl = document.getElementById("blockedMotivo");
    const statusEl = document.getElementById("blockedStatus");
    if (motivoEl) motivoEl.textContent = motivo || "Conta bloqueada pelo administrador.";
    if (statusEl) {
      const statusLabels = {
        'blocked': 'Conta Bloqueada',
        'suspended': 'Conta Suspensa',
        'cancelled': 'Conta Cancelada'
      };
      statusEl.textContent = statusLabels[status] || 'Acesso Restrito';
    }
    blockedTela.style.display = "flex";
  }
}

function esconderTelaBloqueio() {
  const blockedTela = document.getElementById("blockedTela");
  if (blockedTela) blockedTela.style.display = "none";
}

// ===========================
// LOGIN
// ===========================

async function fazerLogin() {
  const email = sanitizarEmail(document.getElementById("usuario").value);
  const senha = document.getElementById("senha").value;
  if (!email || !senha) { showToast("Preencha e-mail e senha!", "error", "Login"); return; }

  try {
    const userCredential = await auth.signInWithEmailAndPassword(email, senha);
    
    // Check if company is blocked before proceeding
    try {
      await carregarUsuarioAtual();
    } catch (blockError) {
      if (blockError.code === 'EMPRESA_BLOQUEADA') {
        await auth.signOut();
        mostrarTelaBloqueio(blockError.message, blockError.data?.status);
        return;
      }
    }
    
    if (usuarioAtual.role === 'superadmin' || usuarioAtual.role === 'MASTER_ADMIN') {
      window.location.href = 'superadmin.html';
      return;
    }
    
    document.getElementById("loginTela").style.display = "none";
    document.getElementById("sistema").style.display = "flex";
    esconderTelaBloqueio();
    mostrarSecao("dashboard");
    initializeTheme();
    await carregarConfiguracoesSistema();
    await registrarAuditoria("login", "Usuário fez login");
    carregarDadosIniciais();
  } catch (erro) {
    if (erro.code === 'EMPRESA_BLOQUEADA') return;
    showToast("Erro de login: " + tratarErroFirebase(erro), "error", "Login");
  }
}

// ===========================
// CADASTRO
// ===========================

function mostrarCadastro() {
  document.getElementById('loginTela').style.display = 'none';
  const cadastroTela = document.getElementById('cadastroTela');
  if (cadastroTela) cadastroTela.style.display = 'flex';
  limparMensagensCadastro();
}

function voltarParaLogin() {
  const cadastroTela = document.getElementById('cadastroTela');
  if (cadastroTela) cadastroTela.style.display = 'none';
  document.getElementById('loginTela').style.display = 'flex';
  limparMensagensCadastro();
}

function limparMensagensCadastro() {
  const msgErro = document.getElementById('cadastroMsgErro');
  const msgSucesso = document.getElementById('cadastroMsgSucesso');
  const loading = document.getElementById('cadastroLoading');
  if (msgErro) msgErro.style.display = 'none';
  if (msgSucesso) msgSucesso.style.display = 'none';
  if (loading) loading.style.display = 'none';
}

function mostrarErroCadastro(mensagem) {
  const msgEl = document.getElementById('cadastroMsgErro');
  const sucessoEl = document.getElementById('cadastroMsgSucesso');
  if (msgEl) { msgEl.textContent = mensagem; msgEl.style.display = 'block'; }
  if (sucessoEl) sucessoEl.style.display = 'none';
}

function mostrarSucessoCadastro(mensagem) {
  const msgEl = document.getElementById('cadastroMsgSucesso');
  const erroEl = document.getElementById('cadastroMsgErro');
  if (msgEl) { msgEl.textContent = mensagem; msgEl.style.display = 'block'; }
  if (erroEl) erroEl.style.display = 'none';
}

function setCadastroLoading(ativo) {
  const loading = document.getElementById('cadastroLoading');
  const btn = document.getElementById('btnCriarConta');
  if (loading) loading.style.display = ativo ? 'flex' : 'none';
  if (btn) btn.disabled = ativo;
}

function validarEmail(email) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email); }

function tratarErroFirebase(erro) {
  const codigo = erro.code || erro.message || '';
  if (codigo.includes('email-already-in-use') || codigo.includes('EMAIL_EXISTS')) return 'Este e-mail já está cadastrado.';
  if (codigo.includes('weak-password') || codigo.includes('WEAK_PASSWORD')) return 'Senha muito fraca. Use 6+ caracteres.';
  if (codigo.includes('invalid-email') || codigo.includes('INVALID_EMAIL')) return 'Formato de e-mail inválido.';
  if (codigo.includes('network-error') || codigo.includes('NETWORK_ERROR')) return 'Erro de conexão. Verifique sua internet.';
  if (codigo.includes('too-many-requests')) return 'Muitas tentativas. Aguarde alguns minutos.';
  if (codigo.includes('user-not-found') || codigo.includes('USER_NOT_FOUND')) return 'Usuário não encontrado.';
  if (codigo.includes('wrong-password') || codigo.includes('INVALID_PASSWORD')) return 'Senha incorreta.';
  if (codigo.includes('user-disabled') || codigo.includes('USER_DISABLED')) return 'Conta desabilitada. Entre em contato com o suporte.';
  if (codigo === 'EMPRESA_BLOQUEADA') return 'Conta bloqueada. Entre em contato com o suporte.';
  return erro.message || 'Erro inesperado. Tente novamente.';
}

async function cadastrarUsuario() {
  limparMensagensCadastro();
  setCadastroLoading(true);
  try {
    const nomeProvedor = sanitizarInput(document.getElementById('cad_nomeProvedor').value);
    const whatsapp = sanitizarTelefone(document.getElementById('cad_whatsapp').value);
    const cidade = sanitizarInput(document.getElementById('cad_cidade').value);
    const nome = sanitizarInput(document.getElementById('cad_nome').value);
    const email = sanitizarEmail(document.getElementById('cad_email').value);
    const senha = document.getElementById('cad_senha').value;
    const confirmarSenha = document.getElementById('cad_confirmarSenha').value;
    const aceitoTermos = document.getElementById('cad_termos').checked;

    if (!nomeProvedor) throw new Error('Informe o nome do provedor.');
    if (!whatsapp || whatsapp.length < 10) throw new Error('WhatsApp inválido.');
    if (!cidade) throw new Error('Informe a cidade.');
    if (!nome) throw new Error('Informe o nome do administrador.');
    if (!email) throw new Error('Informe o e-mail.');
    if (!senha || senha.length < 8) throw new Error('Senha deve ter 8+ caracteres.');
    if (senha !== confirmarSenha) throw new Error('Senhas não conferem.');
    if (!aceitoTermos) throw new Error('Aceite os Termos de Uso.');

    const userCredential = await auth.createUserWithEmailAndPassword(email, senha);
    const user = userCredential.user;
    const agora = new Date();
    const dataExpiracao = new Date(agora);
    dataExpiracao.setDate(dataExpiracao.getDate() + 15);
    const empresaId = user.uid;

    // Create empresa document
    await db.collection('empresas').doc(empresaId).set({
      empresaId,
      nomeProvedor: nomeProvedor,
      nomeEmpresa: nomeProvedor,
      responsavel: nome,
      whatsappPrincipal: whatsapp,
      cidade: cidade,
      email: email,
      plano: 'Teste 15 dias',
      status: 'trial',
      trialStartDate: firebase.firestore.FieldValue.serverTimestamp(),
      trialEndDate: firebase.firestore.Timestamp.fromDate(dataExpiracao),
      trialDaysRemaining: 15,
      logoUrl: '',
      role: 'admin',
      tenantId: empresaId,
      limiteClientes: 300,
      clientesAtivos: 0,
      dataCadastro: firebase.firestore.FieldValue.serverTimestamp(),
      dataExpiracao: firebase.firestore.Timestamp.fromDate(dataExpiracao),
      createdBy: user.uid,
      updatedBy: user.uid,
      updatedAt: new Date()
    });

    // Create user document
    await db.collection('usuarios').doc(user.uid).set({
      uid: user.uid,
      empresaId,
      nome,
      nomeEmpresa: nomeProvedor,
      email,
      role: 'admin',
      ativo: true,
      status: 'trial',
      tenantId: empresaId,
      plano: 'Teste 15 dias',
      dataExpiracaoTeste: firebase.firestore.Timestamp.fromDate(dataExpiracao),
      criadoEm: firebase.firestore.FieldValue.serverTimestamp(),
      ultimoLogin: firebase.firestore.FieldValue.serverTimestamp()
    });

    // Create provider document for logo
    await db.collection("providers").doc(empresaId).set({
      providerName: nomeProvedor,
      logoUrl: "",
      tenantId: empresaId,
      updatedAt: new Date(),
      updatedBy: user.uid
    }, { merge: true });

    mostrarSucessoCadastro('Conta criada com sucesso! Redirecionando...');
    await registrarAuditLog(empresaId, 'empresaCriada', `Novo provedor: ${nomeProvedor}`);
    await new Promise(resolve => setTimeout(resolve, 800));
    await carregarUsuarioAtual();

    document.getElementById('cadastroTela').style.display = 'none';
    document.getElementById('loginTela').style.display = 'none';
    document.getElementById('sistema').style.display = 'flex';
    esconderTelaBloqueio();
    mostrarSecao('dashboard');
    initializeTheme();
    await carregarConfiguracoesSistema();
    await registrarAuditoria('cadastro', `Novo provedor: ${nomeProvedor} - ${email}`);
    carregarDadosIniciais();
  } catch (erro) {
    mostrarErroCadastro(tratarErroFirebase(erro));
    console.error('Erro no cadastro:', erro);
  } finally {
    setCadastroLoading(false);
  }
}

function atualizarForcaSenhaCadastro() {
  const senha = document.getElementById('cad_senha').value;
  const indicator = document.getElementById('cadastroStrengthIndicator');
  const text = document.getElementById('cadastroStrengthText');
  if (!indicator || !text) return;
  let forca = 0, cor = '#EF4444', texto = '';
  if (senha.length >= 6) forca += 20;
  if (senha.length >= 8) forca += 20;
  if (/[a-z]/.test(senha)) forca += 15;
  if (/[A-Z]/.test(senha)) forca += 15;
  if (/[0-9]/.test(senha)) forca += 15;
  if (/[^a-zA-Z0-9]/.test(senha)) forca += 15;
  if (senha.length === 0) { forca = 0; texto = ''; cor = 'transparent'; }
  else if (forca <= 25) { texto = 'Fraca'; cor = '#EF4444'; }
  else if (forca <= 50) { texto = 'Média'; cor = '#F59E0B'; }
  else if (forca <= 75) { texto = 'Boa'; cor = '#34D399'; }
  else { texto = 'Forte'; cor = '#10B981'; }
  indicator.style.width = forca + '%';
  indicator.style.background = cor;
  text.textContent = texto;
  text.style.color = cor;
}

// ===========================
// DOM READY
// ===========================

document.addEventListener('DOMContentLoaded', function () {
  const waInput = document.getElementById('cad_whatsapp');
  if (waInput) aplicarMascaraWhatsApp(waInput);

  const senhaInput = document.getElementById('cad_senha');
  if (senhaInput) senhaInput.addEventListener('input', atualizarForcaSenhaCadastro);

  const cadastroForm = document.getElementById('cadastroTela');
  if (cadastroForm) {
    cadastroForm.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); cadastrarUsuario(); }
    });
  }

  const confirmModal = document.getElementById('confirmDeleteModal');
  if (confirmModal) {
    confirmModal.addEventListener('click', function(e) {
      if (e.target === this) fecharModalConfirmacao();
    });
  }

  // Template change handlers
  const templateIndividual = document.getElementById("wa_template_individual");
  const templateMassa = document.getElementById("wa_template_massa");
  if (templateIndividual) {
    templateIndividual.addEventListener("change", function () {
      if (this.value !== "personalizado") carregarTemplateNaTextarea(this.value, "wa_mensagem_individual");
    });
  }
  if (templateMassa) {
    templateMassa.addEventListener("change", function () {
      if (this.value !== "personalizado") carregarTemplateNaTextarea(this.value, "wa_mensagem_massa");
    });
  }
});

// ===========================
// INITIAL DATA LOAD
// ===========================

function carregarDadosIniciais() {
  carregarProviderData();
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
  carregarDashboardPremium();

  if (usuarioAtual.role === "admin" || isMasterAdmin()) {
    carregarDashboardAdmin();
    carregarUsuariosAdmin();
  }

  // Set current date
  const dataEl = document.getElementById("dataAtualDashboard");
  if (dataEl) {
    dataEl.textContent = new Date().toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  }
  const dataFinEl = document.getElementById("dataAtualFinanceiro");
  if (dataFinEl) {
    dataFinEl.textContent = new Date().toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  }
}

// ===========================
// MENU & SIDEBAR
// ===========================

function mostrarSecao(id) {
  if (id === 'administracao' && !isMasterAdmin()) {
    showToast('Acesso negado.', 'error', 'Permissão');
    return;
  }

  document.querySelectorAll(".secao").forEach(secao => { secao.style.display = "none"; });
  const el = document.getElementById(id);
  if (el) el.style.display = "block";

  // Update sidebar active
  document.querySelectorAll('.sidebar-nav-item').forEach(item => {
    item.classList.remove('active');
    const onclick = item.getAttribute('onclick') || '';
    if (onclick.includes("'" + id + "'") || onclick.includes('"' + id + '"')) {
      item.classList.add('active');
    }
  });

  // Close sidebar on mobile
  if (window.innerWidth <= 900) {
    const sidebar = document.getElementById('mainSidebar');
    const overlay = document.getElementById('sidebarOverlay');
    if (sidebar && sidebar.classList.contains('open')) {
      sidebar.classList.remove('open');
      overlay.classList.remove('open');
    }
  }
}

function toggleSidebar() {
  const sidebar = document.getElementById('mainSidebar');
  const overlay = document.getElementById('sidebarOverlay');
  if (!sidebar || !overlay) return;
  const isOpen = sidebar.classList.contains('open');
  sidebar.classList.toggle('open');
  overlay.classList.toggle('open');
  document.body.style.overflow = isOpen ? '' : 'hidden';
  const btn = document.getElementById('mobileMenuBtn');
  if (btn) {
    btn.setAttribute('aria-expanded', !isOpen);
    btn.setAttribute('title', isOpen ? 'Abrir menu' : 'Fechar menu');
  }
}

window.addEventListener('resize', function() {
  if (window.innerWidth > 900) {
    const sidebar = document.getElementById('mainSidebar');
    const overlay = document.getElementById('sidebarOverlay');
    if (sidebar && sidebar.classList.contains('open')) {
      sidebar.classList.remove('open');
      overlay.classList.remove('open');
      document.body.style.overflow = '';
    }
  }
});

document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    const sidebar = document.getElementById('mainSidebar');
    if (sidebar && sidebar.classList.contains('open')) toggleSidebar();
  }
});

// ===========================
// DASHBOARD PREMIUM
// ===========================

function carregarDashboardPremium() {
  if (!auth.currentUser) return;

  const tenantId = getTenantId();
  const agora = new Date();
  const dataBrasil = new Date(agora.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  const mesAtual = dataBrasil.getMonth();
  const anoAtual = dataBrasil.getFullYear();
  const mesPassado = mesAtual === 0 ? 11 : mesAtual - 1;
  const anoPassado = mesAtual === 0 ? anoAtual - 1 : anoAtual;

  Promise.all([
    db.collection("clientes").where("tenantId", "==", tenantId).get(),
    db.collection("recebimentos").where("tenantId", "==", tenantId).get(),
    db.collection("mensalidades").where("tenantId", "==", tenantId).get(),
    db.collection("planos").where("tenantId", "==", tenantId).get()
  ]).then(([clientesSnap, recebSnap, mensalidadesSnap, planosSnap]) => {
    document.getElementById('skeletonDashboard').style.display = 'none';
    document.getElementById('dashboardCards').style.display = 'grid';
    document.getElementById('chartsContainer').style.display = 'grid';
    document.getElementById('tabelaAtrasoContainer').style.display = 'block';

    let totalClientes = 0, clientesAtivos = 0, clientesInadimplentes = 0;
    let faturamentoMensal = 0, receitaRecebidaMes = 0, receitaPrevista = 0;
    let novosClientesMes = 0;
    let valorAtraso = 0;
    let clientesCadastrosMeses = {};
    let clientesPorPlano = {};
    let receitaPorPlano = {};
    let receitaPorMes = {};
    let inadimplenciaPorMes = {};
    let receitaMesPassado = 0;
    let clientesMesPassado = 0;

    for (let i = 0; i < 12; i++) {
      const key = `${String(i+1).padStart(2,'0')}/${anoAtual}`;
      clientesCadastrosMeses[key] = 0;
      receitaPorMes[key] = { previsto: 0, recebido: 0 };
      inadimplenciaPorMes[key] = { total: 0, atrasado: 0 };
    }

    clientesSnap.forEach(doc => {
      const c = doc.data();
      totalClientes++;
      if (c.status === "Ativo") { clientesAtivos++; faturamentoMensal += Number(c.valor) || 0; receitaPrevista += Number(c.valor) || 0; }
      if (c.status === "Inadimplente") clientesInadimplentes++;
      if (c.dataCadastro) {
        const data = c.dataCadastro.toDate ? c.dataCadastro.toDate() : new Date(c.dataCadastro);
        if (data.getMonth() === mesAtual && data.getFullYear() === anoAtual) novosClientesMes++;
        if (data.getMonth() === mesPassado && data.getFullYear() === anoPassado) clientesMesPassado++;
        const key = `${String(data.getMonth()+1).padStart(2,'0')}/${data.getFullYear()}`;
        if (clientesCadastrosMeses[key] !== undefined) clientesCadastrosMeses[key]++;
      }
      const planoNome = c.plano || "Sem Plano";
      if (!clientesPorPlano[planoNome]) { clientesPorPlano[planoNome] = 0; receitaPorPlano[planoNome] = 0; }
      clientesPorPlano[planoNome]++;
      receitaPorPlano[planoNome] += Number(c.valor) || 0;
    });

    const statusRecebido = ["Pago", "Recebido", "Quitado"];
    recebSnap.forEach(doc => {
      const r = doc.data();
      if (statusRecebido.includes(r.status)) {
        const dataPag = r.dataPagamento ? (r.dataPagamento.toDate ? r.dataPagamento.toDate() : new Date(r.dataPagamento)) : new Date(r.vencimento);
        if (dataPag.getMonth() === mesAtual && dataPag.getFullYear() === anoAtual) receitaRecebidaMes += Number(r.valor) || 0;
        if (dataPag.getMonth() === mesPassado && dataPag.getFullYear() === anoPassado) receitaMesPassado += Number(r.valor) || 0;
        const key = `${String(dataPag.getMonth()+1).padStart(2,'0')}/${dataPag.getFullYear()}`;
        if (receitaPorMes[key]) receitaPorMes[key].recebido += Number(r.valor) || 0;
      }
    });

    mensalidadesSnap.forEach(doc => {
      const m = doc.data();
      if (statusRecebido.includes(m.status)) {
        const dataPag = m.dataPagamento ? (m.dataPagamento.toDate ? m.dataPagamento.toDate() : new Date(m.dataPagamento)) : new Date(m.vencimento);
        if (dataPag.getMonth() === mesAtual && dataPag.getFullYear() === anoAtual) receitaRecebidaMes += Number(m.valor) || 0;
        if (dataPag.getMonth() === mesPassado && dataPag.getFullYear() === anoPassado) receitaMesPassado += Number(m.valor) || 0;
        const key = `${String(dataPag.getMonth()+1).padStart(2,'0')}/${dataPag.getFullYear()}`;
        if (receitaPorMes[key]) receitaPorMes[key].recebido += Number(m.valor) || 0;
      }
      if (m.status === "Atrasado" || m.status === "Vencido") {
        valorAtraso += Number(m.valor) || 0;
        const dataVenc = new Date(m.vencimento);
        const inadiKey = `${String(dataVenc.getMonth()+1).padStart(2,'0')}/${dataVenc.getFullYear()}`;
        if (inadimplenciaPorMes[inadiKey]) inadimplenciaPorMes[inadiKey].atrasado += Number(m.valor) || 0;
      }
    });

    for (let i = 0; i < 12; i++) {
      const key = `${String(i+1).padStart(2,'0')}/${anoAtual}`;
      if (receitaPorMes[key]) receitaPorMes[key].previsto = faturamentoMensal;
    }

    const taxaInadimplencia = faturamentoMensal > 0 ? (clientesInadimplentes / clientesAtivos * 100) : 0;
    const setText = (id, val) => { const el = document.getElementById(id); if (el) el.innerText = val; };
    // Ticket Médio = Faturamento Total / Número de Clientes Ativos
    const ticketMedio = clientesAtivos > 0 ? faturamentoMensal / clientesAtivos : 0;

    // Faturamento Anual = soma de todos os pagamentos confirmados dos últimos 12 meses
    let faturamentoAnual = 0;
    const umAnoAtras = new Date(dataBrasil);
    umAnoAtras.setFullYear(umAnoAtras.getFullYear() - 1);
    recebSnap.forEach(doc => {
      const r = doc.data();
      if (statusRecebido.includes(r.status)) {
        const dataPag = r.dataPagamento ? (r.dataPagamento.toDate ? r.dataPagamento.toDate() : new Date(r.dataPagamento)) : new Date(r.vencimento);
        if (dataPag >= umAnoAtras && dataPag <= dataBrasil) {
          faturamentoAnual += Number(r.valor) || 0;
        }
      }
    });
    mensalidadesSnap.forEach(doc => {
      const m = doc.data();
      if (statusRecebido.includes(m.status)) {
        const dataPag = m.dataPagamento ? (m.dataPagamento.toDate ? m.dataPagamento.toDate() : new Date(m.dataPagamento)) : new Date(m.vencimento);
        if (dataPag >= umAnoAtras && dataPag <= dataBrasil) {
          faturamentoAnual += Number(m.valor) || 0;
        }
      }
    });

    setText("receitaRecebidaMes", "R$ " + receitaRecebidaMes.toFixed(2));
    setText("receitaPrevista", "R$ " + receitaPrevista.toFixed(2));
    setText("clientesAtivos", clientesAtivos);
    setText("clientesInadimplentes", clientesInadimplentes);
    setText("taxaInadimplencia", taxaInadimplencia.toFixed(1) + "%");
    setText("ticketMedioDashboard", "R$ " + ticketMedio.toFixed(2));
    setText("faturamentoAnual", "R$ " + faturamentoAnual.toFixed(2));

    const percReceita = receitaMesPassado > 0 ? ((receitaRecebidaMes - receitaMesPassado) / receitaMesPassado * 100) : 0;
    const trendReceita = document.getElementById("trendReceitaRecebida");
    if (trendReceita) {
      trendReceita.innerHTML = `<span class="trend-icon"><i class="fas fa-arrow-${percReceita >= 0 ? 'up' : 'down'}"></i></span><span class="trend-value">${percReceita >= 0 ? '+' : ''}${percReceita.toFixed(1)}%</span><span class="trend-label">vs. mês anterior</span>`;
    }
    const trendClientes = document.getElementById("trendClientesAtivos");
    if (trendClientes) {
      trendClientes.innerHTML = `<span class="trend-icon"><i class="fas fa-arrow-up"></i></span><span class="trend-value">+0</span><span class="trend-label">novos este mês</span>`;
    }
    const trendInad = document.getElementById("trendInadimplentes");
    if (trendInad) {
      trendInad.innerHTML = `<span class="trend-icon"><i class="fas fa-arrow-down"></i></span><span class="trend-value">${taxaInadimplencia.toFixed(1)}%</span><span class="trend-label">taxa de inadimplência</span>`;
    }
    const trendTaxa = document.getElementById("trendTaxaInadimplencia");
    if (trendTaxa) {
      trendTaxa.innerHTML = `<span class="trend-icon"><i class="fas fa-arrow-down"></i></span><span class="trend-value">${taxaInadimplencia.toFixed(1)}%</span><span class="trend-label">do faturamento</span>`;
    }
    const trendFaturamentoAnual = document.getElementById("trendFaturamentoAnual");
    if (trendFaturamentoAnual) {
      trendFaturamentoAnual.innerHTML = `<span class="trend-icon"><span style="font-weight:700;font-size:13px;">R$</span></span><span class="trend-value">+${faturamentoAnual.toFixed(0)}</span><span class="trend-label">últimos 12 meses</span>`;
    }
    criarGraficos(receitaPorMes, clientesPorPlano, receitaPorPlano, clientesCadastrosMeses, inadimplenciaPorMes);
  }).catch(erro => {
    console.error("Erro ao carregar dashboard premium:", erro);
    document.getElementById('skeletonDashboard').style.display = 'none';
    document.getElementById('dashboardCards').style.display = 'grid';
  });
}

// ===========================
// CHARTS
// ===========================

function criarGraficos(receitaPorMes, clientesPorPlano, receitaPorPlano, evolucaoClientes, inadimplenciaPorMes) {
  const meses = Object.keys(receitaPorMes).slice(-12);
  const receitaRecebidaData = meses.map(m => receitaPorMes[m]?.recebido || 0);
  const receitaPrevistaData = meses.map(m => receitaPorMes[m]?.previsto || 0);

  Chart.defaults.color = '#94A3B8';
  Chart.defaults.borderColor = 'rgba(255,255,255,0.08)';
  Chart.defaults.font.family = "'Inter', sans-serif";

  const ctx1 = document.getElementById('chartReceitaMensal');
  if (ctx1) {
    if (chartReceitaMensal) chartReceitaMensal.destroy();
    chartReceitaMensal = new Chart(ctx1, {
      type: 'line',
      data: {
        labels: meses,
        datasets: [
          { label: 'Recebido', data: receitaRecebidaData, borderColor: '#10B981', backgroundColor: 'rgba(16,185,129,0.1)', fill: true, tension: 0.4, pointRadius: 4, pointHoverRadius: 6, borderWidth: 2 },
          { label: 'Previsto', data: receitaPrevistaData, borderColor: '#3B82F6', backgroundColor: 'rgba(59,130,246,0.05)', fill: false, tension: 0.4, borderDash: [5, 5], pointRadius: 3, pointHoverRadius: 5, borderWidth: 2 }
        ]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top', labels: { boxWidth: 12, padding: 12, font: { size: 12 } } }, tooltip: { backgroundColor: 'rgba(15,23,42,0.95)', titleFont: { size: 13 }, bodyFont: { size: 12 }, padding: 12, cornerRadius: 8 } }, scales: { y: { beginAtZero: true, ticks: { callback: v => 'R$ ' + v.toFixed(0) } }, x: { grid: { display: false } } } }
    });
  }

  const ctx2 = document.getElementById('chartClientesPorPlano');
  if (ctx2) {
    if (chartClientesPorPlano) chartClientesPorPlano.destroy();
    const colors = ['#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444', '#06B6D4'];
    chartClientesPorPlano = new Chart(ctx2, {
      type: 'doughnut',
      data: { labels: Object.keys(clientesPorPlano), datasets: [{ data: Object.values(clientesPorPlano), backgroundColor: Object.keys(clientesPorPlano).map((_, i) => colors[i % colors.length]), borderWidth: 0 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, padding: 8, font: { size: 11 } } }, tooltip: { backgroundColor: 'rgba(15,23,42,0.95)', callbacks: { label: ctx => ctx.label + ': ' + ctx.parsed + ' clientes' } } } }
    });
  }

  const ctx3 = document.getElementById('chartReceitaPorPlano');
  if (ctx3) {
    if (chartReceitaPorPlano) chartReceitaPorPlano.destroy();
    chartReceitaPorPlano = new Chart(ctx3, {
      type: 'bar',
      data: { labels: Object.keys(receitaPorPlano), datasets: [{ label: 'Receita', data: Object.values(receitaPorPlano), backgroundColor: ['#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444', '#06B6D4'], borderRadius: 6 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { backgroundColor: 'rgba(15,23,42,0.95)', callbacks: { label: ctx => 'R$ ' + ctx.parsed.y.toFixed(2) } } }, scales: { y: { beginAtZero: true, ticks: { callback: v => 'R$ ' + v.toFixed(0) } }, x: { grid: { display: false } } } }
    });
  }

  const ctx4 = document.getElementById('chartEvolucaoClientes');
  if (ctx4) {
    if (chartEvolucaoClientes) chartEvolucaoClientes.destroy();
    const evolData = meses.map(m => evolucaoClientes[m] || 0);
    let acum = 0;
    const acumData = evolData.map(v => { acum += v; return acum; });
    chartEvolucaoClientes = new Chart(ctx4, {
      type: 'line',
      data: { labels: meses, datasets: [{ label: 'Total Acumulado', data: acumData, borderColor: '#8B5CF6', backgroundColor: 'rgba(139,92,246,0.1)', fill: true, tension: 0.4, pointRadius: 3, borderWidth: 2 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top', labels: { boxWidth: 12, font: { size: 12 } } }, tooltip: { backgroundColor: 'rgba(15,23,42,0.95)' } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } }, x: { grid: { display: false } } } }
    });
  }

  const ctx5 = document.getElementById('chartInadimplenciaMensal');
  if (ctx5) {
    if (chartInadimplenciaMensal) chartInadimplenciaMensal.destroy();
    const inadiData = meses.map(m => inadimplenciaPorMes[m]?.atrasado || 0);
    chartInadimplenciaMensal = new Chart(ctx5, {
      type: 'bar',
      data: { labels: meses, datasets: [{ label: 'Valor em Atraso', data: inadiData, backgroundColor: 'rgba(239,68,68,0.7)', borderColor: '#EF4444', borderWidth: 1, borderRadius: 4 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { backgroundColor: 'rgba(15,23,42,0.95)', callbacks: { label: ctx => 'R$ ' + ctx.parsed.y.toFixed(2) } } }, scales: { y: { beginAtZero: true, ticks: { callback: v => 'R$ ' + v.toFixed(0) } }, x: { grid: { display: false } } } }
    });
  }
}

// ===========================
// CLIENTES CRUD
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
    showToast("Preencha: Nome, Telefone e E-mail!", "error", "Validação");
    return;
  }

  const cliente = secureData({
    nome, cpf, telefone, email, endereco, bairro, cidade, cep,
    status, plano, valor, vencimento, dataCadastro: new Date()
  });

  db.collection("clientes")
    .add(cliente)
    .then(async (docRef) => {
      showToast("Cliente cadastrado com sucesso!", "success", "Sucesso");
      limparFormulario();
      carregarFinanceiro();
      carregarDashboardPremium();
      await registrarAuditoria("cliente_criado", `Cliente cadastrado: ${nome}`);
      if (status === "Ativo" && valor > 0 && vencimento) {
        gerarMensalidadeInicial(docRef.id, nome, plano, valor, vencimento);
      }
    })
    .catch((erro) => {
      showToast("Erro ao salvar: " + erro.message, "error", "Erro");
    });
}

function carregarClientes() {
  if (!auth.currentUser) { console.error("Usuário não está logado!"); return; }
  if (clientesListener) clientesListener();
  let query = db.collection("clientes").where("tenantId", "==", getTenantId()).orderBy("nome").limit(configuracoesSistema.paginacao.clientes);
  if (clientesLastDoc) query = query.startAfter(clientesLastDoc);
  clientesListener = query.onSnapshot((snapshot) => {
    const tabela = document.getElementById("listaClientes");
    if (!tabela) return;
    tabela.innerHTML = "";
    let totalClientes = 0, clientesAtivos = 0, faturamentoTotal = 0;
    snapshot.forEach((doc) => {
      const cliente = doc.data();
      totalClientes++;
      if (cliente.status === "Ativo") { clientesAtivos++; faturamentoTotal += Number(cliente.valor) || 0; }
      tabela.innerHTML += `<tr><td>${cliente.nome || ""}</td><td>${cliente.telefone || ""}</td><td>${cliente.status || ""}</td><td>${cliente.plano || ""}</td><td>${cliente.vencimento || ""}</td><td><div class="action-buttons"><button class="btn-action btn-action-edit" onclick="editarCliente('${doc.id}')" title="Editar"><i class="fas fa-pen-to-square"></i><span class="tooltip-text">Editar</span></button><button class="btn-action btn-action-delete" onclick="abrirModalExclusao('cliente', '${doc.id}', '${cliente.nome}')" title="Excluir"><i class="fas fa-trash-can"></i><span class="tooltip-text">Excluir</span></button></div></td></tr>`;
    });
    clientesLastDoc = snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null;
    const totalClientesEl = document.getElementById("totalClientes");
    if (totalClientesEl) totalClientesEl.innerText = totalClientes;
    const clientesAtivosEl = document.getElementById("clientesAtivos");
    if (clientesAtivosEl) clientesAtivosEl.innerText = clientesAtivos;
    const faturamentoMensalEl = document.getElementById("faturamentoMensal");
    if (faturamentoMensalEl) faturamentoMensalEl.innerText = "R$ " + faturamentoTotal.toFixed(2);
    const ticketMedioEl = document.getElementById("ticketMedio");
    if (ticketMedioEl) ticketMedioEl.innerText = "R$ " + (clientesAtivos > 0 ? (faturamentoTotal / clientesAtivos).toFixed(2) : "0.00");
  }, (erro) => { console.error("Erro ao carregar clientes:", erro); });
}

async function editarCliente(id) {
  try {
    const docRef = await db.collection("clientes").doc(id).get();
    if (!docRef.exists) { showToast("Cliente não encontrado!", "error", "Erro"); return; }
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
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (erro) {
    console.error("Erro ao editar cliente:", erro);
    showToast("Erro ao carregar dados: " + erro.message, "error", "Erro");
  }
}

async function atualizarCliente() {
  const id = clienteEditando || sessionStorage.getItem('clienteEditandoId');
  if (!id) { showToast("Selecione um cliente para editar.", "warning", "Atenção"); return; }
  try {
    const updateData = secureUpdate({
      nome: sanitizarInput(document.getElementById("nome").value), cpf: sanitizarInput(document.getElementById("cpf").value),
      telefone: sanitizarTelefone(document.getElementById("telefone").value), email: sanitizarEmail(document.getElementById("email").value),
      endereco: sanitizarInput(document.getElementById("endereco").value), bairro: sanitizarInput(document.getElementById("bairro").value),
      cidade: sanitizarInput(document.getElementById("cidade").value), cep: sanitizarInput(document.getElementById("cep").value),
      status: document.getElementById("status").value, plano: document.getElementById("plano").value,
      valor: Number(document.getElementById("valor").value), vencimento: document.getElementById("vencimento").value
    });
    await db.collection("clientes").doc(id).update(updateData);
    showToast("Cliente atualizado!", "success", "Sucesso");
    clienteEditando = null;
    sessionStorage.removeItem('clienteEditandoId');
    limparFormulario();
    carregarFinanceiro();
    carregarDashboardPremium();
    await registrarAuditoria("cliente_atualizado", `Cliente atualizado: ID ${id}`);
  } catch (erro) { showToast("Erro ao atualizar: " + erro.message, "error", "Erro"); }
}

function limparFormulario() {
  document.getElementById("nome").value = ""; document.getElementById("cpf").value = "";
  document.getElementById("telefone").value = ""; document.getElementById("email").value = "";
  document.getElementById("endereco").value = ""; document.getElementById("bairro").value = "";
  document.getElementById("cidade").value = ""; document.getElementById("cep").value = "";
  if (document.getElementById("status")) document.getElementById("status").selectedIndex = 0;
  if (document.getElementById("plano")) document.getElementById("plano").selectedIndex = 0;
  document.getElementById("valor").value = ""; document.getElementById("vencimento").value = "";
  clienteEditando = null; sessionStorage.removeItem('clienteEditandoId');
}

// ===========================
// DELETE CONFIRMATION MODAL
// ===========================

function abrirModalExclusao(tipo, id, nome) {
  const modal = document.getElementById('confirmDeleteModal');
  const overlay = document.getElementById('confirmDeleteOverlay');
  const title = document.getElementById('confirmDeleteTitle');
  const message = document.getElementById('confirmDeleteMessage');
  const confirmBtn = document.getElementById('confirmDeleteBtn');
  const cancelBtn = document.getElementById('confirmDeleteCancelBtn');
  if (!modal) { if (confirm(`Deseja realmente excluir ${nome || 'este registro'}?`)) executarExclusao(tipo, id); return; }
  const labels = { 'cliente': 'Cliente', 'plano': 'Plano', 'mensalidade': 'Mensalidade', 'recebimento': 'Recebimento', 'despesa': 'Despesa', 'usuario': 'Usuário' };
  const label = labels[tipo] || 'Registro';
  const displayName = nome || label;
  if (title) title.textContent = `Excluir ${label}?`;
  if (message) message.textContent = `Tem certeza que deseja excluir "${displayName}"? Esta ação não poderá ser desfeita.`;
  if (confirmBtn) { confirmBtn.innerHTML = `<i class="fas fa-trash-can"></i> Excluir ${label}`; confirmBtn.className = 'btn-confirm-delete'; confirmBtn.onclick = function() { fecharModalConfirmacao(); executarExclusao(tipo, id); }; }
  if (cancelBtn) cancelBtn.onclick = fecharModalConfirmacao;
  pendingDeleteAction = tipo; pendingDeleteId = id; pendingDeleteLabel = displayName;
  modal.style.display = 'flex';
  if (overlay) overlay.style.display = 'block';
  requestAnimationFrame(() => modal.classList.add('show'));
}

function fecharModalConfirmacao() {
  const modal = document.getElementById('confirmDeleteModal');
  const overlay = document.getElementById('confirmDeleteOverlay');
  if (modal) { modal.classList.remove('show'); setTimeout(() => { modal.style.display = 'none'; }, 200); }
  if (overlay) overlay.style.display = 'none';
  pendingDeleteAction = null; pendingDeleteId = null; pendingDeleteLabel = '';
}

function executarExclusao(tipo, id) {
  switch (tipo) {
    case 'cliente': excluirClienteFirestore(id); break;
    case 'plano': excluirPlanoFirestore(id); break;
    case 'mensalidade': excluirMensalidadeFirestore(id); break;
    case 'recebimento': excluirRecebimentoFirestore(id); break;
    case 'despesa': excluirDespesaFirestore(id); break;
    case 'usuario': excluirUsuarioAdmin(id); break;
    default: console.error('Tipo desconhecido:', tipo);
  }
}

function excluirClienteFirestore(id) {
  db.collection("clientes").doc(id).delete().then(async () => { showToast("Cliente removido!", "success", "Excluído"); carregarFinanceiro(); carregarDashboardPremium(); await registrarAuditoria("cliente_excluido", `Cliente excluído: ID ${id}`); }).catch((erro) => showToast("Erro ao excluir: " + erro.message, "error", "Erro"));
}

function excluirPlanoFirestore(id) {
  db.collection("planos").doc(id).delete().then(async () => { showToast("Plano removido!", "success", "Excluído"); await registrarAuditoria("plano_excluido", `Plano excluído: ID ${id}`); }).catch((erro) => showToast("Erro: " + erro.message, "error", "Erro"));
}

function excluirMensalidadeFirestore(id) {
  db.collection("mensalidades").doc(id).delete().then(() => { showToast("Mensalidade removida!", "success", "Excluído"); carregarRecebimentos(); carregarFinanceiro(); carregarDashboardPremium(); }).catch((erro) => showToast("Erro: " + erro.message, "error", "Erro"));
}

function excluirRecebimentoFirestore(id) {
  db.collection("recebimentos").doc(id).delete().then(async () => { showToast("Recebimento removido!", "success", "Excluído"); carregarRecebimentos(); carregarFinanceiro(); carregarDashboardPremium(); await registrarAuditoria("recebimento_excluido", `Recebimento excluído: ID ${id}`); }).catch((erro) => showToast("Erro: " + erro.message, "error", "Erro"));
}

function excluirDespesaFirestore(id) {
  db.collection("despesas").doc(id).delete().then(async () => { showToast("Despesa removida!", "success", "Excluído"); carregarDespesas(); carregarFinanceiro(); carregarDashboardPremium(); await registrarAuditoria("despesa_excluida", `Despesa excluída: ID ${id}`); }).catch((erro) => showToast("Erro: " + erro.message, "error", "Erro"));
}

function excluirCliente(id) { abrirModalExclusao('cliente', id, ''); }
function excluirPlano(id) { abrirModalExclusao('plano', id, ''); }
function excluirMensalidade(id) { abrirModalExclusao('mensalidade', id, ''); }
function excluirRecebimento(id) { abrirModalExclusao('recebimento', id, ''); }
function excluirDespesa(id) { abrirModalExclusao('despesa', id, ''); }

// ===========================
// PLANOS
// ===========================

function salvarPlano() {
  const nome = sanitizarInput(document.getElementById("nomePlano").value);
  const velocidade = sanitizarInput(document.getElementById("velocidadePlano").value);
  const valor = Number(document.getElementById("valorPlano").value);
  if (!nome || !velocidade || !valor) { showToast("Preencha todos os campos!", "error", "Validação"); return; }
  db.collection("planos").add(secureData({ nome, velocidade, valor, dataCadastro: new Date() })).then(async () => { showToast("Plano cadastrado!", "success", "Sucesso"); limparFormularioPlano(); await registrarAuditoria("plano_criado", `Plano: ${nome}`); }).catch((erro) => showToast("Erro: " + erro.message, "error", "Erro"));
}

function carregarPlanos() {
  if (planosListener) planosListener();
  const query = db.collection("planos").where("tenantId", "==", getTenantId()).orderBy("nome");
  planosListener = query.onSnapshot((snapshot) => {
    const tabela = document.getElementById("listaPlanos");
    if (!tabela) return;
    tabela.innerHTML = "";
    snapshot.forEach((doc) => {
      const p = doc.data();
      tabela.innerHTML += `<tr><td>${p.nome || ""}</td><td>${p.velocidade || ""}</td><td>R$ ${Number(p.valor).toFixed(2)}</td><td><div class="action-buttons"><button class="btn-action btn-action-edit" onclick="editarPlano('${doc.id}')" title="Editar"><i class="fas fa-pen-to-square"></i><span class="tooltip-text">Editar</span></button><button class="btn-action btn-action-delete" onclick="abrirModalExclusao('plano', '${doc.id}', '${p.nome}')" title="Excluir"><i class="fas fa-trash-can"></i><span class="tooltip-text">Excluir</span></button></div></td></tr>`;
    });
  }, (erro) => console.error("Erro ao carregar planos:", erro));
}

function carregarPlanosSelect() {
  const select = document.getElementById("plano");
  if (!select) return;
  db.collection("planos").where("tenantId", "==", getTenantId()).orderBy("nome").onSnapshot((snapshot) => {
    select.innerHTML = '<option value="">Selecione um plano</option>';
    snapshot.forEach((doc) => { const p = doc.data(); const opt = document.createElement("option"); opt.value = p.nome; opt.textContent = `${p.nome} - ${p.velocidade} - R$ ${Number(p.valor).toFixed(2)}`; select.appendChild(opt); });
  }, (erro) => console.error("Erro ao carregar planos select:", erro));
}

async function editarPlano(id) {
  try {
    const docRef = await db.collection("planos").doc(id).get();
    if (!docRef.exists) { showToast("Plano não encontrado!", "error", "Erro"); return; }
    const p = docRef.data();
    planoEditando = id; sessionStorage.setItem('planoEditandoId', id);
    document.getElementById("nomePlano").value = p.nome || "";
    document.getElementById("velocidadePlano").value = p.velocidade || "";
    document.getElementById("valorPlano").value = p.valor || "";
  } catch (erro) { showToast("Erro: " + erro.message, "error", "Erro"); }
}

async function atualizarPlano() {
  const id = planoEditando || sessionStorage.getItem('planoEditandoId');
  if (!id) { showToast("Selecione um plano!", "warning", "Atenção"); return; }
  try {
    await db.collection("planos").doc(id).update(secureUpdate({ nome: document.getElementById("nomePlano").value, velocidade: document.getElementById("velocidadePlano").value, valor: Number(document.getElementById("valorPlano").value) }));
    showToast("Plano atualizado!", "success", "Sucesso");
    planoEditando = null; sessionStorage.removeItem('planoEditandoId'); limparFormularioPlano();
    await registrarAuditoria("plano_atualizado", `Plano ID ${id}`);
  } catch (erro) { showToast("Erro: " + erro.message, "error", "Erro"); }
}

function limparFormularioPlano() {
  document.getElementById("nomePlano").value = ""; document.getElementById("velocidadePlano").value = "";
  document.getElementById("valorPlano").value = ""; planoEditando = null; sessionStorage.removeItem('planoEditandoId');
}

function preencherValorPlano() {
  const nomePlano = document.getElementById("plano").value;
  if (!nomePlano) return;
  db.collection("planos").where("nome", "==", nomePlano).where("tenantId", "==", getTenantId()).limit(1).get().then((snapshot) => { if (!snapshot.empty) document.getElementById("valor").value = snapshot.docs[0].data().valor || ""; }).catch((erro) => console.error("Erro ao preencher valor:", erro));
}

// ===========================
// MENSALIDADES
// ===========================

function gerarMensalidadeInicial(clienteId, clienteNome, plano, valor, vencimento) {
  const dataAtual = new Date(); const competencia = formatarCompetencia(dataAtual);
  const dataVencimento = calcularDataVencimento(vencimento, dataAtual);
  db.collection("mensalidades").where("clienteId", "==", clienteId).where("competencia", "==", competencia).get().then((snapshot) => {
    if (snapshot.empty) { db.collection("mensalidades").add(secureData({ clienteId, clienteNome, plano, valor, vencimento: dataVencimento, competencia, status: "Em Aberto", dataGeracao: new Date(), tipo: "Recorrente" })).catch(e => console.error("Erro ao gerar mensalidade:", e)); }
  }).catch(e => console.error("Erro ao verificar mensalidade:", e));
}

function gerarMensalidadesNovoMes() {
  const dataAtual = new Date(); const competencia = formatarCompetencia(dataAtual);
  db.collection("clientes").where("tenantId", "==", getTenantId()).where("status", "==", "Ativo").get().then((snapshot) => {
    let processadas = 0; let total = snapshot.size;
    snapshot.forEach((clienteDoc) => {
      const cliente = clienteDoc.data(); const clienteId = clienteDoc.id;
      db.collection("mensalidades").where("clienteId", "==", clienteId).where("competencia", "==", competencia).get().then((mensSnap) => {
        if (mensSnap.empty && cliente.valor > 0 && cliente.vencimento) {
          const dataVencimento = calcularDataVencimento(cliente.vencimento, dataAtual);
          db.collection("mensalidades").add(secureData({ clienteId, clienteNome: cliente.nome, plano: cliente.plano, valor: cliente.valor, vencimento: dataVencimento, competencia, status: "Em Aberto", dataGeracao: new Date(), tipo: "Recorrente" })).then(() => processadas++).catch(e => console.error("Erro:", e));
        }
      });
    });
    setTimeout(() => { showToast(`${processadas} mensalidades geradas!`, "success", "Mensalidades"); carregarRecebimentos(); carregarFinanceiro(); carregarDashboardPremium(); }, 2000);
  }).catch((erro) => console.error("Erro ao buscar clientes:", erro));
}

function formatarCompetencia(data) { return `${String(data.getMonth() + 1).padStart(2, '0')}/${data.getFullYear()}`; }
function calcularDataVencimento(diaVencimento, dataReferencia) { const data = new Date(dataReferencia); data.setDate(parseInt(diaVencimento)); return `${data.getFullYear()}-${String(data.getMonth()+1).padStart(2,'0')}-${String(data.getDate()).padStart(2,'0')}`; }
function verificarGeracaoMensalidades() { if (new Date().getDate() === 1) gerarMensalidadesNovoMes(); }

function marcarMensalidadePaga(mensalidadeId) {
  db.collection("mensalidades").doc(mensalidadeId).update(secureUpdate({ status: "Pago", dataPagamento: new Date() })).then(() => { showToast("Mensalidade paga!", "success", "Sucesso"); carregarRecebimentos(); carregarFinanceiro(); carregarDashboardPremium(); atualizarFluxoCaixa(); }).catch((erro) => showToast("Erro: " + erro.message, "error", "Erro"));
}

function marcarMensalidadeAtrasada(mensalidadeId) {
  db.collection("mensalidades").doc(mensalidadeId).update(secureUpdate({ status: "Atrasado" })).then(() => { showToast("Mensalidade atrasada!", "success", "Sucesso"); carregarRecebimentos(); carregarFinanceiro(); carregarDashboardPremium(); }).catch((erro) => showToast("Erro: " + erro.message, "error", "Erro"));
}

// ===========================
// FINANCEIRO - RECEBER
// ===========================

function abrirModalRecebimento() { document.getElementById("modalRecebimento").style.display = "flex"; carregarClientesRecebimento(); }
function fecharModalRecebimento() { document.getElementById("modalRecebimento").style.display = "none"; }

function carregarClientesRecebimento() {
  const select = document.getElementById("receb_cliente");
  if (!select) return;
  db.collection("clientes").where("tenantId", "==", getTenantId()).where("status", "==", "Ativo").orderBy("nome").get().then((snapshot) => {
    select.innerHTML = '<option value="">-- Selecione --</option>';
    snapshot.forEach((doc) => { const c = doc.data(); const opt = document.createElement("option"); opt.value = doc.id; opt.textContent = c.nome; select.appendChild(opt); });
  }).catch((erro) => console.error("Erro ao carregar clientes:", erro));
}

function salvarRecebimento() {
  const clienteId = document.getElementById("receb_cliente").value; const valor = Number(document.getElementById("receb_valor").value);
  const vencimento = document.getElementById("receb_vencimento").value; const pagamento = document.getElementById("receb_pagamento").value;
  const status = document.getElementById("receb_status").value; const observacao = sanitizarTexto(document.getElementById("receb_observacao").value);
  if (!clienteId || !valor || !vencimento || !pagamento) { showToast("Preencha todos os campos!", "error", "Validação"); return; }
  db.collection("recebimentos").add(secureData({ clienteId, valor, vencimento, pagamento, status, observacao, dataCadastro: new Date() })).then(async () => { showToast("Cobrança cadastrada!", "success", "Sucesso"); fecharModalRecebimento(); carregarRecebimentos(); carregarFinanceiro(); carregarDashboardPremium(); await registrarAuditoria("recebimento_criado", `Cobrança: R$ ${valor}`); }).catch((erro) => showToast("Erro: " + erro.message, "error", "Erro"));
}

function carregarRecebimentos() {
  const tabela = document.getElementById("listaRecebimentos");
  if (!tabela) return;
  tabela.innerHTML = "";
  if (recebimentosListener) recebimentosListener();
  let query = db.collection("mensalidades").where("tenantId", "==", getTenantId()).orderBy("vencimento", "desc").limit(configuracoesSistema.paginacao.recebimentos);
  if (recebimentosLastDoc) query = query.startAfter(recebimentosLastDoc);
  recebimentosListener = query.onSnapshot((mensSnap) => {
    let html = "";
    mensSnap.forEach((doc) => {
      const m = doc.data();
      const sc = m.status === "Pago" ? "status-pago" : m.status === "Atrasado" ? "status-atrasado" : "status-pendente";
      html += `<tr><td>${m.clienteNome || ""}</td><td>R$ ${m.valor.toFixed(2)}</td><td>${m.vencimento}</td><td><span class="${sc}">${m.status}</span></td><td>${m.tipo || "Recorrente"}</td><td><div class="action-buttons">${m.status !== "Pago" ? `<button class="btn-action btn-action-success" onclick="marcarMensalidadePaga('${doc.id}')" title="Pago"><i class="fas fa-check"></i><span class="tooltip-text">Pago</span></button>` : ""}${m.status === "Em Aberto" ? `<button class="btn-action btn-action-warning" onclick="marcarMensalidadeAtrasada('${doc.id}')" title="Atrasado"><i class="fas fa-exclamation"></i><span class="tooltip-text">Atrasado</span></button>` : ""}<button class="btn-action btn-action-delete" onclick="abrirModalExclusao('mensalidade', '${doc.id}', '${m.clienteNome}')" title="Excluir"><i class="fas fa-trash-can"></i><span class="tooltip-text">Excluir</span></button></div></td></tr>`;
    });
    db.collection("recebimentos").where("tenantId", "==", getTenantId()).orderBy("vencimento", "desc").limit(20).get().then((snap) => {
      snap.forEach((doc) => { const r = doc.data(); db.collection("clientes").doc(r.clienteId).get().then((cDoc) => { if (cDoc.exists) { const c = cDoc.data(); const sc = r.status === "Pago" ? "status-pago" : "status-pendente"; html += `<tr><td>${c.nome}</td><td>R$ ${r.valor.toFixed(2)}</td><td>${r.vencimento}</td><td><span class="${sc}">${r.status}</span></td><td>${r.pagamento}</td><td><div class="action-buttons"><button class="btn-action btn-action-delete" onclick="abrirModalExclusao('recebimento', '${doc.id}', '${c.nome}')" title="Excluir"><i class="fas fa-trash-can"></i><span class="tooltip-text">Excluir</span></button></div></td></tr>`; tabela.innerHTML = html; } }).catch(() => { tabela.innerHTML = html; }); });
      if (snap.size === 0) tabela.innerHTML = html;
    }).catch(() => { tabela.innerHTML = html; });
    recebimentosLastDoc = mensSnap.docs.length > 0 ? mensSnap.docs[mensSnap.docs.length - 1] : null;
  }, (erro) => console.error("Erro ao carregar recebimentos:", erro));
}

function filtrarRecebimentos() {
  const busca = document.getElementById("buscaClienteReceb").value.toLowerCase();
  const status = document.getElementById("filtroStatusReceb").value;
  document.querySelectorAll("#listaRecebimentos tr").forEach(linha => {
    if (linha.cells.length === 0) return;
    const cliente = linha.cells[0].textContent.toLowerCase();
    const s = linha.cells[3].textContent;
    linha.style.display = cliente.includes(busca) && (status === "" || s.includes(status)) ? "" : "none";
  });
}

// ===========================
// FINANCEIRO - PAGAR
// ===========================

function abrirModalDespesa() { document.getElementById("modalDespesa").style.display = "flex"; }
function fecharModalDespesa() { document.getElementById("modalDespesa").style.display = "none"; }

function salvarDespesa() {
  const descricao = sanitizarInput(document.getElementById("desp_descricao").value); const categoria = document.getElementById("desp_categoria").value;
  const valor = Number(document.getElementById("desp_valor").value); const vencimento = document.getElementById("desp_vencimento").value;
  const status = document.getElementById("desp_status").value; const observacao = sanitizarTexto(document.getElementById("desp_observacao").value);
  if (!descricao || !categoria || !valor || !vencimento) { showToast("Preencha todos os campos!", "error", "Validação"); return; }
  db.collection("despesas").add(secureData({ descricao, categoria, valor, vencimento, status, observacao, dataCadastro: new Date() })).then(async () => { showToast("Despesa cadastrada!", "success", "Sucesso"); fecharModalDespesa(); limparFormularioDespesa(); carregarDespesas(); carregarFinanceiro(); carregarDashboardPremium(); await registrarAuditoria("despesa_criada", `Despesa: ${descricao} - R$ ${valor}`); }).catch((erro) => showToast("Erro: " + erro.message, "error", "Erro"));
}

function carregarDespesas() {
  if (despesasListener) despesasListener();
  let query = db.collection("despesas").where("tenantId", "==", getTenantId()).orderBy("vencimento", "desc").limit(configuracoesSistema.paginacao.despesas);
  if (despesasLastDoc) query = query.startAfter(despesasLastDoc);
  despesasListener = query.onSnapshot((snapshot) => {
    const tabela = document.getElementById("listaDespesas");
    if (!tabela) return;
    tabela.innerHTML = "";
    snapshot.forEach((doc) => { const d = doc.data(); const sc = d.status === "Pago" ? "status-pago" : "status-pendente"; tabela.innerHTML += `<tr><td>${d.descricao}</td><td>${d.categoria}</td><td>R$ ${d.valor.toFixed(2)}</td><td>${d.vencimento}</td><td><span class="${sc}">${d.status}</span></td><td><div class="action-buttons"><button class="btn-action btn-action-edit" onclick="editarDespesa('${doc.id}')" title="Editar"><i class="fas fa-pen-to-square"></i><span class="tooltip-text">Editar</span></button><button class="btn-action btn-action-delete" onclick="abrirModalExclusao('despesa', '${doc.id}', '${d.descricao}')" title="Excluir"><i class="fas fa-trash-can"></i><span class="tooltip-text">Excluir</span></button></div></td></tr>`; });
    despesasLastDoc = snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null;
  }, (erro) => console.error("Erro ao carregar despesas:", erro));
}

function filtrarDespesas() {
  const busca = document.getElementById("buscaDespesa").value.toLowerCase();
  const categoria = document.getElementById("filtroCategoriaDespesa").value;
  const status = document.getElementById("filtroStatusDespesa").value;
  document.querySelectorAll("#listaDespesas tr").forEach(linha => {
    if (linha.cells.length < 5) return;
    const d = linha.cells[0].textContent.toLowerCase(); const c = linha.cells[1].textContent; const s = linha.cells[4].textContent;
    linha.style.display = d.includes(busca) && (categoria === "" || c === categoria) && (status === "" || s.includes(status)) ? "" : "none";
  });
}

function editarDespesa(id) { showToast("Edição de despesa em breve.", "info", "Em desenvolvimento"); }

function limparFormularioDespesa() {
  document.getElementById("desp_descricao").value = "";
  if (document.getElementById("desp_categoria")) document.getElementById("desp_categoria").selectedIndex = 0;
  document.getElementById("desp_valor").value = ""; document.getElementById("desp_vencimento").value = "";
  if (document.getElementById("desp_status")) document.getElementById("desp_status").selectedIndex = 0;
  document.getElementById("desp_observacao").value = "";
}

// ===========================
// FLUXO DE CAIXA
// ===========================

function atualizarFluxoCaixa() {
  const dataInicio = document.getElementById("dataInicio").value;
  const dataFim = document.getElementById("dataFim").value;
  financeiroListeners.forEach(l => { if (l) l(); }); financeiroListeners = [];
  Promise.all([
    db.collection("recebimentos").where("tenantId", "==", getTenantId()).get(),
    db.collection("despesas").where("tenantId", "==", getTenantId()).get(),
    db.collection("mensalidades").where("tenantId", "==", getTenantId()).get()
  ]).then(([receb, desp, mens]) => {
    let entradas = 0, saidas = 0, fluxoHTML = "";
    receb.forEach(doc => { const r = doc.data(); if (["Pago","Recebido","Quitado"].includes(r.status)) { if ((!dataInicio || r.vencimento >= dataInicio) && (!dataFim || r.vencimento <= dataFim)) { entradas += r.valor; fluxoHTML += `<tr><td>${r.vencimento}</td><td>Entrada</td><td>Recebimento</td><td class="valor-receita">+R$ ${r.valor.toFixed(2)}</td></tr>`; } } });
    mens.forEach(doc => { const m = doc.data(); if (["Pago","Recebido","Quitado"].includes(m.status)) { const data = m.dataPagamento || m.vencimento; if ((!dataInicio || data >= dataInicio) && (!dataFim || data <= dataFim)) { entradas += m.valor; fluxoHTML += `<tr><td>${data}</td><td>Entrada</td><td>Mensalidade - ${m.clienteNome}</td><td class="valor-receita">+R$ ${m.valor.toFixed(2)}</td></tr>`; } } });
    desp.forEach(doc => { const d = doc.data(); if (d.status === "Pago") { if ((!dataInicio || d.vencimento >= dataInicio) && (!dataFim || d.vencimento <= dataFim)) { saidas += d.valor; fluxoHTML += `<tr><td>${d.vencimento}</td><td>Saída</td><td>${d.descricao}</td><td class="valor-despesa">-R$ ${d.valor.toFixed(2)}</td></tr>`; } } });
    const saldo = entradas - saidas;
    document.getElementById("totalEntradas").innerText = "R$ " + entradas.toFixed(2);
    document.getElementById("totalSaidas").innerText = "R$ " + saidas.toFixed(2);
    document.getElementById("saldoAtual").innerText = "R$ " + saldo.toFixed(2);
    document.getElementById("listaFluxoCaixa").innerHTML = fluxoHTML;
  }).catch(e => console.error("Erro fluxo:", e));
}

// ===========================
// FINANCEIRO - DASHBOARD
// ===========================

function carregarFinanceiro() {
  financeiroListeners.forEach(l => { if (l) l(); }); financeiroListeners = [];
  const agora = new Date();
  const dataBrasil = new Date(agora.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  const mesAtual = dataBrasil.getMonth(); const anoAtual = dataBrasil.getFullYear();
  Promise.all([
    db.collection("clientes").where("tenantId", "==", getTenantId()).get(),
    db.collection("recebimentos").where("tenantId", "==", getTenantId()).get(),
    db.collection("despesas").where("tenantId", "==", getTenantId()).get(),
    db.collection("mensalidades").where("tenantId", "==", getTenantId()).get()
  ]).then(([cSnap, rSnap, dSnap, mSnap]) => {
    let faturamentoMes = 0, totalRecebido = 0, totalAberto = 0;
    let totalDespesas = 0, clientesInadimplentes = 0, valorInadimplente = 0;
    let recebidoQtd = 0, abertoQtd = 0, despesasQtd = 0;
    let receitaRecebidaMes = 0, receitaAnualProjetada = 0, receitaAtraso = 0;
    const statusRecebido = ["Pago","Recebido","Quitado"];
    cSnap.forEach(doc => { const c = doc.data(); if (c.status === "Ativo") faturamentoMes += Number(c.valor) || 0; if (c.status === "Inadimplente") clientesInadimplentes++; });
    receitaAnualProjetada = faturamentoMes * 12;
    rSnap.forEach(doc => {
      const r = doc.data();
      if (statusRecebido.includes(r.status)) { totalRecebido += r.valor; recebidoQtd++; const dataPag = r.dataPagamento ? (r.dataPagamento.toDate ? r.dataPagamento.toDate() : new Date(r.dataPagamento)) : new Date(r.vencimento); const dataPagBR = new Date(dataPag.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' })); if (dataPagBR.getMonth() === mesAtual && dataPagBR.getFullYear() === anoAtual) receitaRecebidaMes += r.valor; }
      else if (r.status === "Pendente" || r.status === "Em Aberto") { totalAberto += r.valor; abertoQtd++; }
      else if (r.status === "Atrasado" || r.status === "Vencido") { receitaAtraso += r.valor; valorInadimplente += r.valor; }
    });
    mSnap.forEach(doc => {
      const m = doc.data();
      if (statusRecebido.includes(m.status)) { totalRecebido += m.valor; recebidoQtd++; const dataPag = m.dataPagamento ? (m.dataPagamento.toDate ? m.dataPagamento.toDate() : new Date(m.dataPagamento)) : new Date(m.vencimento); const dataPagBR = new Date(dataPag.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' })); if (dataPagBR.getMonth() === mesAtual && dataPagBR.getFullYear() === anoAtual) receitaRecebidaMes += m.valor; }
      else if (m.status === "Em Aberto") { totalAberto += m.valor; abertoQtd++; const dataVenc = new Date(m.vencimento); if (dataVenc < dataBrasil) { receitaAtraso += m.valor; valorInadimplente += m.valor; } }
      else if (m.status === "Atrasado" || m.status === "Vencido") { receitaAtraso += m.valor; valorInadimplente += m.valor; }
    });
    dSnap.forEach(doc => { const d = doc.data(); if (d.status === "Pago") totalDespesas += d.valor; else despesasQtd++; });
    const lucroLiquido = totalRecebido - totalDespesas;
    const setText = (id, val) => { const el = document.getElementById(id); if (el) el.innerText = val; };
    setText("faturamentoMes", "R$ " + faturamentoMes.toFixed(2)); setText("totalRecebido", "R$ " + totalRecebido.toFixed(2));
    setText("totalAberto", "R$ " + totalAberto.toFixed(2)); setText("totalDespesas", "R$ " + totalDespesas.toFixed(2));
    setText("lucroLiquido", "R$ " + lucroLiquido.toFixed(2)); setText("totalInadimplentes", String(clientesInadimplentes));
    setText("valorInadimplentes", "R$ " + valorInadimplente.toFixed(2) + " em atraso"); setText("recebidoQtd", recebidoQtd + " pagas");
    setText("abertoQtd", abertoQtd + " pendentes"); setText("despesasQtd", despesasQtd + " este mês");
    setText("receitaRecebidaMes", "R$ " + receitaRecebidaMes.toFixed(2)); setText("receitaAnualProjetada", "R$ " + receitaAnualProjetada.toFixed(2));
    setText("receitaAtraso", "R$ " + receitaAtraso.toFixed(2));
    carregarInadimplentes();
  }).catch(e => console.error("Erro financeiro:", e));
}

// ===========================
// INADIMPLÊNCIA
// ===========================

function carregarInadimplentes() {
  const tabela = document.getElementById("listaInadimplentes");
  if (!tabela) return;
  tabela.innerHTML = "";
  let total = 0, valorTotal = 0; const clientesUnicos = new Set(); const receitasAtraso = [];
  let dados = 0; const esperado = 2;
  if (inadimplentesMensalidadesListener) inadimplentesMensalidadesListener();
  if (inadimplentesRecebimentosListener) inadimplentesRecebimentosListener();
  function atualizar() {
    document.getElementById("qntInadimplentes").innerText = clientesUnicos.size;
    document.getElementById("valorTotalAtraso").innerText = "R$ " + valorTotal.toFixed(2);
    document.getElementById("ticketMedioAtraso").innerText = "R$ " + (total > 0 ? (valorTotal / total).toFixed(2) : "0.00");
    atualizarTabelaReceitaAtraso(receitasAtraso);
  }
  inadimplentesMensalidadesListener = db.collection("mensalidades").where("tenantId", "==", getTenantId()).where("status", "==", "Atrasado").onSnapshot((snap) => {
    snap.forEach(doc => { const m = doc.data(); total++; valorTotal += m.valor; clientesUnicos.add(m.clienteId); const dias = Math.floor((new Date() - new Date(m.vencimento)) / (1000*60*60*24)); tabela.innerHTML += `<tr><td>${m.clienteNome}</td><td>R$ ${m.valor.toFixed(2)}</td><td>${m.vencimento}</td><td>${dias} dias</td><td>Mensalidade</td><td><div class="action-buttons"><button class="btn-action btn-action-whatsapp" onclick="enviarWhatsAppInadimplente('${m.clienteNome}','${m.valor}','${m.vencimento}')" title="WhatsApp"><i class="fab fa-whatsapp"></i><span class="tooltip-text">WhatsApp</span></button><button class="btn-action btn-action-success" onclick="marcarMensalidadePaga('${doc.id}')" title="Pago"><i class="fas fa-check"></i><span class="tooltip-text">Pagar</span></button></div></td></tr>`; receitasAtraso.push({ clienteNome: m.clienteNome, valor: m.valor, vencimento: m.vencimento, diasAtraso: dias, tipo: 'Mensalidade', id: doc.id, telefone: null }); }); dados++; if (dados >= esperado) atualizar();
  }, () => { dados++; if (dados >= esperado) atualizar(); });
  inadimplentesRecebimentosListener = db.collection("recebimentos").where("tenantId", "==", getTenantId()).where("status", "==", "Atrasado").onSnapshot((snap) => {
    let proc = 0; const totalProc = snap.size;
    if (totalProc === 0) { dados++; if (dados >= esperado) atualizar(); return; }
    snap.forEach(doc => { const r = doc.data(); total++; valorTotal += r.valor; clientesUnicos.add(r.clienteId); db.collection("clientes").doc(r.clienteId).get().then(cDoc => { if (cDoc.exists) { const c = cDoc.data(); const dias = Math.floor((new Date() - new Date(r.vencimento)) / (1000*60*60*24)); tabela.innerHTML += `<tr><td>${c.nome}</td><td>R$ ${r.valor.toFixed(2)}</td><td>${r.vencimento}</td><td>${dias} dias</td><td>${c.telefone}</td><td><div class="action-buttons"><button class="btn-action btn-action-whatsapp" onclick="enviarWhatsAppInadimplente('${c.nome}','${r.valor}','${r.vencimento}','${c.telefone}')" title="WhatsApp"><i class="fab fa-whatsapp"></i><span class="tooltip-text">WhatsApp</span></button><button class="btn-action btn-action-success" onclick="marcarComoPago('${doc.id}')" title="Pago"><i class="fas fa-check"></i><span class="tooltip-text">Pagar</span></button></div></td></tr>`; receitasAtraso.push({ clienteNome: c.nome, valor: r.valor, vencimento: r.vencimento, diasAtraso: dias, tipo: 'Manual', id: doc.id, telefone: c.telefone }); } proc++; if (proc >= totalProc) { dados++; if (dados >= esperado) atualizar(); } }).catch(() => { proc++; if (proc >= totalProc) { dados++; if (dados >= esperado) atualizar(); } }); });
  }, () => { dados++; if (dados >= esperado) atualizar(); });
}

function atualizarTabelaReceitaAtraso(receitas) {
  const tabela = document.getElementById("listaReceitaAtraso");
  if (!tabela) return;
  if (receitas.length === 0) { tabela.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:32px;"><i class="fas fa-check-circle" style="font-size:24px;display:block;margin-bottom:8px;opacity:0.5;"></i>Nenhum registro em atraso</td></tr>`; return; }
  tabela.innerHTML = "";
  receitas.sort((a,b) => b.diasAtraso - a.diasAtraso).forEach(r => {
    const tel = r.telefone ? r.telefone.replace(/\D/g,'') : '';
    tabela.innerHTML += `<tr><td>${r.clienteNome}</td><td>R$ ${r.valor.toFixed(2)}</td><td>${r.vencimento}</td><td><span style="color:var(--danger);font-weight:600;">${r.diasAtraso} dias</span></td><td>${tel ? `<a href="https://wa.me/55${tel}" target="_blank" class="btn-premium" style="padding:6px 12px;font-size:12px;text-decoration:none;display:inline-block;"><i class="fab fa-whatsapp"></i> WhatsApp</a>` : ''}</td><td><button class="btn-premium" onclick="enviarCobranca('${r.clienteNome}','${r.valor}','${r.vencimento}','${r.diasAtraso}')" style="padding:6px 12px;font-size:12px;"><i class="fas fa-envelope"></i> Cobrar</button></td></tr>`;
  });
}

function enviarWhatsAppInadimplente(nome, valor, vencimento, telefone) {
  if (!telefone) { db.collection("clientes").where("nome","==",nome).where("tenantId","==",getTenantId()).limit(1).get().then(snap => { if (!snap.empty) abrirWhatsApp(snap.docs[0].data().telefone, nome, valor, vencimento); else showToast("Cliente não encontrado.", "error"); }).catch(e => showToast("Erro: " + e.message, "error")); }
  else abrirWhatsApp(telefone, nome, valor, vencimento);
}

function abrirWhatsApp(telefone, nome, valor, vencimento) {
  const tel = telefone.replace(/\D/g,'');
  const msg = encodeURIComponent(`Olá, ${nome}!\n\nIdentificamos uma mensalidade em aberto no valor de R$ ${valor}, vencida em ${vencimento}.\n\nCaso já tenha efetuado o pagamento, desconsidere esta mensagem.\n\nAtenciosamente,\nControlISP`);
  window.open(`https://wa.me/55${tel}?text=${msg}`, '_blank');
}

function enviarCobranca(nome, valor, vencimento, dias) {
  const msg = `Olá ${nome},\n\nVocê tem uma cobrança de R$ ${Number(valor).toFixed(2)} em atraso há ${dias} dias (vencimento: ${vencimento}).\n\nPor favor, entre em contato para regularizar.\n\nObrigado!`;
  navigator.clipboard.writeText(msg).then(() => showToast("Mensagem copiada!", "success")).catch(() => showToast("Erro ao copiar.", "error"));
}

function marcarComoPago(id) {
  db.collection("recebimentos").doc(id).update(secureUpdate({ status: "Pago" })).then(() => { showToast("Marcado como pago!", "success"); carregarInadimplentes(); carregarFinanceiro(); carregarDashboardPremium(); }).catch(e => showToast("Erro: " + e.message, "error"));
}

// ===========================
// TAB NAVIGATION
// ===========================

function mostrarAbaFinanceira(aba, event) {
  document.querySelectorAll(".abaFinanceira").forEach(a => { a.style.display = "none"; a.classList.remove("ativa"); });
  const el = document.getElementById(aba);
  if (el) { el.style.display = "block"; el.classList.add("ativa"); }
  document.querySelectorAll(".tabBtn").forEach(btn => { btn.classList.remove("active"); if (btn.getAttribute("onclick") && btn.getAttribute("onclick").includes(aba)) btn.classList.add("active"); });
  if (aba === "fluxo-caixa") atualizarFluxoCaixa();
}

function logout() {
  auth.signOut().then(() => location.reload()).catch(e => showToast(e.message, "error"));
}

// ===========================
// WHATSAPP
// ===========================

function mostrarAbaWhatsApp(aba, event) {
  document.querySelectorAll(".abaWhatsApp").forEach(a => { a.style.display = "none"; a.classList.remove("ativa"); });
  const el = document.getElementById("whatsapp-" + aba);
  if (el) { el.style.display = "block"; el.classList.add("ativa"); }
  document.querySelectorAll(".whatsappTabBtn").forEach(btn => { btn.classList.remove("active"); if (btn.getAttribute("onclick") && btn.getAttribute("onclick").includes(aba)) btn.classList.add("active"); });
  if (aba === "cobrancas") identificarCobrancasPendentes();
}

function carregarClientesWhatsApp() {
  if (clientesWhatsAppListener) clientesWhatsAppListener();
  clientesWhatsAppListener = db.collection("clientes").where("tenantId","==",getTenantId()).orderBy("nome").onSnapshot(snap => {
    clientesWhatsApp = [];
    const tabela = document.getElementById("listaClientesWhatsApp");
    const select = document.getElementById("wa_cliente_individual");
    if (!tabela || !select) return;
    tabela.innerHTML = "";
    select.innerHTML = "<option value=''>Selecione um cliente</option>";
    snap.forEach(doc => { const c = doc.data(); c.id = doc.id; clientesWhatsApp.push(c); const opt = document.createElement("option"); opt.value = doc.id; opt.textContent = c.nome; select.appendChild(opt); tabela.innerHTML += `<tr data-cliente-id="${doc.id}"><td><input type="checkbox" class="wa-cliente-checkbox" value="${doc.id}"></td><td>${c.nome||""}</td><td>${c.telefone||""}</td><td>${c.status||""}</td><td>${c.plano||""}</td><td>${c.vencimento||""}</td><td>R$ ${Number(c.valor||0).toFixed(2)}</td></tr>`; });
    filtrarClientesWhatsApp();
  }, e => console.error("Erro WhatsApp:", e));
}

function filtrarClientesWhatsApp() {
  const fStatus = document.getElementById("wa_filtro_status").value;
  const fVenc = document.getElementById("wa_filtro_vencimento").value;
  const fNome = document.getElementById("wa_filtro_nome").value.toLowerCase();
  document.querySelectorAll("#listaClientesWhatsApp tr").forEach(linha => {
    const id = linha.getAttribute("data-cliente-id");
    const c = clientesWhatsApp.find(x => x.id === id);
    if (!c) return;
    let mostrar = true;
    if (fStatus && c.status !== fStatus) mostrar = false;
    if (fNome && !c.nome.toLowerCase().includes(fNome)) mostrar = false;
    if (fVenc) { const hoje = new Date().getDate(); const dia = parseInt(c.vencimento); if (fVenc === "hoje" && hoje !== dia) mostrar = false; if (fVenc === "3dias" && (dia - hoje < 0 || dia - hoje > 3)) mostrar = false; if (fVenc === "7dias" && (dia - hoje < 0 || dia - hoje > 7)) mostrar = false; if (fVenc === "atrasado" && dia - hoje >= 0) mostrar = false; }
    linha.style.display = mostrar ? "" : "none";
  });
}

function toggleSelectAllWhatsApp() {
  const checked = document.getElementById("wa_select_all").checked;
  document.querySelectorAll(".wa-cliente-checkbox").forEach(cb => { cb.checked = checked; checked ? clientesSelecionadosWhatsApp.add(cb.value) : clientesSelecionadosWhatsApp.delete(cb.value); });
}

function selecionarTodosWhatsApp() {
  document.querySelectorAll(".wa-cliente-checkbox").forEach(cb => { cb.checked = true; clientesSelecionadosWhatsApp.add(cb.value); });
  const el = document.getElementById("wa_select_all");
  if (el) el.checked = true;
}

function carregarTemplate(tipo) { const ta = document.getElementById("wa_template_" + tipo); if (ta && configuracoesWhatsApp.templates[tipo]) ta.value = configuracoesWhatsApp.templates[tipo]; }

function salvarTemplate(tipo) {
  const ta = document.getElementById("wa_template_" + tipo);
  if (ta) { configuracoesWhatsApp.templates[tipo] = ta.value; db.collection("configuracoes").doc("whatsapp").set({ templates: configuracoesWhatsApp.templates, updatedAt: new Date() }, { merge: true }).then(() => showToast("Modelo salvo!", "success")).catch(e => showToast("Erro: " + e.message, "error")); }
}

function salvarNomeEmpresa() {
  const nome = document.getElementById("wa_nome_empresa").value;
  configuracoesWhatsApp.nomeEmpresa = nome;
  db.collection("configuracoes").doc("whatsapp").set({ nomeEmpresa: nome, updatedAt: new Date() }, { merge: true }).then(() => showToast("Nome salvo!", "success")).catch(e => showToast("Erro: " + e.message, "error"));
}

function salvarConfiguracaoAPI() {
  const apiProvider = document.getElementById("wa_api_provider").value; const apiKey = document.getElementById("wa_api_key").value; const apiUrl = document.getElementById("wa_api_url").value;
  configuracoesWhatsApp.apiProvider = apiProvider; configuracoesWhatsApp.apiKey = apiKey; configuracoesWhatsApp.apiUrl = apiUrl;
  db.collection("configuracoes").doc("whatsapp").set({ apiProvider, apiKey, apiUrl, updatedAt: new Date() }, { merge: true }).then(() => showToast("Configuração salva!", "success")).catch(e => showToast("Erro: " + e.message, "error"));
}

function substituirVariaveis(msg, cliente, valor, vencimento) {
  return msg.replace(/{nome_cliente}/g, cliente.nome || "").replace(/{valor}/g, "R$ " + Number(valor||0).toFixed(2)).replace(/{vencimento}/g, vencimento || "").replace(/{plano}/g, cliente.plano || "").replace(/{empresa}/g, configuracoesWhatsApp.nomeEmpresa || "Sua Empresa").replace(/{telefone}/g, cliente.telefone || "");
}

function carregarTemplateNaTextarea(tipo, textareaId) { const ta = document.getElementById(textareaId); if (ta && configuracoesWhatsApp.templates[tipo]) ta.value = configuracoesWhatsApp.templates[tipo]; }

function enviarMensagemIndividual() {
  const clienteId = document.getElementById("wa_cliente_individual").value; const templateTipo = document.getElementById("wa_template_individual").value; const msgCustom = document.getElementById("wa_mensagem_individual").value;
  if (!clienteId) { showToast("Selecione um cliente!", "warning"); return; }
  const cliente = clientesWhatsApp.find(c => c.id === clienteId);
  if (!cliente) { showToast("Cliente não encontrado!", "error"); return; }
  if (!cliente.telefone) { showToast("Cliente sem telefone!", "warning"); return; }
  let mensagem = "", tipoMsg = templateTipo;
  if (templateTipo === "personalizado") mensagem = msgCustom;
  else { const template = configuracoesWhatsApp.templates[templateTipo] || ""; mensagem = substituirVariaveis(template, cliente, cliente.valor, formatarDataVencimento(cliente.vencimento)); }
  if (!mensagem) { showToast("Digite uma mensagem!", "warning"); return; }
  const tel = formatarTelefoneWhatsApp(cliente.telefone);
  window.open(`https://wa.me/${tel}?text=${encodeURIComponent(mensagem)}`, '_blank');
  salvarHistoricoWhatsApp(cliente, mensagem, tipoMsg, "Enviado");
}

function enviarMensagemMassa() {
  const templateTipo = document.getElementById("wa_template_massa").value; const msgCustom = document.getElementById("wa_mensagem_massa").value;
  if (clientesSelecionadosWhatsApp.size === 0) { showToast("Selecione clientes!", "warning"); return; }
  let tipoMsg = templateTipo === "personalizado" ? "personalizado" : templateTipo;
  let template = templateTipo === "personalizado" ? msgCustom : (configuracoesWhatsApp.templates[templateTipo] || "");
  if (!template) { showToast("Digite uma mensagem!", "warning"); return; }
  let cont = 0;
  clientesSelecionadosWhatsApp.forEach(id => { const c = clientesWhatsApp.find(x => x.id === id); if (c && c.telefone) { salvarHistoricoWhatsApp(c, substituirVariaveis(template, c, c.valor, formatarDataVencimento(c.vencimento)), tipoMsg, "Enviado"); cont++; } });
  showToast(`${cont} mensagens preparadas!`, "success", "WhatsApp");
  clientesSelecionadosWhatsApp.forEach((id, idx) => { const c = clientesWhatsApp.find(x => x.id === id); if (c && c.telefone) { const msg = substituirVariaveis(template, c, c.valor, formatarDataVencimento(c.vencimento)); setTimeout(() => window.open(`https://wa.me/${formatarTelefoneWhatsApp(c.telefone)}?text=${encodeURIComponent(msg)}`, '_blank'), idx * 1000); } });
  clientesSelecionadosWhatsApp.clear();
  document.querySelectorAll(".wa-cliente-checkbox").forEach(cb => cb.checked = false);
  const el = document.getElementById("wa_select_all");
  if (el) el.checked = false;
}

function identificarCobrancasPendentes() {
  const hoje = new Date(); let vencHoje = 0, venc3 = 0, venc7 = 0, atraso = 0;
  const tabela = document.getElementById("listaCobrancasWhatsApp");
  if (!tabela) return; tabela.innerHTML = "";
  if (cobrancasWhatsAppListener) cobrancasWhatsAppListener();
  cobrancasWhatsAppListener = db.collection("mensalidades").where("tenantId","==",getTenantId()).where("status","==","Em Aberto").onSnapshot(snap => {
    tabela.innerHTML = ""; vencHoje = 0; venc3 = 0; venc7 = 0; atraso = 0;
    snap.forEach(doc => { const m = doc.data(); const diff = Math.floor((new Date(m.vencimento) - hoje) / (1000*60*60*24)); let cat = ""; if (diff === 0) { vencHoje++; cat = "hoje"; } else if (diff > 0 && diff <= 3) { venc3++; cat = "3dias"; } else if (diff > 0 && diff <= 7) { venc7++; cat = "7dias"; } else if (diff < 0) { atraso++; cat = "atrasado"; } if (cat) { const c = clientesWhatsApp.find(x => x.id === m.clienteId); if (c) { tabela.innerHTML += `<tr data-categoria="${cat}"><td>${m.clienteNome}</td><td>${c.telefone||""}</td><td>R$ ${m.valor.toFixed(2)}</td><td>${m.vencimento}</td><td>${diff} dias</td><td>${cat}</td><td><button onclick="enviarCobrancaIndividual('${doc.id}','${cat}')"><i class="fab fa-whatsapp"></i> Enviar</button></td></tr>`; } } });
    document.getElementById("wa_vencendo_hoje").innerText = String(vencHoje);
    document.getElementById("wa_vencendo_3dias").innerText = String(venc3);
    document.getElementById("wa_vencendo_7dias").innerText = String(venc7);
    document.getElementById("wa_em_atraso").innerText = String(atraso);
  }, e => console.error("Erro cobranças:", e));
}

function enviarCobrancaIndividual(mensalidadeId, categoria) {
  db.collection("mensalidades").doc(mensalidadeId).get().then(doc => { const m = doc.data(); const c = clientesWhatsApp.find(x => x.id === m.clienteId); if (!c || !c.telefone) { showToast("Cliente sem telefone!", "warning"); return; } let tipo = ""; if (categoria === "3dias") tipo = "aviso_vencimento"; else if (categoria === "hoje") tipo = "cobranca_vencimento"; else if (categoria === "atrasado") tipo = "cobranca_atraso"; const template = configuracoesWhatsApp.templates[tipo] || ""; const msg = substituirVariaveis(template, c, m.valor, m.vencimento); salvarHistoricoWhatsApp(c, msg, tipo, "Enviado"); window.open(`https://wa.me/${formatarTelefoneWhatsApp(c.telefone)}?text=${encodeURIComponent(msg)}`, '_blank'); }).catch(e => showToast("Erro: " + e.message, "error"));
}

function enviarAvisoVencimento3Dias() { const linhas = document.querySelectorAll("#listaCobrancasWhatsApp tr[data-categoria='3dias']"); if (!linhas.length) { showToast("Nenhum cliente vencendo em 3 dias.", "info"); return; } if (!confirm(`Enviar aviso para ${linhas.length} clientes?`)) return; linhas.forEach(l => { const b = l.querySelectorAll("button"); if (b.length) b[0].click(); }); }
function enviarCobrancaHoje() { const linhas = document.querySelectorAll("#listaCobrancasWhatsApp tr[data-categoria='hoje']"); if (!linhas.length) { showToast("Nenhum cliente vencendo hoje.", "info"); return; } if (!confirm(`Enviar cobrança para ${linhas.length} clientes?`)) return; linhas.forEach(l => { const b = l.querySelectorAll("button"); if (b.length) b[0].click(); }); }
function enviarCobrancaAtraso() { const linhas = document.querySelectorAll("#listaCobrancasWhatsApp tr[data-categoria='atrasado']"); if (!linhas.length) { showToast("Nenhum cliente em atraso.", "info"); return; } if (!confirm(`Enviar cobrança para ${linhas.length} clientes?`)) return; linhas.forEach(l => { const b = l.querySelectorAll("button"); if (b.length) b[0].click(); }); }

function enviarCobrancaAmigavel() {
  const linhas = document.querySelectorAll("#listaCobrancasWhatsApp tr[data-categoria='atrasado']");
  if (!linhas.length) { showToast("Nenhum cliente em atraso.", "info"); return; }
  if (!confirm(`Enviar cobrança amigável para ${linhas.length} clientes?`)) return;
  linhas.forEach(l => { const nome = l.cells[0].textContent; const c = clientesWhatsApp.find(x => x.nome === nome); if (c && c.telefone) { const template = configuracoesWhatsApp.templates.cobranca_amigavel || ""; const msg = substituirVariaveis(template, c, c.valor, formatarDataVencimento(c.vencimento)); salvarHistoricoWhatsApp(c, msg, "cobranca_amigavel", "Enviado"); window.open(`https://wa.me/${formatarTelefoneWhatsApp(c.telefone)}?text=${encodeURIComponent(msg)}`, '_blank'); } });
}

function salvarHistoricoWhatsApp(cliente, mensagem, tipo, status) {
  const agora = new Date();
  db.collection("whatsapp_historico").add(secureData({ clienteId: cliente.id, clienteNome: cliente.nome, clienteTelefone: cliente.telefone, mensagem, tipo, status, data: agora.toLocaleDateString('pt-BR'), hora: agora.toLocaleTimeString('pt-BR'), timestamp: agora })).catch(e => console.error("Erro histórico:", e));
}

function carregarHistoricoWhatsApp() {
  if (historicoWhatsAppListener) historicoWhatsAppListener();
  historicoWhatsAppListener = db.collection("whatsapp_historico").where("tenantId","==",getTenantId()).orderBy("timestamp","desc").limit(100).onSnapshot(snap => {
    const tabela = document.getElementById("listaHistoricoWhatsApp");
    if (!tabela) return;
    tabela.innerHTML = "";
    snap.forEach(doc => { const h = doc.data(); tabela.innerHTML += `<tr><td>${h.clienteNome}</td><td>${h.data}</td><td>${h.hora}</td><td>${h.tipo}</td><td><span class="status-${(h.status||"").toLowerCase()}">${h.status}</span></td><td><button onclick="verMensagemHistorico('${doc.id}')"><i class="fas fa-eye"></i> Ver</button></td></tr>`; });
  }, e => console.error("Erro histórico:", e));
}

function filtrarHistoricoWhatsApp() {
  const busca = document.getElementById("wa_busca_historico").value.toLowerCase();
  const tipo = document.getElementById("wa_filtro_tipo_historico").value;
  const status = document.getElementById("wa_filtro_status_historico").value;
  document.querySelectorAll("#listaHistoricoWhatsApp tr").forEach(linha => {
    if (linha.cells.length < 5) return;
    const c = linha.cells[0].textContent.toLowerCase(); const t = linha.cells[3].textContent; const s = linha.cells[4].textContent.toLowerCase();
    linha.style.display = c.includes(busca) && (tipo === "" || t === tipo) && (status === "" || s.includes(status.toLowerCase())) ? "" : "none";
  });
}

function verMensagemHistorico(id) { db.collection("whatsapp_historico").doc(id).get().then(doc => { if (doc.exists) showToast(doc.data().mensagem, "info", doc.data().clienteNome); }).catch(e => showToast("Erro: " + e.message, "error")); }

function limparHistoricoWhatsApp() {
  if (!confirm("Limpar todo o histórico?")) return;
  db.collection("whatsapp_historico").where("tenantId","==",getTenantId()).get().then(snap => { const b = db.batch(); snap.forEach(d => b.delete(d.ref)); return b.commit(); }).then(() => showToast("Histórico limpo!", "success")).catch(e => showToast("Erro: " + e.message, "error"));
}

function carregarConfiguracoesWhatsApp() {
  db.collection("configuracoes").doc("whatsapp").get().then(doc => {
    if (!doc.exists) return;
    const config = doc.data();
    if (config.templates) { configuracoesWhatsApp.templates = config.templates; Object.keys(config.templates).forEach(tipo => { const ta = document.getElementById("wa_template_" + tipo); if (ta) ta.value = config.templates[tipo]; }); }
    if (config.nomeEmpresa) { configuracoesWhatsApp.nomeEmpresa = config.nomeEmpresa; const el = document.getElementById("wa_nome_empresa"); if (el) el.value = config.nomeEmpresa; }
    if (config.apiProvider) { configuracoesWhatsApp.apiProvider = config.apiProvider; const el = document.getElementById("wa_api_provider"); if (el) el.value = config.apiProvider; }
    if (config.apiKey) { configuracoesWhatsApp.apiKey = config.apiKey; const el = document.getElementById("wa_api_key"); if (el) el.value = config.apiKey; }
    if (config.apiUrl) { configuracoesWhatsApp.apiUrl = config.apiUrl; const el = document.getElementById("wa_api_url"); if (el) el.value = config.apiUrl; }
  }).catch(e => console.error("Erro config:", e));
}

function formatarTelefoneWhatsApp(telefone) { let t = telefone.replace(/\D/g,''); if (t.startsWith('55') && t.length === 12) t = t.substring(2); return '55' + t; }
function formatarDataVencimento(dia) { const d = new Date(); d.setDate(parseInt(dia)); return d.toLocaleDateString('pt-BR'); }

// ===========================
// ADMIN SECTION
// ===========================

function mostrarAbaAdmin(aba, event) {
  if (!isMasterAdmin()) { showToast("Acesso negado.", "error"); return; }
  document.querySelectorAll(".abaAdmin").forEach(a => { a.style.display = "none"; a.classList.remove("ativa"); });
  const el = document.getElementById("admin-" + aba);
  if (!el) return; el.style.display = "block"; el.classList.add("ativa");
  document.querySelectorAll(".adminTabBtn").forEach(btn => { btn.classList.remove("active"); if (btn.getAttribute("onclick") && btn.getAttribute("onclick").includes(aba)) btn.classList.add("active"); });
  if (aba === "dashboard") carregarDashboardAdmin();
  else if (aba === "usuarios") carregarUsuariosAdmin();
}

function carregarDashboardAdmin() {
  if (adminDashboardListener) adminDashboardListener();
  adminDashboardListener = db.collection("usuarios").onSnapshot(snap => {
    let total = 0, ativos = 0, bloqueados = 0, receita = 0, novos = 0;
    const agora = new Date(); const mes = agora.getMonth(), ano = agora.getFullYear();
    const todos = [];
    snap.forEach(doc => { const u = doc.data(); u._id = doc.id; todos.push(u); total++; if (u.status === "Ativo") ativos++; else if (u.status === "Bloqueado") bloqueados++; receita += configuracoesSistema.planos[u.plano] || 0; if (u.criadoEm) { const d = u.criadoEm.toDate ? u.criadoEm.toDate() : new Date(u.criadoEm); if (d.getMonth() === mes && d.getFullYear() === ano) novos++; } });
    document.getElementById("admin_total_usuarios").innerText = total;
    document.getElementById("admin_usuarios_ativos").innerText = ativos;
    document.getElementById("admin_usuarios_bloqueados").innerText = bloqueados;
    document.getElementById("admin_receita_mensal").innerText = "R$ " + receita.toFixed(2);
    document.getElementById("admin_novos_cadastros").innerText = novos;
    const tabela = document.getElementById("listaUltimosUsuarios");
    if (tabela) { tabela.innerHTML = ""; todos.slice(-5).reverse().forEach(u => { tabela.innerHTML += `<tr><td>${u.nome||""}</td><td>${u.empresa||""}</td><td>${u.email||""}</td><td>${u.plano||""}</td><td><span class="status-${(u.status||"").toLowerCase()}">${u.status}</span></td><td>${u.criadoEm ? new Date(u.criadoEm.toDate ? u.criadoEm.toDate() : u.criadoEm).toLocaleDateString('pt-BR') : ""}</td></tr>`; }); }
  }, e => console.error("Erro admin:", e));
}

function carregarUsuariosAdmin() {
  if (adminUsuariosListener) adminUsuariosListener();
  adminUsuariosListener = db.collection("usuarios").orderBy("criadoEm","desc").onSnapshot(snap => {
    const tabela = document.getElementById("listaUsuariosAdmin");
    if (!tabela) return;
    tabela.innerHTML = "";
    snap.forEach(doc => { const u = doc.data(); tabela.innerHTML += `<tr><td>${u.nome||""}</td><td>${u.empresa||""}</td><td>${u.email||""}</td><td>${u.telefone||""}</td><td>${u.plano||""}</td><td><span class="status-${(u.status||"").toLowerCase()}">${u.status}</span></td><td>${u.role||"cliente"}</td><td>${u.criadoEm ? new Date(u.criadoEm.toDate ? u.criadoEm.toDate() : u.criadoEm).toLocaleDateString('pt-BR') : ""}</td><td><div class="action-buttons"><button class="btn-action btn-action-edit" onclick="editarUsuario('${doc.id}')" title="Editar"><i class="fas fa-pen-to-square"></i><span class="tooltip-text">Editar</span></button><button class="btn-action btn-action-warning" onclick="redefinirSenhaUsuario('${doc.id}')" title="Senha"><i class="fas fa-key"></i><span class="tooltip-text">Redefinir</span></button>${u.status === "Ativo" ? `<button class="btn-action btn-action-warning" onclick="bloquearUsuario('${doc.id}')" title="Bloquear"><i class="fas fa-lock"></i><span class="tooltip-text">Bloquear</span></button>` : `<button class="btn-action btn-action-success" onclick="ativarUsuario('${doc.id}')" title="Ativar"><i class="fas fa-unlock"></i><span class="tooltip-text">Ativar</span></button>`}<button class="btn-action btn-action-delete" onclick="abrirModalExclusao('usuario', '${doc.id}', '${u.nome||''}')" title="Excluir"><i class="fas fa-trash-can"></i><span class="tooltip-text">Excluir</span></button></div></td></tr>`; });
  }, e => console.error("Erro admin usuários:", e));
}

function filtrarUsuarios() {
  const busca = document.getElementById("admin_busca_usuario").value.toLowerCase();
  const status = document.getElementById("admin_filtro_status").value;
  const plano = document.getElementById("admin_filtro_plano").value;
  document.querySelectorAll("#listaUsuariosAdmin tr").forEach(linha => {
    if (linha.cells.length < 8) return;
    const n = linha.cells[0].textContent.toLowerCase(); const e = linha.cells[1].textContent.toLowerCase(); const em = linha.cells[2].textContent.toLowerCase(); const s = linha.cells[5].textContent; const p = linha.cells[4].textContent;
    linha.style.display = (n.includes(busca)||e.includes(busca)||em.includes(busca)) && (status === "" || s.includes(status)) && (plano === "" || p === plano) ? "" : "none";
  });
}

function abrirModalUsuario() { const modal = document.getElementById("modalUsuario"); if (modal) modal.style.display = "flex"; const titulo = document.getElementById("modalUsuarioTitulo"); if (titulo) titulo.innerText = "Novo Usuário"; limparFormularioUsuario(); usuarioEditando = null; }
function fecharModalUsuario() { document.getElementById("modalUsuario").style.display = "none"; limparFormularioUsuario(); usuarioEditando = null; }
function limparFormularioUsuario() {
  document.getElementById("admin_usuario_id").value = ""; document.getElementById("admin_usuario_nome").value = "";
  document.getElementById("admin_usuario_empresa").value = ""; document.getElementById("admin_usuario_email").value = "";
  document.getElementById("admin_usuario_telefone").value = ""; const p = document.getElementById("admin_usuario_plano"); if (p) p.selectedIndex = 0;
  const r = document.getElementById("admin_usuario_role"); if (r) r.selectedIndex = 0; const s = document.getElementById("admin_usuario_status"); if (s) s.selectedIndex = 0;
}

async function salvarUsuario() {
  if (!isMasterAdmin()) { showToast("Ação reservada.", "error"); return; }
  const id = document.getElementById("admin_usuario_id").value; const nome = document.getElementById("admin_usuario_nome").value;
  const empresa = document.getElementById("admin_usuario_empresa").value; const email = document.getElementById("admin_usuario_email").value;
  const telefone = document.getElementById("admin_usuario_telefone").value; const plano = document.getElementById("admin_usuario_plano").value;
  const status = document.getElementById("admin_usuario_status").value;
  if (!nome || !email) { showToast("Preencha nome e e-mail!", "warning"); return; }
  try {
    if (id) { await db.collection("usuarios").doc(id).update(secureUpdate({ nome, empresa, telefone, plano, status })); showToast("Usuário atualizado!", "success"); }
    else { const createProvider = functions.httpsCallable('createProvider'); const resp = await createProvider({ email, nome, empresa, telefone, plano, status }); showToast(`Usuário criado! Senha: ${resp.data.senha}`, "success"); }
    fecharModalUsuario(); carregarUsuariosAdmin(); carregarDashboardAdmin();
  } catch (e) { showToast("Erro: " + (e.message||e), "error"); }
}

async function editarUsuario(id) {
  try { const doc = await db.collection("usuarios").doc(id).get(); if (!doc.exists) { showToast("Usuário não encontrado!", "error"); return; } const u = doc.data(); usuarioEditando = id; document.getElementById("modalUsuario").style.display = "flex"; document.getElementById("modalUsuarioTitulo").innerText = "Editar Usuário"; document.getElementById("admin_usuario_id").value = id; document.getElementById("admin_usuario_nome").value = u.nome || ""; document.getElementById("admin_usuario_empresa").value = u.empresa || ""; document.getElementById("admin_usuario_email").value = u.email || ""; document.getElementById("admin_usuario_telefone").value = u.telefone || ""; if (document.getElementById("admin_usuario_plano")) document.getElementById("admin_usuario_plano").value = u.plano || ""; if (document.getElementById("admin_usuario_role")) document.getElementById("admin_usuario_role").value = u.role || "cliente"; if (document.getElementById("admin_usuario_status")) document.getElementById("admin_usuario_status").value = u.status || ""; } catch (e) { showToast("Erro: " + e.message, "error"); }
}

async function bloquearUsuario(id) {
  if (!isMasterAdmin()) { showToast("Ação reservada.", "error"); return; }
  if (!confirm("Bloquear este usuário?")) return;
  try { await functions.httpsCallable('updateUserStatus')({ uid: id, status: "Bloqueado" }); showToast("Usuário bloqueado!", "success"); carregarUsuariosAdmin(); carregarDashboardAdmin(); } catch (e) { showToast("Erro: " + (e.message||e), "error"); }
}

async function ativarUsuario(id) {
  if (!isMasterAdmin()) { showToast("Ação reservada.", "error"); return; }
  if (!confirm("Ativar este usuário?")) return;
  try { await functions.httpsCallable('updateUserStatus')({ uid: id, status: "Ativo" }); showToast("Usuário ativado!", "success"); carregarUsuariosAdmin(); carregarDashboardAdmin(); } catch (e) { showToast("Erro: " + (e.message||e), "error"); }
}

async function excluirUsuarioAdmin(id) {
  if (!isMasterAdmin()) { showToast("Ação reservada.", "error"); return; }
  try { await functions.httpsCallable('deleteUserAccount')({ uid: id }); showToast("Usuário excluído!", "success"); carregarUsuariosAdmin(); carregarDashboardAdmin(); } catch (e) { showToast("Erro: " + (e.message||e), "error"); }
}

async function redefinirSenhaUsuario(id) {
  if (!isMasterAdmin()) { showToast("Ação reservada.", "error"); return; }
  try { const doc = await db.collection("usuarios").doc(id).get(); if (!doc.exists) { showToast("Usuário não encontrado!", "error"); return; } const u = doc.data(); if (!confirm(`Redefinir senha de ${u.email}?`)) return; const resp = await functions.httpsCallable('sendPasswordReset')({ email: u.email }); showToast(`Link: ${resp.data.link}`, "info", "Redefinir Senha"); } catch (e) { showToast("Erro: " + (e.message||e), "error"); }
}

function excluirUsuario(id) { if (!isMasterAdmin()) { showToast("Ação reservada.", "error"); return; } abrirModalExclusao('usuario', id, ''); }

async function diagnosticarDados() {
  if (!auth.currentUser) { showToast("Faça login.", "warning"); return; }
  if (!usuarioAtual.tenantId) { showToast("Tenant não encontrado.", "error"); return; }
  const results = await Promise.all([
    db.collection("clientes").where("tenantId","==",getTenantId()).get(),
    db.collection("planos").where("tenantId","==",getTenantId()).get(),
    db.collection("recebimentos").where("tenantId","==",getTenantId()).get(),
    db.collection("despesas").where("tenantId","==",getTenantId()).get(),
    db.collection("mensalidades").where("tenantId","==",getTenantId()).get(),
    db.collection("whatsapp_historico").where("tenantId","==",getTenantId()).get()
  ]);
  showToast(`Clientes: ${results[0].size} | Planos: ${results[1].size} | Recebimentos: ${results[2].size} | Despesas: ${results[3].size} | Mensalidades: ${results[4].size} | WhatsApp: ${results[5].size}`, "info", "Diagnóstico");
}

function migrarDadosExistentes() { showToast("Migração deve ser feita via backend seguro.", "info"); }

// ===========================
// ENGENHARIA FTTH
// ===========================

function addSplitter() {
  const div = document.createElement("div");
  div.className = "splitter-container";
  div.innerHTML = `<select class="splitter"><option value="0">Sem splitter</option><option value="3.5">1:2</option><option value="7">1:4</option><option value="10.5">1:8</option><option value="13.5">1:16</option><option value="17">1:32</option></select><button class="remove-btn" onclick="removeSplitter(this)">✕</button>`;
  const container = document.getElementById("calc_splitters");
  if (container) container.appendChild(div);
}

function removeSplitter(btn) { if (document.querySelectorAll("#calc_splitters .splitter-container").length > 1) btn.parentElement.remove(); }

function calcularFTTH() {
  const olt = parseFloat(document.getElementById("calc_olt").value); const km = parseFloat(document.getElementById("calc_km").value);
  const lossKm = parseFloat(document.getElementById("calc_lossKm").value); const conn = parseInt(document.getElementById("calc_conn").value);
  const lossConn = parseFloat(document.getElementById("calc_lossConn").value); const threshold = parseFloat(document.getElementById("calc_threshold").value);
  if (isNaN(olt)||isNaN(km)||isNaN(lossKm)||isNaN(conn)||isNaN(lossConn)) { document.getElementById("calc_resultado").innerHTML = '<div class="calcResultado calcResultadoErro"><p>⚠️ Preencha todos os campos</p></div>'; return; }
  if (km < 0 || conn < 0 || lossKm < 0 || lossConn < 0) { document.getElementById("calc_resultado").innerHTML = '<div class="calcResultado calcResultadoErro"><p>⚠️ Valores negativos não permitidos</p></div>'; return; }
  let perda = km * lossKm + conn * lossConn;
  const splitters = document.querySelectorAll("#calc_splitters .splitter"); const cadeia = [];
  splitters.forEach(s => { const v = parseFloat(s.value); if (v > 0) { perda += v; cadeia.push(v); } });
  const final = olt - perda; const ok = final >= threshold; const style = ok ? "calcResultadoSucesso" : "calcResultadoErro"; const status = ok ? "🟢 OK (Dentro do padrão)" : "🔴 RUIM (Perda alta)";
  document.getElementById("calc_resultado").innerHTML = `<div class="calcResultado ${style}"><p>📡 OLT: ${olt} dBm</p><p>📉 Fibra: ${(km*lossKm).toFixed(2)} dB</p><p>🔌 Conectores: ${(conn*lossConn).toFixed(2)} dB</p><p>🔀 Splitters: ${cadeia.join(" + ") || 0} dB</p><hr style="margin:15px 0;border:none;border-top:1px solid rgba(255,255,255,0.1);"><h3>⚡ Potência final: ${final.toFixed(2)} dBm</h3><h3>${status}</h3><p style="margin-top:10px;font-size:12px;color:rgba(255,255,255,0.7);">Perda total: ${perda.toFixed(2)} dB</p></div>`;
}

// ===========================
// AUTH STATE LISTENER
// ===========================

auth.onAuthStateChanged(async (user) => {
  limparListeners();

  if (user) {
    try {
      const currentPage = window.location.pathname.split('/').pop() || 'index.html';
      const isIndexPage = currentPage === 'index.html' || currentPage === '';

      await carregarUsuarioAtual();
      mostrarAdminIfNeeded();

      if ((usuarioAtual.role === 'superadmin' || usuarioAtual.role === 'MASTER_ADMIN') && isIndexPage) {
        window.location.href = 'superadmin.html';
        return;
      }

      const loginTela = document.getElementById("loginTela");
      const cadastroTela = document.getElementById("cadastroTela");
      const sistema = document.getElementById("sistema");

      const loginVisivel = loginTela && loginTela.style.display !== "none";
      const cadastroVisivel = cadastroTela && cadastroTela.style.display !== "none";

      if (loginVisivel && !cadastroVisivel) {
        loginTela.style.display = "none";
        if (cadastroTela) cadastroTela.style.display = "none";
        if (sistema) sistema.style.display = "flex";
        esconderTelaBloqueio();
        mostrarSecao("dashboard");
        initializeTheme();
        await carregarConfiguracoesSistema();
        carregarDadosIniciais();
      } else if (cadastroVisivel) {
        if (sistema && sistema.style.display === "flex") carregarDadosIniciais();
      }
    } catch (erro) {
      if (erro.code === 'EMPRESA_BLOQUEADA') {
        await auth.signOut();
        mostrarTelaBloqueio(erro.message, erro.data?.status);
        return;
      }
      console.error("Erro ao inicializar sessão:", erro);
    }
  } else {
    usuarioAtual = { uid: null, email: null, role: null, tenantId: null };
    const btnAdmin = document.getElementById('btnAdmin');
    if (btnAdmin) btnAdmin.style.display = 'none';
  }
});