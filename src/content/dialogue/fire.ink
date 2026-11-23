// Camp companions who talk (D32, Story_Review #2): at camp only. Townsfolk and allies sit at the
// fire, react to what the party has done, tell a little of their own story, and sometimes ask for
// something. Each scene plays once (fire:<id>); src/game/companions.ts decides which is ready.
// Engine hooks: see tavern.ink and src/content/README.md. found(id): a hidden find was opened.
EXTERNAL has(tag)
EXTERNAL flag(name)
EXTERNAL set_flag(name, value)
EXTERNAL quest_step(quest, step)
EXTERNAL quest_done(quest)
EXTERNAL award(id)
EXTERNAL note(text)
EXTERNAL roller()
EXTERNAL leader()
EXTERNAL found(id)

VAR passed = false

// ── Wix ──
=== wix_1 ===
~ set_flag("fire:wix_1", true)
#speaker:wix
Wix sits so close to the fire his ears steam. "Question. When humans say 'home', do they mean the walls, or the pie?"
+ [The people in it.]
    Wix thinks about that very hard. "So Brannoc is home. And you lot. And not the walls." He pats the ground. "Good. The walls keep trying to fall on me."
+ [The pie, mostly.]
    "I KNEW it." He looks enormously relieved. "Everyone kept saying it was complicated."
-
{ flag("miners_rescued"):
    "You know the miners you got out of the warren? Grisk says you didn't have to. Grisk is still confused about it. Goblins talk about you now. Mostly nice things."
}
-> END

=== wix_2 ===
~ set_flag("fire:wix_2", true)
#speaker:wix
Wix isn't eating. That has never happened before. "The Old Red is awake. I can feel her in my teeth. Promise me something?"
+ [Anything.]
    "If she comes out, you run. Don't be brave. Brave is for people with spare lives." He finally takes a bite of bread. "I'll be right behind you. Well. Ahead of you."
+ [We came here to stop her, Wix.]
    "I know." He sighs. "That's the bit I don't like."
-
{ flag("wix_backway"):
    "My clan says thank you, by the way. For the giant. They said it really loudly. They want you to have the good buttons."
}
-> END

// ── Edric ──
=== edric_1 ===
~ set_flag("fire:edric_1", true)
#speaker:edric
Edric turns a Hall seal over and over in his fingers. "I carried Tarrow's letters for two years. I never once read one."
{ flag("tarrow_killed"):
    "Now he's dead and I'll never know if he meant any of it. The pension. The 'good lad'."
- else:
    { flag("tarrow_confessed") || flag("tarrow_exposed"):
        "Now the whole town has read them for me."
    - else:
        "He still pats my shoulder in the street. I don't know what to do with my face."
    }
}
+ [You did nothing wrong, Edric.]
    "I did nothing at all. That's the bit that itches." He tosses the seal in the fire. "Next time I'll read the post."
+ [What do you want now?]
    "To matter." He laughs at himself. "Uncle Brannoc says that's how you end up in a ditch with a cult's letter in your coat. He's not wrong."
-
-> END

=== edric_2 ===
~ set_flag("fire:edric_2", true)
#speaker:edric
"Half of Ashford is on the boats," Edric says. "The other half is pretending it isn't scared."
{ flag("brannoc_stays"):
    "Uncle's staying with the inn. Of course he is. He says somebody has to keep the lamps lit for when you come back."
- else:
    { flag("brannoc_leaves"):
        "Uncle went on the last boat. He cried, you know. He'll say it was the ash."
    }
}
+ [Go with the boats, Edric.]
    "And miss the end of the story?" He shakes his head. "I'll run messages for the militia. Somebody has to know which way to run."
+ [We could use a runner.]
    His face lights up, then sobers. "I'll be where you need me. Just bring Uncle's lamps home."
-
-> END

// ── Tamsin ──
=== tamsin_1 ===
~ set_flag("fire:tamsin_1", true)
#speaker:tamsin
Tamsin grinds something green with a stone and doesn't look up. "They weren't wrong, you know. The Star. About the town."
{ flag("miners_secret_kept"):
    "You kept the miners' secret. Their families still don't know. Gran says that was kind. I think it was right."
}
{ flag("miners_told"):
    "You told the miners' families. Gran says it had to come out. One of them hasn't spoken to me since."
}
+ [Right about the town. Wrong about the crown.]
    "That's what Gran says, almost word for word." She smiles a little. "I hate it when she's right twice."
+ [Do you miss them?]
    "The singing. Not the rest." She tips the paste into a pot. "Here. For burns. You're walking toward a fire mountain."
-
-> END

=== tamsin_2 ===
~ set_flag("fire:tamsin_2", true)
#speaker:tamsin
"Gran sent a letter," Tamsin says, frowning at it. "She says the marsh is cooking the herbs in the ground. She wants to know what you saw in Marrowmere."
+ [The dead walked. The heat raised them.]
    Tamsin goes quiet. "Then it's not just the town the mountain's angry at." She folds the letter very small. "I'll tell her it's worse than she thinks. She'll want to know."
