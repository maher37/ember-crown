// The Old Mine: F5 (mine mouth), F6 (Deep Seam), the Ammarindar halls, F7 (Ulric), the shard and Maelis (Story_Bible §7, rest block C).
// Engine hooks: see tavern.ink and src/content/README.md.
// The mine is a walk-around map (src/data/placeMaps.json): each area's stitch is started from
// its spot on the map, and ends back on the map.
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

VAR passed = false

=== arrive ===
#speaker:mine
{ flag("act1_complete"):
    The mine mouth is quiet. Somewhere far below, the stone ticks as it cools, like something sleeping.
    -> leave_only
}
{ not (flag("won:f5-mine-mouth") || flag("mouth_cleared")):
    -> mouth
}
{ not flag("won:f6-deep-seam"):
    -> seam
}
{ not flag("found_halls"):
    -> halls
}
{ not (flag("won:f7-sunken-shrine") || flag("parley:f7-sunken-shrine")):
    -> shrine
}
-> maelis


= leave_only
+ [Back.]
    -> END
= back
-> END

= mouth
Fresh spoil heaps, new timbers, and a crane that wasn't there ten years ago. A dozen diggers in grey robes stop work as you come up the track. Their foreman hefts a pick handle.
#speaker:diggers
"Private dig," he calls. "Hollow Star business. Turn round."
* [What are you digging for?]
    "Wages." He shrugs. "Ulric says there's an old dwarf shrine below the Varrow seam. We dig, he pays, nobody asks."
    -> mouth
