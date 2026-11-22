// The toll bridge over the Grayflow: F8 and Captain Kell (Story_Bible Act II, rest block D).
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
#speaker:bridge
{ flag("bridge_crossed"):
    { flag("won:f8-toll-bridge"):
        The chain is down and the toll-house is empty. Someone has left a candle burning for the Grey Company's dead.
    - else:
        Kell's men lean on the rail and nod you through. One of them tosses a coin in the river for luck.
    }
    -> leave_only
}
A chain hangs across the only bridge over the Grayflow for twenty miles. Grey-cloaked soldiers lounge by a brazier, and a lean man with a captain's knot on his shoulder is eating an apple.
-> approach

// D35: eavesdrop on Kell's men before they see you.
= approach
* [Slip down the bank and listen under the bridge first. #check:stealth:13]
    { passed:
        Down among the pilings, the soldiers' voices carry. "Three months since the Guild paid us." "Kell wrote them again." "Kell says we go home before the snow, shards or no shards." Somebody spits in the river. "I'd let the whole marsh through for a hot bath."
        ~ set_flag("kell_overheard", true)
        ~ award("discover-kells-men")
        ~ note("Under Kell's bridge: his soldiers haven't been paid in three months, and Kell has promised to get them home before the snow.")
    - else:
        A boot slips on the wet stones. A soldier leans over the rail and grins down at {roller()}. "Captain! There's a rat under the bridge wearing boots."
        Kell doesn't even look up from his apple. "Then invite it up for a talk."
    }
    -> greet
+ [Walk up to the chain.]
    -> greet

= greet
#speaker:kell
"Toll's gone up," says Captain Ruther Kell. "Guild's orders. Nobody crosses to the marsh without the Coinwright Guild's say-so, and the Guild says no."
{ has("vorna"):
    Then he sees who's standing behind you, and the apple stops halfway to his mouth. "Sergeant Kalvaar." Every soldier at the brazier straightens up without being told.
}
-> talk

= leave_only
+ [Leave (to the map).]
    -> END

= talk
* [Who's paying you to hold a bridge?]
    "The Coinwright Guild. In arrears." He takes another bite. "Ashford owes the Guild, so the Guild owns the bridge, so I stand on it. Simple sums."
    ~ award("discover-kell")
    -> talk
* {has("background:soldier")} [Captain. We're going after the same thing you are. #as:background:soldier]
    Kell looks at {roller()} properly for the first time: the bearing, the boots. "Sergeant-trained, by the look. Fine. Talk to me like a soldier."
    ~ set_flag("kell_rank", true)
    -> talk
* {has("vorna")} [Four families, Ruther. Tamm, Bel, Orrin and Sef. Have they been paid? #as:vorna]
    -> vorna_pay
+ [Make our case for crossing.]
    -> case
+ [Then we'll take the bridge. #fight]
    ~ fight("f8-toll-bridge", "arrive.after_fight")
    -> END
+ [Leave (to the map).]
    -> END
// D33: Vorna asks her old captain about her dead squad's pay (Story_Bible §9b).
= vorna_pay
#speaker:kell
Kell sets the apple down on the rail. "I wrote to the Guild eleven times, Sergeant. They sent back a sheet that said 'contract void: deaths not in the line of duty.'" He can't quite look at her. "I let it go. You didn't."
+ [Then stop letting it go. Give me your word you'll see them paid. #as:vorna #check:persuasion:12]
    { passed:
        Kell is quiet a long moment. Then he takes off his captain's knot and turns it over in his hands. "When this business is done, they'll be paid. Out of my own purse, if the Guild won't. My word, Vorna." He pins the knot back on. "And you can cross my bridge. You always could."
        ~ set_flag("vorna_kell_promise", true)
        ~ set_flag("kell_rank", true)
        ~ note("Captain Kell swore to Vorna that her dead squad's families will be paid, out of his own purse if the Guild won't.")
    - else:
        "I'm sorry," Kell says. "I am. But sorry doesn't pay anyone, and neither do I, it turns out." He goes back to his apple, and doesn't eat it.
        ~ set_flag("vorna_kell_cold", true)
    }
    -> talk
+ [You should have walked out with me. #as:vorna]
    "Maybe." Kell looks at his men, cold and three months unpaid. "Then who'd get these idiots home?" He doesn't say anything else, and neither does Vorna.
    ~ set_flag("vorna_kell_cold", true)
    -> talk

= case
+ {flag("kell_overheard")} [Your men haven't been paid in three months. Let us cross, and you'll get them home sooner.]
    Kell stops chewing. He looks at his men, who suddenly find the river very interesting. "Somebody's been listening under my bridge." A long breath. "Fair. If you find the Star's people, you'll do my job for free. Lift the chain."
    ~ set_flag("kell_respect", true)
    -> crossed_talk
+ [Let us cross. The cult is ahead of all of us. #check:persuasion:14]
    { passed || flag("kell_rank"):
        Kell studies you, then tosses the apple core into the river. "Fair. If you find the Star's people, you'll do my job for free. Lift the chain."
        ~ set_flag("kell_respect", true)
        -> crossed_talk
    - else:
        "Nice speech. No." He nods to his men, who stand up.
        -> refused
    }
+ {gold() >= 50} [Fifty gold for the toll. (Bribe)]
    ~ give_gold(-50)
    "Now that's Guild arithmetic." The chain rattles down.
    -> crossed_talk
+ [We carry the mayor's writ. Stand aside. #check:deception:15]
    { passed:
        Kell reads the scrap of paper you hand him, upside down, and laughs. "That's a laundry list. But it's a brave one. Go on."
        -> crossed_talk
    - else:
        Kell reads it, then folds it very neatly. "That's a laundry list."
        -> refused
    }
+ [Back.]
    -> talk
= refused
"Last chance to walk away," Kell says.
+ [Walk away (to the map).]
    -> END
+ [Fight for the crossing. #fight]
    ~ fight("f8-toll-bridge", "arrive.after_fight")
    -> END
= crossed_talk
~ award("f8-talk")
-> crossed
= after_fight
{ flag("sneaked:f8-toll-bridge"):
    #speaker:bridge
    Behind you, a voice drifts over the water: Kell, asking his men how long they have been watching an empty road.
    -> crossed
}
#speaker:kell
Kell steps back over his fallen men with his hands up and empty. "Enough. I count my dead, and I've counted enough for one morning." He lifts the chain himself.
{ has("vorna"):
    As you pass, he says it to Vorna, quietly: "Now we've both got dead to answer for, Sergeant."
}
~ set_flag("kell_hostile", true)
-> crossed
= crossed
#speaker:bridge
~ set_flag("bridge_crossed", true)
~ set_flag("act2_road", true)
~ quest_step("hollow-star", "bridge")
~ award("q-crossing")
~ note("You crossed the Grayflow at the toll bridge. Beyond it: the steaming Marsh of Chelimber, Drowned Marrowmere, the lizardfolk grounds, and the abbey on the marsh edge.")
Beyond the bridge, the road drops into the Marsh of Chelimber. In the middle of winter, it is steaming.
-> END
