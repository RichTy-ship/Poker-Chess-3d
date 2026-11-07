import path from 'path';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

function pokerChessServerPlugin(): Plugin {
  return {
    name: 'poker-chess-multiplayer-server',
    async configureServer(server) {
      const { attachMultiplayerServer, handleApiMiddleware } = await import('./server/index.js');
      if (server.httpServer) {
        attachMultiplayerServer(server.httpServer);
      }
      server.middlewares.use((req, res, next) => {
        const urlPath = (req.url || '/').split('?')[0];
        if (urlPath.startsWith('/api/') || urlPath === '/traffic' || urlPath === '/admin/traffic') {
          handleApiMiddleware(req, res, next);
          return;
        }
        next();
      });
    },
    async configurePreviewServer(server) {
      const { attachMultiplayerServer, handleApiMiddleware } = await import('./server/index.js');
      if (server.httpServer) {
        attachMultiplayerServer(server.httpServer);
      }
      server.middlewares.use((req, res, next) => {
        const urlPath = (req.url || '/').split('?')[0];
        if (urlPath.startsWith('/api/') || urlPath === '/traffic' || urlPath === '/admin/traffic') {
          handleApiMiddleware(req, res, next);
          return;
        }
        next();
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  loadEnv(mode, '.', '');
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
      hmr: false,
    },
    plugins: [react(), pokerChessServerPlugin()],
    resolve: {
      alias: {
        '@': path.resolve('./src'),
      },
    },
  };
});


