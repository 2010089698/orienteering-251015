import Fastify from 'fastify';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import entryRoutes, { EntryRoutesOptions } from './fastify/entryRoutes.js';

export interface CreateServerOptions {
  entry: EntryRoutesOptions;
  logger?: boolean;
}

export const createServer = (options: CreateServerOptions) => {
  const fastify = Fastify({ logger: options.logger ?? false }).withTypeProvider<TypeBoxTypeProvider>();

  fastify.register(entryRoutes, options.entry);

  return fastify;
};

export type EntryServer = ReturnType<typeof createServer>;
