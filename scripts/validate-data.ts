// Checks every JSON file in src/data/ against its zod schema. Run: npm run validate-data
import { dataFiles } from '../src/data';

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
console.log(
  failed ? `\n${failed} file(s) failed.` : `\nAll ${dataFiles.length} data file(s) valid.`,
);
process.exit(failed ? 1 : 0);
