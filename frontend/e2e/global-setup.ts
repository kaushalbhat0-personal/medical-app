import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default async function globalSetup(): Promise<void> {
  const backendRoot = path.resolve(__dirname, '..', '..');
  const py = process.env.PYTHON ?? 'python';
  execSync(`${py} -m tests.e2e_prepare`, {
    cwd: backendRoot,
    stdio: 'inherit',
    env: { ...process.env },
    shell: true,
  });
}
