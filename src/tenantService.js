import { auth, getIdTokenResult, doc, getDoc } from './firebaseService.js';
import { db } from './firebaseService.js';
import { COLLECTIONS, ROLES } from './config.js';

let currentUser = null;
let currentClaims = {};
let currentProfile = null;

export function normalizeRole(role) {
  if (!role) return ROLES.CLIENTE;
  const normalized = role.toString().trim().toUpperCase();
  if (normalized === 'ADMIN') return ROLES.MASTER_ADMIN;
  if (normalized === 'PROVIDER') return ROLES.PROVEDOR;
  if (normalized === 'PROVEDOR') return ROLES.PROVEDOR;
  if (normalized === 'CLIENTE' || normalized === 'CLIENT') return ROLES.CLIENTE;
  return normalized;
}

export async function refreshTenantContext(user) {
  if (!user) {
    currentUser = null;
    currentClaims = {};
    currentProfile = null;
    return;
  }

  currentUser = user;

  try {
    const tokenResult = await getIdTokenResult(user, true);
    currentClaims = tokenResult.claims || {};
  } catch (error) {
    console.warn('Falha ao carregar claims:', error);
    currentClaims = {};
  }

  if (!currentClaims.tenantId) {
    const profileRef = doc(db, COLLECTIONS.USUARIOS, user.uid);
    const profileSnapshot = await getDoc(profileRef);
    if (profileSnapshot.exists()) {
      currentProfile = profileSnapshot.data();
      currentClaims.tenantId = currentProfile.tenantId || user.uid;
      currentClaims.role = currentClaims.role || currentProfile.role || ROLES.CLIENTE;
    }
  }
}

export function getCurrentUser() {
  return currentUser;
}

export function getTenantId() {
  if (!currentClaims?.tenantId) {
    throw new Error('Tenant não carregado. Faça login novamente.');
  }
  return currentClaims.tenantId;
}

export function getCurrentRole() {
  return normalizeRole(currentClaims.role || currentProfile?.role || ROLES.CLIENTE);
}

export function isMasterAdmin() {
  return getCurrentRole() === ROLES.MASTER_ADMIN;
}

export function isProvider() {
  return getCurrentRole() === ROLES.PROVEDOR;
}

export function getUserEmail() {
  return currentUser?.email || currentProfile?.email || '';
}

export function getUserId() {
  return currentUser?.uid || '';
}
