/**
 * The outbox entity lives in `@abdcshare/persistence` so the worker uses the same definition (S4).
 * Re-exported from this `*.entity.ts` path so MikroORM's entity discovery (glob) still finds it.
 */
export { OutboxEntity } from '@abdcshare/persistence';
