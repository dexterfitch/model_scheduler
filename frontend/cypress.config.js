import { defineConfig } from "cypress";
import { execSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  e2e: {
    baseUrl: "http://localhost:5173",
    chromeWebSecurity: false,
    setupNodeEvents(on, config) {
      on('task', {
        reseedDatabase() {
          const backendPath = path.resolve(__dirname, '../backend');
          execSync('rails db:seed', {
            cwd: backendPath,
            timeout: 60000,
            stdio: 'inherit'
          });
          return null;
        }
      });
    },
  },
});