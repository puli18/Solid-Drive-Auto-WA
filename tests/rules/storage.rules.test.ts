/** Storage rules: receipts/** and sales/** (staff+admin, admin deletes), exports/** (admin read, functions write). */
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { deleteObject, getBytes, ref, uploadBytes, type FirebaseStorage } from 'firebase/storage';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { actors, type Actors, createEnv } from './setup';

let env: RulesTestEnvironment;
let a: Actors;
const st = (ctx: { storage(): unknown }) => ctx.storage() as FirebaseStorage;
const bytes = (n = 16) => new Uint8Array(n);
const pdf = { contentType: 'application/pdf' };

beforeAll(async () => {
  env = await createEnv();
});
afterAll(async () => {
  await env?.cleanup();
});
beforeEach(async () => {
  await env.clearStorage();
  a = actors(env);
  await env.withSecurityRulesDisabled(async (ctx) => {
    const s = st(ctx);
    await uploadBytes(ref(s, 'receipts/car1/e1/receipt.pdf'), bytes(), pdf);
    await uploadBytes(ref(s, 'sales/s1/contract.pdf'), bytes(), pdf);
    await uploadBytes(ref(s, 'exports/admin-uid/report.xlsx'), bytes(), {
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    await uploadBytes(ref(s, 'other/file.txt'), bytes(), { contentType: 'text/plain' });
  });
});

for (const area of ['receipts/car1/e1', 'sales/s1'] as const) {
  const existing = area.startsWith('receipts') ? `${area}/receipt.pdf` : `${area}/contract.pdf`;
  describe(area.split('/')[0]!, () => {
    it('anonymous / no role: no read, upload or delete', async () => {
      for (const ctx of [a.anon, a.noRole]) {
        await assertFails(getBytes(ref(st(ctx), existing)));
        await assertFails(uploadBytes(ref(st(ctx), `${area}/new.pdf`), bytes(), pdf));
        await assertFails(deleteObject(ref(st(ctx), existing)));
      }
    });
    it('staff: read + upload (type/size checked), cannot delete', async () => {
      const s = st(a.staff);
      await assertSucceeds(getBytes(ref(s, existing)));
      await assertSucceeds(uploadBytes(ref(s, `${area}/new.pdf`), bytes(), pdf));
      await assertSucceeds(uploadBytes(ref(s, `${area}/photo.jpg`), bytes(), { contentType: 'image/jpeg' }));
      await assertFails(uploadBytes(ref(s, `${area}/notes.txt`), bytes(), { contentType: 'text/plain' }));
      await assertFails(uploadBytes(ref(s, `${area}/huge.pdf`), bytes(21 * 1024 * 1024), pdf));
      await assertFails(deleteObject(ref(s, existing)));
    });
    it('admin: read, upload and delete', async () => {
      const s = st(a.admin);
      await assertSucceeds(getBytes(ref(s, existing)));
      await assertSucceeds(uploadBytes(ref(s, `${area}/new.pdf`), bytes(), pdf));
      await assertSucceeds(deleteObject(ref(s, existing)));
    });
  });
}

describe('receipts size limit', () => {
  it('rejects receipts over 10 MB', async () => {
    await assertFails(uploadBytes(ref(st(a.staff), 'receipts/car1/e1/big.pdf'), bytes(11 * 1024 * 1024), pdf));
  });
});

describe('exports (admin read only; functions write)', () => {
  it('only admin reads; nobody writes from the client', async () => {
    await assertFails(getBytes(ref(st(a.anon), 'exports/admin-uid/report.xlsx')));
    await assertFails(getBytes(ref(st(a.staff), 'exports/admin-uid/report.xlsx')));
    await assertSucceeds(getBytes(ref(st(a.admin), 'exports/admin-uid/report.xlsx')));
    await assertFails(uploadBytes(ref(st(a.admin), 'exports/admin-uid/new.xlsx'), bytes()));
    await assertFails(deleteObject(ref(st(a.admin), 'exports/admin-uid/report.xlsx')));
  });
});

describe('other paths', () => {
  it('are denied to everyone', async () => {
    for (const ctx of [a.anon, a.staff, a.admin]) {
      await assertFails(getBytes(ref(st(ctx), 'other/file.txt')));
      await assertFails(uploadBytes(ref(st(ctx), 'other/new.txt'), bytes(), { contentType: 'text/plain' }));
    }
  });
});
