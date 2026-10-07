import fp from 'fastify-plugin';
import { createDb, type Db } from '../db/client';

declare module 'fastify' {
  interface FastifyInstance {
    db: Db;
  }
}

export const dbPlugin = fp<{ url: string }>(
  async (app, opts) => {
    const { db, sql } = createDb(opts.url);
    app.decorate('db', db);
    app.addHook('onClose', async () => {
      await sql.end({ timeout: 5 });
    });
  },
  { name: 'db' },
);
