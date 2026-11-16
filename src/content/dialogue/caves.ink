// Wix's Homecoming (side quest): the clan caves and the giant at the door.
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
#speaker:caves
{ quest_done("wix-home"):
    -> leave_only
}
#speaker:wix
"Home!" Wix bounces on his toes. "Well. Home's door. Home's door has a giant in it."
#speaker:caves
A hill giant has wedged itself into the clan's front entrance and is eating the clan's goats one at a time, with an ogre to fetch them. Behind it, a hundred goblin eyes glint in the dark.
~ quest_step("wix-home", "clan")
+ [Get the giant out of the door. #fight]
    ~ fight("s12-wix-giant", "arrive.after_fight")
    -> END
+ [Leave (to the map).]
    -> END
= after_fight
#speaker:chief
Chief Mog climbs over the giant's belly and shakes everyone's hand twice. "Wix said you were friends. Wix says a lot of things. This one was true." He presses a lumpy grey bag into your hands. "Clan gift. Mostly badgers inside."
~ give_item("wixs-clan-gift", 1)
~ set_flag("wix_backway", true)
~ quest_step("wix-home", "giant")
#speaker:wix
"And!" says Wix. "The clan knows the back way into the Kiln. The Old Red's back door. Nobody uses it. Because of the Old Red."
~ note("Wix's clan showed you a back way into the King's Kiln: it skips half of the Hollow Star's last stand.")
-> END
= leave_only
The clan caves are noisy and smell of goat. Somebody is singing a very long song about Wix.
+ [Leave (to the map).]
    -> END
