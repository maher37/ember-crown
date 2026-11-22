// The King's Kiln: F16-F21, Ser Ida, the Cold Forge, and the Crowning (Story_Bible Act III, §8).
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
EXTERNAL ember()

VAR passed = false

// The Kiln is a walk-around map (src/data/placeMaps.json): each area's stitch starts from its
// spot on the map and ends back there.

=== arrive ===
#speaker:kiln
{ not (flag("won:f16-kiln-gate") || flag("won:f16-kiln-gate-kell")):
    -> gate
}
{ not flag("gate_open"):
    -> puzzle
}
{ not flag("won:f17-furnace-halls"):
    -> halls
}
{ not flag("seal_broken"):
    -> seal
}
{ not (flag("won:f18-honor-guard") || flag("ida_aside")):
    -> honor
}
-> hub

= gate
King Varrow's tomb is cut into the mountain's heart: a gate of black iron forty feet high, flanked by stone pillars with wings.
{ flag("kell_respect") || flag("kell_owes"):
    #speaker:kell
    Boots on the road behind you. Captain Kell and thirty Grey Company soldiers come up through the ash. "Cult rearguard's coming up the pass. We'll hold them. You go in." He grins. "I owe you a bridge."
    ~ set_flag("kell_at_gate", true)
    #speaker:kiln
}
+ [Break through the gate. #fight]
    { flag("kell_at_gate"):
        ~ fight("f16-kiln-gate-kell", "arrive.after_gate")
    - else:
        ~ fight("f16-kiln-gate", "arrive.after_gate")
    }
    -> END
+ [Back.]
    -> END
= after_gate
~ quest_step("kings-kiln", "gate")
{ flag("sneaked:f16-kiln-gate") || flag("sneaked:f16-kiln-gate-kell"):
    The gargoyles settle back onto their pillars behind you. Ahead, a door with no handle waits.
- else:
    The gate's guards are down. Beyond it, a door with no handle waits.
}
-> back
= back
-> END

= puzzle
#speaker:kiln
The gate has no handle: only a ring of nine bronze dials, each stamped with a rune, and a slot shaped like a crown shard.
+ [Work out the dials. #check:arcana:15]
    -> solve
+ [Search for the mechanism. #check:investigation:15]
    -> solve
+ {has_item("thieves-tools")} [Pick the mechanism with thieves' tools. #check:sleightOfHand:12 #gear:thieves-tools]
    -> solve
+ [Back.]
    -> END
= solve
{ passed:
    {roller()} sees it: the runes don't open the gate, they lock it from the outside. This door was built to keep something in. The dials turn, and the gate swings inward without a sound.
    ~ award("discover-gate")
- else:
    A wrong dial. Fire jets from the pillars.
    { trap("dex", 14, "4d6", "fire"):
        {roller()} dives clear.
    - else:
        The flames catch {roller()} before the dials finally click home.
    }
    The gate swings inward.
}
~ set_flag("gate_open", true)
~ quest_step("kings-kiln", "puzzle")
~ award("q-puzzle")
-> back

= halls
#speaker:kiln
The Furnace Halls run deep into the mountain: cold furnaces as big as houses, and racks of armor that are not quite empty.
+ [Go on through the halls. #fight]
    ~ fight("f17-furnace-halls", "arrive.after_halls")
    -> END
+ [Not yet. Go back and rest first.]
    -> END
= after_halls
~ quest_step("kings-kiln", "halls")
{ flag("sneaked:f17-furnace-halls"):
    The armor stands silent behind you. At the far end of the halls, a door of red stone is warm to the touch.
- else:
    At the far end of the halls, a door of red stone is warm to the touch.
}
-> back

= seal
#speaker:kiln
A door of red stone seals the deeper halls, warm to the touch, carved with a crowned dragon eating its own tail. The shard you carry pulls toward it like a lodestone.
{ has("corin"):
    The seal is humming Corin's name.
}
+ [Press the shard to the seal.]
    The seal cracks from top to bottom, and the whole mountain sighs. Somewhere far below, something answers.
    ~ set_flag("seal_broken", true)
    ~ quest_step("kings-kiln", "seal")
    ~ award("q-seal")
    -> back
+ [Back.]
    -> END

= honor
#speaker:kiln
In the Hall of the Honor Guard, two hundred dead knights stand in ranks along the walls. One steps forward: a tall woman in old plate, a light like cold stars where her eyes should be.
#speaker:ida
"I am Ida Marrow, captain of the King's guard. No one passes to my king."
{ flag("truth_crown"):
    -> ida_talk
}
+ [Then we go through you. #fight]
    ~ fight("f18-honor-guard", "arrive.after_honor")
    -> END
+ [Back.]
    -> END
= ida_talk
+ [We know what the crown is. Cindrath is inside it.]
    The cold light in her eyes flickers. "Then you know why we guard it. Varrow did not forge it to rule. He forged it to cage her, and it killed him to do it." She lowers her sword. "Go on. Stop whoever is wearing it."
    ~ set_flag("ida_aside", true)
    ~ award("f18-aside")
    ~ quest_step("kings-kiln", "honor-guard")
    ~ quest_step("ida-oath", "oath")
    "One thing," she says as you pass. "I swore to see my king laid to rest. His bones are in the ossuary below, and the ghouls have them. If you have time, I would be in your debt."
    ~ note("Ser Ida Marrow stood aside. Her unfinished oath: lay King Varrow's remains to rest in the ossuary.")
    -> back
+ [Then we go through you. #fight]
    ~ fight("f18-honor-guard", "arrive.after_honor")
    -> END
= after_honor
#speaker:kiln
Ser Ida falls to one knee, and the light goes out of her eyes. The ranks of dead knights stay where they are.
~ set_flag("ida_destroyed", true)
~ quest_step("kings-kiln", "honor-guard")
Passages branch off the hall: down to the ossuary, along the lava tubes, and on toward the Ember Galleries.
-> back

= hub
#speaker:kiln
{ flag("before_crowning"):
    Below you, the mountain's heart roars. This is the last place to rest before the Crowning.
- else:
    Passages branch off the Hall of the Honor Guard: down to the ossuary, along the lava tubes, and on toward the Ember Galleries.
}
+ {flag("ida_aside") && not quest_done("ida-oath")} [Go down to the ossuary (Ida's oath).]
    -> ossuary
+ {not quest_done("cold-forge")} [Follow the lava tubes to the Cold Forge.]
    -> cold_forge
+ {not flag("won:f19-ember-galleries")} [Cross the Ember Galleries. #fight]
    ~ fight("f19-ember-galleries", "arrive.after_galleries")
    -> END
+ {flag("won:f19-ember-galleries") && not flag("before_crowning")} [Climb toward the heart of the mountain.]
    -> stand
+ {flag("before_crowning")} [Go down to the Crowning.]
    -> heart
+ [Leave (to the map).]
    -> END
= galleries
#speaker:kiln
The Ember Galleries: a long bridge of black glass over a lake of fire. Things made of living embers drift along it, waiting.
+ [Cross the Ember Galleries. #fight]
    ~ fight("f19-ember-galleries", "arrive.after_galleries")
    -> END
+ [Not yet. Go back and rest first.]
    -> END
= after_galleries
~ quest_step("kings-kiln", "galleries")
Past the galleries, a great stair climbs toward the heart of the mountain.
-> back

= ossuary
#speaker:kiln
The ossuary is a cathedral of bones. Something is moving among them, and it smells like the grave.
+ [Go in. #fight]
    ~ fight("s10-ossuary", "arrive.after_ossuary")
    -> END
+ [Back.]
    -> END
= after_ossuary
#speaker:kiln
In a niche marked with a broken crown you find him: King Varrow, small and ordinary in death, his hands still blistered from the forge.
~ quest_step("ida-oath", "ossuary")
#speaker:ida
Ser Ida kneels and lays her king in his tomb. "He was not a tyrant," she says. "He was a smith who made one terrible thing to stop a worse one, and the songs got it backwards." She takes off her ring and gives it to you. "And I will stand with you at the end."
~ truth("family")
~ give_item("honor-guards-ring", 1)
~ set_flag("ida_ally", true)
~ award("discover-ida")
~ quest_step("ida-oath", "rest")
~ note("Ser Ida's account: King Varrow forged the crown to cage Cindrath, and it killed him. The Varrows were never tyrants. Ida will fight beside you at the Crowning.")
-> back

= cold_forge
#speaker:kiln
{ flag("won:s9-cold-forge"):
    -> relight
}
The lava tubes are hot enough to bake bread in. At their end, something made of fire stands up.
~ quest_step("cold-forge", "tubes")
+ [Fight through. #fight]
    ~ fight("s9-cold-forge", "arrive.cold_forge")
    -> END
+ [Back.]
    -> END
= relight
King Varrow's own forge sits cold in a cave of black glass, his hammer still on the anvil. A shard set in the hearth would light it, if you can stand what the shard says while it burns.
* [Read Varrow's forge-marks. #check:history:14]
    { passed:
        {roller()} reads them: every blade was quenched "against the Red". He was making weapons for the day she woke.
        ~ award("discover-forge")
    - else:
        Dwarvish smith-marks, and a dragon, crossed out, over and over.
    }
    -> relight
+ [Light the forge and ignore the whisper. #check:insight:14]
    { passed:
        "Closer," the shard says, warm and kind. {roller()} doesn't listen. The forge roars up white.
    - else:
        The whisper gets in for a moment and {roller()} reaches toward the flames before the others pull them back. The forge lights anyway.
        ~ set_flag("forge_whisper", true)
    }
    -> quench
+ {has("corin")} [Let it whisper. I'll answer. #as:corin]
    "Little ember," the shard purrs, and the forge lights for Corin like it was waiting.
    ~ set_flag("ember", ember() + 1)
    -> quench
+ [Back.]
    -> END
= quench
You quench a weapon in the relit forge. It comes out with a faint red line along the edge that never quite cools.
~ give_item("kiln-quenched-weapon", 1)
~ quest_step("cold-forge", "relight")
~ note("The Kiln-Quenched Weapon: +1, made from the first weapon of whoever carries it.")
-> back

= stand
#speaker:kiln
The last of Venna's zealots hold the great stair down to the mountain's heart.
{ flag("ulric_spared"):
    #speaker:ulric
    Brother Ulric steps out of a side passage, lantern-hook raised. "Said I'd know a way. Come on, quiet."
    #speaker:kiln
}
* {not (flag("ulric_spared") || flag("wix_backway"))} [Creep close to the stair and listen to the zealots. #check:stealth:15]
    { passed:
        {roller()} lies flat behind a fallen statue, close enough to hear them. "She hasn't slept in three days. She talks to the fire like it's her mother." "Hush." "And the old miners' stair behind the shrine is still open. Who's watching that?" "Nobody. Nobody's left."
        ~ set_flag("stand_backway", true)
        ~ award("discover-miners-stair")
        ~ note("Listening at the great stair: the zealots left the old miners' stair behind the shrine unguarded. And Maelis hasn't slept in three days; she talks to the fire like it's her mother.")
    - else:
        A pebble skitters down the stair. "Who's there?" A burning brand sails over the statue, and {roller()} scrambles back out of sight. The zealots shout for each other and close ranks.
    }
    -> stand
+ {flag("ulric_spared") || flag("wix_backway") || flag("stand_backway")} [Take the back way in behind them. #fight]
    ~ fight("f20-last-stand-half", "arrive.after_stand")
    -> END
+ [Charge the stair. #fight]
    ~ fight("f20-last-stand", "arrive.after_stand")
    -> END
+ [Back.]
    -> END
= after_stand
~ quest_step("kings-kiln", "last-stand")
~ set_flag("before_crowning", true)
#speaker:kiln
The stair is clear. Below, the heart of the mountain is burning. (This is the last chance to rest. Make camp first if you need to.)
-> back

// ── Things to find (search spots on the Kiln map) ──
= cache
#speaker:kiln
Behind a fallen pillar outside the gate, the Hollow Star left crates for the climb: rope, lamp oil, and a strongbox nobody came back for.
+ [Search the crates. #check:investigation:13]
    { passed:
        {roller()} finds the good stuff packed at the bottom: two healing potions wrapped in a cultist's spare robe, and a purse.
        ~ give_item("potion-of-healing", 2)
        ~ give_gold(30)
    - else:
        Mostly rope. But one potion of healing rolls out of a split crate.
        ~ give_item("potion-of-healing", 1)
    }
    ~ set_flag("kiln_cache", true)
    -> back
+ [Leave it.]
    -> END

= mural
#speaker:kiln
A mural runs the length of a side passage, cut into the rock by dwarven smiths: a king at an anvil, a red dragon coiled in the fire, and a crown being hammered shut around it like a lid on a box. The last panel is blank, as if they never got to carve how it ended.
{ flag("truth_crown"):
    Now you know how it ends. Or rather, that it hasn't, yet.
}
~ set_flag("kiln_mural", true)
+ [Go on.]
    -> back

// ── The Crowning ──
= heart
{ has("corin") && ember() >= 5 && not flag("corin_pulled_back"):
    -> heir
}
#speaker:kiln
The mountain's heart is a cavern of molten light. In a ritual circle of black iron, three crown shards hang in the air around Maelis Varrow, and between them the crown is closing, link by burning link. Under the floor, something enormous is turning over in its sleep.
#speaker:maelis
"You came." She doesn't sound surprised. "Then listen, before you decide. One more turn and the forges light, and this valley is warm and free forever."
-> speak
= speak
#speaker:maelis
* {flag("truth_collapse")} [Your father's name is clear. Ashford has said it.]
    "I know." Her voice catches. "I heard it said out loud. I thought it would feel like winning."
    -> speak
* {flag("truth_crown")} [The voice isn't your father. It's Cindrath. The crown is her cage.]
    "It knew how he took his tea." But the crown's light stutters as she says it.
    -> speak
* {flag("truth_family")} [Your mother never wanted vengeance. She wanted you to live.]
    { has_item("lysas-locket"):
        You hold up the locket. Maelis stares at it, and for a moment she is nine years old.
    }
    "Mother," she whispers. "Don't."
    -> speak
* {has("corin")} [You call me "boy". You're not our father. #as:corin]
    The voice in the crown laughs, low and pleased, and Maelis flinches: she heard it too. Their father never called him boy.
    -> speak
* {has_item("drowned-lantern")} [You asked us to bring a lantern. We did.]
    Maelis looks at the Drowned Lantern, Brannoc's lantern, and something in her face gives way. "You did," she says.
    -> speak
+ [Maelis. Take it off. (Try to talk her down.)]
    { speech():
        -> redeemed
    - else:
        -> refused
    }
+ [Wait. Let her finish it.]
    -> queen
+ [Stop her by force. #fight]
    ~ fight("f21-crowning-maelis", "arrive.after_maelis")
    -> END

= redeemed
#speaker:maelis
Maelis looks at the crown in her hands as if she has only just seen it. "It isn't him," she says. "It never was." The voice in the crown screams.
~ set_flag("maelis_redeemed", true)
+ {has("corin")} [Give it to me, Mae. I'll break it from the inside. #as:corin]
    -> varrow
+ [Break it, Maelis. Now.]
    She lifts the crown and brings it down on the iron of the circle. It splits, and Cindrath tears herself out of the stone, roaring.
    ~ fight("f21-crowning-wraith", "arrive.lit_end")
    -> END
= varrow
#speaker:kiln
Corin sets the crown on his own head. For one long moment his eyes burn gold, and the mountain holds its breath. Then he reaches inside himself and snuffs the ember out: Cindrath's, and his own. The crown falls in two pieces. The fire in the walls goes out like a candle.
~ set_flag("ending", "last-varrow")
-> finish
= lit_end
#speaker:kiln
Cindrath comes apart in a storm of sparks, screaming, and the stone closes over her for good.
~ set_flag("ending", "lamp-lit")
-> finish

= refused
#speaker:maelis
"I'm sorry," Maelis says, and means it. "Then you'll have to stop me." Fire rises around her hands.
+ [Then we will. #fight]
    ~ fight("f21-crowning-maelis", "arrive.after_maelis")
    -> END
= after_maelis
#speaker:kiln
Maelis lies at the edge of the circle. The half-made crown rolls to a stop at your feet, all three shards burning in it, and the voice inside is calling you by name.
~ set_flag("maelis_dead", true)
+ [Break the crown.]
    You bring it down on the iron of the circle. It splits, and Cindrath tears herself out of the stone.
    ~ fight("f21-crowning-wraith", "arrive.snuffed_end")
    -> END
+ [Put it on.]
    It fits. Of course it fits. The mountain bows.
    ~ set_flag("ending", "ember-crown")
    -> finish
+ {flag("kell_at_gate") || flag("kell_hostile")} [Give it to Captain Kell.]
    #speaker:kell
    Kell is at the top of the stair, breathing hard. He wraps the crown in his cloak without looking at it. "Guild property," he says. "I'm sorry. It's the contract."
    ~ set_flag("ending", "guild-prize")
    -> finish
= snuffed_end
#speaker:kiln
Cindrath goes out like a snuffed lamp. In Maelis's coat you find a letter she never finished.
~ set_flag("ending", "lamp-snuffed")
-> finish

= queen
#speaker:kiln
You wait. The last link closes. Maelis lifts her head, and her eyes are not hers anymore. "Thank you," says the Ember Queen, in a voice like a furnace.
+ [Fight her. #fight]
    ~ fight("f21-ember-queen", "arrive.queen_end")
    -> END
= queen_end
#speaker:kiln
The Ember Queen falls, and Maelis falls with her. In the ashes there's a page in her handwriting.
~ set_flag("ending", "ember-queen")
-> finish

= heir
#speaker:cindrath
Corin stops at the edge of the circle. When he turns, his eyes are molten gold. "Little ember," says Cindrath through his mouth. "You said yes so many times. I'll take this one."
+ {truths() >= 2} [Corin! Remember who you are. Your mother. Your father. Mae.]
    Every Truth you carry, you say out loud. Maelis says the rest. Corin's eyes flicker, gold to amber, and he falls to his knees, gasping. "I'm here. I'm here."
    ~ set_flag("corin_pulled_back", true)
    ~ set_flag("ember", 4)
    -> heart
+ [Corin, fight it!]
    He tries. It isn't enough. Cindrath stands up in Corin's body and the circle blazes.
    ~ fight("f21-ember-heir", "arrive.heir_end")
    -> END
= heir_end
#speaker:kiln
Cindrath goes out of him at last, and there's nothing left to come back.
~ set_flag("ending", "ember-heir")
-> finish

= finish
~ quest_step("kings-kiln", "crowning")
~ travel("epilogue")
-> END
