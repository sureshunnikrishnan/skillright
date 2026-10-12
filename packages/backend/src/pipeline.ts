import { config as appConfig } from './config.js';
import { initializeDatabase } from './schema.js';
import { SkillExtractor } from './extractor.js';
import { listRepos } from './registry.js';
import { theme } from './theme.js';

async function runPipeline() {
  console.log(`${theme.info('[Config]')} ${theme.muted('Using DB_PATH:')} ${theme.path(appConfig.dbPath)}`);

  const db = initializeDatabase(appConfig.dbPath);
  const extractor = new SkillExtractor(db);

  const repos = listRepos(db);
  if (repos.length === 0) {
    console.log(`${theme.muted('No repos indexed.')}`);
    db.close();
    return;
  }

  for (const repo of repos) {
    try {
      await extractor.processRepository({ repoUrl: repo.repoUrl });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`${theme.error('[-] Error processing')} ${theme.error(repo.repoUrl)}: ${message}`);
    }
  }

  const tree = extractor.getCatalogTree();
  console.log(`\n${theme.heading('[Catalog Tree Generated]:')}`);
  console.log(JSON.stringify(tree, null, 2));

  db.close();
}

runPipeline();