+ [Tell her we're handling it.]
    "She'll know that's a lie," Tamsin says. "She'll like that you bothered."
-
-> END

// ── Ulric (personal quest: the gap in the stone) ──
=== ulric_1 ===
~ set_flag("fire:ulric_1", true)
#speaker:ulric
Ulric sits with his back to the fire, facing the dark, the way old miners do. "You let me live. I keep waiting to find out why."
"There's a memorial in the Old Mine. Thirty names, and a gap. Hadric Varrow's gap. The Hall made us leave it."
{ flag("harl_named_hadric"):
    "And then your dwarf went and carved it, plain as day." His voice catches. "Thirty-one. Ten years late. Thank him for me."
    ~ quest_step("ulric-name", "ask")
    ~ quest_step("ulric-name", "carve")
    ~ quest_step("ulric-name", "tell")
    -> END
}
+ [Do you want us to carve it?]
    "I can't go back in there. I've tried." He holds out a miner's chisel, worn to a stub. "His name, then FOREMAN, like the others. Neat capitals. He'd care about that."
    ~ quest_step("ulric-name", "ask")
    ~ note("Ulric asked you to carve Hadric Varrow's name into the gap in the miners' memorial, in the Old Mine.")
+ [Not now, Ulric.]
    "No. Course not." He turns back to the dark.
    ~ set_flag("fire:ulric_1", false)
-
-> END

=== ulric_2 ===
~ set_flag("fire:ulric_2", true)
#speaker:ulric
Ulric looks at the chisel you give back, then at you. "It's done?"
+ [Thirty-one names.]
    He doesn't say anything for a long time. Then he laughs, once, wet. "Hadric would've complained about the spacing."
    ~ quest_step("ulric-name", "tell")
    ~ note("You told Ulric that Hadric Varrow's name is on the memorial now.")
-
-> END

// ── Captain Kell (personal quest: the drowned sergeant) ──
=== kell_1 ===
~ set_flag("fire:kell_1", true)
#speaker:kell
Kell eats standing up, like a man who expects to be called away. "I count my dead. It's the one part of the job I'm good at."
{ flag("deserters_freed"):
    "Holm's lot made it home. I won't say thank you, because officially I'm furious."
}
{ flag("deserters_turned_in"):
    "You brought Holm in. I paid you. Neither of us has to like it."
}
"One I can't count: Sergeant Dace. Went into the marsh reeds with the company strongbox key in the autumn, and never came out."
{ found("reeds-sergeant"):
    -> told_dace
}
+ [We'll look for him.]
    "The reeds by the lizardfolk grounds. He'll have a key on a tag round his neck." He looks away. "Bring the tag. The rest can stay with the river."
    ~ quest_step("kell-sergeant", "ask")
    ~ note("Kell asked you to find Sergeant Dace in the reeds by the lizardfolk hunting grounds, and bring back his tag.")
+ [Not now.]
    "No one ever has time for the dead. That's why I do it."
    ~ set_flag("fire:kell_1", false)
-
-> END
= told_dace
+ [We found him. In the reeds, with the key around his neck.]
    Kell closes his eyes. "Drowned?" A long breath out. "Better than the alternatives. Thank you." He makes a mark in a little book. It's a long book.
    ~ quest_step("kell-sergeant", "ask")
    ~ quest_step("kell-sergeant", "find")
    ~ quest_step("kell-sergeant", "tell")
    -> END

=== kell_2 ===
~ set_flag("fire:kell_2", true)
#speaker:kell
"Well?" Kell says, before you've sat down.
+ [Here's his tag.]
    ~ quest_step("kell-sergeant", "find")
    Kell takes the tag and turns it to the firelight. "M'mere chapel. Strongbox. Mine." He snorts. "He always did label everything." He makes a mark in his little book, and closes it gently.
    ~ quest_step("kell-sergeant", "tell")
    ~ note("You gave Kell Sergeant Dace's tag. He has one fewer name to wonder about.")
-
"Something you should know. The Guild's last letter says the crown goes to Waterdeep 'whole and unworn'. They don't want it melted. They want it used."
-> END

// ── Ser Ida Marrow ──
=== ida_1 ===
~ set_flag("fire:ida_1", true)
#speaker:ida
Ser Ida sits at the edge of the firelight, where it can't quite reach her. She doesn't need warmth any more, but she seems to like watching it.
"King Varrow was not a great man. He was a frightened one who did one brave thing, and then spent his life afraid of it."
+ [The crown.]
    "He knew what he'd made. He made us swear to keep it buried, and then he died, and we kept the oath long past caring why." She looks at her hands. "Now I care again. It's unpleasant."
+ [And you?]
    "I was the one who held the door." A pause. "I'm still holding it. That's all an honor guard is: someone who doesn't leave."
-
{ flag("maelis_doubt"):
    "The girl doubts. I hear it in how you speak of her. Hold on to that: doubt is a door left open."
}
-> END
