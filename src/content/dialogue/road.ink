// The Ashford road after the ambush (F2): the goblin who stayed (Story_Bible §7, side quest part 1).
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

=== wix ===
#speaker:road
The last goblin isn't running. It's lying under a thornbush with its hands over its head, and it's talking very fast.
#speaker:wix
"Wait wait wait! Wix is too small to eat! Wix is mostly ears!"
~ set_flag("wix_met", true)
-> menu
= menu
* [Why are goblins raiding the road?]
    "Too hot up the mountain. Springs boil, goats cook standing up." He shivers. "The mountain is breathing. The Old Red is waking up. Wix says so and nobody listens."
    ~ award("discover-breathing")
    ~ note("A goblin named Wix says the mountain is 'breathing' and 'the Old Red' is waking. The goblins came down because the heights are too hot.")
    -> menu
* [Where are the missing miners?]
    "Grisk has them. Grisk Two-Teeth, big boss of the warren. He trades diggers to the hole-people for food." He points east. "Warren is that way. Wix is going the other way."
    ~ set_flag("knows_grisk", true)
    -> menu
+ [Go on, then. Run. Spare him.]
    "Wix will remember!" He's already ten yards off. "Wix is very good at finding people. And pies. Mostly pies."
    ~ set_flag("wix_spared", true)
    ~ quest_step("wix", "spare")
    ~ note("You spared a goblin scout named Wix on the Ashford road. He promised to 'remember.'")
    -> END
+ [Get out of my sight. #check:intimidation:10]
    { passed:
        Wix vanishes so fast he leaves a hat behind.
    - else:
        Wix squeaks, then bows, then runs. You're not sure which part was the insult.
    }
    ~ set_flag("wix_driven_off", true)
    ~ note("You drove off a goblin scout named Wix on the Ashford road.")
    -> END
