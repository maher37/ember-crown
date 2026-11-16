# Rules engine (D&D 5e, 2014)

Pure TypeScript with no React and no game store. Every function takes plain data and returns new
data plus log lines. All randomness goes through a `RandomSource` (normally `SeededRng`).

| File | What it covers |
|---|---|
| `rng.ts` | Seeded random numbers (state saved in save files), scripted rolls for tests |
| `dice.ts` | Dice notation (`2d6+3`), rolling, log text |
| `abilities.ts` | Ability modifiers, proficiency bonus by level |
| `advantage.ts`, `d20.ts` | Advantage/disadvantage (and cancelling), d20 rolls |
| `checks.ts` | Ability checks and saving throws, with condition effects |
| `conditions.ts`, `status.ts` | The 14 conditions, exhaustion, speed |
| `attack.ts` | Attack rolls, crits, cover, damage rolls |
| `damage.ts` | Resistance/vulnerability/immunity, temp HP, 0 HP, instant death, knockouts, concentration, healing |
| `deathSaves.ts` | Death saves, stabilizing |
| `rests.ts` | Short rest (Hit Dice) and long rest |
| `leveling.ts` | XP thresholds, level-ups, HP per level |

Tests live in `tests/unit/rules/`. To see a sample combat log, run `npm test -- duel` or read
`tests/unit/rules/__snapshots__/duel.test.ts.snap`.
