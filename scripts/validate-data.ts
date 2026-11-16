// Checks every JSON file in src/data/ against its zod schema, then the links between files.
// Run: npm run validate-data
import { dataFiles } from '../src/data/files';

let failed = 0;
for (const file of dataFiles) {
  const result = file.schema.safeParse(file.raw);
  if (result.success) {
    console.log(`ok    ${file.name}`);
  } else {
    failed++;
    console.error(`FAIL  ${file.name}`);
    for (const issue of result.error.issues) {
      console.error(`      ${issue.path.join('.') || '(root)'}: ${issue.message}`);
    }
  }
}
if (failed) {
  console.error(`\n${failed} file(s) failed.`);
  process.exit(1);
}

// Only load the parsed data once every file is valid.
const { gameData } = await import('../src/data');
const { crossCheck } = await import('../src/data/crossCheck');
const { errors, warnings } = crossCheck(gameData);
for (const e of errors) console.error(`ERROR ${e}`);
for (const w of warnings) console.warn(`warn  ${w}`);
console.log(
  `\nAll ${dataFiles.length} data files valid. ${errors.length} cross-file error(s), ${warnings.length} warning(s).`,
);
process.exit(errors.length ? 1 : 0);
