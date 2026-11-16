// The Drowned Lantern on Lantern Night (docs/Story_Bible.md §7, Act I, rest block A).
// Engine hooks (src/game/dialogue.ts):
//   has(tag)       party has: "corin", "class:cleric", "species:hill-dwarf", "background:soldier"
//   flag(name)     a story flag (false if unset)        set_flag(name, value)
//   quest_step(q, s) / quest_done(q)                    award(id)   note(text)
//   roller()       who rolled the last check            leader()    the party's first hero
//   travel(where)  leave the scene (e.g. an encounter id)
// Choice tags: #check:skill:dc  (party-best roll, D11)   #as:tag  (that character only)
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

VAR passed = false

=== intro ===
#speaker:tavern
Every lantern on the Grayflow flared red at once. Minutes later a young courier staggered through the door of the Drowned Lantern and fell across a table, bleeding.
Three strangers in grey came in behind him, asking quietly after "a lost letter." Now the whole room is pretending not to watch them.
-> END

// ── Brannoc Hale, the innkeeper ──
=== brannoc ===
#speaker:brannoc
{ brannoc > 1:
    Brannoc wipes a mug that was clean an hour ago. "Still here? Good. I could use the company."
- else:
    "He came in off the river road an hour past dusk, half-dead and clutching that satchel like it was his own heart. Then three strangers walked in after him, asking after 'a lost letter.'"
    "I don't want trouble in my house, friends. But I think trouble's already sitting at my tables."
    ~ quest_step("lantern-night", "talk-brannoc")
}
-> menu
= menu
* [Who was the courier, and who wants that letter?]
    "His name's Edric. He rides for the mayor's office." He nods at the hearth. "As for the letter, look at the men by the fire. Not from Ashford, and they haven't touched their ale."
    ~ set_flag("knows_strangers", true)
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
"Wrong answer." Chairs scrape. A bottle flies past {leader()}'s ear—and Brannoc fires a crossbow bolt into the ceiling. "Not in my house!"
[The tavern brawl (F1) arrives in Milestone M7. For now, the strangers back off.]
The three of them back out into the rain, promising to come back.
-> gone
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
+ [Leave her be.]
    -> END
= leaves
~ set_flag("hooded_gone", true)
~ note("A hooded woman with a red-flamed lantern watched the room, then left without a word.")
-> END

// ── The cellar trapdoor (side quest: Something in the Cellar) ──
=== cellar ===
#speaker:brannoc
Something scratches under the trapdoor, steady as a heartbeat.
{ not flag("cellar_asked"):
    "Rats, I hope," Brannoc says. "Been at it a week. If you're the sort who fixes things, I'd not say no."
    ~ set_flag("cellar_asked", true)
    ~ quest_step("cellar", "start")
}
+ {has("species:hill-dwarf")} [That's not rats on stone. That's digging. #as:species:hill-dwarf]
    {roller()} presses an ear to the floorboards. "Old tunnel under here, mark me. Something's using it."
    ~ note("There's an old tunnel under the Drowned Lantern's cellar.")
    -> later
+ [Open the trapdoor.]
    -> later
+ [Not tonight.]
    -> END
= later
[The cellar fight arrives in Milestone M7.] You lower the trapdoor again. The scratching stops, then starts.
-> END

// ── The front door ──
=== front_door ===
#speaker:tavern
{ not quest_done("lantern-night"):
    {not flag("edric_tended"): Brannoc catches your sleeve. "You're not walking out on the boy now."}
    {flag("edric_tended") && not (flag("has_letter") || flag("letter_lost")): Rain hammers the shutters. Whatever this letter business is, it isn't finished yet.}
    -> END
}
The Ashford road runs north along the Grayflow toward the old mine. Goblins have been seen on it, coming down from the mountains.
+ [Set out along the road (F2: Road ambush).]
    ~ travel("f2-road-ambush")
    -> END
+ [Not yet.]
    -> END
