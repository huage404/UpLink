import { defineConfig } from 'vite';

// 主进程构建配置
// 将 ssh2-sftp-client 及其底层依赖标记为 external，避免 Vite 尝试打包 .node 原生模块
export default defineConfig({
  build: {
    rollupOptions: {
      external: [
        'ssh2-sftp-client',
        'ssh2',
        'cpu-features'
      ]
    }
  },
  optimizeDeps: {
    // 这些库只在 Node/Electron 主进程环境使用，不需要预打包
    exclude: ['ssh2-sftp-client', 'ssh2', 'cpu-features']
  }
});
