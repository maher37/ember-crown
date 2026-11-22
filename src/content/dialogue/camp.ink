// Night camp in Act II: Maelis's parley (Story_Bible Act II midpoint).
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
EXTERNAL regain_slot()
EXTERNAL ember()
EXTERNAL kindled()

VAR passed = false

=== parley ===
#speaker:camp
Late in the watch, a red light comes through the trees, steady and unhurried. Maelis Varrow walks into your firelight alone, lantern in hand, and sits down across from you as if she'd been invited.
#speaker:maelis
{ has("corin"):
    "Little brother." She warms her hands. "I wanted to see you without a shard between us."
- else:
    "I'm not here to fight. I'm here because you're the only people in this valley who've actually looked at what's happening."
}
~ set_flag("maelis_parley", true)
-> talk
= talk
* [Marrowmere. The dead walk because of the shards.]
    "I know." She doesn't look away. "I didn't raise them. The heat did, when the first shard woke. I'm sorry for it. I'm not sorry for what it's for."
    -> talk
* [What happens when you wear the crown?]
    "The deep forges light. Ashford's debt turns to ash. And the voice that's guided me finally gets to speak out loud." She smiles. "My father's voice, I think. He always had so much to say."
    -> talk
* {flag("truth_crown")} [The crown is Cindrath's prison. The voice is the dragon.]
    For a moment her face is very still. "That's what the hag says. Or the abbey's old priests." She looks into the fire for a long time. "It knew how my father took his tea." But she doesn't sound sure anymore.
    ~ set_flag("maelis_doubt", true)
    -> talk
* {flag("truth_collapse") && not has("harl")} [Tarrow's report is known now. Your father's name is clear.]
    "I heard." Her voice catches, just once. "Ten years. And it took you a month." She wipes her eyes with the back of a sooty hand. "Thank you."
    -> talk
* {has("corin")} [Come home, Mae. Leave the crown. #as:corin]
    "I am home, Corin. That's the point." She reaches over and fixes his collar, the way she used to. "Come with me to the Kiln. Please."
    ~ set_flag("corin_asked_to_kiln", true)
    -> talk
* {has("harl")} [I knew your father. I should have said so ten years ago. #as:harl]
    "I know you did. I was at the mine mouth, behind my mother, when you read the names." She looks at Harl for a long time. "You left his out. I counted."
    {
        - flag("harl_confessed"):
        "I heard you stood on the Hall steps beside Tarrow." Her voice catches, just once. "Ten years, and then a month."
        - flag("truth_collapse"):
        "Tarrow's report is known now, they tell me. My father's name is clear." She wipes her eyes with the back of a sooty hand. "Ten years, and then a month."
    }
    { flag("harl_named_hadric"):
        Harl tells her about the chisel and the gap in the wall. She doesn't thank him. She looks into the fire, and her jaw works, and she doesn't say anything at all.
    - else:
        "Saying it now doesn't give me back ten years," she says. "Say it anyway. Out loud, where they can hear."
    }
    ~ set_flag("maelis_harl", true)
    -> talk
+ [Good night, Maelis.]
    She stands and picks up her lantern. "Good night. Keep warm." At the edge of the firelight she turns. "If you're right about the voice, I'd rather hear it from you than from a hag."
    ~ note("Maelis came to the camp in person. It was an honest conversation.")
    -> END

// ── The kindled dream (Story_Review #1): once an act, Cindrath offers every marked hero a gift ──
=== kindled_dream ===
#speaker:cindrath
All of you dream the same dream. A red room, warm all the way through, and the marks on your palms glowing like coals. A voice like a banked fire speaks, fondly. "Kindled. You carry a little of me already. Let me make it worth carrying."
{kindled() > 0: "You took my gifts before," it says. "You'll find they've grown."}
+ {not flag("kindled_resist")} [Accept: let fire not burn us. (Every marked hero takes half damage from fire, from now on.)]
    ~ set_flag("kindled_resist", true)
    -> took
+ {not flag("kindled_strike")} [Accept: let our blows burn. (Once a turn, each hero's weapon hit adds 1d4 fire damage, from now on.)]
    ~ set_flag("kindled_strike", true)
    -> took
+ {not flag("kindled_vigor")} [Accept: let the warmth keep us standing. (Each hero starts every fight with temporary HP equal to their level, from now on.)]
    ~ set_flag("kindled_vigor", true)
    -> took
+ [Refuse.]
    ~ set_flag("kindled_refused", true)
    "Another night, then," the voice says, not at all offended. You all wake cold, and the marks ache for an hour.
    -> END
= took
~ set_flag("kindled", kindled() + 1)
You wake warm. The rings on your palms are a little wider than they were, and for a moment everyone's eyes catch the firelight like a cat's. (Kindled {kindled()} of 3. The gift is listed on each hero's sheet. The cost: every gift you take makes the voice harder to argue with when it matters most.)
-> END

// ── Corin's dream bargain (Story_Bible §9: the Ember meter) ──
=== bargain ===
#speaker:cindrath
Corin dreams of a red room that is warm all the way through. A voice like a banked fire speaks to him, kindly. "Little ember. You're tired. Let me help."
~ set_flag("ember_rest", true)
+ {not flag("ember_fire")} [Accept: make my fire burn hotter. (Corin's fire spells deal +2 damage, from now on. Ember +1.)]
    ~ set_flag("ember_fire", true)
    -> took
+ {not flag("ember_resist")} [Accept: let the fire not burn me. (Corin takes half damage from fire, from now on. Ember +1.)]
    ~ set_flag("ember_resist", true)
    -> took
+ [Accept: give me back my strength. (Corin gets back one used spell slot, now. Ember +1.)]
    ~ regain_slot()
    -> took
+ [Refuse.]
    "Another night, then," the voice says, not at all offended. Corin wakes cold.
    -> END
= took
~ set_flag("ember", ember() + 1)
Corin wakes warm, and his eyes are a little more gold than they were. (Ember {ember()} of 5. The gift is listed on Corin's sheet. The cost: the higher Ember climbs, the more of Corin belongs to the voice. At 5, it may take him.)
-> END

// ── Vorna's dreams (D33, Story_Bible §9b): once an act, the voice that calls her "daughter" ──
=== vorna_dream_1 ===
#speaker:cindrath
Vorna dreams of a red room, warm all the way through, and of being small enough to be carried. A voice like a banked fire speaks to her, fondly. "Daughter. You came home."
+ [I'm nobody's daughter. #as:vorna]
    "Everyone is somebody's," the voice says, amused. "You'll see." Vorna wakes with her fists clenched.
    ~ set_flag("vorna_defied", true)
    -> END
+ [Who are you? #as:vorna]
    "The fire your scales remember. The mountain you were always walking toward." It hums, pleased. "Sleep. We'll talk again."
    Vorna wakes warm, and doesn't tell anyone for most of the morning.
    ~ set_flag("vorna_listened", true)
    -> END

=== vorna_dream_2 ===
#speaker:cindrath
The red room again. This time there are four bedrolls by the fire, and the voice says the names Vorna never says out loud: "Tamm. Bel. Orrin. Little Sef." A pause. "The Guild weighed them and found them cheap. Put the crown on Maelis's head, and no family on this mountain will go hungry again."
+ {flag("vorna_truth_blood")} [You talk to Maelis in her father's voice. With me you use theirs. #as:vorna]
    For the first time, the voice has nothing to say. The bedrolls are empty, and then they were never there. Vorna wakes up cold and angry, and it feels much better than warm.
    ~ set_flag("vorna_defied", true)
    -> END
+ [Don't say their names. #as:vorna]
    "Someone should," the voice says gently. "You never do." Vorna wakes before dawn and sits by the dead fire until the others stir.
    ~ set_flag("vorna_defied", true)
    -> END
+ [Could you really do that? Pay them? #as:vorna]
    "Daughter, I could pay the whole world." The fire purrs. Vorna wakes with four names on her lips and an ache in her chest like a healed bone in the cold.
    ~ set_flag("vorna_listened", true)
    -> END

=== vorna_dream_3 ===
#speaker:cindrath
The red room has a door now, iron, glowing at the edges. "They'll come for my door tomorrow," the voice says. "Stand at it for me, daughter. You were always the one who held the line."
+ [I'll stand at it. With my sword pointed in. #as:vorna]
    The heat goes out of the room so fast it hurts. "Then you are no child of mine," the voice says, and it is not fond anymore. Vorna wakes, and for the first time in months her sleep was her own.
    ~ set_flag("vorna_refused_voice", true)
    ~ note("Vorna told the voice in her dreams no. Whatever it is, it isn't her mother, and it isn't her captain.")
    -> END
+ [I'll think on it. #as:vorna]
    "That's my girl," the voice says. Vorna wakes warm, and spends the morning sharpening a sword that is already sharp.
    ~ set_flag("vorna_heeded_voice", true)
    ~ note("Vorna didn't say no to the voice in her dreams. It asked her to guard its door in the Kiln.")
    -> END
