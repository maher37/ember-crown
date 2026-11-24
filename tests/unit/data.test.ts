import { describe, expect, it } from 'vitest';
import checklist from '../../docs/Data_Verify_Checklist.md?raw';
import {
  backgrounds,
  classes,
  dataFiles,
  difficulties,
  foes,
  gameData,
  magicItems,
  monsters,
  species,
  spells,
  spellSlots,
  weapons,
} from '../../src/data';
import { crossCheck } from '../../src/data/crossCheck';
import { DifficultyFile } from '../../src/data/schemas/difficulty';
import { verifyChecklistMarkdown } from '../../src/data/verifyList';

describe('data files', () => {
  it.each(dataFiles.map((f) => [f.name, f] as const))('%s passes its zod schema', (_name, file) => {
    const result = file.schema.safeParse(file.raw);
    expect(result.success, JSON.stringify(!result.success && result.error.issues.slice(0, 3))).toBe(
      true,
    );
  });

  it('has no broken links between files and no new number mismatches', () => {
    expect(crossCheck(gameData)).toEqual({ errors: [], warnings: [] });
  });

  it('docs/Data_Verify_Checklist.md is up to date (run `npm run verify-list`)', () => {
    expect(checklist).toBe(verifyChecklistMarkdown());
  });
});

describe('difficulties (D9)', () => {
  it('offers Easy, Medium and Hard in that order, Medium by default', () => {
    expect(difficulties.levels.map((l) => l.id)).toEqual(['easy', 'medium', 'hard']);
    expect(difficulties.default).toBe('medium');
  });

  it('rejects a file with a duplicated difficulty', () => {
    const level = (id: string) => ({ id, name: id, tag: 't', summary: ['x'] });
    const bad = { default: 'easy', levels: [level('easy'), level('easy'), level('hard')] };
    expect(DifficultyFile.safeParse(bad).success).toBe(false);
  });
});

// docs/Rules_Scope.md §3.
describe('species and backgrounds', () => {
  it('has the 9 species with the checked ability bonuses and speeds', () => {
    const summary = Object.fromEntries(species.map((s) => [s.id, [s.abilityBonuses, s.speed]]));
    expect(summary).toEqual({
      'hill-dwarf': [{ con: 2, wis: 1 }, 25],
      'high-elf': [{ dex: 2, int: 1 }, 30],
      'lightfoot-halfling': [{ dex: 2, cha: 1 }, 25],
      human: [{ str: 1, dex: 1, con: 1, int: 1, wis: 1, cha: 1 }, 30],
      dragonborn: [{ str: 2, cha: 1 }, 30],
      'rock-gnome': [{ int: 2, con: 1 }, 25],
      'half-elf': [{ cha: 2 }, 30],
      'half-orc': [{ str: 2, con: 1 }, 30],
      tiefling: [{ cha: 2, int: 1 }, 30],
    });
    expect(species.find((s) => s.id === 'half-elf')!.abilityChoice).toEqual({
      count: 2,
      amount: 1,
      exclude: ['cha'],
    });
  });

  it('has the 8 backgrounds with their two skills', () => {
    expect(Object.fromEntries(backgrounds.map((b) => [b.id, b.skills]))).toEqual({
      acolyte: ['insight', 'religion'],
      criminal: ['deception', 'stealth'],
      'folk-hero': ['animalHandling', 'survival'],
      sage: ['arcana', 'history'],
      soldier: ['athletics', 'intimidation'],
      outlander: ['athletics', 'survival'],
      urchin: ['sleightOfHand', 'stealth'],
      noble: ['history', 'persuasion'],
    });
  });
});

