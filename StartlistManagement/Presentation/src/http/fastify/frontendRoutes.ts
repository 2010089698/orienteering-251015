import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FastifyPluginAsync } from 'fastify';
import { renderStartlistWizardPage } from '../frontend/startlistWizardPage.js';

const currentDir = dirname(fileURLToPath(import.meta.url));
const scriptPath = join(currentDir, '../frontend/public/startlist-wizard.js');

const frontendRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', async (_, reply) => {
    reply.type('text/html; charset=utf-8').send(renderStartlistWizardPage());
  });

  fastify.get('/startlist-wizard.js', async (_, reply) => {
    const script = await readFile(scriptPath, 'utf-8');
    reply.type('text/javascript; charset=utf-8').send(script);
  });
};

export default frontendRoutes;
