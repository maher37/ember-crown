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

VAR passed = false

=== arrive ===
#speaker:mill
{ quest_done("mill"):
    The mill is only a mill now: cold millstones, swallows in the rafters. Somebody has left wildflowers on the kitchen table.
    + [Leave (to the map).]
        -> END
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
~ note("Lysa Varrow's ghost: she never wanted vengeance for Hadric, only for Maelis to live. She gave you her locket.")
+ [We'll tell her. Rest now.]
    The ghost nods, and when you look again there's only the table, and the evening light.
    ~ quest_step("mill", "rest")
    -> END