// docs/Rules_Scope.md §4 (hit dice, saves, subclass levels checked against the PHB).
describe('classes', () => {
  it('has all 12 with the checked hit die, saves and subclass level', () => {
    const summary = Object.fromEntries(
      classes.map((c) => [c.id, [c.hitDie, c.saves, c.subclass.level]]),
    );
    expect(summary).toEqual({
      barbarian: [12, ['str', 'con'], 3],
      bard: [8, ['dex', 'cha'], 3],
      cleric: [8, ['wis', 'cha'], 1],
      druid: [8, ['int', 'wis'], 2],
      fighter: [10, ['str', 'con'], 3],
      monk: [8, ['str', 'dex'], 3],
      paladin: [10, ['wis', 'cha'], 3],
      ranger: [10, ['str', 'dex'], 3],
      rogue: [8, ['dex', 'int'], 3],
      sorcerer: [6, ['con', 'cha'], 1],
      warlock: [8, ['wis', 'cha'], 1],
      wizard: [6, ['int', 'wis'], 2],
    });
  });

  it('uses the slot tables from Rules_Scope §4', () => {
    expect(spellSlots.full).toEqual([[2], [3], [4, 2], [4, 3], [4, 3, 2], [4, 3, 3]]);
    expect(spellSlots.half).toEqual([[], [2], [3], [3], [4, 2], [4, 2]]);
    expect(spellSlots.pact.map((p) => `${p.slots}x${p.slotLevel}`)).toEqual([
      '1x1',
      '2x1',
      '2x2',
      '2x2',
      '2x3',
      '2x3',
    ]);
  });

  it('gives every class an Ability Score Increase at level 4, and Extra Attack at 5 for martial classes', () => {
    for (const c of classes)
      expect(c.levels[3]!.features.map((f) => f.id)).toContain('ability-score-increase');
    for (const id of ['barbarian', 'fighter', 'monk', 'paladin', 'ranger'])
      expect(classes.find((c) => c.id === id)!.levels[4]!.features.map((f) => f.id)).toContain(
        'extra-attack',
      );
  });

  it('matches the resource counts named in Rules_Scope §4', () => {
    const res = (cls: string, id: string) =>
      classes.find((c) => c.id === cls)!.resources.find((r) => r.id === id)!;
    expect(res('barbarian', 'rage').perLevel).toEqual([2, 2, 3, 3, 3, 4]);
    expect(res('monk', 'ki').perLevel).toEqual([0, 2, 3, 4, 5, 6]);
    expect(res('sorcerer', 'sorcery-points').perLevel).toEqual([0, 2, 3, 4, 5, 6]);
    expect(res('cleric', 'channel-divinity').perLevel).toEqual([0, 1, 1, 1, 1, 2]);
  });
});

// docs/Rules_Scope.md §5.
describe('spells', () => {
  const named = [
    'fire-bolt',
    'ray-of-frost',
    'shocking-grasp',
    'acid-splash',
    'chill-touch',
    'eldritch-blast',
    'poison-spray',
    'sacred-flame',
    'vicious-mockery',
    'produce-flame',
    'shillelagh',
    'thorn-whip',
    'guidance',
    'spare-the-dying',
    'bless',
    'bane',
    'burning-hands',
    'color-spray',
    'command',
    'cure-wounds',
    'healing-word',
    'guiding-bolt',
    'inflict-wounds',
    'magic-missile',
    'shield',
    'mage-armor',
    'sleep',
    'thunderwave',
    'faerie-fire',
    'entangle',
    'hex',
    'hunters-mark',
    'hellish-rebuke',
    'armor-of-agathys',
    'shield-of-faith',
    'divine-favor',
    'sanctuary',
    'charm-person',
    'dissonant-whispers',
    'aid',
    'hold-person',
    'misty-step',
    'scorching-ray',
    'shatter',
    'spiritual-weapon',
    'moonbeam',
    'flaming-sphere',
    'spike-growth',
    'web',
    'lesser-restoration',
    'prayer-of-healing',
    'invisibility',
    'mirror-image',
    'silence',
    'heat-metal',
    'pass-without-trace',
    'branding-smite',
    'suggestion',
    'fireball',
    'lightning-bolt',
    'counterspell',
    'dispel-magic',
    'spirit-guardians',
    'revivify',
    'mass-healing-word',
    'hypnotic-pattern',
    'haste',
    'fly',
    'call-lightning',
    'conjure-animals',
    'hunger-of-hadar',
    'vampiric-touch',
    'fear',
    'slow',
  ];
  it.each(named)('includes %s', (id) => expect(spells.some((s) => s.id === id)).toBe(true));

  it('keeps the checked numbers for Fireball and Magic Missile', () => {
    const fireball = spells.find((s) => s.id === 'fireball')!;
    expect(fireball.area).toEqual({ shape: 'sphere', size: 20 });
    expect(fireball.range).toEqual({ feet: 150 });
    expect(JSON.stringify(fireball.effects)).toContain('"8d6"');
    expect(JSON.stringify(spells.find((s) => s.id === 'magic-missile')!.effects)).toContain(
      '"1d4+1"',
    );
  });

  it('marks concentration on the concentration spells', () => {
    for (const id of ['bless', 'hold-person', 'spirit-guardians', 'hex', 'haste'])
      expect(spells.find((s) => s.id === id)!.concentration).toBe(true);
    for (const id of ['fireball', 'cure-wounds', 'spiritual-weapon'])
      expect(spells.find((s) => s.id === id)!.concentration).toBe(false);
  });
});

