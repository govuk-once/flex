import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { createDocument } from 'zod-openapi';

import { getHelloWorld } from './domain/hello-world';
import { getTopics } from './domain/topics';

const docs = createDocument({
  openapi: '3.1.1',
  info: {
    title: 'FLEX API',
    version: '1.0.0',
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
  },
  paths: {
    '/example': {
      get: getHelloWorld,
    },
    '/topics': {
      get: getTopics,
    },
  },
  security: [{ bearerAuth: [] }],
});

const outputPath = path.join(process.cwd(), 'apps/docs/api.json');

fs.writeFileSync(outputPath, JSON.stringify(docs, null, 2));

console.log(`API documentation: ${outputPath}`);
