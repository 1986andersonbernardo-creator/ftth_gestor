// =============================================
// CONTROLISP - MÓDULO FINANCEIRO v4.0
// Visão por Meses - Controle de Assinaturas
// =============================================
// ✅ NÃO armazena meses no banco
// ✅ NÃO duplica dados de status
// ✅ Tudo calculado dinamicamente
// ✅ Apenas lê: clientes + pagamentos
// =============================================

const ModuloFinanceiro = (function() {
  'use strict';

  // ---------- STATE ----------
  let _clientes = [];
  let _pagamentos = []; // recebimentos + mensalidades pagas
  let _allDataLoaded = false;
  let _periodoFiltro = 'ano'; // 'mes', '3meses', '6meses', 'ano'

  // ---------- HELPERS ----------
  function getTenantId() {
    return window.usuarioAtual && (window.usuarioAtual.tenantId || window.usuarioAtual.uid) || 'default';
  }

  function formatDateBR(dateStr) {
    if (!dateStr) return '—';
    try {
      if (dateStr.toDate) dateStr = dateStr.toDate();
      if (dateStr instanceof Date) {
        return String(dateStr.getDate()).padStart(2,'0') + '/' +
               String(dateStr.getMonth()+1).padStart(2,'0') + '/' +
               dateStr.getFullYear();
      }
      if (typeof dateStr === 'string' && dateStr.includes('-')) {
        const parts = dateStr.split('-');
        return parts[2] + '/' + parts[1] + '/' + parts[0];
      }
      return dateStr;
    } catch(e) {
      return dateStr;
    }
  }

  function formatMoney(val) {
    return 'R$ ' + (Number(val) || 0).toFixed(2);
  }

  function getMonthName(m) {
    const meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    return meses[m] || m;
  }

  function $(id) { return document.getElementById(id); }

  // ---------- GERAR MESES PARA CALENDÁRIO ----------
  function gerarMesesCalendario() {
    const hoje = new Date();
    const anoAtual = hoje.getFullYear();
    const mesAtual = hoje.getMonth();
    const meses = [];
    
    // APENAS meses a partir do mês atual (hoje) para frente
    // Não mostra meses passados para permitir marcar parcelas futuras como pagas
    let totalMeses = 12;
    if (_periodoFiltro === 'mes') totalMeses = 1;
    else if (_periodoFiltro === '3meses') totalMeses = 3;
    else if (_periodoFiltro === '6meses') totalMeses = 6;
    
    // Gerar apenas meses futuros (incluindo mês atual)
    for (let i = 0; i < totalMeses; i++) {
      let m = mesAtual + i;
      let y = anoAtual;
      while (m > 11) { m -= 12; y += 1; }
      meses.push({
        index: m,
        label: getMonthName(m),
        key: String(m + 1).padStart(2, '0') + '/' + y,
        year: y,
        mes: m
      });
    }
    return meses;
  }

  // ---------- GERAR HISTÓRICO MENSAL PARA UM CLIENTE ----------
  function gerarHistoricoMensal(cliente, mesesPassado, mesesFuturo) {
    const meses = [];
    const hoje = new Date();
    const anoAtual = hoje.getFullYear();
    const mesAtual = hoje.getMonth();

    // Data de cadastro do cliente
    let dataInicio = null;
    if (cliente.dataCadastro) {
      try {
        if (cliente.dataCadastro.toDate) dataInicio = cliente.dataCadastro.toDate();
        else dataInicio = new Date(cliente.dataCadastro);
      } catch(e) {}
    }
    if (!dataInicio || isNaN(dataInicio.getTime())) {
      // Se não houver data de cadastro, não gera histórico
      return meses;
    }

    const mesInicio = dataInicio.getMonth();
    const anoInicio = dataInicio.getFullYear();

    // APENAS meses a partir do mês atual (hoje) até futuro
    // Não gera meses passados para permitir marcar parcelas futuras como pagas
    const futuro = mesesFuturo;

    for (let i = 0; i <= futuro; i++) {
      let m = mesAtual + i;
      let y = anoAtual;
      while (m > 11) { m -= 12; y += 1; }

      // Verificar se o mês é anterior ao cadastro
      if (y < anoInicio) continue;
      if (y === anoInicio && m < mesInicio) continue;

      const diaVenc = parseInt(cliente.vencimento) || 5;
      const dataVenc = new Date(y, m, diaVenc);
      const mesKey = String(m + 1).padStart(2, '0') + '/' + y;

      meses.push({
        key: mesKey,
        dataVencimento: dataVenc,
        mes: m,
        ano: y
      });
    }

    return meses;
  }

  // ---------- CALCULAR STATUS DE UM MÊS ----------
  function calcularStatus(cliente, mesKey, dataVencimento) {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    
    const clienteId = cliente._id || cliente.nome;
    const clienteNome = cliente.nome || '';

    // Buscar pagamento para este mês
    const pagamento = _pagamentos.find(p => {
      const pClienteId = p.clienteId || p.clienteNome;
      
      // Verificar se é o mesmo cliente
      if (pClienteId !== clienteId && pClienteId !== clienteNome) return false;
      
      // Verificar mês de referência
      if (p.mesReferencia) {
        let ref = p.mesReferencia;
        if (ref.includes('-')) {
          const parts = ref.split('-');
          ref = String(parseInt(parts[1])).padStart(2, '0') + '/' + parts[0];
        }
        if (ref === mesKey) return true;
      }
      
      // Fallback: competencia
      if (p.competencia && p.competencia === mesKey) return true;
      
      return false;
    });

    if (pagamento) {
      const s = (pagamento.status || '').trim();
      if (s === 'Pago' || s === 'Recebido' || s === 'Quitado') {
        return {
          status: 'Pago',
          dataPagamento: pagamento.dataPagamento || pagamento.data || null,
          pagamentoId: pagamento._id
        };
      }
    }

    // Sem pagamento: verificar vencimento
    if (dataVencimento < hoje) {
      return { status: 'Atrasado', dataPagamento: null, pagamentoId: null };
    }

    return { status: 'Pendente', dataPagamento: null, pagamentoId: null };
  }

  // ---------- OBTER MESES DO PERÍODO (CALENDÁRIO) ----------
  function getMesesDoPeriodo() {
    const hoje = new Date();
    const ano = hoje.getFullYear();
    const mesAtual = hoje.getMonth();
    const meses = [];
    
    let totalMeses = 12;
    if (_periodoFiltro === 'mes') totalMeses = 1;
    else if (_periodoFiltro === '3meses') totalMeses = 3;
    else if (_periodoFiltro === '6meses') totalMeses = 6;
    
    for (let i = totalMeses - 1; i >= 0; i--) {
      let m = mesAtual - i;
      let y = ano;
      if (m < 0) { m += 12; y -= 1; }
      meses.push({
        index: m,
        label: getMonthName(m),
        key: String(m + 1).padStart(2, '0') + '/' + y,
        year: y,
        mes: m
      });
    }
    return meses;
  }

  // ---------- CARREGAR DADOS ----------
  function loadData() {
    const tenantId = getTenantId();
    console.log('[ModuloFinanceiro v4] loadData chamado. tenantId:', tenantId, 'window.usuarioAtual:', window.usuarioAtual);
    if (!tenantId || tenantId === 'default') {
      console.warn('[ModuloFinanceiro v4] tenantId inválido, abortando.');
      return;
    }

    console.log('[ModuloFinanceiro v4] Carregando dados... tenant:', tenantId);

    Promise.all([
      db.collection('clientes').where('tenantId', '==', tenantId).get(),
      db.collection('recebimentos').where('tenantId', '==', tenantId).get(),
      db.collection('mensalidades').where('tenantId', '==', tenantId).get()
    ]).then(([clientesSnap, recebimentosSnap, mensalidadesSnap]) => {
      _clientes = [];
      _pagamentos = [];

      // Carregar clientes
      clientesSnap.forEach(doc => {
        const c = doc.data();
        c._id = doc.id;
        _clientes.push(c);
      });

      // Carregar recebimentos como pagamentos
      recebimentosSnap.forEach(doc => {
        const r = doc.data();
        r._id = doc.id;
        r._tipo = 'recebimento';
        _pagamentos.push(r);
      });

      // Carregar mensalidades pagas como pagamentos
      mensalidadesSnap.forEach(doc => {
        const m = doc.data();
        const s = (m.status || '').trim();
        if (s === 'Pago' || s === 'Recebido' || s === 'Quitado') {
          m._id = doc.id;
          m._tipo = 'mensalidade';
          _pagamentos.push(m);
        }
      });

      _allDataLoaded = true;
      
      console.log(`[ModuloFinanceiro v4] ${_clientes.length} clientes, ${_pagamentos.length} pagamentos`);
      
      renderCalendario();
    }).catch(err => {
      console.error('[ModuloFinanceiro v4] Erro:', err);
    });
  }

  // ---------- RENDER CALENDÁRIO ----------
  function renderCalendario() {
    const container = $('financeiro-calendario');
    if (!container) return;

    const meses = gerarMesesCalendario();

    // Ordenar clientes alfabeticamente
    const clientesOrdenados = [..._clientes].sort((a, b) => {
      const nomeA = (a.nome || '').toLowerCase();
      const nomeB = (b.nome || '').toLowerCase();
      return nomeA.localeCompare(nomeB);
    });

    // Label do filtro
    let filterLabel = 'Ano completo';
    if (_periodoFiltro === 'mes') filterLabel = 'Mês atual';
    else if (_periodoFiltro === '3meses') filterLabel = 'Últimos 3 meses';
    else if (_periodoFiltro === '6meses') filterLabel = 'Últimos 6 meses';

    let html = `
      <div class="df-section">
        <div class="df-section-title">
          <h2><i class="fas fa-calendar-alt"></i> Visão por Meses</h2>
          <span class="df-section-subtitle">${filterLabel}</span>
        </div>
        <div class="df-filters" style="margin-bottom:16px;">
          <select id="filtro-periodo-calendario" onchange="ModuloFinanceiro.setPeriodo(this.value)" style="max-width:250px;">
            <option value="mes" ${_periodoFiltro === 'mes' ? 'selected' : ''}>Mês atual</option>
            <option value="3meses" ${_periodoFiltro === '3meses' ? 'selected' : ''}>Últimos 3 meses</option>
            <option value="6meses" ${_periodoFiltro === '6meses' ? 'selected' : ''}>Últimos 6 meses</option>
            <option value="ano" ${_periodoFiltro === 'ano' ? 'selected' : ''}>Ano completo</option>
          </select>
          <input type="text" id="filtro-cliente-calendario" placeholder="🔍 Buscar cliente..." onkeyup="ModuloFinanceiro.filtrarCalendario()" style="max-width:300px;">
        </div>
        <div class="df-table-wrapper df-calendar-wrapper">
          <table class="df-calendar" id="financeiro-calendar-table">
            <thead>
              <tr id="financeiro-calendar-header"></tr>
            </thead>
            <tbody id="financeiro-calendar-body"></tbody>
          </table>
        </div>
      </div>
    `;

    container.innerHTML = html;

    const header = $('financeiro-calendar-header');
    const body = $('financeiro-calendar-body');
    if (!header || !body) return;

    // Renderizar cabeçalho
    let headerHtml = '<th>Cliente</th>';
    meses.forEach(m => {
      headerHtml += `<th>${m.label}/${m.year}</th>`;
    });
    header.innerHTML = headerHtml;

    if (clientesOrdenados.length === 0) {
      body.innerHTML = `<tr><td colspan="${meses.length + 1}" class="df-empty"><i class="fas fa-calendar"></i> Nenhum cliente cadastrado</td></tr>`;
      return;
    }

    // Renderizar corpo
    let bodyHtml = '';
    clientesOrdenados.forEach(cliente => {
      const clienteId = cliente._id || cliente.nome;
      const nomeCliente = cliente.nome || '—';
      
      // Obter data de cadastro do cliente
      let dataCadastro = null;
      if (cliente.dataCadastro) {
        try {
          dataCadastro = cliente.dataCadastro.toDate ? cliente.dataCadastro.toDate() : new Date(cliente.dataCadastro);
        } catch(e) {}
      }
      
      bodyHtml += `<tr class="financeiro-calendar-row" data-cliente="${nomeCliente.toLowerCase()}" data-cliente-id="${clienteId}">
        <td><a href="#" onclick="ModuloFinanceiro.abrirHistorico('${clienteId.replace(/'/g, "\\'")}', '${nomeCliente.replace(/'/g, "\\'")}'); return false;" style="color:var(--text-primary);text-decoration:none;font-weight:600;">${nomeCliente}</a></td>`;
      
      meses.forEach(m => {
        // Verificar se o mês é anterior ao cadastro
        let mesAnteriorCadastro = false;
        if (dataCadastro && !isNaN(dataCadastro.getTime())) {
          const mesCalendario = new Date(m.year, m.mes, 1);
          // Verificar se o mês do calendário é anterior ao mês de cadastro
          if (m.year < dataCadastro.getFullYear() || 
              (m.year === dataCadastro.getFullYear() && m.mes < dataCadastro.getMonth())) {
            mesAnteriorCadastro = true;
          }
        }
        
        let cellHtml = '';
        if (mesAnteriorCadastro) {
          // Meses antes do cadastro: mostrar como "Sem dados"
          cellHtml = `<span class="df-calendar-status df-calendar-sem-mensalidade" title="Cliente não cadastrado">—</span>`;
        } else {
          const dataVenc = new Date(m.year, m.mes, parseInt(cliente.vencimento) || 5);
          const result = calcularStatus(cliente, m.key, dataVenc);
          
          if (result.status === 'Pago') {
            cellHtml = `<span class="df-calendar-status df-calendar-pago" title="Pago${result.dataPagamento ? ' em ' + formatDateBR(result.dataPagamento) : ''}">✅</span>`;
          } else if (result.status === 'Atrasado') {
            cellHtml = `<span class="df-calendar-status df-calendar-atrasado" title="Atrasado">🔴</span>`;
          } else if (result.status === 'Pendente') {
            cellHtml = `<span class="df-calendar-status df-calendar-pendente" title="Pendente">🟡</span>`;
          } else {
            cellHtml = `<span class="df-calendar-status df-calendar-sem-mensalidade" title="Sem dados">—</span>`;
          }
        }
        bodyHtml += `<td>${cellHtml}</td>`;
      });
      
      bodyHtml += '</tr>';
    });

    body.innerHTML = bodyHtml;
  }

  // ---------- FILTER CALENDAR ----------
  function filtrarCalendario() {
    const busca = ($('filtro-cliente-calendario')?.value || '').toLowerCase().trim();
    const linhas = document.querySelectorAll('#financeiro-calendar-body tr');
    
    linhas.forEach(linha => {
      const cliente = linha.getAttribute('data-cliente') || '';
      const clienteId = linha.getAttribute('data-cliente-id') || '';
      
      if (!busca) {
        linha.style.display = '';
        return;
      }
      
      const match = cliente.includes(busca) || clienteId.includes(busca);
      linha.style.display = match ? '' : 'none';
    });
  }

  // ---------- SET PERIOD ----------
  function setPeriodo(valor) {
    _periodoFiltro = valor;
    renderCalendario();
  }

  // ---------- GERAR HISTÓRICO COMPLETO (PASSADO + FUTURO) ----------
  function gerarHistoricoCompleto(cliente) {
    const meses = [];
    const hoje = new Date();
    const anoAtual = hoje.getFullYear();
    const mesAtual = hoje.getMonth();

    // Data de cadastro do cliente
    let dataInicio = null;
    if (cliente.dataCadastro) {
      try {
        if (cliente.dataCadastro.toDate) dataInicio = cliente.dataCadastro.toDate();
        else dataInicio = new Date(cliente.dataCadastro);
      } catch(e) {}
    }
    if (!dataInicio || isNaN(dataInicio.getTime())) {
      // Se não houver data de cadastro, usar 12 meses atrás
      dataInicio = new Date(anoAtual, mesAtual - 12, 1);
    }

    const mesInicio = dataInicio.getMonth();
    const anoInicio = dataInicio.getFullYear();

    // Gerar meses: do cadastro até 3 meses futuros
    const totalMesesDesdeInicio = (anoAtual - anoInicio) * 12 + (mesAtual - mesInicio);
    const passado = totalMesesDesdeInicio;
    const futuro = 3;

    for (let i = -passado; i <= futuro; i++) {
      let m = mesAtual + i;
      let y = anoAtual;
      while (m < 0) { m += 12; y -= 1; }
      while (m > 11) { m -= 12; y += 1; }

      // Não mostrar meses antes do cadastro
      if (y < anoInicio) continue;
      if (y === anoInicio && m < mesInicio) continue;

      const diaVenc = parseInt(cliente.vencimento) || 5;
      const dataVenc = new Date(y, m, diaVenc);
      const mesKey = String(m + 1).padStart(2, '0') + '/' + y;

      meses.push({
        key: mesKey,
        dataVencimento: dataVenc,
        mes: m,
        ano: y
      });
    }

    return meses;
  }

  // ---------- ABRIR HISTÓRICO DO CLIENTE ----------
  function abrirHistorico(clienteId, clienteNome) {
    const modalOverlay = $('df-modal-overlay');
    const modal = $('df-modal');
    if (!modalOverlay || !modal) return;

    const nomeEl = $('df-modal-cliente-nome');
    const planoEl = $('df-modal-cliente-plano');
    const valorEl = $('df-modal-cliente-valor');
    const statusEl = $('df-modal-cliente-status');
    const vencimentoEl = $('df-modal-cliente-vencimento');
    const historyList = $('df-modal-history');

    const cliente = _clientes.find(c => c._id === clienteId || c.nome === clienteNome) || {};

    if (nomeEl) nomeEl.textContent = clienteNome || cliente.nome || '—';
    if (planoEl) planoEl.textContent = cliente.plano || '—';
    if (valorEl) valorEl.textContent = formatMoney(cliente.valor || 0);
    if (vencimentoEl) vencimentoEl.textContent = cliente.vencimento ? 'Dia ' + cliente.vencimento : '—';
    if (statusEl) {
      const s = cliente.status || '—';
      const sClass = s === 'Ativo' ? 'df-status-pago' : s === 'Inadimplente' ? 'df-status-atrasado' : 'df-status-pendente';
      statusEl.innerHTML = `<span class="df-status ${sClass}">${s}</span>`;
    }

    // Gerar histórico COMPLETO: todos os pagamentos registrados (passado + futuro)
    const meses = gerarHistoricoCompleto(cliente);
    meses.reverse(); // Mais recente primeiro

    if (historyList) {
      if (meses.length === 0) {
        historyList.innerHTML = '<li style="text-align:center;padding:32px;color:var(--text-muted);">Nenhum histórico disponível</li>';
      } else {
        let html = '';
        meses.forEach(m => {
          const result = calcularStatus(cliente, m.key, m.dataVencimento);
          const status = result.status;
          const icon = status === 'Pago' ? '✅' : status === 'Atrasado' ? '🔴' : '🟡';
          const sClass = status === 'Pago' ? 'pago' : status === 'Atrasado' ? 'atrasado' : 'pendente';
          const hClass = status === 'Pago' ? 'df-history-pago' : status === 'Atrasado' ? 'df-history-atrasado' : 'df-history-pendente';
          const dataPag = result.dataPagamento ? formatDateBR(result.dataPagamento) : '';
          
          html += `<li class="df-history-item ${hClass}">
            <span class="df-history-competencia">${m.key}</span>
            <span class="df-history-status ${sClass}">${icon} ${status}${dataPag ? ' — ' + dataPag : ''}</span>
          </li>`;
        });
        historyList.innerHTML = html;
      }
    }

    modalOverlay.style.display = 'block';
    modal.style.display = 'block';
  }

  function fecharHistorico() {
    const overlay = $('df-modal-overlay');
    const modal = $('df-modal');
    if (overlay) overlay.style.display = 'none';
    if (modal) modal.style.display = 'none';
  }

  // ---------- REGISTRAR PAGAMENTO ----------
  function registrarPagamento(clienteId, clienteNome, mesKey, valor) {
    const hoje = new Date();
    const dataPagamento = hoje.toISOString().split('T')[0];
    
    // Converter mesKey "MM/AAAA" para "AAAA-MM"
    const parts = mesKey.split('/');
    const mesReferencia = parts[1] + '-' + parts[0];

    const pagamento = {
      clienteId: clienteId,
      clienteNome: clienteNome,
      valor: Number(valor) || 0,
      mesReferencia: mesReferencia,
      competencia: mesKey,
      status: 'Pago',
      dataPagamento: dataPagamento,
      data: hoje,
      tenantId: getTenantId(),
      createdBy: window.usuarioAtual?.uid || 'unknown',
      updatedBy: window.usuarioAtual?.uid || 'unknown',
      updatedAt: hoje
    };

    return db.collection('recebimentos').add(pagamento).then(() => {
      // Recarregar dados e atualizar interface
      loadData();
      return true;
    });
  }

  // ---------- INIT ----------
  function init() {
    if (!$('df-modal-overlay')) {
      const overlay = document.createElement('div');
      overlay.className = 'df-modal-overlay';
      overlay.id = 'df-modal-overlay';
      overlay.onclick = ModuloFinanceiro.fecharHistorico;
      document.body.appendChild(overlay);

      const modal = document.createElement('div');
      modal.className = 'df-modal';
      modal.id = 'df-modal';
      modal.innerHTML = `
        <div class="df-modal-header">
          <h2><i class="fas fa-user"></i> <span id="df-modal-cliente-nome">—</span> <small>Histórico</small></h2>
          <button class="df-modal-close" onclick="ModuloFinanceiro.fecharHistorico()"><i class="fas fa-times"></i></button>
        </div>
        <div class="df-modal-body">
          <div class="df-modal-info">
            <div class="df-modal-info-item">
              <label>Plano</label>
              <span id="df-modal-cliente-plano">—</span>
            </div>
            <div class="df-modal-info-item">
              <label>Valor Mensal</label>
              <span id="df-modal-cliente-valor">—</span>
            </div>
            <div class="df-modal-info-item">
              <label>Status</label>
              <span id="df-modal-cliente-status">—</span>
            </div>
            <div class="df-modal-info-item">
              <label>Vencimento</label>
              <span id="df-modal-cliente-vencimento">—</span>
            </div>
          </div>
          <h3 style="font-size:14px;font-weight:600;color:var(--text-primary);margin-bottom:12px;">
            <i class="fas fa-clock-rotate-left"></i> Histórico Mensal
          </h3>
          <ul class="df-history" id="df-modal-history"></ul>
        </div>
      `;
      document.body.appendChild(modal);
    }
    
    // Aguardar window.usuarioAtual estar disponível
    const tentarCarregar = () => {
      const tenantId = getTenantId();
      if (tenantId && tenantId !== 'default') {
        console.log('[ModuloFinanceiro v4] Inicializando com tenantId:', tenantId);
        loadData();
      } else {
        console.warn('[ModuloFinanceiro v4] Aguardando usuarioAtual...');
        setTimeout(tentarCarregar, 200);
      }
    };
    tentarCarregar();
  }

  // ---------- PUBLIC API ----------
  return {
    init: init,
    loadData: loadData,
    setPeriodo: setPeriodo,
    filtrarCalendario: filtrarCalendario,
    abrirHistorico: abrirHistorico,
    fecharHistorico: fecharHistorico,
    registrarPagamento: registrarPagamento
  };
})();