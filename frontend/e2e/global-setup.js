import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Rebuild the development database from seeds.rb before every browser test run
const backendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../backend');

export default function globalSetup() {
  execSync('bundle exec rails db:seed', { cwd: backendDir, stdio: 'inherit' });
}