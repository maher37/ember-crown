// Ashfall Pass: F15, the ogres' toll (Act III).
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
#speaker:pass
{ flag("pass_cleared"):
    -> leave_only
}
Ash falls like grey snow on the road into the high Greypeaks. Two ogres have rolled boulders across the pass and sit on them, singed and starving.
#speaker:pass
"FOOD," says the bigger ogre. "All food. Then walk."
-> talk
= talk
* [Read the ash. #check:nature:13]
    { passed:
        {roller()} rubs the ash between finger and thumb: not ash from wood. It's the mountain's own breath, stone burned to powder. Something under the Kiln is waking fast.
        ~ award("discover-ash")
    - else:
        Grey, gritty, everywhere. It gets in your teeth.
    }
    -> talk
+ {has_item("rope")} [Rope up and climb round the boulders on the cliff path. #check:athletics:12 #gear:rope]
    { passed:
        Hand over hand along the rope, above the drop, and down again behind the ogres before they finish arguing about which of them is hungrier.
        ~ award("f15-pay")
        -> cleared
    - else:
        A loose stone clatters down onto the bigger ogre's head. He looks up. "FOOD," he says, and reaches for his club.
        ~ fight("f15-ashfall-pass", "arrive.after_fight")
        -> END
    }
+ [Pay the toll: all our food.]
    The ogres eat it all on the spot, wrappers and all, and roll one boulder aside. "Good walkers," says the big one, chewing.
    ~ award("f15-pay")
    -> cleared
+ [Clear the road. #fight]
    ~ fight("f15-ashfall-pass", "arrive.after_fight")
    -> END
+ [Leave (to the map).]
    -> END
= after_fight
#speaker:pass
The ogres lie in the ash. The pass is open.
-> cleared
= cleared
~ set_flag("pass_cleared", true)
~ quest_step("kings-kiln", "pass")
~ note("Ashfall Pass is open. The King's Kiln and Ammarindar's Great Forge are on the map now.")
-> END
= leave_only
The pass is open. The ash keeps falling.
+ [Leave (to the map).]
    -> END
