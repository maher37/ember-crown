// The goblin warren: F3 (gate), F4 (Grisk), the miners, and Wix's luck-stone (Story_Bible §7, rest block B).
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
#speaker:warren
{ not (flag("won:f3-warren-gate") || flag("gate_passed")):
    -> gate
}
{ not (flag("won:f4-grisk") || flag("grisk_dealt")):
    -> hall
}
{ not flag("miners_rescued"):
    -> miners
}
-> inside

= gate
A cave mouth in a fold of the hills, ringed with stolen mine carts. Two wolves are chained across it, too thin and too awake. Goblin archers watch from the rocks.
+ [Charge the gate. #fight]
    ~ fight("f3-warren-gate", "arrive.after_gate")
    -> END
+ [Sneak past while the wolves doze. #check:stealth:13]
    { passed:
        You pick your way along the rock wall in single file. One wolf lifts its head, sniffs, and puts it down again.
        -> passed_gate
    - else:
        A loose stone skitters. Both wolves come up snarling, and an archer yells.
        ~ fight("f3-warren-gate", "arrive.after_gate")
        -> END
    }
+ {has("class:druid") || has("class:ranger")} [Calm the wolves with a little food. #check:animalHandling:12]
    { passed:
        {roller()} tosses dried meat to the starving wolves. They forget about everything else in the world.
        -> passed_gate
    - else:
        The wolves take the meat and want the hand too.
        ~ fight("f3-warren-gate", "arrive.after_gate")
        -> END
    }
+ [Back away (to the map).]
    -> END
= passed_gate
~ set_flag("gate_passed", true)
~ award("f3-sneak")
~ quest_step("old-mine", "warren-gate")
-> hall
= after_gate
The last archer drops behind the rocks. The tunnels beyond smell of smoke and wet dog.
~ quest_step("old-mine", "warren-gate")
-> hall

= hall
#speaker:grisk
{ not flag("met_grisk"):
    #speaker:warren
    Grisk Two-Teeth sits on a throne of mine carts, gnawing a goat bone. Behind him, in a pen of lashed timbers, six filthy miners shout for help.
    #speaker:grisk
    "Grisk trades," he says, before you speak. "Diggers for food. Lots of food. Or Grisk trades you to the hole-people too."
    ~ set_flag("met_grisk", true)
}
* [Why take the miners at all?]
    "Mountain is hot. Warren is hungry." He spits out a splinter of bone. "Hole-people with the stars pay for diggers. Grisk is not stupid. Grisk is hungry."
    -> hall
+ [Trade our rations for the miners. #check:persuasion:13]
    { passed:
        Grisk weighs your packs in one hand. "Hm. Good trade. Grisk likes you. Take the noisy ones."
        ~ award("f4-trade")
        -> dealt
    - else:
        "That? That is a snack." He stands up. He keeps standing up for longer than seems possible. "Grisk will take the rest himself."
        ~ fight("f4-grisk", "arrive.after_grisk")
        -> END
    }
+ [Slip round to the pen while he eats. #check:stealth:15]
    { passed:
        Grisk is very involved with his goat. You cut the pen lashings and the miners crawl out after you, sobbing with relief.
        ~ award("f4-trade")
        -> dealt
    - else:
        A miner cries out your name. Grisk turns, still chewing.
        ~ fight("f4-grisk", "arrive.after_grisk")
        -> END
    }
+ [Fight him. #fight]
    ~ fight("f4-grisk", "arrive.after_grisk")
    -> END
+ [Leave (to the map).]
    -> END
= dealt
~ set_flag("grisk_dealt", true)
~ quest_step("old-mine", "grisk")
-> miners
= after_grisk
#speaker:warren
Grisk goes down like a felled pine. The remaining goblins scatter into side tunnels, wailing.
~ quest_step("old-mine", "grisk")
-> miners

= miners
#speaker:miners
The miners are grey with dust and shaking. As they climb out of the pen, their shirts gape open: every one of them wears a little tin pendant, a hollow eight-pointed star.
"Please," the eldest says. "Don't tell our wives. The Star pays a fair wage, which is more than the Guild ever did. We dig where they tell us."
* [Where do they tell you to dig?]
    "The old Varrow seam, under the mine. Deeper than anyone's gone since the Collapse." He swallows. "Brother Ulric says there's something down there that'll make Ashford whole."
    ~ note("The rescued miners dig for the Hollow Star in the old Varrow seam, under Brother Ulric.")
    -> miners
+ [Your secret's safe. Go home.]
    "Bless you." They go, quick and quiet.
    ~ set_flag("miners_secret_kept", true)
    -> rescued
+ [Your families deserve the truth. Tell them yourselves.]
    The eldest nods slowly. "Aye. Maybe they do."
    ~ set_flag("miners_told", true)
    -> rescued
= rescued
~ set_flag("miners_rescued", true)
~ quest_step("old-mine", "miners")
~ award("miners-rescued")
~ note("The miners are free. They wear the Hollow Star: the cult pays them to dig in the old mine.")
-> inside

= inside
#speaker:warren
{ flag("luck_stone_taken"):
    The warren is quiet now. Somewhere deep in it, a goblin is crying about pie.
- else:
    The warren's tunnels branch away into smoke and dark. The old mine lies a short walk west.
}
+ {flag("pies_settled") && not flag("luck_stone_taken")} [Find the shrine with Wix's luck-stone.]
    -> shrine
+ [Leave the warren (to the map).]
    -> END

= shrine
A niche of goblin skulls and copper pots, and in the middle of it a smooth grey stone that seems to catch more light than it should. A hobgoblin keeper sits beside it, sharpening a spear.
+ [Steal it while the keeper dozes. #check:sleightOfHand:14]
    { passed:
        {roller()} swaps the luck-stone for a river pebble. The keeper never looks up.
        ~ award("luck-stone-sneak")
        -> got_stone
    - else:
        The keeper's spear comes up faster than seems fair.
        ~ fight("s4-luck-stone", "arrive.after_stone")
        -> END
    }
+ [Take it by force. #fight]
    ~ fight("s4-luck-stone", "arrive.after_stone")
    -> END
+ [Not yet.]
    -> inside
= after_stone
The keeper slumps against the skulls. The luck-stone is warm in your hand.
-> got_stone
= got_stone
~ set_flag("luck_stone_taken", true)
~ give_item("luck-stone", 1)
~ quest_step("wix", "luck-stone")
~ set_flag("wix_companion", true)
~ note("You recovered Wix's clan luck-stone. 'The luck goes with whoever brought it home,' so it's yours. Wix will meet you at camp.")
#speaker:wix
Wix is waiting outside the warren, of course. "The luck goes with whoever brought it home," he says, folding your fingers over the stone. "Clan rule. Also Wix comes with you now. Also clan rule. Wix just made it."
-> END
