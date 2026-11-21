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
* {flag("truth_collapse")} [Tarrow's report is known now. Your father's name is clear.]
    "I heard." Her voice catches, just once. "Ten years. And it took you a month." She wipes her eyes with the back of a sooty hand. "Thank you."
    -> talk
* {has("corin")} [Come home, Mae. Leave the crown. #as:corin]
    "I am home, Corin. That's the point." She reaches over and fixes his collar, the way she used to. "Come with me to the Kiln. Please."
    ~ set_flag("corin_asked_to_kiln", true)
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
+ {not flag("kindled_resist")} [Accept: let fire not burn us. (The mark deepens.)]
    ~ set_flag("kindled_resist", true)
    -> took
+ {not flag("kindled_strike")} [Accept: let our blows burn. (The mark deepens.)]
    ~ set_flag("kindled_strike", true)
    -> took
+ {not flag("kindled_vigor")} [Accept: let the warmth keep us standing. (The mark deepens.)]
    ~ set_flag("kindled_vigor", true)
    -> took
+ [Refuse.]
    ~ set_flag("kindled_refused", true)
    "Another night, then," the voice says, not at all offended. You all wake cold, and the marks ache for an hour.
    -> END
= took
~ set_flag("kindled", kindled() + 1)
You wake warm. The rings on your palms are a little wider than they were, and for a moment everyone's eyes catch the firelight like a cat's. (Kindled {kindled()} of 3: the voice will be harder to argue with when it matters.)
-> END

// ── Corin's dream bargain (Story_Bible §9: the Ember meter) ──
=== bargain ===
#speaker:cindrath
Corin dreams of a red room that is warm all the way through. A voice like a banked fire speaks to him, kindly. "Little ember. You're tired. Let me help."
~ set_flag("ember_rest", true)
+ [Accept: make my fire burn hotter. (+Ember)]
    ~ set_flag("ember_fire", true)
    -> took
+ [Accept: let the fire not burn me. (+Ember)]
    ~ set_flag("ember_resist", true)
    -> took
+ [Accept: give me back my strength. (+Ember, a spell slot)]
    ~ regain_slot()
    -> took
+ [Refuse.]
    "Another night, then," the voice says, not at all offended. Corin wakes cold.
    -> END
= took
~ set_flag("ember", ember() + 1)
Corin wakes warm, and his eyes are a little more gold than they were. (Ember {ember()} of 5.)
-> END
