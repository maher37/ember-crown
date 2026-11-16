// Writes docs/Data_Verify_Checklist.md from every "verify": true flag in src/data/.
// Run: npm run verify-list
import { writeFileSync } from 'node:fs';
import { collectVerifyFlags, verifyChecklistMarkdown } from '../src/data/verifyList';

writeFileSync('docs/Data_Verify_Checklist.md', verifyChecklistMarkdown());
console.log(`Wrote docs/Data_Verify_Checklist.md (${collectVerifyFlags().length} items).`);
