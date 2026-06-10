const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();

function requireSignedIn(context) {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Autenticação obrigatória.');
  }
}

function assertMasterAdmin(context) {
  requireSignedIn(context);
  if (context.auth.token.role !== 'MASTER_ADMIN') {
    throw new functions.https.HttpsError('permission-denied', 'Apenas MASTER_ADMIN pode executar esta operação.');
  }
}

exports.createProvider = functions.https.onCall(async (data, context) => {
  assertMasterAdmin(context);

  const email = (data.email || '').toString().trim().toLowerCase();
  const nome = (data.nome || '').toString().trim();
  const empresa = (data.empresa || '').toString().trim();
  const telefone = (data.telefone || '').toString().trim();
  const plano = (data.plano || '').toString().trim();
  const status = (data.status || 'Ativo').toString().trim();
  const senha = (data.senha || Math.random().toString(36).slice(-10));

  if (!email || !nome) {
    throw new functions.https.HttpsError('invalid-argument', 'Nome e e-mail são obrigatórios.');
  }

  try {
    const userRecord = await admin.auth().createUser({
      email,
      password: senha,
      emailVerified: false,
      disabled: false
    });

    const claims = {
      role: 'PROVEDOR',
      tenantId: userRecord.uid
    };

    await admin.auth().setCustomUserClaims(userRecord.uid, claims);

    const providerData = {
      uid: userRecord.uid,
      tenantId: userRecord.uid,
      role: 'PROVEDOR',
      nome,
      empresa,
      email,
      telefone,
      plano,
      status,
      criadoEm: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: context.auth.uid
    };

    await db.collection('usuarios').doc(userRecord.uid).set(providerData);
    await db.collection('provedores').doc(userRecord.uid).set(providerData);

    return {
      uid: userRecord.uid,
      email,
      nome,
      senha
    };
  } catch (error) {
    console.error('Erro createProvider:', error);
    throw new functions.https.HttpsError('internal', 'Falha ao criar provedor. ' + error.message);
  }
});

exports.updateUserStatus = functions.https.onCall(async (data, context) => {
  assertMasterAdmin(context);

  const uid = (data.uid || '').toString().trim();
  const status = (data.status || '').toString().trim();

  if (!uid || !status) {
    throw new functions.https.HttpsError('invalid-argument', 'UID e status são obrigatórios.');
  }

  try {
    await db.collection('usuarios').doc(uid).update({
      status,
      updatedBy: context.auth.uid,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    await admin.auth().updateUser(uid, {
      disabled: status !== 'Ativo'
    });

    return { uid, status };
  } catch (error) {
    console.error('Erro updateUserStatus:', error);
    throw new functions.https.HttpsError('internal', 'Falha ao atualizar status do usuário. ' + error.message);
  }
});

exports.deleteUserAccount = functions.https.onCall(async (data, context) => {
  assertMasterAdmin(context);

  const uid = (data.uid || '').toString().trim();

  if (!uid) {
    throw new functions.https.HttpsError('invalid-argument', 'UID é obrigatório.');
  }

  try {
    await db.collection('usuarios').doc(uid).delete();
    await admin.auth().deleteUser(uid);
    return { uid };
  } catch (error) {
    console.error('Erro deleteUserAccount:', error);
    throw new functions.https.HttpsError('internal', 'Falha ao excluir usuário. ' + error.message);
  }
});

exports.sendPasswordReset = functions.https.onCall(async (data, context) => {
  assertMasterAdmin(context);

  const email = (data.email || '').toString().trim().toLowerCase();

  if (!email) {
    throw new functions.https.HttpsError('invalid-argument', 'E-mail é obrigatório para resetar senha.');
  }

  try {
    const link = await admin.auth().generatePasswordResetLink(email);
    return { email, link };
  } catch (error) {
    console.error('Erro sendPasswordReset:', error);
    throw new functions.https.HttpsError('internal', 'Falha ao gerar link de redefinição. ' + error.message);
  }
});
