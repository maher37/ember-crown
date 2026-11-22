// Ashford's streets: townsfolk who remember what you did (Story_Review #3, "the world remembers").
// Each speaks one line picked by what has happened, then offers a rumor and a way to leave.
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
EXTERNAL truths()
EXTERNAL speech()
EXTERNAL regain_slot()
EXTERNAL ember()

VAR passed = false

// ── Hobb Tullow, the town crier: the news, as Ashford tells it ──
=== crier ===
#speaker:hobb
{
    - flag("act3_evacuation"):
        "HEAR YE! Boats at dawn! Pack light! No, you may not bring the goat!" Hobb lowers the bell. "Go careful up there. We're all counting on you, which is a terrible thing to say to anyone."
    - flag("act2_complete") && flag("tarrow_killed"):
        "HEAR YE! Ash on the roofs! No mayor to tell us not to panic, on account of him being dead! So: panic a bit, but tidily!"
    - flag("act2_complete"):
        "HEAR YE! Ash on the roofs! The mountain is coughing! The Hall says do not panic!" He leans in. "The Hall's roof cracked yesterday. I'd panic a little."
    - flag("tarrow_confessed"):
        "HEAR YE! Mayor Tarrow confessed the Collapse report was a lie! Hadric Varrow was innocent!" Hobb's voice cracks on the name. "Ten years I've cried that man a thief. Ten years."
    - flag("tarrow_exposed"):
        "HEAR YE! The Hall's ledgers say the mayor took Hollow Star coin!" He winces. "I'm paid by the Hall. I'm going to need a new job."
    - flag("act1_complete") && flag("ulric_spared"):
        "HEAR YE! The heroes of the old mine are back, with Brother Ulric alive! He's telling the widows' row the Star lied to him." Hobb nods at you. "That took more than a sword."
    - flag("act1_complete") && flag("ulric_killed"):
        "HEAR YE! The diggers at the old mine are scattered! Brother Ulric is dead!" Quieter: "Half of widows' row won't open their shutters. He fed them, you know. Whatever else he did."
    - flag("act1_complete"):
        "HEAR YE! The old mine is quiet again! The heroes are back!" He squints. "That's you. I'm told it's you."
    - flag("won:f1-tavern-brawl"):
        "HEAR YE! Brawl at the Drowned Lantern! Four Grey Company bruisers carried out feet first! Brannoc says the tables are fine!" Aside: "The tables are not fine."
    - else:
        "HEAR YE! Rain tonight, bread's up a copper, and the lanterns on the river burn red! Nobody knows why! Stay indoors!"
}
-> menu
= menu
+ [Any work going?]
    "The Hall pins bounties on the board by its door: wolves, bandits, whatever's eating the goats this week. Honest coin." He rings the bell once, for emphasis. "And Odo's wagon comes in on market days, the first four of every tenday. He sells things that are mostly real."
    -> menu
+ [Where can we get things?]
    "Hulda at the Stonemantle Forge for steel. Sabeth Quillon for anything that glows; she's from Waterdeep and she'll tell you so. Sister Aubra at the Dawn Shrine patches people up for a gift. Brannoc has rope, oil and gossip."
    -> menu
+ [Back to the street.]
    -> END

