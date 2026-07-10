import { defineConfig } from 'vite';

// sphere-sdk depends on a few packages (buffer, crypto-js, elliptic) written with
// Node's Buffer global in mind. Vite/Rollup don't polyfill Buffer by default in the
// browser, so if you hit "Buffer is not defined" at runtime, install the polyfill:
//
//   npm install --save-dev vite-plugin-node-polyfills
//
// and uncomment the plugin below.

// import { nodePolyfills } from 'vite-plugin-node-polyfills';

export default defineConfig({
  // plugins: [nodePolyfills({ include: ['buffer'] })],
  server: {
    port: 5173,
  },
});
