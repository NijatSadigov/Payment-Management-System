// Runs the Prisma CLI with settings that survive shared-hosting limits:
// - --disable-wasm-trap-handler: Node otherwise reserves ~10 GB of virtual
//   memory for WebAssembly, which capped hosts refuse.
// - TOKIO_WORKER_THREADS / MALLOC_ARENA_MAX: Prisma's engine otherwise starts a
//   thread per CPU core and hangs when the host's thread cap is hit.
const path = require('path');
const { spawnSync } = require('child_process');

const cli = path.join(__dirname, '..', 'node_modules', 'prisma', 'build', 'index.js');
const env = {
  TOKIO_WORKER_THREADS: '2',
  MALLOC_ARENA_MAX: '2',
  CHECKPOINT_DISABLE: '1',
  ...process.env,
};
const r = spawnSync(process.execPath, ['--disable-wasm-trap-handler', cli, ...process.argv.slice(2)], {
  stdio: 'inherit',
  env,
});
process.exit(r.status ?? 1);
