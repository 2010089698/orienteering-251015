import Fastify from 'fastify';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import startlistRoutes, { StartlistRoutesOptions } from './fastify/startlistRoutes.js';

export interface CreateServerOptions {
  startlist: StartlistRoutesOptions;
  logger?: boolean;
}

export const createServer = (options: CreateServerOptions) => {
  const fastify = Fastify({ logger: options.logger ?? false }).withTypeProvider<TypeBoxTypeProvider>();

  fastify.register(startlistRoutes, options.startlist);

  return fastify;
};

export type StartlistServer = ReturnType<typeof createServer>;
