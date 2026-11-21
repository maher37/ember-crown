// The Abbey of the Morninglord: F13 (cloister), F14 (undercroft, Venna), the archives,
// The Fallen Paladin's Shield (side quest) and the Drowned Abbot (Act II elite).
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

VAR passed = false

=== arrive ===
#speaker:abbey
{ not flag("won:f13-cloister"):
    -> gate
}
-> hub

= gate
A ruined abbey of Lathander on the marsh edge, its sunrise windows long since broken. Grey-robed diggers carry baskets of spoil out of the cloister, and the whole place is warm underfoot.
{ flag("gave_shard"):
    Somewhere below, Maelis's shard is calling to its sister. You came to take one of them back.
}
+ [Break into the cloister. #fight]
    ~ fight("f13-cloister", "arrive.after_cloister")
    -> END
+ [Leave (to the map).]
    -> END
= after_cloister
The cloister garden is yours. Stairs lead down to the undercroft, a side door to the old chapel, and somewhere water drips into a flooded crypt.
~ quest_step("hollow-star", "cloister")
-> hub

= hub
#speaker:abbey
{ flag("act2_complete"):
    The abbey is quiet. Novices from Marrowmere have started sweeping the cloister.
}
+ {not quest_done("paladin-shield")} [Search the old chapel.]
    -> chapel
+ {not flag("won:e2-drowned-abbot")} [The sealed door to the lower crypt (☠ elite).]
    -> abbot
+ {not flag("won:f14-undercroft")} [Go down to the undercroft. #fight]
    #speaker:venna
    "Lathander's priests sealed his fire under this floor and called it holy," Sister Venna says from the altar, "Let it burn the Guild's town, and the town that let them take it." The ogre beside her grins.
    ~ fight("f14-undercroft", "arrive.after_undercroft")
    -> END
+ {flag("won:f14-undercroft") && not flag("act2_complete")} [Read the archives.]
    -> archives
+ [Leave (to the map).]
    -> END

= chapel
#speaker:abbey
{ not flag("shield_clue"):
    A painted wall shows the abbey's founder, Mother Aldis, a paladin with a sun-shield. Below it: "She took her shield down with her, to keep the fire asleep."
    ~ set_flag("shield_clue", true)
    ~ quest_step("paladin-shield", "clue")
}
* [Study the sealed crypt door. #check:religion:12]
    { passed:
        {roller()} knows the rite: the door was sealed with Lathander's sun, and someone has scratched the sun out. The seal is broken. Whatever is down there can get out.
        ~ award("discover-sun")
    - else:
        A sun carving, scratched over. Vandals, or worse.
    }
    -> chapel
+ {not flag("won:s7-paladin-crypt")} [Go down into the flooded crypt. #fight]
    ~ fight("s7-paladin-crypt", "arrive.after_crypt")
    -> END
+ {flag("won:s7-paladin-crypt") && not quest_done("paladin-shield")} [Restore the shield at the shrine.]
    -> restore
+ [Back to the cloister.]
    -> hub
= after_crypt
#speaker:abbey
In Mother Aldis's tomb, under black water, lies a shield with a tarnished sunburst. It's cold to the touch, even here.
~ quest_step("paladin-shield", "crypt")
-> chapel
= restore
#speaker:abbey
You set the shield on the chapel's broken altar and clean the sunburst. When the first light comes through the windows, the shield takes it, and holds it.
~ quest_step("paladin-shield", "restore")
~ give_item("shield-of-the-morninglord", 1)
~ note("Mother Aldis's shield, restored: the Shield of the Morninglord. While you hold it, fire hurts less.")
-> hub

= abbot
#speaker:abbey
Behind a door stamped with a scratched-out sun, water laps at the top step. Something under it is praying, backwards. (☠ Deadly at level 4, Hard at level 5. Its touch drains maximum HP until a long rest.)
+ [Go down. #fight]
    ~ fight("e2-drowned-abbot", "arrive.abbot_reward")
    -> END
+ [Not yet.]
    -> hub
= abbot_reward
#speaker:abbey
The Drowned Abbot comes apart like wet paper. On his tomb lie two relics of the old abbey: a flanged mace that hums near the dead, and a staff of white ash wound with sun-gold. You can carry only one out through the water.
+ [Take the mace (Mace of Disruption). #item:mace-of-disruption]
    ~ give_item("mace-of-disruption", 1)
    -> hub
+ [Take the staff (Staff of Healing). #item:staff-of-healing]
    ~ give_item("staff-of-healing", 1)
    -> hub

= after_undercroft
#speaker:abbey
Sister Venna lies at the foot of the drowned altar. On it, in a ring of guttering candles, is the second shard, warm as a hand.
~ quest_step("hollow-star", "undercroft")
~ set_flag("has_shard2", true)
{ has("corin"):
    It says Corin's name, quite clearly, and everyone hears it.
}
~ note("You took the second crown shard from Sister Venna in the abbey undercroft.")
-> hub

= archives
#speaker:abbey
The abbey's archive is a dry room above the flood line. In a locked chest is the founder's own account, in Mother Aldis's hand: King Varrow's crown was forged around the heart-ember of Cindrath, an ancient red dragon, to bind her. It is not a crown. It is her prison, and her way back.
~ truth("crown")
"Whoever wears it," Aldis wrote, "will hear a voice they love, and it will be the dragon."
{ has("corin"):
    Corin reads it twice. "Maelis doesn't know," he says. "She thinks it's family."
- else:
    Maelis doesn't know. She thinks the voice is family.
}
~ quest_step("hollow-star", "archives")
~ set_flag("act2_complete", true)
~ note("The abbey archives: the crown is Cindrath's soul-vessel, made to bind the dragon. Whoever wears it hears a loved voice that is really Cindrath. Maelis doesn't know.")
~ set_act(3)
Act II ends here. Make camp tonight: a lantern moth is already on its way. The high Greypeaks are open on the map. #style:card
-> hub
