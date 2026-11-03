import { readConfig } from './config.ts';
import { createPromptServer } from './server.ts';

const config = readConfig();
const server = createPromptServer(config);

/** Confirm startup without printing configuration values, input, or secret keys. */
function onListening(): void {
  console.info(`Prompt API listening on port ${config.port}.`);
}

/** Drain active requests when Render replaces this instance, then exit within its deadline. */
function shutdown(): void {
  // The close callback runs after every existing HTTP connection finishes.
  server.close(() => process.exit(0));
  // A bounded drain prevents hung clients from delaying replacement indefinitely.
  setTimeout(() => process.exit(1), 25_000).unref();
}

server.listen(config.port, '0.0.0.0', onListening);
process.once('SIGTERM', shutdown);
process.once('SIGINT', shutdown);