+ {flag("miners_rescued")} [Your friends from the warren are safe. Go home to your families. #check:persuasion:10]
    -> talk
+ [None of this is worth dying for. Walk away. #check:persuasion:13]
    -> talk
+ [Stand aside or be moved. #fight]
    ~ fight("f5-mine-mouth", "arrive.after_mouth")
    -> END
+ [Back.]
    -> END
= talk
{ passed:
    The diggers look at each other. One by one the picks go down. "Ulric pays," the foreman mutters, "but not that much." They file away down the track.
    ~ set_flag("mouth_cleared", true)
    ~ award("f5-talk")
    ~ quest_step("old-mine", "mine-mouth")
    The shaft is open. A miners' tunnel leads down into the dark.
    -> back
- else:
    "Brave talk," says the foreman, and the knives come out.
    ~ fight("f5-mine-mouth", "arrive.after_mouth")
    -> END
}
= after_mouth
#speaker:mine
The last of the diggers flees down the track. The shaft breathes warm air at you, like an oven door left open.
~ quest_step("old-mine", "mine-mouth")
-> back

= seam
#speaker:mine
The old Varrow seam runs down into the dark, warm as a bread oven. Pale things move in the cracks of the walls.
+ [Press on into the seam. #fight]
    ~ fight("f6-deep-seam", "arrive.after_seam")
    -> END
+ [Not yet. Go back and rest first.]
    -> END
= after_seam
The centipedes lie curled and still. Past their nest, the rough miners' tunnel meets something older: smooth-cut dwarven stone.
~ quest_step("old-mine", "deep-seam")
-> back

= halls
#speaker:mine
A sealed archway carved with dwarven runes and a hammer-and-anvil. Ammarindar: the dwarf kingdom that ruled under these mountains before it fell.
+ [Read the runes. #check:history:12]
    { passed:
        {roller()} traces the runes: a warding for "the deep forge-guard" and, scratched in later and badly, a miner's mark pointing down. The catch is behind the anvil.
        ~ award("discover-runes")
    - else:
        The runes stay stubborn. In the end it's the miners' newer scratches that show you the way: a catch hidden behind the anvil.
    }
    -> opened
+ {has("species:hill-dwarf")} [Dwarves made this. Let me feel for the catch. #as:species:hill-dwarf]
    {roller()}'s hands find the hidden catch without looking, the way you find a stair in your own house. The arch grinds open.
    ~ award("discover-runes")
    -> opened
+ {has_item("crowbar")} [Lever the arch open with a crowbar. #gear:crowbar]
    The crowbar finds the seam between the stones. One long heave, and the old catch gives with a crack like a knuckle.
    -> opened
+ [Back.]
    -> END
= opened
~ set_flag("found_halls", true)
~ quest_step("old-mine", "halls")
~ award("ammarindar-halls")
~ note("Below the Varrow seam lie the old Ammarindar halls, and a shrine half-drowned in warm water.")
Beyond the arch, stairs lead down toward the sound of water.
-> back

= shrine
#speaker:mine
Stairs go down into a hall half-full of steaming water. At its far end, a drowned shrine; on its altar, something glows like a coal. A broad grey-bearded man with a lantern-hook for a hand stands before it.
{ has("corin"):
    The glow brightens as Corin steps closer. Under the hiss of the water, something says his name.
}
#speaker:ulric
"So Brannoc's town sends heroes now." Brother Ulric doesn't turn round. "Go home. This is for the widows of the Collapse, and it's nearly done."
* [What is that thing on the altar?]
    "A piece of a crown. King Varrow's own. Lady Maelis says it'll make this valley rich again." His voice wavers. "It whispers, mind. Don't listen to it."
    -> shrine
* {flag("knows_ulric")} [Brannoc sent us. He says you were his shift partner.]
    That turns him round. "Brannoc." Something in his face cracks. "Then he should've come himself." The skeletons in the water begin to stir anyway. (Brannoc's name will make talking him down easier.)
    -> shrine
+ [Step down into the shrine. #fight]
    ~ fight("f7-sunken-shrine", "arrive.after_shrine")
    -> END
+ [Not yet. Go back and rest.]
    -> END
= after_shrine
{ flag("parley:f7-sunken-shrine"):
    #speaker:ulric
    Ulric sits down heavily on the altar step. "Take it. Tell Brannoc… tell him I'm sorry about the pensions." He looks at the shard like it bit him. "If you need a way into the deep places, later, I'll know one."
    ~ set_flag("ulric_spared", true)
    ~ note("Brother Ulric yielded and gave up the shard. He may turn up again with a way into the deep places.")
- else:
    #speaker:mine
    Brother Ulric lies still in the warm water. Back in Ashford, someone will have to tell Brannoc.
    ~ set_flag("ulric_dead", true)
    ~ set_flag("ulric_killed", true)
    ~ note("Brother Ulric is dead. He was Brannoc's old shift partner.")
}
#speaker:mine
In a tomb niche behind the altar, a dwarf king's guard sleeps in stone, his warhammer laid across his chest: Deepdelver, its head still bright.
~ give_item("deepdelver", 1)
The shard is warm, and heavier than it should be. When you hold it the steam stops stinging, and at the edge of hearing something old and patient says: "Closer."
~ set_flag("has_shard", true)
~ quest_step("old-mine", "shrine")
~ note("You took the first crown shard. It whispers. Holding it, fire seems to sting less.")
Somewhere above, at the mine mouth, a red lantern is burning.
-> back

= maelis
#speaker:mine
When you climb back out into the evening, someone is waiting at the mine mouth: a woman in a dark travelling cloak, unarmed, with a hooded lantern burning red.
#speaker:maelis
{ has("corin"):
    "Corin." For a moment she's just his sister, and she looks as if she might cry. "You came home."
- else:
    "You're the ones from the Lantern." She pushes back her hood. "My name is Maelis Varrow. I think you've heard my family's name spat on, by now."
}
-> meet
= meet
* [Who are you, really?]
    "Hadric Varrow's daughter. He was foreman when the seam came down, and this town hanged the blame on him because it was cheaper than the truth." Her voice never rises. "I'm the one making them say it out loud."
    -> meet
* [What do you want with the shard?]
    "There's a crown, in pieces. King Varrow's. Put together, it can wake the deep forges and make this valley what it was." She hesitates. "And make Ashford look at what it did."
    -> meet
* {has("corin")} [Maelis, what are you doing? #as:corin]
    "What you ran away from doing, little brother." She takes his hands. "Stand with me. Just this once, let a Varrow win."
    ~ set_flag("corin_reunion", true)
    -> meet
+ [No. The shard stays with us.]
    She nods, as if she expected it. "Then we'll talk again, when you've seen more of this town." She turns down the track. "The Grey Company is already marching for the Marsh of Chelimber. The second shard is there. Don't let the Guild have it."
    -> done
+ [Take it. It's yours by right.]
    ~ set_flag("gave_shard", true)
    ~ set_flag("has_shard", false)
    She takes the shard as if it might break. "Thank you. You don't know what that means." She hesitates. "The Grey Company is already marching for the Marsh of Chelimber, after the second shard. Watch yourselves."
    -> done
= done
~ quest_step("old-mine", "maelis")
~ set_flag("act1_complete", true)
~ note("Maelis Varrow, the hooded woman from Lantern Night, met you at the mine mouth. The Grey Company is marching to the Marsh of Chelimber for the second shard.")
~ set_act(2)
#speaker:mine
Act I ends here. The marsh roads are open on the map. #style:card
-> END

// ── Things to find (search spots on the mine map) ──

= cart
#speaker:mine
An ore cart lies on its side by the track, one wheel still turning in the wind. The diggers left in a hurry.
+ [Search it. #check:investigation:12]
    { passed:
        Under the spilled ore, {roller()} finds a strongbox: a week of the Hollow Star's wages, never paid out.
        ~ give_gold(25)
    - else:
        A few coins in the spilled ore, and a lot of grit under your nails.
        ~ give_gold(8)
    }
    ~ set_flag("mine_cart", true)
    -> back
+ [Leave it.]
    -> END

= memorial
#speaker:mine
Where the old tunnel meets the shaft, someone has carved names into the rock: thirty of them, in neat miners' capitals, with candle stubs beneath. Between two of the names is a gap the width of one more.
{ flag("truth_collapse"):
    You know whose name belongs in the gap. The town left Hadric Varrow out on purpose.
}
{ has("corin"):
    Corin looks at the gap for a long time and says nothing at all.
}
~ set_flag("mine_memorial", true)
+ [Light a candle for the thirty-one.]
    The flame stands straight up in the still air. For a moment the mine feels less hungry.
    -> back

= alcove
#speaker:mine
A side chamber off the dwarven hall: stone shelves, a cold brazier, and clay jars sealed with wax and stamped with a hammer.
+ [Open the jars carefully. #check:perception:13]
    { passed:
        Most are dust. One holds a dwarven healing draught, still bright red after centuries.
        ~ give_item("potion-of-healing", 1)
    - else:
        Dust, dust, and a jar of something that used to be pickles.
    }
    ~ set_flag("mine_alcove", true)
    -> back
+ [Leave them be.]
    -> END
