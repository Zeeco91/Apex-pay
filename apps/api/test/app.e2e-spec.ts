import { Test, type TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

/** Boot smoke test — confirms the whole DI graph (every module, every provider) wires up and
 * the app can actually start, independent of any specific business flow. Kept separate from
 * critical-flows.e2e-spec.ts so a DI wiring break fails fast and obviously here rather than
 * inside a longer flow. */
describe('App bootstrap (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1', { exclude: ['health'] });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('/health (GET) reports the app and database are up', () => {
    return request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect((res) => {
        if (res.body.status !== 'ok') {
          throw new Error(
            `Expected health status "ok", got ${JSON.stringify(res.body)}`,
          );
        }
      });
  });

  it('/api/v1/levels (GET) is publicly reachable', () => {
    return request(app.getHttpServer())
      .get('/api/v1/levels')
      .expect(200)
      .expect((res) => {
        if (res.body.success !== true) {
          throw new Error(
            `Expected success envelope, got ${JSON.stringify(res.body)}`,
          );
        }
      });
  });
});
