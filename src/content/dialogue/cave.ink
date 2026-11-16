// The Steaming Cave: Scald, the Act I elite (Items.md).
// Engine hooks: see tavern.ink and src/content/README.md.
EXTERNAL has(tag)
EXTERNAL flag(name)
EXTERNAL set_flag(name, value)
EXTERNAL quest_step(quest, step)
EXTERNAL quest_done(quest)
EXTERNAL award(id)
EXTERNAL note(text)
EXTERNAL roller()
EXTERNAL leader()
EXTERNAL travel(where)
EXTERNAL fight(encounter, resume)
EXTERNAL give_item(id, qty)
EXTERNAL has_item(id)
EXTERNAL truth(id)
EXTERNAL set_act(n)
EXTERNAL trap(ability, dc, dice, type)

VAR passed = false

=== arrive ===
#speaker:cave
{ flag("won:e1-scald"):
    The cave still steams, but nothing breathes in it now except the springs.
    + [Leave (to the map).]
        -> END
}
Melted snow, scorched goats, a smell of hot copper. Something in the cave is snoring, and every snore makes the steam glow orange. (☠ Deadly at level 2, Hard at level 3.)
{ flag("wix_companion"):
    Wix has stopped twenty yards back and is hiding behind a rock. "Old Red's baby," he hisses. "Wix is guarding this rock. Very important rock."
}
* [Read the signs. #check:nature:12]
    { passed:
        {roller()} reads it plain: a red dragon wyrmling, newly hatched. Its breath fills a cone; spread out and it can only catch a few of you at once.
        ~ award("discover-scald")
    - else:
        Something big, something hot, and something that likes copper pots. That's all you can tell.
    }
    -> arrive
+ [Go in. #fight]
    ~ fight("e1-scald", "arrive.hoard")
    -> END
+ [Leave it sleeping (to the map).]
    -> END
= hoard
#speaker:cave
Scald lies still on its hoard of stolen pots. Under the copper is a fine grey cloak that doesn't burn, and two flasks of something that glows like embers.
~ give_item("cloak-of-protection", 1)
~ give_item("potion-of-fire-resistance", 2)
~ note("Scald, a red dragon wyrmling, is dead. It was hatched from an old clutch woken by the mountain's heat: something bigger and older is stirring.")
-> END
