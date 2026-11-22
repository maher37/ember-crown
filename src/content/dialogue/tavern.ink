// The Drowned Lantern on Lantern Night (docs/Story_Bible.md §7, Act I, rest block A).
// Engine hooks (src/game/dialogue.ts):
//   has(tag)       party has: "corin", "class:cleric", "species:hill-dwarf", "background:soldier"
//   flag(name)     a story flag (false if unset)        set_flag(name, value)
//   quest_step(q, s) / quest_done(q)                    award(id)   note(text)
//   roller()       who rolled the last check            leader()    the party's first hero
//   travel(where)  leave the scene ("map")
//   fight(encounter, knot)  start a fight; the story picks up at `knot` (flags won:/lost:/parley:<id>)
//   give_item(id, qty)  has_item(id)  truth(id)  set_act(n)  trap(ability, dc, dice, type)
// Choice tags: #check:skill:dc  (party-best roll, D11)   #as:tag  (that character only)   #fight (starts combat)
// Before a #check choice is followed, the engine sets `passed`.

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

=== intro ===
{ has("corin") && not flag("corin_barge"):
    -> corin_barge
}
-> lantern_night

// ── Corin's origin opening (Story_Bible §9) ──
=== corin_barge ===
#speaker:road
The evening barge noses into Ashford's landing under a sky the colour of a bruise. Corin Varrow hasn't set foot here in ten years.
His sister's letter is creased soft from rereading: the first word from her in eight years, and it asks him to come home for Lantern Night.
~ set_flag("corin_barge", true)
* [Read the letter again.]
    Her handwriting hasn't changed. The last line still reads like a promise and a threat at once. (Find it in the journal under Letters.)
    -> walk_in
* [Pull the hood up and walk.]
    -> walk_in
= walk_in
At the Drowned Lantern the potboy takes one look at those amber eyes and suddenly has somewhere else to be. A miner at the bar spits into the rushes. "Varrow," he says, to nobody.
Brannoc's hands go still on the mug he's wiping. He doesn't say a word. Yet.
-> lantern_night

=== lantern_night ===
#speaker:tavern
Every lantern on the Grayflow flared red at once. Minutes later a young courier staggered through the door of the Drowned Lantern and fell across a table, bleeding.
Three strangers in grey came in behind him, asking quietly after "a lost letter." Now the whole room is pretending not to watch them.
-> END

// ── Brannoc Hale, the innkeeper ──
=== brannoc ===
#speaker:brannoc
{ flag("act2_complete") && not flag("act3_evacuation"):
    -> ash
}
{ flag("tarrow_fate_decided") && not flag("brannoc_confessed"):
    -> confession
}
{ flag("wix_spared") && not flag("pies_settled"):
    "You." Brannoc points the mug at {leader()}. "A goblin's been in my kitchen. Three pies gone, and it keeps telling the cook you're its 'friends.'"
    -> pies
}
{ brannoc > 1:
    // Story_Review #3: Brannoc remembers what you did.
    {
        - flag("ulric_spared") && not flag("brannoc_ulric_said"):
            ~ set_flag("brannoc_ulric_said", true)
            Brannoc sets down two mugs before you ask. "Ulric came by. Sat right there and cried into his ale, and said you let him walk out of that shrine." He looks away. "Twenty years he was my shift partner. Thank you."
        - flag("ulric_killed") && not flag("brannoc_ulric_said"):
            ~ set_flag("brannoc_ulric_said", true)
            Brannoc doesn't look up from the mug he's wiping. "They brought Ulric down from the mine yesterday." A long pause. "I know. He'd have done the same to you. Still. Twenty years."
        - flag("miners_rescued") && not flag("brannoc_miners_said"):
            ~ set_flag("brannoc_miners_said", true)
            "The Tullow lads are home, and their mam's sent three pies over with your names on them." Brannoc jerks a thumb at the kitchen. "I've hidden them. There's a goblin about, or there will be."
        - flag("won:f1-tavern-brawl") && not flag("act1_complete") && not flag("brannoc_brawl_said"):
            ~ set_flag("brannoc_brawl_said", true)
            Brannoc sweeps the last of a broken chair into a bucket. "Four of the Grey Company's finest, on my floor. You're good for business and terrible for furniture."
        - else:
            Brannoc wipes a mug that was clean an hour ago. "Still here? Good. I could use the company."
    }
- else:
    "He came in off the river road an hour past dusk, half-dead and clutching that satchel like it was his own heart. Then three strangers walked in after him, asking after 'a lost letter.'"
    "I don't want trouble in my house, friends. But I think trouble's already sitting at my tables."
    { has("vorna"):
        His eyes go to Vorna's red scales and stay there a beat too long. Then he puts a mug in front of her like anyone else. "House rule. Nobody gets spat at while they're drinking."
    }
    ~ quest_step("lantern-night", "talk-brannoc")
}
-> menu
= menu
* [Who was the courier, and who wants that letter?]
    "His name's Edric. He rides for the mayor's office." He nods at the hearth. "As for the letter, look at the men by the fire. Not from Ashford, and they haven't touched their ale."
    ~ set_flag("knows_strangers", true)
    -> menu
