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
EXTERNAL trust()
EXTERNAL kindled()

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
{ not flag("maelis_pass_met"):
    -> maelis_ridge
}
-> END

// ── Story_Review #6: Maelis in person, one last time before the Crowning ──
= maelis_ridge
~ set_flag("maelis_pass_met", true)
Above the pass, on a spur of black rock, a lantern is burning. Maelis Varrow stands beside it with her hood down, and the ash settles on her hair without touching the flame.
#speaker:maelis
"I wanted to see you before the Kiln. Once we're inside, there won't be time to talk."
{ flag("tarrow_confessed"): "Tarrow confessed, in the square, in front of everyone. I heard it from three people before I believed it. Thank you for that, whatever happens next." }
{ flag("tarrow_killed"): "Tarrow's dead. I used to dream about that. It turns out it doesn't help." }
{ flag("brannoc_will_testify"): "Brannoc says he'll stand up and tell them what he signed. I've hated him for ten years. I don't know what to do with that now." }
{ kindled() >= 2: She looks at the rings on your palms, wide as coins now. "You've taken its gifts. Then you know how kind it sounds. Don't pretend you don't." }
{ trust() >= 2: "You answered my letters, honestly, mostly. That's more than anyone in Ashford ever did." }
-> ridge_talk
= ridge_talk
* [Come down. Talk to us properly.]
    "I am talking to you properly. This is me being careful." She almost smiles. "If I come down, you'll try to stop me, and I'll have to stop you, and we'll never finish this conversation."
    -> ridge_talk
* [The crown isn't your family's. It's Cindrath's.]
    { flag("truth_crown") || flag("maelis_doubt"):
        "I know what the abbey records say. I know what the hag says." Her voice catches. "And at night it sounds exactly like my father. What would you do, if it sounded like yours?"
        ~ set_flag("maelis_doubt", true)
    - else:
        "Says who?" She shakes her head. "Find me proof, and I'll listen. Bring me a feeling, and I'll go on."
    }
    -> ridge_talk
* { has("corin") } [Come home, Mae. Mother asked me to tell you. #as:corin]
    The lantern flickers. For a moment she looks fourteen. "Don't," she says. "Don't use her voice. Not up here." But she doesn't turn away.
    ~ set_flag("maelis_trust", trust() + 1)
    -> ridge_talk
+ [We'll see you at the Kiln.]
    "Yes." She lifts the lantern. "Come quickly, if you're coming. It's getting harder to hear my own voice over its." Then she climbs into the ash, and the light goes with her.
    ~ note("Maelis met you above Ashfall Pass. She is going up to the King's Kiln to put on the crown. 'It's getting harder to hear my own voice over its.'")
    -> END
= leave_only
The pass is open. The ash keeps falling.
+ [Leave (to the map).]
    -> END
