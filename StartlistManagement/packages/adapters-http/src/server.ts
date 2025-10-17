import Fastify from 'fastify';
import cors from '@fastify/cors';
import { Type } from '@sinclair/typebox';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import startlistRoutes, { StartlistRoutesOptions } from './fastify/startlistRoutes.js';

export interface CreateServerOptions {
  startlist: StartlistRoutesOptions;
  logger?: boolean;
}

export const createServer = (options: CreateServerOptions) => {
  const fastify = Fastify({ logger: options.logger ?? false }).withTypeProvider<TypeBoxTypeProvider>();

  void fastify.register(cors, { origin: true });

  fastify.get(
    '/health',
    {
      schema: {
        response: { 200: Type.Object({ status: Type.Literal('ok') }) },
      },
    },
    async () => ({ status: 'ok' }),
  );
  fastify.register(startlistRoutes, options.startlist);

  return fastify;
};

export type StartlistServer = ReturnType<typeof createServer>;
