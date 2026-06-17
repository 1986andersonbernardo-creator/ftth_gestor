export const ROLES = {
  MASTER_ADMIN: 'MASTER_ADMIN',
  PROVEDOR: 'PROVEDOR',
  CLIENTE: 'CLIENTE'
};

export const COLLECTIONS = {
  USUARIOS: 'usuarios',
  CLIENTES: 'clientes',
  PLANOS: 'planos',
  RECEBIMENTOS: 'recebimentos',
  DESPESAS: 'despesas',
  MENSALIDADES: 'mensalidades',
  WHATSAPP_HISTORICO: 'whatsapp_historico',
  CONFIGURACOES: 'configuracoes',
  AUDITORIA: 'auditoria',
  BACKUPS: 'backups'
};

export const CONFIG_DOCS = {
  SISTEMA: 'sistema',
  WHATSAPP: 'whatsapp'
};

export const DEFAULT_SYSTEM_CONFIG = {
  planos: {
    Basico: 49.9,
    Pro: 99.9,
    Enterprise: 199.9
  },
  paginacao: {
    clientes: 20,
    recebimentos: 20,
    despesas: 20
  }
};
