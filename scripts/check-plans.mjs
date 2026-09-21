import { readdir, readFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const idPattern = /^[A-Z][A-Z0-9]*-[A-Za-z0-9]+-(?:[A-Za-z0-9]+)$/;
const statuses = new Set(['planned', 'built', 'verified', 'BLOCKED']);

export async function readPlans(directory) {
  const documents = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) documents.push(...(await readPlans(path)));
    else if (entry.name.endsWith('.md')) documents.push({ path, text: await readFile(path, 'utf8') });
  }
  return documents;
}

/** Only definition tables count. References in prose never create duplicate IDs. */
export function auditPlans(documents) {
  const errors = [];
  const definitions = new Map();
  const ledger = new Map();
  const phases = Object.fromEntries(
    Array.from({ length: 9 }, (_, i) => [`P${i}`, { planned: 0, built: 0, verified: 0, BLOCKED: 0 }]),
  );
  for (const document of documents) {
    const isLedger = /acceptance\.md$/.test(document.path);
    let columns = [];
    let definitionCount = 0;
    for (const [index, line] of document.text.split(/\r?\n/).entries()) {
      if (!line.startsWith('|')) {
        columns = [];
        continue;
      }
      const cells = line
        .split(/(?<!\\)\|/)
        .slice(1, -1)
        .map((cell) => cell.trim());
      if (cells[0] === 'ID') {
        columns = cells;
        continue;
      }
      if (columns[0] !== 'ID') continue;
      const id = cells[0]?.replaceAll('`', '');
      if (!idPattern.test(id ?? '')) continue;
      // A deviations table references an ID but does not define it.
      const catalogue = columns.includes('Trigger') && columns.includes('What happens');
      if (!columns.includes('Feature') && !columns.includes('Phase') && !catalogue) continue;
      const location = `${document.path}:${index + 1}`;
      const target = isLedger ? ledger : definitions;
      if (target.has(id)) errors.push(`${location}: duplicate ${isLedger ? 'ledger' : 'definition'} ${id}`);
      if (isLedger) {
        const phase = cells[columns.indexOf('Phase')];
        const status = cells[columns.indexOf('Status')];
        const evidence = cells[columns.indexOf('Evidence')] ?? '';
        const deviation = cells[columns.indexOf('Deviation')] ?? '';
        if (!Object.hasOwn(phases, phase ?? '')) errors.push(`${location}: ${id} has invalid phase ${phase}`);
        if (!statuses.has(status)) errors.push(`${location}: ${id} has invalid status ${status}`);
        if (status === 'verified' && !evidence) errors.push(`${location}: ${id} is verified without evidence`);
        if (status === 'BLOCKED' && (!evidence || !deviation))
          errors.push(`${location}: ${id} needs a blocking reason and sign-off`);
        if (phases[phase] && statuses.has(status)) phases[phase][status]++;
        target.set(id, { location, phase, status, evidence });
      } else {
        const acceptance =
          catalogue && document.text.includes('unit/e2e: egg <id> behaves as')
            ? `unit/e2e: egg ${id} behaves as specified`
            : cells[columns.indexOf('Acceptance test')];
        if (!acceptance) errors.push(`${location}: ${id} has no named acceptance test`);
        target.set(id, { location });
        definitionCount++;
      }
    }
    if (definitionCount && /[/\\](?:surfaces|apps)[/\\]/.test(document.path)) {
      if (!/not like the others/i.test(document.text)) errors.push(`${document.path}: missing distinctness contract`);
      for (const section of ['Motion', 'Responsive', 'Accessibility', 'Edge cases']) {
        if (!new RegExp(`^##.*${section}`, 'im').test(document.text))
          errors.push(`${document.path}: missing ${section} section`);
      }
    }
  }
  for (const [id, value] of definitions) if (!ledger.has(id)) errors.push(`${value.location}: ${id} has no ledger row`);
  for (const [id, value] of ledger)
    if (!definitions.has(id)) errors.push(`${value.location}: ${id} has no owning specification`);
  return { errors, definitions, ledger, phases };
}

async function main() {
  const documents = await readPlans(join(root, 'plans'));
  const audit = auditPlans(documents.map((doc) => ({ ...doc, path: relative(root, doc.path).replaceAll('\\', '/') })));
  if (audit.errors.length) {
    console.error(audit.errors.join('\n'));
    process.exitCode = 1;
    return;
  }
  console.log(
    `Plans valid: ${documents.length} documents, ${audit.definitions.size} unique requirements, ${audit.ledger.size} ledger rows.`,
  );
  for (const [phase, counts] of Object.entries(audit.phases))
    console.log(
      `${phase}: ${Object.entries(counts)
        .map(([status, count]) => `${count} ${status}`)
        .join(', ')}`,
    );
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main();
