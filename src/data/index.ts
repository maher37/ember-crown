import armorJson from './armor.json';
import backgroundsJson from './backgrounds.json';
import classesJson from './classes.json';
import difficultiesJson from './difficulties.json';
import encountersJson from './encounters.json';
import loadoutsJson from './loadouts.json';
import npcsJson from './npcs.json';
import questsJson from './quests.json';
import {
  EpilogueFile,
  LetterFile,
  NpcFile,
  PlaceFile,
  PlaceMapFile,
  QuestFile,
  WixFile,
} from './schemas/story';
import placeMapsJson from './placeMaps.json';
import epilogueJson from './epilogue.json';
import placesJson from './places.json';
import wixJson from './wix.json';
import lettersJson from './letters.json';
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
const gearFile = GearFile.parse(gearJson);
export const gear = gearFile.gear;
export const startingSupplies = gearFile.startingSupplies;
export const magicItems = MagicItemFile.parse(magicItemsJson).items;
const encounterFile = EncounterFile.parse(encountersJson);
export const encounters = encounterFile.encounters;
export const roadTables = encounterFile.roadTables;
export const roadEvents = encounterFile.roadEvents;
const loadoutFile = LoadoutFile.parse(loadoutsJson);
export const loadouts = loadoutFile.loadouts;
export const defaultChoices = loadoutFile.defaultChoices;
const questFile = QuestFile.parse(questsJson);
export const quests = questFile.quests;
export const awards = questFile.awards;
export const npcs = NpcFile.parse(npcsJson).npcs;
export const places = PlaceFile.parse(placesJson).places;
export const placeMaps = PlaceMapFile.parse(placeMapsJson).maps;
export const wix = WixFile.parse(wixJson);
export const epilogue = EpilogueFile.parse(epilogueJson);
const letterFile = LetterFile.parse(lettersJson);
export const letters = letterFile.letters;
export const letterReplies = letterFile.replies;
export const trustDcBonus = letterFile.trustDcBonus;

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
  gear,
  magicItems,
  encounters,
  loadouts,
  quests,
  awards,
  npcs,
  places,
  placeMaps,
  letters,
  roadTables,
};
export type GameData = typeof gameData;
