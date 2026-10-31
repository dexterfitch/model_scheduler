/**
 * Runs once before the end-to-end tests: reseeds the development database so every run
 * starts the same.
 */

import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const backendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../backend');

/** Reseeds the database. */
export default function globalSetup() {
  execSync('bundle exec rails db:seed', { cwd: backendDir, stdio: 'inherit' });
}
