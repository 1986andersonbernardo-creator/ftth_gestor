import {
  db,
  functions,
  collection,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  getDocs,
  getDoc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  httpsCallable
} from './firebaseService.js';
import { COLLECTIONS, CONFIG_DOCS, DEFAULT_SYSTEM_CONFIG } from './config.js';
import { getTenantId } from './tenantService.js';

function tenantQuery(collectionRef, constraints = []) {
  return query(collectionRef, where('tenantId', '==', getTenantId()), ...constraints);
}

function withTenant(data) {
  return {
    ...data,
    tenantId: getTenantId(),
    updatedAt: serverTimestamp()
  };
}

function timestamped(data) {
  return {
    ...data,
    updatedAt: serverTimestamp()
  };
}

export async function listClients(pageSize = 20, startAfterDoc = null) {
  const constraints = [orderBy('createdAt', 'desc'), limit(pageSize)];
  if (startAfterDoc) constraints.push(startAfter(startAfterDoc));
  const q = tenantQuery(collection(db, COLLECTIONS.CLIENTES), constraints);
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function getClient(clientId) {
  const snapshot = await getDoc(doc(db, COLLECTIONS.CLIENTES, clientId));
  return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
}

export async function createClient(payload) {
  const payloadWithTenant = withTenant({
    ...payload,
    status: payload.status || 'Ativo',
    createdAt: serverTimestamp()
  });
  const docRef = await addDoc(collection(db, COLLECTIONS.CLIENTES), payloadWithTenant);
  return { id: docRef.id, ...payloadWithTenant };
}

export async function updateClient(clientId, updates) {
  const docRef = doc(db, COLLECTIONS.CLIENTES, clientId);
  await updateDoc(docRef, timestamped(updates));
  return getClient(clientId);
}

export async function deleteClient(clientId) {
  await deleteDoc(doc(db, COLLECTIONS.CLIENTES, clientId));
}

export async function listPlans() {
  const q = tenantQuery(collection(db, COLLECTIONS.PLANOS), [orderBy('createdAt', 'desc')]);
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function createPlan(payload) {
  const payloadWithTenant = withTenant({
    ...payload,
    createdAt: serverTimestamp()
  });
  const docRef = await addDoc(collection(db, COLLECTIONS.PLANOS), payloadWithTenant);
  return { id: docRef.id, ...payloadWithTenant };
}

export async function updatePlan(planId, updates) {
  const docRef = doc(db, COLLECTIONS.PLANOS, planId);
  await updateDoc(docRef, timestamped(updates));
  return getDoc(docRef);
}

export async function deletePlan(planId) {
  await deleteDoc(doc(db, COLLECTIONS.PLANOS, planId));
}

export async function listRecebimentos(pageSize = 20, startAfterDoc = null) {
  const constraints = [orderBy('vencimento', 'asc'), limit(pageSize)];
  if (startAfterDoc) constraints.push(startAfter(startAfterDoc));
  const q = tenantQuery(collection(db, COLLECTIONS.RECEBIMENTOS), constraints);
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function createRecebimento(payload) {
  const payloadWithTenant = withTenant({
    ...payload,
    status: payload.status || 'Pendente',
    createdAt: serverTimestamp()
  });
  const docRef = await addDoc(collection(db, COLLECTIONS.RECEBIMENTOS), payloadWithTenant);
  return { id: docRef.id, ...payloadWithTenant };
}

export async function updateRecebimento(recebimentoId, updates) {
  const docRef = doc(db, COLLECTIONS.RECEBIMENTOS, recebimentoId);
  await updateDoc(docRef, timestamped(updates));
}

export async function deleteRecebimento(recebimentoId) {
  await deleteDoc(doc(db, COLLECTIONS.RECEBIMENTOS, recebimentoId));
}

export async function listDespesas(pageSize = 20, startAfterDoc = null) {
  const constraints = [orderBy('vencimento', 'asc'), limit(pageSize)];
  if (startAfterDoc) constraints.push(startAfter(startAfterDoc));
  const q = tenantQuery(collection(db, COLLECTIONS.DESPESAS), constraints);
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function createDespesa(payload) {
  const payloadWithTenant = withTenant({
    ...payload,
    status: payload.status || 'Pendente',
    createdAt: serverTimestamp()
  });
  const docRef = await addDoc(collection(db, COLLECTIONS.DESPESAS), payloadWithTenant);
  return { id: docRef.id, ...payloadWithTenant };
}

export async function updateDespesa(despesaId, updates) {
  const docRef = doc(db, COLLECTIONS.DESPESAS, despesaId);
  await updateDoc(docRef, timestamped(updates));
}

export async function deleteDespesa(despesaId) {
  await deleteDoc(doc(db, COLLECTIONS.DESPESAS, despesaId));
}

export async function getConfiguration(docId) {
  const ref = doc(db, COLLECTIONS.CONFIGURACOES, docId);
  const snapshot = await getDoc(ref);
  return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
}

export async function saveConfiguration(docId, payload) {
  const ref = doc(db, COLLECTIONS.CONFIGURACOES, docId);
  const payloadWithTenant = withTenant({
    ...payload,
    createdAt: serverTimestamp()
  });
  await setDoc(ref, payloadWithTenant, { merge: true });
  return getConfiguration(docId);
}

export async function logAudit(action, description, metadata = {}) {
  const payload = withTenant({
    action,
    description,
    metadata,
    createdAt: serverTimestamp()
  });
  await addDoc(collection(db, COLLECTIONS.AUDITORIA), payload);
}

export async function getWhatsAppHistory(pageSize = 100) {
  const q = tenantQuery(collection(db, COLLECTIONS.WHATSAPP_HISTORICO), [orderBy('createdAt', 'desc'), limit(pageSize)]);
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function createWhatsAppHistory(payload) {
  const payloadWithTenant = withTenant({
    ...payload,
    status: payload.status || 'Pendente',
    createdAt: serverTimestamp()
  });
  const docRef = await addDoc(collection(db, COLLECTIONS.WHATSAPP_HISTORICO), payloadWithTenant);
  return { id: docRef.id, ...payloadWithTenant };
}

export async function listUsers(pageSize = 100) {
  const q = query(collection(db, COLLECTIONS.USUARIOS), orderBy('criadoEm', 'desc'), limit(pageSize));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}
