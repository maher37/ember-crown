// Drowned Marrowmere: F10 (the village), F11 (the chapel), and the paymaster's satchel.
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
#speaker:marrowmere
{ flag("marrowmere_done"):
    Marrowmere's dead lie still now. Someone from the abbey has started digging graves on the higher ground.
    -> leave_only
}
{ flag("won:f10-marrowmere"):
    -> village
}
A bog village half-sunk in warm black water. Doors hang open. Something walks between the houses, slowly, in the clothes it was buried in.
* [Look for the living first. #check:perception:12]
    { passed:
        {roller()} spots a lantern in the chapel tower, and a face behind it. Someone's alive in there, or was.
    - else:
        Nobody answers your calls. The walking things turn toward the sound.
    }
    -> arrive
+ [Go in. #fight]
    ~ fight("f10-marrowmere", "arrive.village")
    -> END
+ [Leave (to the map).]
    -> END


= leave_only
+ [Leave (to the map).]
    -> END

= village
#speaker:marrowmere
{ not flag("marrowmere_dead"):
    The dead lie in the warm mud again. In the parish house the records are soaked but readable.
    ~ set_flag("marrowmere_dead", true)
    ~ quest_step("hollow-star", "marrowmere")
    ~ award("q-marrowmere")
}
* [Read the parish records. #check:history:12]
    { passed:
        {roller()} pieces it together: the graves started steaming nine weeks ago, the same week the Old Mine's shard was lifted. The heat came here first because the bog sits on an old Ammarindar fire-channel.
        ~ award("discover-records")
    - else:
        Burials, births, a complaint about a goat. The last page is just a date, nine weeks ago, and the word "warm".
    }
    -> village
+ [Climb up to the chapel. #fight]
    ~ fight("f11-chapel", "arrive.chapel")
    -> END
+ [Leave (to the map) and rest first.]
    -> END

= chapel
#speaker:marrowmere
The ghouls lie still among the broken pews. Behind the altar, a dead man in a grey robe still clutches a satchel: a Hollow Star paymaster.
~ quest_step("hollow-star", "chapel")
~ set_flag("marrowmere_chapel_done", true)
~ set_flag("marrowmere_done", true)
Inside are wage-chits for the abbey diggers, signed by a "Sister V.", and a receipt: ninety gold, delivered "to our friend in Ashford Hall, for the bridge and the quiet."
~ note("A Hollow Star paymaster's satchel in Marrowmere chapel: the cult is digging at the abbey under 'Sister V.', and paying 'our friend in Ashford Hall' to keep things quiet. Time to go back to Ashford.")
{ flag("has_letter") || flag("letter_lost"):
    It's the same hollow eight-pointed star that sealed the courier's letter on Lantern Night.
}
-> END
