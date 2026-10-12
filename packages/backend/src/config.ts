import dotenv from 'dotenv';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(packageRoot, '../..');

dotenv.config({ path: path.join(packageRoot, '.env'), quiet: true });
dotenv.config({ path: path.join(repoRoot, '.env'), quiet: true });

export interface AppConfig {
  dbPath: string;
  githubToken?: string | undefined;
  bitbucketToken?: string | undefined;
  defaultRef: string;
}

export const config: AppConfig = {
  dbPath: process.env.DB_PATH || path.join(os.homedir(), '.skillright', 'skillright.db'),
  githubToken: process.env.GITHUB_TOKEN,
  bitbucketToken: process.env.BITBUCKET_TOKEN,
  defaultRef: process.env.DEFAULT_GIT_REF || 'main',
};