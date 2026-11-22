// Mother Sallow's Bargain (side quest): the Crown Truth and the Bog Pearl.
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
#speaker:bog
{ quest_done("sallow"):
    The cottage is empty and cold. A single lantern-wisp bobs by the door, waiting for someone who won't come back.
    -> leave_only
}
{ not flag("found_sallow"):
    -> search
}
-> hut



= leave_only
+ [Leave (to the map).]
    -> END

= search
Little blue lights bob over the bog, always a few steps ahead, always leading somewhere wetter.
+ [Follow the path, not the lights. #check:survival:12]
    { passed:
        {roller()} ignores the wisps and follows the reeds the deer have bent. A cottage, chimney smoking, garden full of herbs that shouldn't grow in winter.
    - else:
        The lights lead you in circles for hours, thigh-deep in warm mud, and then, as if bored, to a cottage door.
    }
    ~ set_flag("found_sallow", true)
    ~ quest_step("sallow", "find")
    -> hut
+ [Leave (to the map).]
    -> END

= hut
#speaker:sallow
A round, rosy old woman opens the door before you knock. "Visitors! And you've come about the crown, haven't you, dearies. Everyone does, eventually."
-> talk
= talk
* [Something's wrong with her reflection. #check:insight:13]
    { passed:
        In the copper pot behind her, {roller()} sees what's really standing in the doorway: green skin, long fingers, too many teeth. A hag.
        ~ set_flag("saw_hag", true)
    - else:
        She's a nice old woman. Probably.
    }
    -> talk
* {has("vorna")} [A voice in my sleep calls me daughter. Is my blood hers? #as:vorna]
    Sallow's smile goes wide, wider than a face should. "That one I'll give you free, dearie, because it stings." She taps a red scale on Vorna's arm. "Dragons made your folk, long ago. Not that one. She calls every warm thing on this mountain 'child', and she talks to the Varrow girl in her dead father's voice. Whatever you miss most: that's the voice she uses."
    ~ set_flag("vorna_truth_blood", true)
    ~ note("Mother Sallow, to Vorna: the voice that calls her daughter isn't her blood. It speaks to everyone in the voice they miss most, and to Maelis in her father's.")
    -> talk
* [What do you know about the crown?]
    "Everything, dearie. Who made it, what's inside it, what it wants." She pats your hand. "And I'll tell you, for a price. Nothing much. Something precious."
    -> price
+ [Leave (to the map).]
    -> END
= price
#speaker:sallow
"A memory," she says, counting on her fingers. "Or a name. Or ten years of someone's life. Your choice, dearie. I'm not greedy."
+ [A memory. (One of you forgets someone they love.)]
    {leader()} feels something go, like a tooth pulled in sleep. Later, nobody can remember the name of the person in the locket {leader()} carries.
    ~ set_flag("sallow_memory", true)
    -> told
+ [A name. (Wix's true name, if he'll give it.)]
    { flag("wix_companion"):
        Wix goes very quiet, then whispers something in goblin. Sallow smiles. "Lovely." Wix doesn't tell jokes for a whole day.
        ~ set_flag("sallow_name", true)
        -> told
    - else:
        "Not yours, dearie. A name with a bit more to it." She waits.
        -> price
    }
+ [Ten years of my life.]
    {leader()} feels the years go out like a tide. There's grey in the mirror that wasn't there this morning.
    ~ set_flag("sallow_years", true)
    -> told
+ [No bargain. We'll take what we came for. #fight]
    The kindly face slides off like wet paper.
    ~ fight("s5-sallow", "arrive.after_fight")
    -> END
= told
#speaker:sallow
"The crown," says Mother Sallow, "is a cage with a door on the inside. The dragon Cindrath is in it, and whoever wears it opens the door." She drops a grey pearl into your palm. "And a little something for your trouble. I'm not unfair."
~ truth("crown")
~ give_item("bog-pearl", 1)
~ award("sallow-deal")
~ quest_step("sallow", "bargain")
~ note("Mother Sallow: the crown is a cage for the dragon Cindrath, and whoever wears it opens the door.")
-> END
= after_fight
#speaker:bog
The hag is gone, back into the bog in a hiss of steam. Her cauldron is still warm. Scratched into its rim, in a hundred languages, is the same sentence: "The crown is a cage with a door on the inside." At the bottom of the cauldron lies a grey pearl.
~ truth("crown")
~ give_item("bog-pearl", 1)
~ quest_step("sallow", "bargain")
~ note("Mother Sallow's cauldron: the crown is a cage for the dragon Cindrath, and whoever wears it opens the door.")
-> END
