[1mdiff --git a/app.js b/app.js[m
[1mindex ee4c749..4fca2c7 100644[m
[1m--- a/app.js[m
[1m+++ b/app.js[m
[36m@@ -197,8 +197,6 @@[m [mfunction carregarProviderData() {[m
   providerRef.onSnapshot((doc) => {[m
     const providerNameEl = document.getElementById("providerNameText");[m
     const providerLogoEl = document.getElementById("providerLogo");[m
[31m-    const sidebarLogoEl = document.getElementById("logoSidebar");[m
[31m-    const loginLogoEls = document.querySelectorAll(".logoLogin");[m
 [m
     if (doc.exists) {[m
       const data = doc.data();[m
[36m@@ -208,16 +206,13 @@[m [mfunction carregarProviderData() {[m
         providerNameEl.textContent = "Meu Provedor";[m
       }[m
 [m
[32m+[m[32m      // Apenas o logo do provedor (topbar) é alterado[m
[32m+[m[32m      // Sidebar e login mantêm a logo do ControlISP[m
       if (data.logoUrl) {[m
         const logoUrl = data.logoUrl;[m
[31m-        [providerLogoEl, sidebarLogoEl].forEach(el => {[m
[31m-          if (el) { el.src = logoUrl; el.onerror = function() { this.src = "img/logo.png"; }; }[m
[31m-        });[m
[31m-        loginLogoEls.forEach(el => { el.src = logoUrl; el.onerror = function() { this.src = "img/logo.png"; }; });[m
[32m+[m[32m        if (providerLogoEl) { providerLogoEl.src = logoUrl; providerLogoEl.onerror = function() { this.src = "img/logo.png"; }; }[m
       } else {[m
[31m-        const fallback = "img/logo.png";[m
[31m-        [providerLogoEl, sidebarLogoEl].forEach(el => { if (el) el.src = fallback; });[m
[31m-        loginLogoEls.forEach(el => { el.src = fallback; });[m
[32m+[m[32m        if (providerLogoEl) providerLogoEl.src = "img/logo.png";[m
       }[m
     } else {[m
       if (providerNameEl) providerNameEl.textContent = "Meu Provedor";[m
[36m@@ -264,63 +259,74 @@[m [masync function criarProviderDoc() {[m
 async function uploadProviderLogo(event) {[m
   const file = event.target.files[0];[m
   if (!file) return;[m
[31m-  const tiposPermitidos = ["image/jpeg", "image/png", "image/webp"];[m
[32m+[m[32m  const tiposPermitidos = ["image/jpeg", "image/png", "image/webp", "image/svg+xml"];[m
   if (!tiposPermitidos.includes(file.type)) {[m
     showToast("Formato inválido. Use JPG, PNG ou WEBP.", "error", "Erro");[m
     return;[m
   }[m
[31m-  if (file.size > 5 * 1024 * 1024) {[m
[31m-    showToast("A imagem deve ter no máximo 5MB.", "error", "Erro");[m
[32m+[m[32m  if (file.size > 2 * 1024 * 1024) {[m
[32m+[m[32m    showToast("A imagem deve ter no máximo 2MB.", "error", "Erro");[m
     return;[m
   }[m
   try {[m
[31m-    showToast("Enviando logo...", "info", "Upload");[m
[31m-    const tenantId = getTenantId();[m
[31m-    const storagePath = `logos/${tenantId}/${Date.now()}_${file.name}`;[m
[31m-    const storageRef = storage.ref(storagePath);[m
[32m+[m[32m    showToast("Processando logo...", "info", "Upload");[m
[32m+[m[41m    [m
[32m+[m[32m    // Converte a imagem para Base64 (simples, sem Firebase Storage)[m
[32m+[m[32m    const base64 = await fileToBase64(file);[m
     [m
[31m-    // Compress to max 600px for better quality[m
[31m-    const imagemComprimida = await comprimirImagem(file, 600);[m
[31m-    const snapshot = await storageRef.put(imagemComprimida);[m
[31m-    const downloadURL = await snapshot.ref.getDownloadURL();[m
[32m+[m[32m    // Comprime reduzindo qualidade se for muito grande[m
[32m+[m[32m    const imagemFinal = await comprimirBase64(base64, 400, 0.7);[m
[32m+[m[41m    [m
[32m+[m[32m    const tenantId = getTenantId();[m
     [m
[31m-    // Save URL to providers collection[m
[32m+[m[32m    // Salva diretamente no Firestore como string Base64[m
     await db.collection("providers").doc(tenantId).set({[m
[31m-      logoUrl: downloadURL, updatedAt: new Date(), updatedBy: usuarioAtual.uid[m
[32m+[m[32m      logoUrl: imagemFinal,[m
[32m+[m[32m      logoMimeType: file.type,[m
[32m+[m[32m      updatedAt: new Date(),[m
[32m+[m[32m      updatedBy: usuarioAtual.uid[m
     }, { merge: true });[m
     [m
[31m-    // Also save to empresas collection for cross-reference[m
[32m+[m[32m    // Também salva na empresa para compatibilidade[m
     try {[m
       await db.collection("empresas").doc(tenantId).set({[m
[31m-        logoUrl: downloadURL, updatedAt: new Date()[m
[32m+[m[32m        logoUrl: imagemFinal,[m
[32m+[m[32m        updatedAt: new Date()[m
       }, { merge: true });[m
     } catch (e) {}[m
     [m
[31m-    // Update all logo elements immediately[m
[32m+[m[32m    // Atualiza apenas o logo do provedor na topbar[m
[32m+[m[32m    // Sidebar e login mantêm a logo do ControlISP[m
     const providerLogoEl = document.getElementById("providerLogo");[m
[31m-    const sidebarLogoEl = document.getElementById("logoSidebar");[m
[31m-    const loginLogoEls = document.querySelectorAll(".logoLogin");[m
[31m-    if (providerLogoEl) providerLogoEl.src = downloadURL;[m
[31m-    if (sidebarLogoEl) sidebarLogoEl.src = downloadURL;[m
[31m-    loginLogoEls.forEach(el => { el.src = downloadURL; });[m
[32m+[m[32m    if (providerLogoEl) providerLogoEl.src = imagemFinal;[m
     [m
     showToast("Logo atualizada com sucesso!", "success", "Sucesso");[m
     await registrarAuditoria("logo_atualizada", "Logo do provedor alterada");[m
   } catch (erro) {[m
[31m-    console.error("Erro ao fazer upload da logo:", erro);[m
[31m-    showToast("Erro ao fazer upload. Tente novamente.", "error", "Erro");[m
[32m+[m[32m    console.error("Erro ao salvar logo:", erro);[m
[32m+[m[32m    showToast("Erro ao salvar logo. Tente novamente.", "error", "Erro");[m
   }[m
   event.target.value = "";[m
 }[m
 [m
[31m-function comprimirImagem(file, maxSize) {[m
[32m+[m[32m// Converte arquivo para Base64[m
[32m+[m[32mfunction fileToBase64(file) {[m
[32m+[m[32m  return new Promise((resolve, reject) => {[m
[32m+[m[32m    const reader = new FileReader();[m
[32m+[m[32m    reader.onload = () => resolve(reader.result);[m
[32m+[m[32m    reader.onerror = () => reject(new Error("Falha ao ler arquivo"));[m
[32m+[m[32m    reader.readAsDataURL(file);[m
[32m+[m[32m  });[m
[32m+[m[32m}[m
[32m+[m
[32m+[m[32m// Comprime imagem Base64 para um tamanho menor[m
[32m+[m[32mfunction comprimirBase64(base64, maxSize, qualidade) {[m
   return new Promise((resolve, reject) => {[m
     const img = new Image();[m
     img.onload = function() {[m
       const canvas = document.createElement("canvas");[m
       let width = img.width, height = img.height;[m
       [m
[31m-      // Only resize if larger than maxSize[m
       if (width > maxSize || height > maxSize) {[m
         if (width > height) {[m
           height = Math.round(height * (maxSize / width));[m
[36m@@ -336,14 +342,11 @@[m [mfunction comprimirImagem(file, maxSize) {[m
       const ctx = canvas.getContext("2d");[m
       ctx.drawImage(img, 0, 0, width, height);[m
       [m
[31m-      // Use PNG for transparency, JPEG for photos[m
[31m-      const outputType = file.type === "image/png" ? "image/png" : "image/jpeg";[m
[31m-      canvas.toBlob((blob) => {[m
[31m-        blob ? resolve(blob) : reject(new Error("Falha ao comprimir"));[m
[31m-      }, outputType, 0.85);[m
[32m+[m[32m      const dataUrl = canvas.toDataURL("image/jpeg", qualidade);[m
[32m+[m[32m      resolve(dataUrl);[m
     };[m
[31m-    img.onerror = () => reject(new Error("Falha ao carregar imagem"));[m
[31m-    img.src = URL.createObjectURL(file);[m
[32m+[m[32m    img.onerror = () => reject(new Error("Falha ao comprimir imagem"));[m
[32m+[m[32m    img.src = base64;[m
   });[m
 }[m
 [m
[36m@@ -1023,14 +1026,39 @@[m [mfunction carregarDashboardPremium() {[m
 [m
     const taxaInadimplencia = faturamentoMensal > 0 ? (clientesInadimplentes / clientesAtivos * 100) : 0;[m
     const setText = (id, val) => { const el = document.getElementById(id); if (el) el.innerText = val; };[m
[32m+[m[32m    // Ticket Médio = Faturamento Total / Número de Clientes Ativos[m
[32m+[m[32m    const ticketMedio = clientesAtivos > 0 ? faturamentoMensal / clientesAtivos : 0;[m
[32m+[m
[32m+[m[32m    // Faturamento Anual = soma de todos os pagamentos confirmados dos últimos 12 meses[m
[32m+[m[32m    let faturamentoAnual = 0;[m
[32m+[m[32m    const umAnoAtras = new Date(dataBrasil);[m
[32m+[m[32m    umAnoAtras.setFullYear(umAnoAtras.getFullYear() - 1);[m
[32m+[m[32m    recebSnap.forEach(doc => {[m
[32m+[m[32m      const r = doc.data();[m
[32m+[m[32m      if (statusRecebido.includes(r.status)) {[m
[32m+[m[32m        const dataPag = r.dataPagamento ? (r.dataPagamento.toDate ? r.dataPagamento.toDate() : new Date(r.dataPagamento)) : new Date(r.vencimento);[m
[32m+[m[32m        if (dataPag >= umAnoAtras && dataPag <= dataBrasil) {[m
[32m+[m[32m          faturamentoAnual += Number(r.valor) || 0;[m
[32m+[m[32m        }[m
[32m+[m[32m      }[m
[32m+[m[32m    });[m
[32m+[m[32m    mensalidadesSnap.forEach(doc => {[m
[32m+[m[32m      const m = doc.data();[m
[32m+[m[32m      if (statusRecebido.includes(m.status)) {[m
[32m+[m[32m        const dataPag = m.dataPagamento ? (m.dataPagamento.toDate ? m.dataPagamento.toDate() : new Date(m.dataPagamento)) : new Date(m.vencimento);[m
[32m+[m[32m        if (dataPag >= umAnoAtras && dataPag <= dataBrasil) {[m
[32m+[m[32m          faturamentoAnual += Number(m.valor) || 0;[m
[32m+[m[32m        }[m
[32m+[m[32m      }[m
[32m+[m[32m    });[m
[32m+[m
     setText("receitaRecebidaMes", "R$ " + receitaRecebidaMes.toFixed(2));[m
     setText("receitaPrevista", "R$ " + receitaPrevista.toFixed(2));[m
     setText("clientesAtivos", clientesAtivos);[m
     setText("clientesInadimplentes", clientesInadimplentes);[m
[31m-    setText("novosClientesMes", novosClientesMes);[m
     setText("taxaInadimplencia", taxaInadimplencia.toFixed(1) + "%");[m
[31m-    setText("chamadosAbertos", "0");[m
[31m-    setText("ticketsResolvidos", "0");[m
[32m+[m[32m    setText("ticketMedioDashboard", "R$ " + ticketMedio.toFixed(2));[m
[32m+[m[32m    setText("faturamentoAnual", "R$ " + faturamentoAnual.toFixed(2));[m
 [m
     const percReceita = receitaMesPassado > 0 ? ((receitaRecebidaMes - receitaMesPassado) / receitaMesPassado * 100) : 0;[m
     const trendReceita = document.getElementById("trendReceitaRecebida");[m
[36m@@ -1039,20 +1067,20 @@[m [mfunction carregarDashboardPremium() {[m
     }[m
     const trendClientes = document.getElementById("trendClientesAtivos");[m
     if (trendClientes) {[m
[31m-      trendClientes.innerHTML = `<span class="trend-icon"><i class="fas fa-arrow-up"></i></span><span class="trend-value">+${novosClientesMes}</span><span class="trend-label">novos este mês</span>`;[m
[32m+[m[32m      trendClientes.innerHTML = `<span class="trend-icon"><i class="fas fa-arrow-up"></i></span><span class="trend-value">+0</span><span class="trend-label">novos este mês</span>`;[m
     }[m
     const trendInad = document.getElementById("trendInadimplentes");[m
     if (trendInad) {[m
       trendInad.innerHTML = `<span class="trend-icon"><i class="fas fa-arrow-down"></i></span><span class="trend-value">${taxaInadimplencia.toFixed(1)}%</span><span class="trend-label">taxa de inadimplência</span>`;[m
     }[m
[31m-    const trendNovos = document.getElementById("trendNovosClientes");[m
[31m-    if (trendNovos) {[m
[31m-      trendNovos.innerHTML = `<span class="trend-icon"><i class="fas fa-arrow-up"></i></span><span class="trend-value">+${novosClientesMes}</span><span class="trend-label">este mês</span>`;[m
[31m-    }[m
     const trendTaxa = document.getElementById("trendTaxaInadimplencia");[m
     if (trendTaxa) {[m
       trendTaxa.innerHTML = `<span class="trend-icon"><i class="fas fa-arrow-down"></i></span><span class="trend-value">${taxaInadimplencia.toFixed(1)}%</span><span class="trend-label">do faturamento</span>`;[m
     }[m
[32m+[m[32m    const trendFaturamentoAnual = document.getElementById("trendFaturamentoAnual");[m
[32m+[m[32m    if (trendFaturamentoAnual) {[m
[32m+[m[32m      trendFaturamentoAnual.innerHTML = `<span class="trend-icon"><span style="font-weight:700;font-size:13px;">R$</span></span><span class="trend-value">+${faturamentoAnual.toFixed(0)}</span><span class="trend-label">últimos 12 meses</span>`;[m
[32m+[m[32m    }[m
     criarGraficos(receitaPorMes, clientesPorPlano, receitaPorPlano, clientesCadastrosMeses, inadimplenciaPorMes);[m
   }).catch(erro => {[m
     console.error("Erro ao carregar dashboard premium:", erro);[m
[1mdiff --git a/index.html b/index.html[m
[1mindex cc71bc4..7e08436 100644[m
[1m--- a/index.html[m
[1m+++ b/index.html[m
[36m@@ -185,7 +185,7 @@[m
 [m
     <aside class="sidebar" id="mainSidebar">[m
       <div class="sidebarTop">[m
[31m-        <img src="img/logo.png" class="logoSidebar" id="logoSidebar" alt="ControlISP Pro" style="width:42px;height:42px;border-radius:10px;object-fit:cover;">[m
[32m+[m[32m        <img src="img/logo.png" class="logoSidebar" id="logoSidebar" alt="ControlISP Pro">[m
         <h4>ControlISP</h4>[m
       </div>[m
 [m
[36m@@ -281,7 +281,6 @@[m
           <div class="skeleton-card"></div>[m
           <div class="skeleton-card"></div>[m
           <div class="skeleton-card"></div>[m
[31m-          <div class="skeleton-card"></div>[m
         </div>[m
 [m
         <!-- Premium KPI Cards -->[m
[36m@@ -362,21 +361,19 @@[m
             </div>[m
           </div>[m
 [m
[31m-          <!-- Card 5 - Novos Clientes -->[m
[32m+[m[32m          <!-- Card 5 - Ticket Médio -->[m
           <div class="card card-premium card-gradient-cyan">[m
             <div class="card-header">[m
               <div class="cardIcon">[m
[31m-                <i class="fas fa-user-plus"></i>[m
[32m+[m[32m                <i class="fas fa-cart-shopping"></i>[m
               </div>[m
[31m-              <span class="card-badge">Mês</span>[m
[32m+[m[32m              <span class="card-badge">Indicador</span>[m
             </div>[m
             <div class="card-body">[m
[31m-              <h3>Novos Clientes</h3>[m
[31m-              <h2 id="novosClientesMes">0</h2>[m
[31m-              <div class="card-trend" id="trendNovosClientes">[m
[31m-                <span class="trend-icon"><i class="fas fa-arrow-up"></i></span>[m
[31m-                <span class="trend-value">+0</span>[m
[31m-                <span class="trend-label">este mês</span>[m
[32m+[m[32m              <h3>Ticket Médio</h3>[m
[32m+[m[32m              <h2 id="ticketMedioDashboard">R$ 0,00</h2>[m
[32m+[m[32m              <div class="card-trend">[m
[32m+[m[32m                <span class="trend-label">faturamento / clientes ativos</span>[m
               </div>[m
             </div>[m
           </div>[m
[36m@@ -400,36 +397,21 @@[m
             </div>[m
           </div>[m
 [m
[31m-          <!-- Card 7 - Chamados Abertos -->[m
[32m+[m[32m          <!-- Card 7 - Faturamento Anual -->[m
           <div class="card card-premium card-gradient-amber">[m
             <div class="card-header">[m
               <div class="cardIcon">[m
[31m-                <i class="fas fa-headset"></i>[m
[31m-              </div>[m
[31m-              <span class="card-badge">Suporte</span>[m
[31m-            </div>[m
[31m-            <div class="card-body">[m
[31m-              <h3>Chamados Abertos</h3>[m
[31m-              <h2 id="chamadosAbertos">0</h2>[m
[31m-              <div class="card-trend">[m
[31m-                <span class="trend-label">últimos 30 dias</span>[m
[31m-              </div>[m
[31m-            </div>[m
[31m-          </div>[m
[31m-[m
[31m-          <!-- Card 8 - Tickets Resolvidos -->[m
[31m-          <div class="card card-premium card-gradient-teal">[m
[31m-            <div class="card-header">[m
[31m-              <div class="cardIcon">[m
[31m-                <i class="fas fa-check-double"></i>[m
[32m+[m[32m                <i class="fas fa-calendar-year"></i>[m
               </div>[m
[31m-              <span class="card-badge">Suporte</span>[m
[32m+[m[32m              <span class="card-badge">Últimos 12 meses</span>[m
             </div>[m
             <div class="card-body">[m
[31m-              <h3>Tickets Resolvidos</h3>[m
[31m-              <h2 id="ticketsResolvidos">0</h2>[m
[31m-              <div class="card-trend">[m
[31m-                <span class="trend-label">últimos 30 dias</span>[m
[32m+[m[32m              <h3>Faturamento Anual</h3>[m
[32m+[m[32m              <h2 id="faturamentoAnual">R$ 0,00</h2>[m
[32m+[m[32m              <div class="card-trend" id="trendFaturamentoAnual">[m
[32m+[m[32m                <span class="trend-icon"><i class="fas fa-arrow-up"></i></span>[m
[32m+[m[32m                <span class="trend-value">+0%</span>[m
[32m+[m[32m                <span class="trend-label">vs. período anterior</span>[m
               </div>[m
             </div>[m
           </div>[m
[1mdiff --git a/style.css b/style.css[m
[1mindex b11b09d..3cb8b64 100644[m
[1m--- a/style.css[m
[1m+++ b/style.css[m
[36m@@ -589,27 +589,30 @@[m [mbody {[m
   display: flex;[m
   flex-direction: column;[m
   align-items: center;[m
[31m-  padding: var(--space-md) 0 var(--space-xl);[m
[32m+[m[32m  padding: var(--space-lg) var(--space-sm) var(--space-xl);[m
   border-bottom: 1px solid var(--border-light);[m
   margin-bottom: var(--space-lg);[m
 }[m
 [m
 .logoSidebar {[m
[31m-  width: 64px;[m
[32m+[m[32m  width: 180px;[m
   height: auto;[m
[32m+[m[32m  max-height: 180px;[m
   object-fit: contain;[m
[31m-  margin-bottom: var(--space-sm);[m
[32m+[m[32m  margin-bottom: var(--space-md);[m
[32m+[m[32m  display: block;[m
 }[m
 [m
 .sidebarTop h4 {[m
   font-family: var(--font-heading);[m
[31m-  font-size: 18px;[m
[31m-  font-weight: 700;[m
[32m+[m[32m  font-size: 24px;[m
[32m+[m[32m  font-weight: 800;[m
   background: var(--gradient-primary);[m
   -webkit-background-clip: text;[m
   -webkit-text-fill-color: transparent;[m
   background-clip: text;[m
[31m-  letter-spacing: -0.3px;[m
[32m+[m[32m  letter-spacing: -0.5px;[m
[32m+[m[32m  line-height: 1.3;[m
 }[m
 [m
 .sidebarNav {[m
[1mdiff --git a/superadmin.html b/superadmin.html[m
[1mindex 74d8985..d1c21d4 100644[m
[1m--- a/superadmin.html[m
[1m+++ b/superadmin.html[m
[36m@@ -626,10 +626,26 @@[m
     .sa-chart-card canvas { max-height: 280px; }[m
     .sa-chart-full { grid-column: 1 / -1; }[m
 [m
[32m+[m[32m    /* ===== RESPONSIVE TABLES ===== */[m
[32m+[m[32m    .sa-responsive-cell {[m
[32m+[m[32m      display: none;[m
[32m+[m[32m    }[m
[32m+[m[32m    @media (max-width: 768px) {[m
[32m+[m[32m      .sa-hide-mobile { display: none !important; }[m
[32m+[m[32m    }[m
[32m+[m[32m    @media (max-width: 480px) {[m
[32m+[m[32m      .sa-hide-small { display: none !important; }[m
[32m+[m[32m    }[m
[32m+[m
     /* ===== RESPONSIVE ===== */[m
[32m+[m[32m    @media (max-width: 1200px) {[m
[32m+[m[32m      .sa-stats-grid { grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); }[m
[32m+[m[32m    }[m
[32m+[m
     @media (max-width: 1024px) {[m
       .sa-charts-grid { grid-template-columns: 1fr; }[m
[31m-      .sa-stats-grid { grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); }[m
[32m+[m[32m      .sa-stats-grid { grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); }[m
[32m+[m[32m      .sa-table { min-width: 650px; }[m
     }[m
 [m
     @media (max-width: 768px) {[m
[36m@@ -640,24 +656,57 @@[m
       .sa-sidebar.open { transform: translateX(0); }[m
       .sa-main {[m
         margin-left: 0;[m
[31m-        padding: 20px 16px;[m
[32m+[m[32m        padding: 20px 12px;[m
         padding-top: 76px;[m
       }[m
       .sa-topbar { flex-direction: column; align-items: flex-start; gap: 12px; }[m
[31m-      .sa-stats-grid { grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 12px; }[m
[31m-      .sa-stat-card { padding: 16px; }[m
[31m-      .sa-stat-card .sa-stat-value { font-size: 22px; }[m
[32m+[m[32m      .sa-topbar-left h1 { font-size: 20px; }[m
[32m+[m[32m      .sa-topbar-right { width: 100%; }[m
[32m+[m[32m      .sa-topbar-user { width: 100%; justify-content: center; }[m
[32m+[m[32m      .sa-stats-grid {[m
[32m+[m[32m        grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));[m
[32m+[m[32m        gap: 10px;[m
[32m+[m[32m      }[m
[32m+[m[32m      .sa-stat-card { padding: 14px; }[m
[32m+[m[32m      .sa-stat-card .sa-stat-icon { width: 36px; height: 36px; font-size: 16px; margin-bottom: 10px; }[m
[32m+[m[32m      .sa-stat-card .sa-stat-value { font-size: 20px; }[m
[32m+[m[32m      .sa-stat-card .sa-stat-label { font-size: 11px; }[m
[32m+[m[32m      .sa-stat-card .sa-stat-sub { font-size: 11px; }[m
       .sa-toolbar { flex-direction: column; }[m
       .sa-toolbar input, .sa-toolbar select { width: 100%; min-width: auto; }[m
       .sa-form-row { grid-template-columns: 1fr; }[m
       .sa-section-header { flex-direction: column; align-items: flex-start; }[m
       .sa-modal { max-width: 100%; margin: 10px; }[m
[32m+[m[32m      .sa-table { min-width: 500px; font-size: 13px; }[m
[32m+[m[32m      .sa-table thead th, .sa-table tbody td { padding: 10px 12px; font-size: 12px; }[m
[32m+[m[32m      .sa-charts-grid { gap: 12px; }[m
[32m+[m[32m      .sa-chart-card { padding: 16px; }[m
[32m+[m[32m      .sa-chart-card h3 { font-size: 14px; }[m
[32m+[m[32m      .sa-config-grid { grid-template-columns: 1fr !important; }[m
[32m+[m[32m      .sa-section-header h2 { font-size: 17px; }[m
     }[m
 [m
     @media (max-width: 480px) {[m
[31m-      .sa-stats-grid { grid-template-columns: 1fr 1fr; }[m
[31m-      .sa-stat-card .sa-stat-value { font-size: 18px; }[m
[32m+[m[32m      .sa-stats-grid {[m
[32m+[m[32m        grid-template-columns: repeat(2, 1fr);[m
[32m+[m[32m        gap: 8px;[m
[32m+[m[32m      }[m
[32m+[m[32m      .sa-stat-card { padding: 12px; }[m
[32m+[m[32m      .sa-stat-card .sa-stat-icon { width: 32px; height: 32px; font-size: 14px; margin-bottom: 8px; }[m
[32m+[m[32m      .sa-stat-card .sa-stat-value { font-size: 17px; }[m
[32m+[m[32m      .sa-stat-card .sa-stat-label { font-size: 10px; }[m
[32m+[m[32m      .sa-stat-card .sa-stat-sub { font-size: 10px; }[m
       .sa-sidebar { width: 100%; }[m
[32m+[m[32m      .sa-topbar-left h1 { font-size: 18px; }[m
[32m+[m[32m      .sa-table { min-width: 400px; font-size: 12px; }[m
[32m+[m[32m      .sa-table thead th, .sa-table tbody td { padding: 8px 10px; font-size: 11px; }[m
[32m+[m[32m      .sa-action-btn { width: 28px; height: 28px; font-size: 12px; }[m
[32m+[m[32m      .sa-main { padding: 20px 8px; padding-top: 72px; }[m
[32m+[m[32m      .sa-pagination { flex-wrap: wrap; gap: 6px; }[m
[32m+[m[32m      .sa-page-btn { padding: 6px 10px; font-size: 11px; }[m
[32m+[m[32m      .sa-page-info { font-size: 11px; }[m
[32m+[m[32m      .sa-stat-card .sa-stat-bg-icon { display: none; }[m
[32m+[m[32m      #sa-dashboard-stats { grid-template-columns: repeat(2, 1fr); }[m
     }[m
 [m
     /* ===== OCCUPATION OVERLAY ===== */[m
[36m@@ -919,12 +968,13 @@[m
                 <tr>[m
                   <th>Empresa</th>[m
                   <th>Responsável</th>[m
[31m-                  <th>WhatsApp</th>[m
[31m-                  <th>E-mail</th>[m
[32m+[m[32m                  <th class="sa-hide-small">WhatsApp</th>[m
[32m+[m[32m                  <th class="sa-hide-mobile">E-mail</th>[m
                   <th>Plano</th>[m
                   <th>Status</th>[m
[31m-                  <th>Cadastro</th>[m
[31m-                  <th>Último Login</th>[m
[32m+[m[32m                  <th class="sa-hide-small">Cadastro</th>[m
[32m+[m[32m                  <th class="sa-hide-mobile">Último Login</th>[m
[32m+[m[32m                  <th>Clientes</th>[m
                   <th>Ações</th>[m
                 </tr>[m
               </thead>[m
[36m@@ -1700,6 +1750,17 @@[m
           }[m
         });[m
         saState.empresas = empresas;[m
[32m+[m[41m        [m
[32m+[m[32m        // Buscar contagem de clientes para cada empresa[m
[32m+[m[32m        const clientesSnap = await db.collection('clientes').get();[m
[32m+[m[32m        const clientesCount = {};[m
[32m+[m[32m        clientesSnap.forEach(doc => {[m
[32m+[m[32m          const c = doc.data();[m
[32m+[m[32m          const tenantId = c.tenantId || 'default';[m
[32m+[m[32m          clientesCount[tenantId] = (clientesCount[tenantId] || 0) + 1;[m
[32m+[m[32m        });[m
[32m+[m[32m        saState.clientesCount = clientesCount;[m
[32m+[m[41m        [m
         renderizarEmpresas();[m
       } catch (e) {[m
         console.error('Erro ao carregar empresas:', e);[m
[36m@@ -1731,22 +1792,26 @@[m
 [m
       const tbody = document.getElementById('sa-lista-empresas');[m
       if (pageItems.length === 0) {[m
[31m-        tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;color:var(--sa-text-muted);padding:40px;">Nenhuma empresa encontrada</td></tr>';[m
[32m+[m[32m        tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;color:var(--sa-text-muted);padding:40px;">Nenhuma empresa encontrada</td></tr>';[m
       } else {[m
         tbody.innerHTML = pageItems.map(e => {[m
           const dataCad = formatDate(e.criadoEm);[m
           const ultimoLogin = formatDate(e.ultimoLogin);[m
           const wa = e.whatsappPrincipal || '-';[m
           const waLink = wa !== '-' ? 'https://wa.me/55' + wa.replace(/\D/g, '') : '#';[m
[32m+[m[32m          // Get client count for this empresa (by tenantId or id)[m
[32m+[m[32m          const tenantId = e.tenantId || e.id;[m
[32m+[m[32m          const qntClientes = saState.clientesCount && saState.clientesCount[tenantId] ? saState.clientesCount[tenantId] : 0;[m
           return '<tr>' +[m
             '<td><strong>' + (e.nomeEmpresa || '-') + '</strong></td>' +[m
             '<td>' + (e.responsavel || '-') + '</td>' +[m
[31m-            '<td>' + wa + '</td>' +[m
[31m-            '<td>' + (e.email || '-') + '</td>' +[m
[32m+[m[32m            '<td class="sa-hide-small">' + wa + '</td>' +[m
[32m+[m[32m            '<td class="sa-hide-mobile">' + (e.email || '-') + '</td>' +[m
             '<td>' + (e.plano || '-') + '</td>' +[m
             '<td><span class="sa-badge sa-badge-' + statusClass(e.status) + '">' + (e.status || '-') + '</span></td>' +[m
[31m-            '<td>' + dataCad + '</td>' +[m
[31m-            '<td>' + ultimoLogin + '</td>' +[m
[32m+[m[32m            '<td class="sa-hide-small">' + dataCad + '</td>' +[m
[32m+[m[32m            '<td class="sa-hide-mobile">' + ultimoLogin + '</td>' +[m
[32m+[m[32m            '<td style="text-align:center;font-weight:700;font-size:16px;color:var(--sa-primary);">' + qntClientes + '</td>' +[m
             '<td><div class="sa-actions">' +[m
             '<button class="sa-action-btn sa-action-view" onclick="visualizarEmpresa(\'' + e.id + '\')" title="Visualizar"><i class="fas fa-eye"></i></button>' +[m
             '<button class="sa-action-btn sa-action-edit" onclick="editarEmpresa(\'' + e.id + '\')" title="Editar"><i class="fas fa-pencil"></i></button>' +[m