// docs/Monster_Roster.md and docs/Items.md.
describe('monsters, foes and items', () => {
  it('has every monster in the roster', () => {
    expect(monsters.map((m) => m.id).sort()).toEqual(
      [
        'bandit',
        'grey-bruiser',
        'crown-shard',
        'bandit-captain',
        'thug',
        'scout',
        'guard',
        'veteran',
        'cultist',
        'cult-fanatic',
        'priest',
        'mage',
        'lizardfolk',
        'goblin',
        'hobgoblin',
        'orc',
        'bugbear',
        'wolf',
        'worg',
        'dire-wolf',
        'giant-rat',
        'swarm-of-rats',
        'giant-centipede',
        'stirge',
        'brown-bear',
        'giant-spider',
        'swarm-of-insects',
        'griffon',
        'owlbear',
        'skeleton',
        'zombie',
        'ghoul',
        'ghast',
        'shadow',
        'specter',
        'wraith',
        'wight',
        'animated-armor',
        'gargoyle',
        'earth-elemental',
        'fire-elemental',
        'magma-mephit',
        'hell-hound',
        'salamander',
        'ogre',
        'hill-giant',
        'fire-giant',
        'troll',
        'green-hag',
        'red-dragon-wyrmling',
        'young-red-dragon',
        'ember-wraith',
        // Familiar shapes (Find Familiar, Pact of the Chain).
        'bat',
        'cat',
        'frog',
        'hawk',
        'lizard',
        'octopus',
        'owl',
        'rat',
        'raven',
        'sea-horse',
        'spider',
        'weasel',
        'imp',
        'pseudodragon',
        'quasit',
        'sprite',
      ].sort(),
    );
  });

  it('keeps the AC, HP and CR read from the Monster Manual', () => {
    const m = (id: string) => monsters.find((x) => x.id === id)!;
    expect([m('goblin').ac, m('goblin').hp, m('goblin').cr]).toEqual([15, 7, '1/4']);
    expect([m('cult-fanatic').ac, m('cult-fanatic').hp, m('cult-fanatic').cr]).toEqual([
      13,
      33,
      '2',
    ]);
    expect([m('wraith').ac, m('wraith').hp, m('wraith').cr]).toEqual([13, 67, '5']);
    expect([m('fire-giant').ac, m('fire-giant').hp]).toEqual([18, 162]);
    expect([
      m('red-dragon-wyrmling').ac,
      m('red-dragon-wyrmling').hp,
      m('red-dragon-wyrmling').xp,
    ]).toEqual([17, 75, 1100]);
  });

  it('keeps flagged what the rulebook check could not read, and the homebrew (Data_Fixes.md §3)', () => {
    for (const id of ['zombie', 'earth-elemental', 'grey-bruiser', 'ember-wraith', 'crown-shard'])
      expect(monsters.find((m) => m.id === id)!.verify).toBe(true);
  });

  it('clears the flag on monsters checked against the MM (Data_Fixes.md §2)', () => {
    for (const id of ['orc', 'magma-mephit', 'young-red-dragon', 'goblin', 'fire-giant'])
      expect(monsters.find((m) => m.id === id)!.verify).toBeUndefined();
  });

  it('applies the rulebook fixes (Data_Fixes.md §1)', () => {
    // MM: Brown bear bite and claws are +5 to hit.
    const bear = monsters.find((m) => m.id === 'brown-bear')!;
    for (const a of bear.actions) {
      const atk = a.effects.find((e) => e.type === 'attack');
      if (atk && atk.type === 'attack') expect(atk.toHit).toBe(5);
    }
    // PHB spell schools and ranges.
    const sp = (id: string) => spells.find((s) => s.id === id)!;
    expect(sp('revivify').school).toBe('conjuration');
    expect(sp('protection-from-evil-and-good').range).toBe('touch');
    const feet: [string, number][] = [
      ['prestidigitation', 10],
      ['dancing-lights', 120],
      ['feather-fall', 60],
      ['fog-cloud', 120],
      ['beacon-of-hope', 30],
      ['sleet-storm', 150],
    ];
    for (const [id, ft] of feet) expect(sp(id).range).toEqual({ feet: ft });
    // Only gust-of-wind (unreadable scan) is still flagged.
    expect(spells.filter((s) => s.verify).map((s) => s.id)).toEqual(['gust-of-wind']);
  });

  it('has the three elites and their rewards (Items.md)', () => {
    const elites = foes.filter((f) => f.role === 'elite');
    expect(elites.map((f) => [f.id, f.base, f.reward])).toEqual([
      ['scald', 'red-dragon-wyrmling', ['cloak-of-protection', 'potion-of-fire-resistance']],
      ['drowned-abbot', 'wraith', ['mace-of-disruption', 'staff-of-healing']],
      ['vorrag', 'fire-giant', ['dragon-slayer']],
    ]);
  });

  it('knocks out the named villains instead of killing them (Rules_Scope §1)', () => {
    expect(foes.filter((f) => f.knockedOutAtZero).map((f) => f.id)).toEqual([
      'brother-ulric',
      'maelis',
    ]);
  });

  it('has the story items from every act', () => {
    for (const act of [1, 2, 3])
      expect(magicItems.filter((i) => i.act === act).length).toBeGreaterThanOrEqual(4);
    expect(magicItems.find((i) => i.id === 'potion-of-healing')!.effects).toEqual([
      { type: 'heal', dice: '2d4+2' },
    ]);
  });

  it('has the PHB weapon table', () => {
    expect(weapons).toHaveLength(36);
    expect(weapons.find((w) => w.id === 'longsword')).toMatchObject({
      damage: { dice: '1d8', type: 'slashing' },
      versatile: '1d10',
    });
  });
});
