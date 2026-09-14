import { defineConfig } from "nitro";

export default defineConfig({
  serverDir: "./server",
  logLevel: 3,
  $development: {
    debug: true,
  },
  $production: {
    minify: true,
  },
});
