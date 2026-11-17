// Ammarindar's Great Forge: Vorrag the Kiln-Smith (Act III elite) and Dragon Slayer.
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
EXTERNAL give_gold(n)
EXTERNAL gold()
EXTERNAL truths()
EXTERNAL speech()
EXTERNAL regain_slot()

VAR passed = false

=== arrive ===
#speaker:forge
{ flag("vorrag_done"):
    -> leave_only
}
Hammering shakes the cavern. At the great Ammarindar anvil a fire giant is beating a blade out of something that glows like a sunset. (☠ Deadly at level 5, Hard at level 6.)
#speaker:vorrag
"Small smiths," rumbles Vorrag the Kiln-Smith, not looking up. "You smell of the crown. When it is made, I will wear it, and every forge under the mountain will be mine."
-> talk
= talk
* [What are you forging?]
    "A blade to kill a dragon. The old one under the Kiln will not like my crown." He turns the blade in the light. "Earn it, and it is yours."
    -> talk
+ [A contest of strength, then. #check:athletics:18]
    -> contest
+ {has("species:hill-dwarf") || has("species:rock-gnome")} [A smithing contest. Our hands against yours. #check:history:16]
    -> contest
+ [Fight him for it. #fight]
    ~ fight("e3-vorrag", "arrive.after_fight")
    -> END
+ [Leave (to the map).]
    -> END
= contest
{ passed:
    Vorrag laughs until the cavern rings. "Small, but true!" He sets the dragon-blade in your hands, still warm. "Kill the old one with it. Then we are even."
    ~ award("e3-contest")
    -> blade
- else:
    "No," says Vorrag kindly, and picks up a sword the size of a door. "Now we do it the other way."
    ~ fight("e3-vorrag", "arrive.after_fight")
    -> END
}
= after_fight
#speaker:forge
Vorrag goes down like a collapsing chimney. On his anvil lies the blade he was making.
-> blade
= blade
~ set_flag("vorrag_done", true)
~ give_item("dragon-slayer", 1)
~ note("Vorrag's dragon-blade (Dragon Slayer): +1, and 3d6 more damage against dragons, including Cindrath.")
-> END
= leave_only
The great anvil is cold. Somebody has scratched a small, rude giant on it.
+ [Leave (to the map).]
    -> END
