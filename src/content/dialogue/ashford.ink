// Ashford in Act II: the Hall (F12, Tarrow's fate) and Edric's Errand (side quest).
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

// ── Ashford Hall: the betrayal ──
=== hall ===
#speaker:hall
{ flag("hall_resolved"):
    The Hall is quiet. A clerk is scrubbing the mayor's name off the door.
    -> END
}
Ashford Hall smells of beeswax and old paper. Mayor Oswin Tarrow comes down the stairs with both hands out, smiling the smile of a tired, kind man.
#speaker:tarrow
{ flag("gave_shard"):
    "My friends! I heard you met the Varrow girl at the mine. I must know where she went. For the town's sake."
- else:
    "My friends! I hear you carry something from the old mine. The Hall should keep it safe, for the town's sake."
}
-> talk
= talk
* [Ask: what do you know about the Hollow Star?]
    "Diggers. Widows' sons. Harmless." His smile doesn't move, but his hand finds the bannister. "Why do you ask?"
    -> talk
+ {flag("tarrow_exposed")} [Read the ledger aloud: every payment from the Star to this Hall.]
    The clerks stop writing. Tarrow's face goes the colour of the paper. Behind him, a hired thug sets down his club and walks out.
    #speaker:hall
    Only Captain Voss of the Hall guard stays, hand on his sword, waiting for an order.
    -> exposed
+ [We found your receipt in Marrowmere. "For the bridge and the quiet." #check:insight:12]
    { passed:
        {roller()} watches his eyes go to the door, then to the captain. "He's going to call the guard."
    - else:
        Tarrow just smiles wider.
    }
    "Captain Voss," the mayor says softly. "These people are thieves. Take what they carry."
    ~ fight("f12-betrayal", "hall.after_fight")
    -> END
+ [Keep it. We'll be going. #fight]
    "I'm afraid I insist," says Tarrow, and the doors bang shut.
    ~ fight("f12-betrayal", "hall.after_fight")
    -> END
= exposed
+ [Captain, it's over. Stand down. #check:persuasion:13]
    { passed:
        #speaker:hall
        Voss looks at the ledger, then at his mayor, and unbuckles his sword belt. "I signed on to guard a town. Not this."
        ~ award("f12-skip")
        -> cornered
    - else:
        "I gave my word," says Voss, and draws.
        ~ fight("f12-betrayal-small", "hall.after_fight")
        -> END
    }
+ [Then come on, Captain. #fight]
    ~ fight("f12-betrayal-small", "hall.after_fight")
    -> END
= after_fight
#speaker:hall
Captain Voss is down. Tarrow has backed into his own fireplace, hands up.
-> cornered
= cornered
~ quest_step("hollow-star", "hall")
~ award("q-friend")
#speaker:tarrow
"I took their money because the Guild takes everything else," Tarrow says. "The Star pays our widows. The Guild sends them bills." He sags. "And ten years ago I wrote the report that blamed Hadric Varrow for the Collapse. I was the Guild's clerk. I was told what to write."
-> fate
= fate
* [Ask: where is the Star digging now?]
    "The abbey on the marsh edge. Sister Venna runs it. The second shard is under the altar." He swallows. "She frightens me more than the Guild does."
    -> fate
+ [Say it in the square, in front of everyone. #check:persuasion:12]
    { passed || flag("tarrow_exposed"):
        It takes an hour. Tarrow stands on the Hall steps in the cold and says Hadric Varrow's name, and what he wrote, and why. Nobody throws anything. Somebody starts to cry.
        ~ set_flag("tarrow_confessed", true)
        ~ truth("collapse")
        ~ note("Mayor Tarrow confessed in the square: he falsified the safety report that blamed Hadric Varrow for the Collapse.")
        -> decided
    - else:
        "I can't," he whispers. "They'll hang me." He won't do it. Not today.
        -> fate
    }
+ [Get out of Ashford. Tonight. Don't come back.]
    He's gone before dawn, with one bag and no goodbyes. The truth goes with him.
    ~ set_flag("tarrow_silent", true)
    ~ note("Tarrow fled Ashford with his secret, probably to Waterdeep.")
    -> decided
+ [This ends here.]
    It's quick. The clerks don't look up from their desks for a long time afterwards.
    ~ set_flag("tarrow_killed", true)
    ~ note("Mayor Tarrow is dead.")
    -> decided
= decided
~ set_flag("tarrow_fate_decided", true)
~ set_flag("hall_resolved", true)
~ quest_step("hollow-star", "tarrow")
~ award("q-tarrow")
~ note("The trail leads to the Abbey of the Morninglord, where Sister Venna's diggers are after the second shard.")
#speaker:hall
The abbey on the marsh edge is the last place left to go in this act. (It's open on the map now.)
-> END

// ── Edric's Errand ──
=== errand ===
#speaker:edric
{ quest_done("edric-errand"):
    Edric is wearing a very fine pair of boots and trying not to look smug about it.
    -> END
}
"I've been watching the Hall," Edric says, low. "The mayor's runner goes out every third night with a satchel. If we follow him, I bet we find where the money goes. And the Hall ledger's in the mayor's study. I can get us in."
* [Follow the runner. #check:stealth:13]
    ~ quest_step("edric-errand", "shadow")
    { passed:
        You shadow the runner through three alleys to a cooper's yard where a woman in grey counts his coins. He's paying the Hollow Star, not the other way round.
    - else:
        You lose him at the fish market, but Edric knows where the runner sleeps. His satchel's ledger-key is easy to borrow.
    }
    -> ledger
* [Not now.]
    "I'll be here," Edric says. "Bored."
    -> END
= ledger
#speaker:edric
"The study's on the first floor," Edric whispers outside the Hall. "Window, door, or the clerk?"
+ [The window. #check:athletics:13]
    -> steal
+ [Pick the study lock. #check:sleightOfHand:14]
    -> steal
+ [Talk past the night clerk. #check:deception:13]
    -> steal
= steal
{ passed:
    In and out without a sound. The Hall ledger is under your arm, and Edric has somehow also acquired a pair of the mayor's boots. "They were just sitting there," he says.
- else:
    A shout behind you, a lamp in a window. You're out with the ledger, but someone saw Edric's face. And Edric has somehow also acquired a pair of the mayor's boots.
}
~ quest_step("edric-errand", "ledger")
~ give_item("mayors-boots", 1)
* [Read the ledger. #check:investigation:12]
    { passed:
        {roller()} cracks the clerk's code in an hour: every month, a payment marked with a hollow star, in Tarrow's own hand.
        ~ award("discover-ledger")
    - else:
        Columns of numbers. Edric points at the little stars in the margin. "Those, I think."
    }
    ~ set_flag("tarrow_exposed", true)
    ~ note("The Hall ledger shows monthly Hollow Star payments in Tarrow's own hand. You can expose him before he moves against you.")
    -> ambush
= ambush
#speaker:edric
Two nights later Edric doesn't come back from the market. You find him in Cobbler's Lane, pinned against a wall by Sister Venna's enforcers.
+ [Get him out. #fight]
    ~ fight("s8-edric-ambush", "errand.after_ambush")
    -> END
= after_ambush
#speaker:edric
Edric picks himself up, bleeding from the lip and grinning. "Told you I could help." He holds out the boots. "Mayor's. Never worn. Shame to waste them."
~ quest_step("edric-errand", "ambush")
~ note("Edric survived Venna's enforcers. He gave you the mayor's boots (Boots of Elvenkind).")
-> END