// ── Gran Esk, at the well: everyone's business, and the old superstitions ──
=== gran ===
#speaker:gran-esk
{
    - has("corin") && not flag("gran_corin"):
        ~ set_flag("gran_corin", true)
        She squints at Corin, then spits on the cobbles for luck. "Hadric's boy. Your father dug me out of the '82 flood with his bare hands. Some of us remember that, whatever the Hall says."
    - has("harl") && not flag("gran_harl"):
        ~ set_flag("gran_harl", true)
        "Father Harl." She doesn't spit this time. "You read the words over my Davey, ten years back. Fine words." She draws a bucket. "Shame you never said the rest of them."
    - has("vorna") && not flag("gran_vorna"):
        ~ set_flag("gran_vorna", true)
        Gran sees Vorna's red scales, and her hand makes the warding sign before she can stop it: two fingers, pressed to the iron nail. "Begging your pardon," she says, not very sorry. "Old habit. Red's an unlucky colour in Ashford."
    - flag("tarrow_confessed"):
        "So it was the Hall all along." She draws a bucket. "Ten years of spitting at the Varrows' door. I'll be saying sorry to a mill full of ghosts."
    - flag("miners_rescued"):
        "You brought the Tullow lads up out of that warren. My grandnephew's one of them. Thin as a rake and twice as cheeky. Thank you."
    - flag("tamsin_home"):
        "Wynn's girl is home. Sat by the fire all evening, saying nothing." Gran nods slowly. "Saying nothing's how we heal, round here."
    - flag("tamsin_informant"):
        "Wynn's girl went back to the Star, they say, and her grandmother tells everyone she's 'visiting friends.'" A long look. "I hope you know what you're doing."
    - flag("wix_spared") && not flag("pies_settled"):
        "There's a goblin in Brannoc's kitchen stealing pies and telling the cook you're its friends." She cackles. "Is it true? Oh, it's true. Look at your faces."
    - flag("act1_complete"):
        "The lanterns on the river still burn red at night." She touches the iron nail over the well. "My mother said red lanterns mean the mountain's remembering. I didn't believe her either."
    - else:
        "Lantern Night, and the lanterns burn red." She touches the iron nail over the well. "Mark me: the mountain's remembering something. Mind you don't get marked with it."
}
-> menu
= menu
* {flag("gran_vorna")} [What did the red dragon do to Ashford, grandmother? #as:vorna]
    "Burned the old king's halls, two hundred years back, and the king locked her in the mountain for it. Or she's sleeping. Depends who's telling." Gran looks Vorna up and down. "You've a kind face, under all that. I'll stop with the nail."
    ~ set_flag("gran_vorna_kind", true)
    -> menu
+ [What's the old story about the lanterns?]
    "Every family puts a lantern on the river for their dead from the Collapse. Thirty-one lanterns." She counts on her fingers, and stops. "This year there's always one more than we light. Nobody's owned up to it."
    -> menu
+ [Back to the street.]
    -> END

// ── Mags Fenner, at the docks: the river trade, and who came down it ──
=== mags ===
#speaker:mags
{
    - flag("act3_evacuation") && flag("brannoc_stays"):
        "Brannoc won't get in a boat. Stubborn old goat." She ties off a line too hard. "Someone's got to keep the lantern lit, he says. Bring him back a reason to have stayed, will you?"
    - flag("deserters_freed"):
        "Those deserters you let go came through on a barge, shaking hands with everyone like it was a wedding." Mags grins. "Tipped well, too. Grey Company never tips."
    - flag("deserters_turned_in"):
        "Kell's men hanged four of their own at the toll bridge." She looks at the river, not at you. "Bad for trade. Bad for sleeping."
    - flag("kell_respect"):
        "Captain Kell paid his men's bar tab on the way through. Every copper." She shakes her head. "Never seen a mercenary do that in my life."
    - flag("marrowmere_done"):
        "My cousin's from Marrowmere. Was." She guts a fish without looking at it. "Thank you for putting them to rest. I couldn't have."
    - else:
        "Fish are coming up boiled. Boiled! In midwinter!" She holds one up. "Half price. It's already cooked."
}
-> menu
= menu
+ [What comes up the river these days?]
    "Waterdeep coin, Guild clerks, and folk who don't give names." She lowers her voice. "And a lantern-moth now and then, flying upstream. Moths don't fly upstream."
    -> menu
+ [Back to the street.]
    -> END

// ── Pell, a miner's boy: hero worship, and the occasional truth ──
=== pell ===
#speaker:pell
{
    - flag("act2_complete"):
        "Mam says we're leaving if the ash gets worse." Pell kicks a cobble. "I don't want to go. You'll fix it. You fix everything."
    - flag("act1_complete"):
        "Did you really go down the old mine? Is there a dragon? Did you see the dragon? Is it big?" He doesn't wait for answers. "I'm going to be a hero. Or a smith. Or a hero smith."
    - flag("won:s1-cellar-rats"):
        "You killed Brannoc's rats! Was there one as big as a dog? Davy says there was one as big as a dog."
    - else:
        "Are you adventurers? Real ones?" He stares at your weapons. "Can I hold one? Just the small one. I won't stab anybody important."
}
-> menu
= menu
* [Heard anything odd lately, Pell?]
    "Old Wynn's hen laid a black egg! And there's smoke in the Ashwood where nobody lives. Davy says it's a goblin. A goblin with a shop!" He laughs at how silly that sounds.
    ~ note("Pell says there's cookfire smoke in the Ashwood where nobody lives. 'A goblin with a shop.'")
    -> menu
+ [Back to the street.]
    -> END
