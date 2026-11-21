# Animation plan (milestone M11)

*Moved from the original plan (§9d). Read this only when working on animations.*

**Approach.** The rules engine resolves the action first (all rolls). It then sends a list of **presentation events** that the renderer plays back. Animation never decides outcomes, so a missed arrow visibly flies past the target.
Example event list: `projectile → impact → damageNumber → status → downed`. Each spell or attack gets a small JSON "VFX recipe" (`projectile: {sprite, count, arc, trail, speed}`, `area: {shape, size}`, `impactFx`, `statusIcon`).

| Effect | How it plays [inferred design] |
|---|---|
| Arrow / bolt | Arcs from the shooter to the target. A miss lands in the ground behind. |
| Flaming arrow | Same arrow plus a fire trail, a burst on impact, and a separate fire damage number. *Not a basic SRD 5.1 item: we'd add it as our own homebrew "Ember Arrow".* |
| Magic Missile | Three darts (one more per slot level above 1st). They can split between targets, always hit, and **strike simultaneously** per the rules text, so they launch in a quick fan and land together. Each dart shows its own 1d4+1 force number. |
| Fireball | A small bead streaks to a point and blooms into a 20-ft-radius explosion. Each target shows "Saved – half" or "Failed". |
| Color Spray | A 15-ft cone of shifting color. Targets are affected one by one in order of lowest HP first, and get a Blinded icon. Needs a **"reduce flashing" setting** for photosensitive players. |
| Burning Hands / Thunderwave | Cone / cube shapes using the same area system. |
| Healing | Rising green motes and a green number. |
| **Downed** | The token goes gray and tilts, with a small blood-drop icon and **death-save pips (3 successes / 3 failures)**. "Stable" icon when stabilized; a skull when dead. |

- **More D&D-specific animation ideas (phase 2) [inferred design]:**
  - **Dice moments:** a d20 rolls on screen for big rolls. Advantage/disadvantage shows two d20s with the dropped one fading. A natural 20 gets a gold flash; a natural 1 gets a "clunk".
  - **Damage-type colors** on floating numbers and impacts: fire orange, cold pale blue, lightning yellow, thunder shock-ring, acid green, poison sickly green, necrotic purple-black, radiant gold, force violet, psychic pink.
  - **Spell-school "cast" glows** on the caster before the effect: evocation ember, abjuration blue hexes, necromancy green smoke, enchantment pink motes, illusion shimmer, conjuration swirl, divination eye-glint, transmutation sparkle.
  - **Area previews before casting:** the cone, sphere or line is drawn on the grid with affected creatures highlighted, and a warning if allies are inside.
  - **Saving throws:** a shield icon on each target, then "Saved" or "Failed".
  - **Reactions:** a quick pause-and-flash banner ("Opportunity Attack!", "Shield!", "Counterspell!") so you understand why the turn was interrupted.
  - **Class signatures:** Rage aura (Barbarian), Sneak Attack slash (Rogue), Divine Smite radiant burst (Paladin), Bardic Inspiration note floating to an ally, Wild Shape puff (Druid), Action Surge speed lines (Fighter), Flurry of Blows multi-hit (Monk), Eldritch Blast beams (Warlock).
  - **Condition icons on tokens:** prone (token lies flat), grappled/restrained (chains), frightened, charmed, poisoned, blinded, paralyzed, invisible (token fades to an outline), and a ring for concentration that cracks when concentration is checked.
  - **Movement:** opportunity-attack danger shown on the planned path; the movement path is previewed with the feet remaining.
  - **Downed / death saves:** gray, tilted token, a small blood drop, and 3 success / 3 failure markers. A natural 20 on a death save springs the hero back up with 1 HP.
  - **Out of combat:** a level-up flourish, a lockpick mini-moment, trap triggers, and camp scenes at long rests (where Maelis's lantern-moth letters arrive).
- **Settings:** animation speed 1× / 2× / instant; reduce flashing; shake on/off.
- **Art:** effects can be drawn in code with particles (free, no licensing), or with free VFX sprite packs (credit required). Animated *characters* (walk, slash, shoot, cast, hurt) would come from LPC sprites, which replace the current round tokens. Decision **D12: tokens (v1) vs. animated sprites (v1.5)**.
- **Cost:** roughly 1 extra day: half a day for the event and animation system, then about 15–20 minutes per spell recipe [inferred]. Minimum: generic projectile + burst + floating numbers + downed state, then per-spell polish.
