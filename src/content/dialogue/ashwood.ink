// The Ashwood: The Herbalist's Granddaughter (side quest parts 2 and 3).
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
#speaker:ashwood
{ quest_done("herbalist"):
    Charcoal smoke, birdsong, nobody following you. The Ashwood has gone back to being only a wood.
    -> leave_only
}
{ flag("won:s2-ashwood-wolves"):
    -> camp
}
Old charcoal-burners' woods, black stumps and new birch. {flag("knows_tamsin_trail"):Somewhere in here is the recruiters' camp.|Nobody has asked you to look for anything here.}
{ not quest_done("lantern-night"):
    -> END
}
+ {not flag("knows_tamsin_trail")} [Look for Old Wynn's granddaughter. #check:survival:12]
    -> track
+ {flag("knows_tamsin_trail")} [Follow the trail.]
    -> track
+ [Leave (to the map).]
    -> END

= leave_only
+ [Leave (to the map).]
    -> END

= track
~ set_flag("knows_tamsin_trail", true)
~ quest_step("herbalist", "track")
{ passed:
    {roller()} finds the trail: two sets of boots and a girl's light step, heading west. Also paw prints, big ones, following the same way.
- else:
    You lose the trail twice in the birches. By the time you find it, you're not the only ones on it.
}
Three grey wolves, ribs showing, step out of the trees ahead.
+ [Stand your ground. #fight]
    ~ fight("s2-ashwood-wolves", "arrive.camp")
    -> END
+ [Back off (to the map).]
    -> END

= camp
#speaker:ashwood
A clearing with a cookfire and two tents. A man in grey robes with a star sewn on the breast stands between you and a red-haired girl with a pack on her back.
#speaker:tamsin
"I know why you're here." Tamsin lifts her chin. "Gran sent you. Did she tell you they pay my brother's widow more than the Guild ever did?"
* [Ask: why the Star?]
    "Because when the seam came down, the Guild sent a bill for the lamps. The Star sends bread." She glares at the recruiter, then at you. "I'm not stupid. I know they want something."
    -> choice
+ [Your grandmother needs you. Come home. #check:persuasion:12]
    { passed:
        Tamsin's lip trembles. She looks back at the recruiter, who shrugs. "Fine. But I'm telling Gran it was my idea."
        ~ set_flag("tamsin_home", true)
        ~ note("Tamsin went home to Old Wynn.")
        -> reward
    - else:
        "Don't tell me what she needs." But she doesn't walk away either.
        -> choice
    }
= choice
+ [It's your choice. We'll tell your grandmother you're safe.]
    She blinks, surprised. Then, quietly, when the recruiter isn't looking: "If you want to know what they're really digging for… I'll find out. I'll leave word with Gran."
    ~ set_flag("tamsin_informant", true)
    ~ note("Tamsin stayed with the Hollow Star, but she'll send word through Old Wynn: an informant inside the cult.")
    -> reward
+ [Come home. We'll walk you there.]
    She looks at the recruiter for a long moment, then picks up her pack. "If you're wrong about them, you can explain it to my brother's widow."
    ~ set_flag("tamsin_home", true)
    ~ note("Tamsin went home to Old Wynn.")
    -> reward
= reward
~ quest_step("herbalist", "camp")
#speaker:wynn
Back in Ashford, Old Wynn presses a clinking cloth bag into your hands. "For trying. For caring enough to try."
~ give_item("potion-of-healing", 3)
-> END
