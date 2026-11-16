import type { z } from 'zod';
import armorJson from './armor.json';
import backgroundsJson from './backgrounds.json';
import classesJson from './classes.json';
import difficultiesJson from './difficulties.json';
import encountersJson from './encounters.json';
import loadoutsJson from './loadouts.json';
import npcsJson from './npcs.json';
import questsJson from './quests.json';
import { NpcFile, QuestFile } from './schemas/story';
import { EncounterFile, LoadoutFile } from './schemas/encounter';
import foesJson from './foes.json';
import magicItemsJson from './magicItems.json';
import monstersJson from './monsters.json';
import { BackgroundFile } from './schemas/background';
import { ClassFile } from './schemas/class';
import { DifficultyFile } from './schemas/difficulty';
import { ArmorFile, MagicItemFile, WeaponFile } from './schemas/item';
import { MonsterFile, NamedFoeFile } from './schemas/monster';
import { SpeciesFile } from './schemas/species';
import { SpellFile } from './schemas/spell';
import speciesJson from './species.json';
import spellsJson from './spells.json';
import weaponsJson from './weapons.json';

/**
 * Every JSON content file, paired with the zod schema that checks it.
 * `npm run validate-data` and the unit tests walk this list; add new files here.
 */
export const dataFiles = [
  { name: 'difficulties.json', schema: DifficultyFile, raw: difficultiesJson },
  { name: 'species.json', schema: SpeciesFile, raw: speciesJson },
  { name: 'backgrounds.json', schema: BackgroundFile, raw: backgroundsJson },
  { name: 'classes.json', schema: ClassFile, raw: classesJson },
  { name: 'spells.json', schema: SpellFile, raw: spellsJson },
  { name: 'monsters.json', schema: MonsterFile, raw: monstersJson },
  { name: 'foes.json', schema: NamedFoeFile, raw: foesJson },
  { name: 'weapons.json', schema: WeaponFile, raw: weaponsJson },
  { name: 'armor.json', schema: ArmorFile, raw: armorJson },
  { name: 'magicItems.json', schema: MagicItemFile, raw: magicItemsJson },
  { name: 'encounters.json', schema: EncounterFile, raw: encountersJson },
  { name: 'loadouts.json', schema: LoadoutFile, raw: loadoutsJson },
  { name: 'quests.json', schema: QuestFile, raw: questsJson },
  { name: 'npcs.json', schema: NpcFile, raw: npcsJson },
] as const satisfies readonly { name: string; schema: z.ZodType; raw: unknown }[];
