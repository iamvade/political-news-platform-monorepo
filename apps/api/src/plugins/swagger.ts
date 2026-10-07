import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import fp from 'fastify-plugin';
import { jsonSchemaTransform } from 'fastify-type-provider-zod';

/**
 * Add to `schema.security` on state-changing admin routes so Swagger UI sends `X-CSRF-Token`
 * (paste the token via the Authorize button). Documentation only: enforcement is `verifyCsrf`.
 */
export const csrfSecurity = [{ csrfToken: [] }];

/** OpenAPI spec + Swagger UI at /docs. Registered in development only. */
export const swaggerPlugin = fp(
  async (app) => {
    await app.register(swagger, {
      openapi: {
        info: { title: 'News API', version: '0.0.0' },
        components: {
          securitySchemes: {
            csrfToken: {
              type: 'apiKey',
              in: 'header',
              name: 'X-CSRF-Token',
              description:
                'Log in via POST /v1/admin/auth/login, then paste `data.csrfToken` here. ' +
                'The session cookie is sent by the browser automatically.',
            },
          },
        },
      },
      transform: jsonSchemaTransform,
    });
    await app.register(swaggerUi, {
      routePrefix: '/docs',
    });
  },
  { name: 'swagger' },
);
