import armorJson from './armor.json';
import backgroundsJson from './backgrounds.json';
import classesJson from './classes.json';
import difficultiesJson from './difficulties.json';
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

export { dataFiles } from './files';

// Parsed at startup: a broken data file fails loudly instead of misbehaving in play.
export const difficulties = DifficultyFile.parse(difficultiesJson);
export const species = SpeciesFile.parse(speciesJson).species;
export const backgrounds = BackgroundFile.parse(backgroundsJson).backgrounds;
const classFile = ClassFile.parse(classesJson);
export const classes = classFile.classes;
export const spellSlots = classFile.spellSlots;
export const spells = SpellFile.parse(spellsJson).spells;
export const monsters = MonsterFile.parse(monstersJson).monsters;
export const foes = NamedFoeFile.parse(foesJson).foes;
export const weapons = WeaponFile.parse(weaponsJson).weapons;
export const armor = ArmorFile.parse(armorJson).armor;
export const magicItems = MagicItemFile.parse(magicItemsJson).items;

export const gameData = {
  difficulties,
  species,
  backgrounds,
  classes,
  spellSlots,
  spells,
  monsters,
  foes,
  weapons,
  armor,
  magicItems,
};
export type GameData = typeof gameData;
