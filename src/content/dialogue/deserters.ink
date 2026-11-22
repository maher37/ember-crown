// Deserters' Bounty (side quest): free Kell's deserters, or turn them in.
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
#speaker:forest
{ quest_done("deserters"):
    The deserters' fire is cold ashes. Someone has carved a little shield into a tree: a thank-you, or a warning.
    -> leave_only
}
{ not flag("found_deserters"):
    -> search
}
-> camp



= leave_only
+ [Leave (to the map).]
    -> END

= search
The bounty says four bandits are robbing travellers at the forest's edge. The tracks say four people walking in step, boots mended army-fashion.
+ [Follow them. #check:survival:12]
    { passed:
        {roller()} finds the camp without a sound: four Grey Company soldiers, insignia cut off, cooking a single rabbit between them.
    - else:
        A twig cracks. When you reach the camp, four Grey Company soldiers are waiting with swords out, insignia cut off their cloaks.
    }
    ~ set_flag("found_deserters", true)
    ~ quest_step("deserters", "track")
    -> camp
+ [Leave (to the map).]
    -> END

= camp
#speaker:holm
"Sergeant Holm," says the oldest. "Late of the Grey Company. Kell's paying for our heads because the Guild told him to make an example." He spits. "We left because the Guild stopped paying, and started asking us to burn things."
{ has("vorna"):
    Then he squints past you. "Kalvaar? They said you walked. Said you threw your badge at the captain." A crooked grin. "Wish I'd seen it."
}
* [What did the Guild want burned?]
    "Ashford Hall's records. Anything with the old Collapse in it." He shrugs. "We're soldiers, not arsonists."
    -> camp
+ [Go home. We'll tell Kell we found nothing.]
    -> free
+ {flag("kell_respect") || has("background:soldier")} [Go home. We'll square it with Kell. Soldier to soldier.]
    -> free
+ {has("vorna")} [Go home, Holm. If Kell wants your head, he can ask me for it. #as:vorna]
    Holm laughs, the first time in weeks by the sound of it. "He won't. He's still scared of you." He clasps Vorna's arm, soldier-fashion.
    ~ set_flag("vorna_freed_holm", true)
    -> free
+ [Come quietly. The bounty's paid either way. #check:intimidation:14]
    { passed:
        Holm looks at his three tired men and lowers his sword. "Fine. Kell's a fair man. Mostly."
        ~ award("deserters-talk")
        -> turned_in
    - else:
        "Then you'll have to drag us."
        ~ fight("s6-deserters", "arrive.after_fight")
        -> END
    }
+ [Then you'll come in chains. #fight]
    ~ fight("s6-deserters", "arrive.after_fight")
    -> END
= free
Holm grips your hand, hard. "We won't forget it." They're gone into the trees by noon.
A week later a Grey Company runner finds you with a shield wrapped in oilcloth and a note in a careful soldier's hand: "Holm reached his mother's farm. I didn't want to hang them. Thank you for not making me. — R. Kell"
{ has("vorna"):
    Under the signature, in smaller letters: "Tell Kalvaar I haven't forgotten the four."
}
~ set_flag("deserters_freed", true)
~ set_flag("kell_owes", true)
~ give_item("kells-shield", 1)
~ award("deserters-talk")
~ quest_step("deserters", "decide")
~ note("You freed Sergeant Holm's deserters. Captain Kell sent his own shield in thanks: he owes you one.")
-> END
= after_fight
#speaker:forest
The deserters lie in the leaves. Kell's bounty is paid in full, dead or alive.
-> turned_in
= turned_in
~ give_gold(300)
~ set_flag("deserters_turned_in", true)
~ quest_step("deserters", "decide")
~ note("You turned in the Grey Company deserters for Kell's bounty (300 gp).")
-> END
