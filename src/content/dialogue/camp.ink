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
