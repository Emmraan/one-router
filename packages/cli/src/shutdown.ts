import type { Server } from 'node:http';

export function installShutdown(server: Server) {
  const { promise: stopped, resolve } = Promise.withResolvers<void>();
  let closing = false;
  const close = () => {
    if (!closing) {
      closing = true;
      const deadline = setTimeout(() => server.closeAllConnections(), 5000).unref();
      server.close(() => {
        clearTimeout(deadline);
        resolve();
      });
    }
    return stopped;
  };
  const onError = () => {
    console.error('The HTTP listener failed');
    process.exitCode = 1;
    void close();
  };
  process.on('SIGINT', close);
  process.on('SIGTERM', close);
  server.on('error', onError);
  return { stopped, close, isClosing: () => closing, dispose() {
    process.off('SIGINT', close);
    process.off('SIGTERM', close);
    server.off('error', onError);
  } };
}
