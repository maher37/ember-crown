// The lizardfolk hunting grounds: F9 and the heat under the marsh.
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
#speaker:marsh
{ flag("lizard_passed") || flag("won:f9-lizardfolk"):
    The hunting grounds are quiet. Somewhere, a lizardfolk drum keeps time with the bubbling water.
    -> leave_only
}
The reeds part. Three lizardfolk hunters stand waist-deep in water that steams around them, clubs on their shoulders, shields painted with a sun.
#speaker:ssarith
"Warm-water hunts are good hunts," says the one with the scarred snout. "You walk in our hunt. Give, or be hunted."
-> talk

= leave_only
+ [Leave (to the map).]
    -> END

= talk
* [Why is the water warm?]
    "The fire-under-the-mud woke at the hatching-moon. Fish cook. Old dead walk in the soft-village." Ssarith points north with his club. "The stone-house of the sun-people sits on the warmest place."
    -> talk
* [Read the water. #check:nature:12]
    { passed:
        {roller()} cups the water: it's warm from below, steadily, the way a forge-floor is warm. The heat runs toward the abbey on the marsh edge.
        ~ award("discover-steam")
    - else:
        Warm, bubbling, smelling faintly of eggs. That's all you can say.
    }
    -> talk
+ [Offer food and speak plainly. #check:persuasion:12]
    { passed:
        Ssarith takes your rations and sniffs them gravely. "Plain words, good gift. Walk." The hunters step back into the reeds.
        -> passed_talk
    - else:
        "Small gift. Small words." The clubs come down off their shoulders.
        ~ fight("f9-lizardfolk", "arrive.after_fight")
        -> END
    }
+ {has("class:druid") || has("class:ranger") || has("background:outlander")} [Hunt with them a while, by their rules. #check:survival:10]
    { passed:
        {roller()} brings down a bog-pig the lizardfolk way, without a word. Ssarith hisses approval. "This one hunts. Walk."
    - else:
        The bog-pig gets away, but you tried the right way. Ssarith clicks his tongue: amusement. "Walk, bad hunter."
    }
    -> passed_talk
+ [Stand aside or be moved. #fight]
    ~ fight("f9-lizardfolk", "arrive.after_fight")
    -> END
+ [Leave (to the map).]
    -> END
= passed_talk
~ set_flag("lizard_passed", true)
~ award("f9-talk")
-> heart
= after_fight
#speaker:marsh
{ flag("sneaked:f9-lizardfolk"):
    The hunters' hissing fades behind you. They never knew you were there.
- else:
    The last hunter splashes away into the reeds, hissing a warning to the others.
}
-> heart
= heart
#speaker:marsh
Past the hunting grounds, the marsh opens into steaming pools ringed with dead trees. Two things are plain from here: the heat flows toward the old abbey, and a cottage stands alone in the bog to the west, lit by lights that aren't lanterns.
~ quest_step("hollow-star", "marsh")
~ award("q-marsh")
~ set_flag("knows_sallow", true)
~ note("The marsh is heated from below, strongest near the abbey. A lone cottage in the western bog belongs to 'Mother Sallow', who the lizardfolk say knows old things.")
-> END
