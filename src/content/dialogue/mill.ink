// Varrow's Mill: the Mill at Night side quest; Lysa's ghost, the Family Truth, and Corin's scene.
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
EXTERNAL trust()

VAR passed = false

=== arrive ===
#speaker:mill
{ quest_done("mill"):
    { flag("act1_complete") && not flag("maelis_mill_met") && not flag("ending"):
        -> maelis_mill
    }
    { not flag("act1_complete") && not flag("hooded_mill_seen"):
        -> hooded_mill
    }
    The mill is only a mill now: cold millstones, swallows in the rafters. Somebody has left wildflowers on the kitchen table.
    -> leave_only
}
{ flag("won:s3-mill-shadows"):
    -> lysa
}
Varrow's Mill leans over the Grayflow, its wheel stopped for ten years. Through the gaps in the shutters, shadows move around a kitchen table, like a family sitting down to dinner.
~ quest_step("mill", "investigate")
{ has("corin"):
    Corin stops at the gate. "That's our kitchen," he says quietly. "That's where my mother sat."
}
* [Look closer at the shadows. #check:religion:12]
    { passed:
        {roller()} knows these: shadows, the dregs of the dead, drawn by grief. Steel barely bites them; light and magic do.
    - else:
        They're shadows. Shadows don't usually move on their own.
    }
    -> arrive
+ [Light a lantern and go in. #fight]
    ~ fight("s3-mill-shadows", "arrive.lysa")
    -> END
+ [Leave (to the map).]
    -> END


// ── Story_Review #6: Maelis in person. Before she reveals herself (Act I), only a hooded woman. ──
= hooded_mill
~ set_flag("hooded_mill_seen", true)
A hooded woman kneels by the kitchen table, setting down a bunch of wildflowers. A lantern sits beside her, its shutter closed. She stands when she hears you, unhurried.
#speaker:hooded
"You laid her to rest." Her voice is low and precise. "Thank you. I could never get past the shadows. They knew me too well."
* [Who are you?]
    "Someone who used to live here." She picks up the lantern. "Mind the third step on your way out. It was always loose."
    ~ note("A hooded woman left wildflowers at Varrow's Mill and thanked you for laying Lysa Varrow to rest. She knew the house.")
    -> END
* [Let her go.]
    She inclines her head and leaves by the river door. The wildflowers are fresh.
    ~ note("A hooded woman left wildflowers at Varrow's Mill and thanked you for laying Lysa Varrow to rest. She knew the house.")
    -> END

= maelis_mill
~ set_flag("maelis_mill_met", true)
Someone has lit the kitchen fire. Maelis Varrow sits at her mother's table, lantern hooded, a cup of tea going cold in front of her.
#speaker:maelis
{ has("corin"):
    "Corin." She doesn't get up. "Sit down. It's still your kitchen too."
- else:
    "Sit, if you like. I won't keep you long. I only wanted to see who laid my mother to rest."
}
{ flag("ulric_spared"): "Ulric writes to me. He says you let him live, and talked to him like a man. He's usually right about people." }
{ flag("ulric_killed"): "Ulric is dead. He had three grandchildren. I paid for the funeral; the Hall didn't send anyone." }
{ flag("ember_marked"): She looks at your hands. "And you're kindled, all of you. So you hear it too, at night." }
-> mill_talk
= mill_talk
* { flag("has_lysas_locket") || flag("corin_lysa") } [Your mother said she never wanted them to pay. She wanted you to live.]
    Maelis is quiet a long time. "That sounds like her," she says at last. "She forgave everyone. Someone in this family has to remember." But her hands shake around the cup.
    ~ set_flag("maelis_trust", trust() + 1)
    ~ set_flag("maelis_heard_lysa", true)
    -> mill_talk
* [Ask anyone in Ashford: your father killed thirty men.]
    "Ask them how they know." Her voice doesn't rise. "A report, signed by a Guild clerk and a frightened miner. Thirty-one lanterns, and one of them has my father's name on it, and nobody lights it."
    -> mill_talk
* [The voice in your dreams isn't your ancestor.]
    { flag("truth_crown"):
        "You read that somewhere." She studies you. "No. You believe it." For the first time she looks unsure. "I'll think about it. I won't promise more than that."
        ~ set_flag("maelis_doubt", true)
    - else:
        "And you know whose voice it is? You've known about it for a month." She smiles, not unkindly. "Come back when you have more than a feeling."
    }
    -> mill_talk
+ [What do you want from us?]
    "Today? Nothing." She stands and picks up her lantern. "When the time comes, don't stand between me and the Kiln. That's all I'll ever ask."
    She leaves by the river door. The tea is still warm.
    ~ note("Maelis Varrow met you at her mother's kitchen table in Varrow's Mill. She asked only that you not stand between her and the King's Kiln.")
    -> END

= leave_only
+ [Leave (to the map).]
    -> END

= lysa
#speaker:mill
The shadows tear apart like smoke. In the quiet afterwards, someone is sitting at the kitchen table who wasn't there before: a pale woman with amber eyes, a locket in her hands.
~ quest_step("mill", "shadows")
#speaker:lysa
{ has("corin"):
    "Corin." The ghost smiles. "My little ember. You got so tall."
- else:
    "You came to the Lantern," the ghost says. "I watch the lanterns. I watch my daughter light them."
}
* [Who are you?]
    "Lysa. Hadric's wife. Maelis's mother." She turns the locket over. "The town drove us out, and grief kept me here."
    -> lysa_talk
* {has("corin")} [Mother. I'm sorry I left. #as:corin]
    "You were fourteen and they spat on your father's grave. You went where you could breathe." She touches his face; it feels like cold air. "Now go and find your sister."
    ~ set_flag("corin_lysa", true)
    -> lysa_talk
= lysa_talk
"Tell Maelis I never wanted them to pay. I wanted her to live." She presses the locket into your hands. "Her father gave me this. It always brought me home safe."
~ truth("family")
~ give_item("lysas-locket", 1)
~ set_flag("has_lysas_locket", true)
~ note("Lysa Varrow's ghost: she never wanted vengeance for Hadric, only for Maelis to live. She gave you her locket.")
+ [We'll tell her. Rest now.]
    The ghost nods, and when you look again there's only the table, and the evening light.
    ~ quest_step("mill", "rest")
    -> END
