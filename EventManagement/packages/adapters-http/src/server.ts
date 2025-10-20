import Fastify from 'fastify';
import cors from '@fastify/cors';
import { Type } from '@sinclair/typebox';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';

import eventRoutes, { type EventRoutesOptions } from './fastify/eventRoutes.js';

export interface CreateServerOptions {
  events: EventRoutesOptions;
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

  fastify.register(eventRoutes, options.events);

  return fastify;
};

export type EventServer = ReturnType<typeof createServer>;
