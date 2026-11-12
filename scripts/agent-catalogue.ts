// Writes docs/copilot-studio/catalogue.csv from the seed catalogue (npm run agent:catalogue).
import { writeFileSync } from 'node:fs';
import { agentCatalogueCsv } from '../src/services/seed/agentCatalogue';
import { seedCatalogue } from '../src/services/seed/catalogue';

const path = new URL('../docs/copilot-studio/catalogue.csv', import.meta.url);
writeFileSync(path, agentCatalogueCsv(seedCatalogue));
console.log(`Wrote ${path.pathname}`);
