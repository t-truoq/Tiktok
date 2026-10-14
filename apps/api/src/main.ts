// truonglt phase1 bootstrap start
import { createApp } from './app';
import { listenHost } from './runtime-config';

async function bootstrap() {
  const app = await createApp();
  const port = Number(process.env.PORT || 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('INVALID_PORT');
  await app.listen(port, listenHost());
}

bootstrap().catch(() => {
  console.error(JSON.stringify({ event: 'startup_failed', code: 'STARTUP_FAILED' }));
  process.exitCode = 1;
});
// truonglt phase1 bootstrap end
