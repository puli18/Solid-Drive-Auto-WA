import { carSlug, COLLECTIONS, SYSTEM_ACTOR, type AuditAction } from '@sda/shared';
import { logger } from 'firebase-functions/v2';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { bindSecrets, db, diffFields, REGION, siteUrl, writeAudit } from '../core';
import { purgeCache } from '../core/cloudflare';

/** Fields this trigger itself maintains (a change to only these is not audited / purged again). */
const DERIVED = new Set(['slug', 'searchText', 'updatedAt', 'updatedBy']);

export function searchTextOf(d: Record<string, unknown>): string {
  return [d.make, d.model, d.variant, d.stockNo, d.rego]
    .filter((v) => v !== undefined && v !== null && v !== '')
    .join(' ')
    .toLowerCase();
}

/** Audit action for a car change. */
export function carAuditAction(before: Record<string, unknown> | undefined, after: Record<string, unknown> | undefined): AuditAction {
  if (!before) return 'create';
  if (!after) return 'delete';
  if (!before.deletedAt && after.deletedAt) return 'delete';
  if (before.deletedAt && !after.deletedAt) return 'restore';
  if (before.status !== after.status) return 'status-change';
  if (before.published !== after.published) return after.published ? 'publish' : 'unpublish';
  return 'update';
}

/** Public URLs to purge for a car change (old and new slug, inventory, home, sitemap). */
export function purgeUrlsFor(before: Record<string, unknown> | undefined, after: Record<string, unknown> | undefined, base: string) {
  const wasPublic = before?.published === true;
  const isPublic = after?.published === true && !after?.deletedAt;
  if (!wasPublic && !isPublic) return [];
  const slugs = [before?.slug, after?.slug].filter((s): s is string => typeof s === 'string' && s.length > 0);
  return [...new Set([...slugs.map((s) => `${base}/cars/${s}`), `${base}/cars`, `${base}/`, `${base}/sitemap.xml`])];
}

/**
 * onCarWrite – keeps `slug` ({year}-{make}-{model}-{variant}-{stockNo}) and `searchText` in sync, purges the
 * Cloudflare edge cache for the car page and /cars, and writes the audit log (actor = updatedBy).
 * Loop guard: it only writes when slug/searchText actually changed, and ignores changes to derived fields only.
 */
export const onCarWrite = onDocumentWritten(
  { region: REGION, document: 'cars/{carId}', secrets: bindSecrets('CF_CACHE_PURGE_TOKEN') },
  async (event) => {
    const carId = event.params.carId;
    const before = event.data?.before.exists ? (event.data.before.data() as Record<string, unknown>) : undefined;
    const after = event.data?.after.exists ? (event.data.after.data() as Record<string, unknown>) : undefined;

    // 1. Derived fields.
    if (after && after.make && after.model && after.year && after.stockNo) {
      const slug = carSlug({
        year: after.year as number,
        make: String(after.make),
        model: String(after.model),
        variant: (after.variant as string) ?? '',
        stockNo: String(after.stockNo),
      });
      const searchText = searchTextOf(after);
      if (slug !== after.slug || searchText !== after.searchText) {
        await db.collection(COLLECTIONS.cars).doc(carId).update({ slug, searchText });
        // The follow-up event (slug only) is skipped below; continue with the real change now using the new slug.
        after.slug = slug;
        after.searchText = searchText;
      }
    }

    // 2. Skip events where only derived fields changed (our own update above).
    const { before: b, after: a } = diffFields(before ?? null, after ?? null);
    const changed = before && after ? Object.keys(a ?? {}).filter((k) => !DERIVED.has(k)) : ['*'];
    if (before && after && changed.length === 0) return;

    // 3. Audit.
    const action = carAuditAction(before, after);
    const actor = String(after?.updatedBy ?? before?.updatedBy ?? SYSTEM_ACTOR);
    const strip = (o: Record<string, unknown> | null) =>
      o ? Object.fromEntries(Object.entries(o).filter(([k]) => !DERIVED.has(k))) : null;
    try {
      await writeAudit({
        actorUid: actor,
        action,
        entity: 'car',
        entityId: carId,
        carId,
        before: action === 'create' ? null : strip(b),
        after: action === 'delete' && !after ? null : action === 'create' ? { stockNo: after?.stockNo, status: after?.status } : strip(a),
      });
    } catch (err) {
      logger.error('Car audit write failed', err);
    }

    // 4. Edge cache purge (logged when Cloudflare isn't configured).
    const urls = purgeUrlsFor(before, after, siteUrl());
    if (urls.length) await purgeCache(urls).catch((err) => logger.error('Cache purge failed', err));
  },
);
