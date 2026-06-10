from pathlib import Path

root = Path('.')
app = root / 'app.js'
text = app.read_text(encoding='utf-8')

needle = 'let clientesLastDoc = null;\nlet recebimentosLastDoc = null;\nlet despesasLastDoc = null;\nlet clientesPageSize = 20;\nlet recebimentosPageSize = 20;\nlet despesasPageSize = 20;\n'
insert = '''let usuarioAtual = {
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

async function carregarUsuarioAtual() {
  if (!auth.currentUser) return;

  usuarioAtual.uid = auth.currentUser.uid;
  usuarioAtual.email = auth.currentUser.email;

  try {
    const tokenResult = await auth.currentUser.getIdTokenResult(true);
    usuarioAtual.role = tokenResult.claims.role || usuarioAtual.role;
    usuarioAtual.tenantId = tokenResult.claims.tenantId || usuarioAtual.tenantId;
  } catch (erro) {
    console.warn('Não foi possível obter custom claims, usando dados do perfil:', erro);
  }

  try {
    const userDoc = await db.collection('usuarios').doc(usuarioAtual.uid).get();
    if (userDoc.exists) {
      const data = userDoc.data();
      usuarioAtual.role = usuarioAtual.role || data.role;
      usuarioAtual.tenantId = usuarioAtual.tenantId || data.tenantId || usuarioAtual.uid;
    }
  } catch (erro) {
    console.warn('Erro ao buscar perfil de usuário:', erro);
  }

  if (!usuarioAtual.tenantId) {
    usuarioAtual.tenantId = usuarioAtual.uid;
  }

  mostrarAdminIfNeeded();
  return usuarioAtual;
}

function secureCollection(collectionName) {
  if (!usuarioAtual.tenantId) {
    throw new Error('Tenant ID não definido. Verifique o login e as custom claims.');
  }
  return db.collection(collectionName).where('tenantId', '==', usuarioAtual.tenantId);
}

function secureData(data) {
  return {
    ...data,
    tenantId: usuarioAtual.tenantId,
    createdBy: usuarioAtual.uid,
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
'''

if needle not in text:
    raise SystemExit('Needle not found in app.js')
text = text.replace(needle, needle + insert)

text = text.replace('.where("usuarioId", "==", auth.currentUser.uid)', '.where("tenantId", "==", usuarioAtual.tenantId)')
text = text.replace('usuarioId: auth.currentUser.uid', 'tenantId: usuarioAtual.tenantId, createdBy: usuarioAtual.uid')
text = text.replace('usuarioId: auth.currentUser.uid,', 'tenantId: usuarioAtual.tenantId, createdBy: usuarioAtual.uid,')

old_login = '''  auth.signInWithEmailAndPassword(email, senha)
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
'''
new_login = '''  auth.signInWithEmailAndPassword(email, senha)
    .then(async () => {
      await carregarUsuarioAtual();
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
'''
if old_login not in text:
    raise SystemExit('Old login block not found')
text = text.replace(old_login, new_login)

if 'auth.onAuthStateChanged(async (user) =>' not in text:
    text += '''

// Auth state listener ensures tenant claims and UI state are updated
auth.onAuthStateChanged(async (user) => {
  if (user) {
    await carregarUsuarioAtual();
    mostrarAdminIfNeeded();
  } else {
    usuarioAtual = { uid: null, email: null, role: null, tenantId: null };
    document.getElementById('btnAdmin')?.style.setProperty('display','none');
  }
});
'''

app.write_text(text, encoding='utf-8')

firebase = root / 'firebase.js'
fb_text = firebase.read_text(encoding='utf-8')
if 'const functions = firebase.functions();' not in fb_text:
    if 'const auth = firebase.auth();' in fb_text:
        fb_text = fb_text.replace('const auth = firebase.auth();', 'const auth = firebase.auth();\nconst functions = firebase.functions();')
        firebase.write_text(fb_text, encoding='utf-8')
    else:
        raise SystemExit('Auth init line not found in firebase.js')

index = root / 'index.html'
index_text = index.read_text(encoding='utf-8')
script_tag = '<script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-functions-compat.js"></script>'
if script_tag not in index_text:
    index_text = index_text.replace('<script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js"></script>\n\n  <script src="firebase.js"></script>', '<script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js"></script>\n  <script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-functions-compat.js"></script>\n\n  <script src="firebase.js"></script>')
    index.write_text(index_text, encoding='utf-8')

print('Patched app.js, firebase.js, and index.html scaffolding')
