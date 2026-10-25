/**
 * One-off: create (or promote) the first admin user.
 *
 * Emulator:   FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 \
 *             pnpm create-admin --project demo-solid-drive --email you@example.com --name "Your Name" [--password ...]
 * Staging/prod: gcloud auth application-default login   (or GOOGLE_APPLICATION_CREDENTIALS=service-account.json)
 *             pnpm create-admin --project dealership-staging --email you@example.com --name "Your Name"
 *
 * Without --password a password-reset link is printed so the admin sets their own password.
 * Admin must then enrol TOTP 2FA on first login (/admin/login).
 */
import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { parseArgs } from 'node:util';

const { values } = parseArgs({
  options: {
    project: { type: 'string' },
    email: { type: 'string' },
    name: { type: 'string' },
    password: { type: 'string' },
  },
});

async function main() {
  const projectId = values.project ?? process.env.GCLOUD_PROJECT ?? process.env.FIREBASE_PROJECT;
  if (!values.email || !values.name || !projectId) {
    console.error('Usage: pnpm create-admin --project <id> --email <email> --name "<name>" [--password <pw>]');
    process.exit(1);
  }
  const app = getApps()[0] ?? initializeApp({ projectId });
  const auth = getAuth(app);
  const db = getFirestore(app);
  const target = process.env.FIREBASE_AUTH_EMULATOR_HOST ? `emulator (${projectId})` : `project ${projectId}`;

  let user = await auth.getUserByEmail(values.email).catch(() => null);
  if (!user) {
    user = await auth.createUser({
      email: values.email,
      displayName: values.name,
      password: values.password,
      emailVerified: false,
    });
    console.log(`Created auth user ${user.uid} in ${target}`);
  } else {
    if (values.password) await auth.updateUser(user.uid, { password: values.password });
    console.log(`Found existing auth user ${user.uid} in ${target}`);
  }

  await auth.setCustomUserClaims(user.uid, { ...(user.customClaims ?? {}), role: 'admin' });
  const ref = db.collection('users').doc(user.uid);
  const existing = await ref.get();
  await ref.set(
    {
      name: values.name,
      email: values.email,
      role: 'admin',
      active: true,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: 'createAdmin-script',
      ...(existing.exists
        ? {}
        : { createdAt: FieldValue.serverTimestamp(), createdBy: 'createAdmin-script', deletedAt: null }),
    },
    { merge: true },
  );
  await db.collection('auditLog').add({
    actorUid: 'createAdmin-script',
    action: 'role-change',
    entity: 'user',
    entityId: user.uid,
    carId: null,
    before: null,
    after: { role: 'admin' },
    at: FieldValue.serverTimestamp(),
  });
  console.log(`✔ ${values.email} is now an admin.`);
  if (!values.password) {
    const link = await auth.generatePasswordResetLink(values.email);
    console.log(`Set a password with this link:\n${link}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