* {has("vorna")} [Those three by the fire are Grey Company. I wore that cloak for six years. #as:vorna]
    Brannoc glances at the fire, then back at Vorna. "Then you'll know whether they draw steel in a man's house." Vorna watches them a moment. "They will if their captain's paying. He usually isn't."
    ~ set_flag("knows_strangers", true)
    ~ set_flag("vorna_knows_company", true)
    -> menu
+ {not flag("edric_tended")} [Let me see to his wounds. #check:medicine:10]
    -> tend_edric -> menu
+ {not flag("has_letter") && not flag("letter_lost") && flag("strangers_gone")} [They're gone. Will you trust us with the letter now?]
    "You stood between my house and those men." He reaches under the bar. "Here. Better you than me."
    -> get_letter -> menu
+ {not flag("has_letter") && not flag("letter_lost") && not flag("strangers_gone") && has("corin")} [You know me, Brannoc. #as:corin]
    Brannoc stares a long moment. "You've your mother's eyes, Varrow boy." He sets down the mug. "Your father never stole a coin in his life. Here. If anyone has a right to this, it's you."
    ~ set_flag("brannoc_knows_corin", true)
    -> get_letter -> menu
+ {not flag("has_letter") && not flag("letter_lost") && not flag("strangers_gone") && not flag("tried_insight")} [You knew him. What aren't you telling us? #check:insight:12]
    ~ set_flag("tried_insight", true)
    {passed:
        Brannoc's jaw tightens. "Fine. Edric's my sister's boy. The letter's under the bar. I meant to burn it if those men pushed."
        -> get_letter -> menu
    - else:
        Brannoc meets your eyes and holds them. You can't read him. "I've told you what I know."
        -> menu
    }
+ {not flag("has_letter") && not flag("letter_lost") && not flag("strangers_gone") && not flag("tried_persuasion") && not has("corin")} [Give us the letter. We'll handle this. #check:persuasion:14]
    ~ set_flag("tried_persuasion", true)
    {passed:
        He slides a wax-sealed letter across the bar.
        -> get_letter -> menu
    - else:
        "I don't know you. Earn a little trust first." He nods at the hearth, then at the cellar door. "Start with them, or with whatever's gnawing under my floor."
        ~ quest_step("cellar", "start")
        -> menu
    }
* {quest_done("lantern-night")} [What do you know about the old mine?]
    "I dug it for twenty years, until the Collapse." He sets the mug down. "If there's digging there now, Ulric Dunmore's behind it. My old shift partner. Tell him Brannoc sent you; he might listen."
    ~ set_flag("knows_ulric", true)
    ~ note("Brannoc's old shift partner, Ulric Dunmore, may be behind the digging at the old mine. Saying Brannoc's name might make him listen.")
    -> menu
* {quest_done("lantern-night")} [We'll need supplies for the road.]
    He sets four stoppered flasks on the bar, one in front of each of you. "Healing draughts. On the house, once. After that you're paying like everyone else."
    ~ give_item("potion-of-healing", 4)
    -> menu
* {quest_done("lantern-night") && not flag("act1_complete")} [Who's the old woman crying by the window?]
    -> wynn
+ {flag("act3_evacuation") && not quest_done("last-boats")} [The convoy. Let's get people to the boats.]
    ~ travel("scene:ashford.convoy")
    -> END
* {flag("act1_complete") && not flag("act2_complete")} [Anything on the Lantern Board?]
    "One bounty worth the ink." He taps a nailed-up notice. "Four bandits at the edge of the Forgotten Forest. Captain Kell's paying three hundred gold, dead or alive." He frowns. "Bandits who don't rob anyone. Odd sort of bandit."
    ~ set_flag("bounty_known", true)
    ~ note("Lantern Board: Captain Kell pays 300 gp for four 'bandits' at the edge of the Forgotten Forest. The Deserters' camp is on the map.")
    -> menu
+ [Back to the tavern.]
    "Mind the strangers," Brannoc mutters.
    -> END

=== get_letter ===
Pressed into the wax is a hollow, eight-pointed star. It's addressed to "our friend in Ashford Hall."
~ set_flag("has_letter", true)
~ quest_step("lantern-night", "secure-letter")
~ note("The courier's letter is sealed with a hollow eight-pointed star and addressed to \"our friend in Ashford Hall.\"")
->->

// ── Edric Hale, the wounded courier ──
=== tend_edric ===
{passed:
    {roller()} stops the bleeding. Edric's eyes flutter open: "The old mine… they're digging for it… warn the mayor—" Then he slips back under. He'll live.
    ~ set_flag("edric_clue", true)
    ~ note("Edric gasped that someone is digging for something in the old mine.")
- else:
    The wound is deeper than it looks. "Keep pressure on it," Brannoc says, "I'll fetch hot water." Between you, the bleeding finally slows. He'll live, though he won't talk tonight.
}
~ set_flag("edric_tended", true)
~ quest_step("lantern-night", "tend-edric")
->->

=== edric ===
#speaker:edric
{ flag("act1_complete") && not quest_done("edric-errand"):
    -> offer
}
{ not flag("edric_tended"):
    The courier lies across two benches, grey-faced. Blood has soaked through his sleeve and into the satchel strap.
    + [Let me see to his wounds. #check:medicine:10]
        -> tend_edric -> after
    + {has("class:cleric")} [A prayer to the Morninglord. #as:class:cleric]
        {roller()} lays a hand on the wound and murmurs Lathander's dawn-prayer. Warmth spreads; the bleeding stops. Edric opens his eyes. "The old mine… they're digging for it…"
        ~ set_flag("edric_clue", true)
        ~ note("Edric gasped that someone is digging for something in the old mine.")
        ~ set_flag("edric_tended", true)
        ~ quest_step("lantern-night", "tend-edric")
        -> after
    + [Leave him to Brannoc for now.]
        -> END
- else:
    { not flag("edric_clue"):
        Edric stirs as you lean over him. "The old mine," he whispers. "They're digging for it. Tell my uncle I'm sorry." Then he's asleep again.
        ~ set_flag("edric_clue", true)
        ~ note("Edric gasped that someone is digging for something in the old mine.")
    - else:
        Edric sleeps, pale but breathing. Someone has tucked Brannoc's own coat over him.
    }
    -> END
}
= after
-> END
= offer
Edric is up and about, pacing by the hearth with a bandage on his arm. "There you are. I want to help. I know things about the Hall."
+ [Tell us.]
    ~ travel("scene:ashford.errand")
    -> END
+ [Later, Edric.]
    -> END

// ── The strangers by the hearth (the Grey Company; F1) ──
=== strangers ===
#speaker:grey-company
{ flag("strangers_gone"):
    The hearth bench is empty. Three untouched mugs of ale are still on the table.
    -> END
}
{ strangers > 1:
    The big one doesn't bother standing. "Changed your mind about that letter?"
- else:
    "Evening." The biggest of the three doesn't stand. "We're looking for a letter. Property of the Coinwright Guild. The boy over there took it."
    He cracks his knuckles, one at a time. "You wouldn't happen to know where it is?"
}
-> menu
= menu
* [Who's asking?]
    "Grey Company. We collect what's owed." He shrugs. "Nothing personal. Ashford owes everyone."
    -> menu
+ [Leave this house. Now. #check:intimidation:13]
    {passed:
        The room goes quiet. The big one looks at {leader()}, then at the door, and decides the Guild doesn't pay him enough. "Another night," he says, and they go.
        -> gone
    - else:
        -> brawl
    }
+ [The boy's no thief, and this is Brannoc's house. Drink up and go. #check:persuasion:13]
    {passed:
        "Huh." He drains his mug at last. "Fair. Bad night for it anyway, with the river burning." They leave a coin for the ale.
        -> gone
    - else:
        -> brawl
    }
+ {has("background:soldier")} [I know Kell's outfit. Does he know you're brawling in taverns on his coin? #as:background:soldier]
    The big one straightens without meaning to. "...No need to bother the captain." They're out the door in a minute.
    -> gone
+ {not flag("has_letter") && not has("background:soldier")} [Then come and take it. #fight]
    -> brawl
+ {flag("has_letter")} [Here. Take the letter and go.]
    He breaks the seal, reads, and pockets it. "Pleasure doing business." Brannoc says nothing at all, which is worse than shouting.
    ~ set_flag("has_letter", false)
    ~ set_flag("letter_lost", true)
    ~ set_flag("strangers_gone", true)
    ~ note("You gave the courier's letter to the Grey Company.")
    ~ award("f1-strangers")
    -> END
+ [Never mind.]
    -> END
= brawl
"Wrong answer." Chairs scrape. A fourth bruiser steps in from the door, and a bottle flies past {leader()}'s ear.
~ fight("f1-tavern-brawl", "strangers.after_brawl")
-> END
= after_brawl
{ flag("won:f1-tavern-brawl"):
    The last bruiser hits the floorboards and stays there. Brannoc lowers the crossbow he never had to fire. "Out," he tells the ones who can still crawl, and they go.
    "That's the first time in ten years anyone's stood up in my house." He pours four ales nobody ordered.
    ~ set_flag("brannoc_trust", true)
- else:
    You come round on the floor with a split lip and the taste of sawdust. Brannoc is standing over you with his crossbow; the Grey Company are gone, cursing, into the rain.
    "Not your night," he says, and hauls {leader()} up by the collar. "But you tried. That counts in this house."
}
{ not flag("edric_clue"):
    Over by the hearth, Edric stirs at the noise. "The old mine," he gasps. "They're digging for it." Then he's out again.
    ~ set_flag("edric_clue", true)
    ~ note("Edric gasped that someone is digging for something in the old mine.")
}
~ set_flag("strangers_gone", true)
~ note("The Grey Company wants the courier's letter for the Coinwright Guild.")
-> END
= gone
~ set_flag("strangers_gone", true)
~ award("f1-strangers")
~ note("The Grey Company wants the courier's letter for the Coinwright Guild.")
-> END

// ── The hooded figure (Maelis, unrevealed) ──
=== hooded ===
#speaker:hooded
{ flag("hooded_gone"):
    The corner table is empty. A ring of wax and a single scorched moth are all that's left.
    -> END
}
A woman in a dark travelling cloak sits alone, a hooded lantern on the table. Its flame burns a deep, unsettling red.
{ has("corin"):
    Corin's breath catches. He knows that lantern.
}
+ [Who are you?]
    "Someone who remembers this night." She stands and gathers her lantern. "Look after the boy. This town never looks after its own."
    -> leaves
+ [That flame isn't natural. #check:arcana:12]
    {passed:
        {roller()} studies the flame. It isn't burning the wick; it's burning the air, the way the old songs say dragon-fire does. The woman notices you noticing, and smiles sadly.
        ~ note("The hooded woman's lantern burns with a flame that isn't natural fire.")
    - else:
        It's a red-glassed lantern, nothing more. Probably.
    }
    "Good night," she says, and goes.
    -> leaves
+ {has("corin")} [Maelis? #as:corin]
    "Not here, little brother." She presses a folded paper lantern into his palm and slips out into the rain.
    ~ set_flag("corin_met_maelis", true)
    -> leaves
+ {has("nessa")} [That flame smells like a signed contract. #as:nessa]
    The woman looks at Nessa properly for the first time, and her eyes catch the light like a cat's. "Someone else holds your paper too," she says gently. "Read every line of it, notary. I didn't." She steps out into the rain.
    ~ set_flag("nessa_met_maelis", true)
    -> leaves
+ [Leave her be.]
    -> END
= leaves
~ set_flag("hooded_gone", true)
~ note("A hooded woman with a red-flamed lantern watched the room, then left without a word.")
-> END

// ── The cellar trapdoor (side quest: Something in the Cellar) ──
=== cellar ===
#speaker:brannoc
{ flag("won:s1-cellar-rats"):
    { quest_done("cellar"):
        The cellar smells of fresh lime. Brannoc has bricked up the tunnel and hung a horseshoe over it, just in case.
        -> END
    }
    The tunnel behind the barrels breathes warm air.
    -> tunnel
}
Something scratches under the trapdoor, steady as a heartbeat.
{ not flag("cellar_asked"):
    "Rats, I hope," Brannoc says. "Been at it a week. If you're the sort who fixes things, I'd not say no."
    ~ set_flag("cellar_asked", true)
    ~ quest_step("cellar", "start")
}
-> choices
= choices
* {has("species:hill-dwarf")} [That's not rats on stone. That's digging. #as:species:hill-dwarf]
    {roller()} presses an ear to the floorboards. "Old tunnel under here, mark me. Something's using it."
    ~ note("There's an old tunnel under the Drowned Lantern's cellar.")
    ~ award("discover-tunnel")
    -> choices
+ [Open the trapdoor. #fight]
    -> open
+ [Not tonight.]
    -> END
= open
~ fight("s1-cellar-rats", "cellar.after_rats")
-> END
= after_rats
The last rat goes squealing into the dark. Behind the barrels, a hole in the wall opens onto an old dwarf tunnel, shored with timbers older than the inn.
~ quest_step("cellar", "clear")
-> tunnel

= tunnel
#speaker:cellar
* {has_item("torches") || has_item("lantern")} [Light the way and check the timbers before going in. #gear:torches]
    By torchlight the bad beam is easy to see: split right through, held up by habit. You prop it with a barrel stave and edge past.
    -> journal
* [Follow the tunnel.]
    The timbers groan. Twenty yards in, a beam gives way overhead.
    { trap("dex", 12, "2d6", "bludgeoning"):
        {roller()} throws themselves clear as the beam slams down where they stood.
    - else:
        The beam clips {roller()} across the shoulders before they roll clear.
    }
    -> journal
* [Not yet.]
    -> END
= journal
At the tunnel's end, a dead miner sits against the rock with his lamp in his lap. In his coat is a journal, its last pages written by feel in the dark.
"Foreman Varrow told them the seam wasn't safe. The Guild clerk wrote it up the other way. Hadric's name is on the report; Tarrow's hand wrote it."
~ truth("collapse")
~ note("A dead miner's journal: Hadric Varrow warned the Guild the seam was unsafe. The clerk who wrote the report blaming him was Oswin Tarrow, now Ashford's mayor.")
~ quest_step("cellar", "tunnel")
-> END

// ── Act III: ash on Ashford ──
=== ash ===
#speaker:ashford
Ash is falling on Ashford like grey snow. A crack runs right up the front of the Hall, and the river is crowded with boats: the town is leaving.
#speaker:brannoc
"They're calling it the end of the world," Brannoc says, polishing the same mug. "I'm calling it a slow night." He doesn't look at the door. "I'm not going anywhere."
~ set_flag("act3_evacuation", true)
~ quest_step("kings-kiln", "ash")
~ award("q-ash")
~ note("Ashford is evacuating by river. Brannoc refuses to leave his inn. Maelis has gone to the King's Kiln, up through Ashfall Pass.")
-> brannoc.menu

// ── Brannoc's confession (after Tarrow's fate, Act II) ──
=== confession ===
#speaker:brannoc
Brannoc puts down the mug he's been wiping and doesn't pick up another. "Tarrow's report. I signed it too. Me and eleven others, the crew bosses." He looks at his hands. "The mayor promised our widows a pension if we put our names to it. They never got a copper."
~ set_flag("brannoc_confessed", true)
* [Why tell us now?]
    "Because Hadric Varrow was my friend, and I let them bury him twice." He breathes out. "If anyone ever asks me to say it in the square, I will."
    ~ set_flag("brannoc_will_testify", true)
    ~ truth("collapse")
    ~ note("Brannoc confessed: he and the other crew bosses signed the false Collapse report for a pension that never came. He'll testify if asked.")
    -> END

// ── Old Wynn, the herbalist (side quest: The Herbalist's Granddaughter) ──
=== wynn ===
#speaker:wynn
{ quest_done("herbalist"):
    Old Wynn is mixing poultices again, humming. She waves a spoon at you like a blessing.
    -> END
}
"My Tamsin." She twists a handkerchief to rags. "Men in grey robes with a star sewn on, talking about wages and a fair wage and justice. She went into the Ashwood after them three days ago."
* [We'll find her.]
    "Bring her home. Or…" She stops. "Or let her tell you why, at least. I've potions for whoever tries."
    ~ quest_step("herbalist", "plea")
    ~ note("Old Wynn's granddaughter Tamsin followed Hollow Star recruiters into the Ashwood, west of town.")
    -> END
* [What is this star they wear?]
    "The Hollow Star. They pay in good silver for digging. Half the widows in Ashford have a son on their rolls." She sniffs. "Silver from where, I'd like to know."
    ~ quest_step("herbalist", "plea")
    ~ note("Old Wynn's granddaughter Tamsin followed Hollow Star recruiters into the Ashwood, west of town.")
    -> END
* [Not now.]
    -> END

// ── The goblin who stayed: pies (side quest part 2) ──
=== pies ===
#speaker:wix
Wix is sitting on the kitchen table with pastry on both ears. "Friends! Tell the big human Wix is a guest. Guests get pie. This is known."
+ [He's with us. Put the pies on our account. #check:persuasion:12]
    #speaker:brannoc
    { passed:
        Brannoc looks from the goblin to you and back. "Fine. But he works it off. Pots. All of them."
    - else:
        "Your account's not that deep," Brannoc says. Then he sighs. "He scrubs pots till midnight, and we never speak of this again."
    }
    -> settled
+ {has("class:bard")} [Let me sing for the pies. #as:class:bard]
    #speaker:brannoc
    {roller()} gives the whole room a song about a goblin and a pie that ends in a marriage. Brannoc laughs despite himself. "Pies are paid for. Never sing that again."
    -> settled
* [Ask Wix why he stole them.]
    "Wix didn't steal. Wix rescued. The pies were alone on a windowsill." He lowers his voice. "Also the warren took Wix's clan luck-stone. No luck, no food. Wix was hungry from no luck."
    -> pies
= settled
#speaker:wix
~ set_flag("pies_settled", true)
~ quest_step("wix", "pies")
"Wix owes you twice now," the goblin says, solemn as a priest. "The clan luck-stone is in the warren, in Grisk's shrine. Bring it out, and Wix follows you anywhere. Even places without pie."
~ note("Wix's clan luck-stone is in a shrine inside the goblin warren. Bring it out and he'll join you.")
-> END

// ── The front door ──
// Story_Review #1: the ember-kiss. The first time you step out after Lantern Night, the river
// lanterns flare red and mark every hero.
=== lantern_flare ===
Your hand is on the latch when the light changes. Through the shutters, every lantern on the river flares red at once: thirty-one of them, and one more nobody lit.
Each of you feels it land, a warm spark under the skin of the palm, like a coal you can't drop. When you look, there's a thin red ring there that fades to a freckle.
{has("corin"): Corin's was already there. It has always been there. It has just never glowed before.}
Brannoc stares at your hands, and his voice goes quiet. "The old miners called that the ember-kiss. Gods keep you. It's not a blessing."
~ set_flag("ember_marked", true)
~ note("On Lantern Night the river lanterns flared red and left a mark on every one of you: a warm red ring under the skin of the palm. Brannoc calls it the ember-kiss.")
->->

=== front_door ===
#speaker:tavern
{ not quest_done("lantern-night"):
    {not flag("edric_tended"): Brannoc catches your sleeve. "You're not walking out on the boy now."}
    {flag("edric_tended") && not (flag("has_letter") || flag("letter_lost")): Rain hammers the shutters. Whatever this letter business is, it isn't finished yet.}
    -> END
}
{ not flag("ember_marked"):
    -> lantern_flare ->
}
{ not flag("road_done"):
    The Ashford road runs north along the Grayflow toward the old mine. Goblins have been seen on it, coming down from the mountains.
    (Side roads lead to Varrow's Mill and the Ashwood, if anyone's asked you to look there.)
- else:
    The door opens on the Grayflow valley and the dark line of the Greypeaks beyond.
}
+ {flag("marrowmere_done") && not flag("hall_resolved")} [Go to Ashford Hall and see the mayor.]
    ~ travel("scene:ashford.hall")
    -> END
+ [Step out into Ashford.]
    ~ travel("town")
    -> END
+ [Set out (open the map).]
    ~ travel("map")
    -> END
+ [Not yet.]
    -> END
