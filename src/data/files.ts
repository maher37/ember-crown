import type { z } from 'zod';
import armorJson from './armor.json';
import backgroundsJson from './backgrounds.json';
import classesJson from './classes.json';
import difficultiesJson from './difficulties.json';
import encountersAct1Json from './encounters/act1.json';
import encountersAct2Json from './encounters/act2.json';
import encountersAct3Json from './encounters/act3.json';
import loadoutsJson from './loadouts.json';
import npcsJson from './npcs.json';
import questsJson from './quests.json';
import {
  LetterFile,
  NpcFile,
  PlaceFile,
  PlaceMapFile,
  QuestFile,
  WixFile,
  EpilogueFile,
} from './schemas/story';
import placeMapsJson from './placeMaps.json';
import placesJson from './places.json';
import wixJson from './wix.json';
import lettersJson from './letters.json';
import epilogueJson from './epilogue.json';
import { EncounterFile, LoadoutFile } from './schemas/encounter';
import foesJson from './foes.json';
import magicItemsJson from './magicItems.json';
import monstersJson from './monsters.json';
import { BackgroundFile } from './schemas/background';
import { ClassFile } from './schemas/class';
import { DifficultyFile } from './schemas/difficulty';
import { ArmorFile, GearFile, MagicItemFile, WeaponFile } from './schemas/item';
import gearJson from './gear.json';
import { MonsterFile, NamedFoeFile } from './schemas/monster';
import { SpeciesFile } from './schemas/species';
import { SpellFile } from './schemas/spell';
import speciesJson from './species.json';
import spellsJson from './spells.json';
import weaponsJson from './weapons.json';
import shopsJson from './shops.json';
import bountiesJson from './bounties.json';
import findsJson from './finds.json';
import { BountyFile, FindFile, ShopFile } from './schemas/town';
import originsJson from './origins.json';
import { OriginFile } from './schemas/origin';

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
  { name: 'gear.json', schema: GearFile, raw: gearJson },
  { name: 'magicItems.json', schema: MagicItemFile, raw: magicItemsJson },
  { name: 'encounters/act1.json', schema: EncounterFile, raw: encountersAct1Json },
  { name: 'encounters/act2.json', schema: EncounterFile, raw: encountersAct2Json },
  { name: 'encounters/act3.json', schema: EncounterFile, raw: encountersAct3Json },
  { name: 'loadouts.json', schema: LoadoutFile, raw: loadoutsJson },
  { name: 'quests.json', schema: QuestFile, raw: questsJson },
  { name: 'npcs.json', schema: NpcFile, raw: npcsJson },
  { name: 'places.json', schema: PlaceFile, raw: placesJson },
  { name: 'shops.json', schema: ShopFile, raw: shopsJson },
  { name: 'bounties.json', schema: BountyFile, raw: bountiesJson },
  { name: 'finds.json', schema: FindFile, raw: findsJson },
  { name: 'wix.json', schema: WixFile, raw: wixJson },
  { name: 'letters.json', schema: LetterFile, raw: lettersJson },
  { name: 'epilogue.json', schema: EpilogueFile, raw: epilogueJson },
  { name: 'placeMaps.json', schema: PlaceMapFile, raw: placeMapsJson },
  { name: 'origins.json', schema: OriginFile, raw: originsJson },
] as const satisfies readonly { name: string; schema: z.ZodType; raw: unknown }[];
