export interface FactionTech {
  name: string;
  type: "unit" | "green" | "blue" | "yellow" | "red";
  prerequisites?: string;
  description: string;
}

export interface FactionAgent {
  name: string;
  description: string;
}

export interface FactionCommander {
  name: string;
  unlock: string;
  description: string;
}

export interface FactionHero {
  name: string;
  description: string;
}

export interface StartingUnitEntry {
  name: string;
  count: number;
}

export interface Faction {
  name: string;
  shortName: string;
  color: string; // tailwind-compatible hsl
  abilities?: string[];
  promissoryNote?: string;
  startingUnits?: string;
  startingUnitsParsed?: StartingUnitEntry[];
  startingTech?: string[];
  commodities?: number;
  strategyTip?: string;
  factionTech?: FactionTech[];
  agent?: FactionAgent;
  commander?: FactionCommander;
  hero?: FactionHero;
}

// Generic tech reference for starting techs
export const GENERIC_TECH: Record<string, { type: "green" | "blue" | "yellow" | "red"; description: string }> = {
  "Antimass Deflectors": { type: "blue", description: "Your ships can move into and through asteroid fields. When other players' units use Space Cannon against your units, apply −1 to the result of each die roll." },
  "Plasma Scoring": { type: "red", description: "When 1 or more of your units use Bombardment or Space Cannon, 1 of those units may roll 1 additional die." },
  "Neural Motivator": { type: "green", description: "During the status phase, draw 2 action cards instead of 1." },
  "Sarween Tools": { type: "yellow", description: "When 1 or more of your units use Production, reduce the combined cost of the produced units by 1." },
  "Gravity Drive": { type: "blue", description: "After you activate a system, apply +1 to the move value of 1 of your ships during this tactical action." },
  "Magen Defense Grid": { type: "red", description: "At the start of ground combat on a planet that contains 1 or more of your units that have Planetary Shield, your opponent cannot make combat rolls during the first round of ground combat." },
  "Graviton Laser System": { type: "yellow", description: "You may exhaust this card before 1 or more of your units use Space Cannon; hits produced by those units must be assigned to non-fighter ships." },
  "Dacxive Animators": { type: "green", description: "After you win a ground combat, you may place 1 infantry from your reinforcements on that planet." },
  "Dark Energy Tap": { type: "blue", description: "After you perform a tactical action in a system that contains a frontier token, if you have 1 or more ships in that system, explore that frontier token." },
  "Bio-Stims": { type: "green", description: "You may exhaust this card at the end of your turn to ready 1 of your other technologies." },
  "Predictive Intelligence": { type: "yellow", description: "At the end of your turn, you may exhaust this card to redistribute your command tokens." },
  "Psychoarchaeology": { type: "green", description: "You can use technology specialties on planets you control without exhausting them. During the action phase, you may exhaust a planet you control that has a technology specialty to gain 1 trade good." },
  "AI Development Algorithm": { type: "red", description: "When you research a unit upgrade technology, you may exhaust this card to ignore any 1 prerequisite." },
  "Sling Relay": { type: "blue", description: "During a ground combat, if your opponent is the active player, you may exhaust this card to produce 1 infantry on that planet." },
  "Scanlink Drone Network": { type: "yellow", description: "When you activate a system, you may explore each planet in that system that contains 1 or more of your units." },
  "Self Assembly Routines": { type: "red", description: "After 1 or more of your units is destroyed during combat, you may place 1 mech from your reinforcements on the planet or in the space area of that system." },
};

// Unit reference
export const UNIT_REFERENCE: Record<string, string> = {
  "Carrier": "Cost 3 / Combat 9 / Move 1 / Capacity 4. Transports ground forces and fighters across the galaxy.",
  "Cruiser": "Cost 2 / Combat 7 / Move 2. Fast, affordable warship ideal for hit-and-run tactics.",
  "Destroyer": "Cost 1 / Combat 9 / Move 2 / Anti-Fighter Barrage 9(×2). Cheap screening ship effective against fighters.",
  "Dreadnought": "Cost 4 / Combat 5 / Move 1 / Capacity 1 / Sustain Damage / Bombardment 5. Heavy capital ship with planet bombardment.",
  "Fighter": "Cost 1(×2) / Combat 9. Cheap combat unit. Must be supported by capacity.",
  "Infantry": "Cost 1(×2) / Combat 8. Basic ground force for controlling planets.",
  "PDS": "Planetary Shield / Space Cannon 6. Stationary defense structure on planets.",
  "Space Dock": "Production 7. Produces units on the planet where it is placed.",
  "War Sun": "Cost 12(×3) / Combat 3(×3) / Move 2 / Capacity 6 / Sustain Damage / Bombardment 3(×3). Devastating super-unit that negates Planetary Shield.",
  "Flagship": "Unique to each faction. Powerful capital ship with a special ability.",
  "Mech": "Cost 2 / Combat 6 / Sustain Damage. Durable ground force with a faction-specific ability.",
};

export const TI4_FACTIONS: Faction[] = [
  {
    name: "The Arborec",
    shortName: "Arborec",
    color: "120 50% 35%",
    abilities: [
      "Mitosis: During the status phase, place 1 infantry from your reinforcements on any planet you control.",
      "Deploy: When you produce ground forces, you may place them on any planet you control instead of your space dock's system.",
    ],
    promissoryNote: "Stall Order — Action: Place this card face-up in your play area. The next time another player activates a system, you may exhaust this card to end your turn.",
    startingUnits: "1 Carrier, 1 Cruiser, 5 Infantry, 1 Space Dock, 2 Fighters, 1 PDS",
    startingTech: ["Magen Defense Grid"],
    commodities: 3,
    strategyTip: "Focus on spreading infantry across planets early. Your Mitosis ability snowballs over time. Prioritize Warfare or Production to maximize unit output.",
    factionTech: [
      { name: "Bioplasmosis", type: "green", prerequisites: "GG", description: "At the end of the status phase, you may remove any number of infantry from planets you control and place them on 1 or more planets you control in the same or adjacent systems." },
      { name: "Letani Warrior II", type: "unit", prerequisites: "GG", description: "Cost 1 / Combat 8(×2). After this unit is destroyed, roll 1 die. If the result is 6 or greater, place the unit on this card. At the start of your next turn, place each unit that is on this card on a planet you control in your home system." },
    ],
    agent: { name: "Letani Ospha", description: "After a player activates a system: You may exhaust this card to allow that player to replace 1 of their infantry in the active system with 1 infantry from their reinforcements." },
    commander: { name: "Dirzuga Rophal", unlock: "Have 12 or more ground forces on the game board.", description: "After any player produces 1 or more units: You may place 1 infantry from your reinforcements on any planet you control." },
    hero: { name: "Letani Miasmiala", description: "ACTION: Place this card face-up in your play area. At the start of each status phase, place 2 infantry from your reinforcements on any planet you control. At the start of the agenda phase, remove this card." },
  },
  {
    name: "The Barony of Letnev",
    shortName: "Letnev",
    color: "0 0% 25%",
    abilities: [
      "Munitions Reserves: At the start of each round of space combat, you may spend 2 trade goods to apply +1 to each of your ship's combat rolls.",
      "Armada: The maximum number of non-fighter ships you can have in a system is equal to 2 more than the number of tokens in your fleet pool.",
    ],
    promissoryNote: "War Funding — After a player's destroyer or cruiser is destroyed: Place it back on the game board in the system instead. Then return this card to the Barony.",
    startingUnits: "1 Dreadnought, 1 Carrier, 1 Destroyer, 3 Infantry, 1 Fighter, 1 Space Dock",
    startingTech: ["Antimass Deflectors", "Plasma Scoring"],
    commodities: 2,
    strategyTip: "Leverage your Armada ability to field massive fleets. Spend trade goods aggressively for combat bonuses. The Barony excels at military dominance.",
    factionTech: [
      { name: "L4 Disruptors", type: "yellow", prerequisites: "Y", description: "During an invasion in a system that contains 1 or more of your units, you may exhaust this card to prevent the \"Space Cannon Defense\" step of the invasion." },
      { name: "Non-Euclidean Shielding", type: "red", prerequisites: "RR", description: "When 1 of your units uses \"Sustain Damage,\" cancel 2 hits instead of 1." },
    ],
    agent: { name: "Darktalon Treilla", description: "At the start of a combat round: You may exhaust this card to choose a player in the active system; that player may spend 2 trade goods to apply +1 to the result of each of their unit's combat rolls during this combat round." },
    commander: { name: "Rear Admiral Farran", unlock: "Have 5 or more non-fighter ships in 1 system.", description: "After 1 of your units uses Sustain Damage: You may spend 1 trade good to repair that unit." },
    hero: { name: "Dark Talons Treilla", description: "ACTION: Place this card face-up in your play area. During this game round, apply +2 to the move value and +2 to the combat value of each of your dreadnoughts. At the end of this game round, purge this card." },
  },
  {
    name: "The Clan of Saar",
    shortName: "Saar",
    color: "35 70% 45%",
    abilities: [
      "Scavenge: After you gain control of a planet, gain 1 trade good.",
      "Nomadic: Your space docks have the 'sustain damage' ability. They are placed in space and can move with your fleet.",
    ],
    promissoryNote: "Ragh's Call — After you commit 1 or more units to a planet: Remove all of the Saar player's ground forces from that planet and place them on a planet they control. Then return this card.",
    startingUnits: "2 Carriers, 1 Cruiser, 4 Infantry, 2 Fighters, 1 Space Dock",
    startingTech: ["Antimass Deflectors"],
    commodities: 3,
    strategyTip: "Stay mobile. Your floating space docks mean you never need to defend a home system. Expand aggressively and use Scavenge to fuel your economy.",
    factionTech: [
      { name: "Chaos Mapping", type: "blue", prerequisites: "B", description: "Other players cannot activate asteroid fields that contain 1 or more of your units. At the start of your turn, you may produce 1 unit in a system that contains an asteroid field and 1 or more of your units." },
      { name: "Floating Factory II", type: "unit", prerequisites: "YY", description: "Capacity 5 / Move 2 / Production 7. This unit is placed in a space area instead of on a planet. This unit can move and retreat as if it were a ship. It cannot be stored in or transported by a ship." },
    ],
    agent: { name: "Captain Mendosa", description: "After a player activates a system that contains 1 or more of your ships: You may exhaust this card to allow that player to gain 1 trade good." },
    commander: { name: "Elder Harka", unlock: "Have units in 3 systems that do not contain planets.", description: "After you gain control of a planet: You may gain 1 trade good or draw 1 action card." },
    hero: { name: "Clan Noskovak", description: "ACTION: Remove each of your ground forces from the game board and place them on planets you control in any systems that contain your ships. Purge this card." },
  },
  {
    name: "The Embers of Muaat",
    shortName: "Muaat",
    color: "15 80% 50%",
    abilities: [
      "Star Forge: Action: Spend 1 token from your strategy pool to place either 2 fighters or 1 destroyer from your reinforcements in a system that contains 1 or more of your war suns.",
      "Gashlai Physiology: Your war suns lose their Bombardment ability during the first round of a space combat.",
    ],
    promissoryNote: "Promise of Protection — Action: Place this card face-up in your play area. While this card is in your play area, the Muaat player cannot activate your home system.",
    startingUnits: "1 War Sun, 2 Fighters, 4 Infantry, 1 Space Dock",
    startingTech: ["Plasma Scoring"],
    commodities: 4,
    strategyTip: "Your War Sun start is your biggest asset—protect it early. Use Star Forge to generate free units. Rush War Sun II tech for devastating fleets.",
    factionTech: [
      { name: "Magmus Reactor", type: "red", prerequisites: "RR", description: "Your ships can move into supernovas. After 1 or more of your units use Production in a system that either contains a war sun or is adjacent to a supernova, reduce the combined cost of the produced units by 1." },
      { name: "Prototype War Sun II", type: "unit", prerequisites: "RRR", description: "Cost 10(×3) / Combat 3(×3) / Move 3 / Capacity 6 / Sustain Damage / Bombardment 3(×3). Other players' units in this system lose \"Planetary Shield.\"" },
    ],
    agent: { name: "Umbat", description: "After a player activates a system that contains 1 or more of their war suns or their flagship: You may exhaust this card; that player may produce up to 2 units in that system, applying +2 to the production limit of that system." },
    commander: { name: "Magmus", unlock: "Have a war sun on the game board.", description: "You may spend 1 trade good when you use the secondary ability of the Warfare strategy card to use the primary ability instead." },
    hero: { name: "Adjudicator Ba'al", description: "ACTION: Place this card face-up in your play area. Your war suns gain SUSTAIN DAMAGE. At the end of the status phase, purge this card." },
  },
  {
    name: "The Emirates of Hacan",
    shortName: "Hacan",
    color: "45 80% 50%",
    abilities: [
      "Masters of Trade: You do not have to spend a command token to resolve the secondary ability of the Trade strategy card.",
      "Guild Ships: You can negotiate transactions with players who are not your neighbors.",
    ],
    promissoryNote: "Trade Convoys — Action: Place this card face-up in your play area. While this card is in your play area, you may negotiate transactions with the Hacan player.",
    startingUnits: "2 Carriers, 1 Cruiser, 4 Infantry, 2 Fighters, 1 Space Dock",
    startingTech: ["Antimass Deflectors", "Sarween Tools"],
    commodities: 6,
    strategyTip: "You are the trade king. Use your massive commodity pool and Guild Ships to broker deals across the galaxy. Economic dominance is your path to victory.",
    factionTech: [
      { name: "Production Biomes", type: "green", prerequisites: "GG", description: "ACTION: Exhaust this card and spend 1 token from your strategy pool to gain 4 trade goods and choose 1 other player; that player gains 2 trade goods." },
      { name: "Quantum Datahub Node", type: "yellow", prerequisites: "YYY", description: "At the end of the strategy phase, you may spend 1 token from your strategy pool to swap 1 of your strategy cards with a strategy card that was not picked." },
    ],
    agent: { name: "Carth of Golden Sands", description: "At the start of a player's turn: You may exhaust this card to allow that player to replenish their commodities; if you do, replenish your commodities." },
    commander: { name: "Gila the Silvertongue", unlock: "Have 10 or more trade goods.", description: "After you resolve a transaction: You may gain 1 trade good." },
    hero: { name: "Harrugh Gefhara", description: "ACTION: Each other player may give you 1 trade good; for each trade good you receive, you may give that player up to 3 trade goods. Purge this card." },
  },
  {
    name: "The Federation of Sol",
    shortName: "Sol",
    color: "210 60% 50%",
    abilities: [
      "Orbital Drop: Action: Spend 1 command token from your strategy pool to place 2 infantry from your reinforcements on any planet you control.",
      "Versatile: When you gain command tokens during the status phase, gain 1 additional command token.",
    ],
    promissoryNote: "Military Support — At the start of the Sol player's turn: remove 1 token from the Sol player's strategy pool and return this card. Then place the removed token in your reinforcements.",
    startingUnits: "2 Carriers, 1 Destroyer, 5 Infantry, 2 Fighters, 1 Space Dock",
    startingTech: ["Antimass Deflectors", "Neural Motivator"],
    commodities: 4,
    strategyTip: "Use Orbital Drop to contest planets without moving fleets. Versatile gives you action economy advantage. Sol is flexible—adapt to the table's dynamics.",
    factionTech: [
      { name: "Advanced Carrier II", type: "unit", prerequisites: "BB", description: "Cost 3 / Combat 9 / Move 2 / Capacity 8 / Sustain Damage. When this unit is destroyed, units it was transporting may be placed in the system' space area." },
      { name: "Spec Ops II", type: "unit", prerequisites: "GG", description: "Cost 1(×2) / Combat 6. After this unit is destroyed, roll 1 die. If the result is 5 or greater, place the unit on this card. At the start of your next turn, place each unit on this card on a planet you control in your home system." },
    ],
    agent: { name: "Evelyn Delouis", description: "After a player activates a system: You may exhaust this card to allow that player to remove 1 of their infantry from the game board and place it on a planet they control in the active system." },
    commander: { name: "Claire Gibson", unlock: "Have 3 or more structures on the game board.", description: "After you produce units: You may place up to 2 infantry from your reinforcements on any planet you control." },
    hero: { name: "Jace X. 4th Air Legion", description: "ACTION: Place this card face-up in your play area. For the rest of this game round, your infantry on planets you control gain Sustain Damage. Purge this card at the end of the game round." },
  },
  {
    name: "The Ghosts of Creuss",
    shortName: "Creuss",
    color: "220 70% 60%",
    abilities: [
      "Quantum Entanglement: You treat all systems that contain either an alpha or beta wormhole as adjacent to each other.",
      "Slipstream: During your tactical actions, you can move through systems that contain other players' ships.",
    ],
    promissoryNote: "Creuss Iff — At the start of your turn: Place or move a Creuss wormhole token into either a system that contains a planet you control or a non-home system that is adjacent to one of your ships. Then return this card.",
    startingUnits: "2 Carriers, 1 Destroyer, 4 Infantry, 2 Fighters, 1 Space Dock",
    startingTech: ["Gravity Drive"],
    commodities: 4,
    strategyTip: "Wormhole control is your superpower. Place wormholes strategically for surprise attacks and easy scoring. Your mobility is unmatched when wormholes are on the board.",
    factionTech: [
      { name: "Dimensional Splicer", type: "red", prerequisites: "R", description: "At the start of a space combat in a system that contains a wormhole and 1 or more of your ships, you may produce 1 hit against your opponent' ships." },
      { name: "Wormhole Generator II", type: "blue", prerequisites: "BBB", description: "At the start of the status phase, place or move a Creuss wormhole token into either a system that contains a planet you control or a non-home system that is adjacent to a system that contains a planet you control." },
    ],
    agent: { name: "Emissary Taivra", description: "After a player activates a system that contains a non-delta wormhole: You may exhaust this card to allow that player to apply +1 to the move value of each of their ships during this tactical action that started in or adjacent to a wormhole." },
    commander: { name: "Sai Seravus", unlock: "Have units in or adjacent to 3 or more wormholes.", description: "During your turn, you may place 1 Creuss wormhole token in a non-home system that contains 1 or more of your ships." },
    hero: { name: "Ixthael", description: "ACTION: Place this card face-up in your play area. All systems that contain a wormhole are adjacent to all other systems that contain a wormhole. At the end of the status phase, purge this card." },
  },
  {
    name: "The L1Z1X Mindnet",
    shortName: "L1Z1X",
    color: "200 30% 35%",
    abilities: [
      "Assimilate: When you gain control of a planet that contains another player's PDS or space dock, you may replace it with one of your own from your reinforcements.",
      "Harrow: At the end of each round of ground combat, your dreadnoughts in the system may use their Bombardment ability against your opponent's ground forces on the planet.",
    ],
    promissoryNote: "Cybernetic Enhancements — At the start of your turn: Remove 1 token from the L1Z1X player's strategy pool and return this card. Then place the removed token in your fleet pool.",
    startingUnits: "1 Dreadnought, 1 Carrier, 5 Infantry, 3 Fighters, 1 Space Dock, 1 PDS",
    startingTech: ["Neural Motivator", "Plasma Scoring"],
    commodities: 2,
    strategyTip: "Harrow makes your dreadnoughts terrifying in ground combat. Assimilate stolen infrastructure to fuel your expansion. Play aggressively—your units are built for war.",
    factionTech: [
      { name: "Inheritance Systems", type: "yellow", prerequisites: "YY", description: "You may exhaust this card and spend 2 resources when you research a technology. If you do, ignore all of that technology' prerequisites." },
      { name: "Super Dreadnought II", type: "unit", prerequisites: "BBR", description: "Cost 4 / Combat 4 / Move 2 / Capacity 2 / Sustain Damage / Bombardment 4. This unit may transport up to 2 fighters or ground forces." },
    ],
    agent: { name: "I48S", description: "After a player activates a system that contains 1 or more of their dreadnoughts or their flagship: You may exhaust this card to allow that player to replace 1 of their infantry in the active system with 1 mech from their reinforcements." },
    commander: { name: "2RAM", unlock: "Have your flagship or your war sun on the game board.", description: "When you produce units: You may spend influence to use as resources." },
    hero: { name: "Ibna Vel Sansen", description: "ACTION: For each planet you control, place 1 mech on that planet from your reinforcements. Then purge this card." },
  },
  {
    name: "The Mentak Coalition",
    shortName: "Mentak",
    color: "40 60% 45%",
    abilities: [
      "Ambush: At the start of space combat, you may roll 1 die for up to 2 of your cruisers or destroyers. For each result >= 6, produce 1 hit.",
      "Pillage: After another player gains trade goods or resolves a transaction, you may take 1 trade good from that player.",
    ],
    promissoryNote: "Promise of Protection — Action: Place this card face-up in your play area. While this card is in your play area, the Mentak player cannot use their Pillage ability against you.",
    startingUnits: "2 Carriers, 1 Cruiser, 4 Infantry, 3 Fighters, 1 Space Dock, 1 PDS",
    startingTech: ["Sarween Tools", "Plasma Scoring"],
    commodities: 2,
    strategyTip: "Pillage is your economic engine—use it every chance you get. Ambush makes your smaller ships dangerous. Build a cruiser-heavy fleet for maximum efficiency.",
    factionTech: [
      { name: "Salvage Operations", type: "yellow", prerequisites: "YY", description: "After you win or lose a space combat, gain 1 trade good; if you won, you may also produce 1 ship in that system of any ship type that was destroyed during the combat." },
      { name: "Mirror Computing", type: "yellow", prerequisites: "YYY", description: "When you spend trade goods, each trade good is worth 2 resources or 2 influence instead of 1." },
    ],
    agent: { name: "Suffi An", description: "After a player activates a system that contains 1 or more of their ships: You may exhaust this card to allow that player to produce 1 ship in that system; the produced ship must have a cost equal to or lower than the highest-cost ship that player has in that system." },
    commander: { name: "S'Ula Mentarion", unlock: "Have 4 or more ships in 2 or more systems.", description: "During your turn: You may take 1 trade good from a player who has more trade goods than you." },
    hero: { name: "Iperia Mentak", description: "ACTION: Each other player gives you all of their trade goods. Purge this card." },
  },
  {
    name: "The Naalu Collective",
    shortName: "Naalu",
    color: "50 70% 50%",
    abilities: [
      "Telepathic: At the end of the strategy phase, place the Naalu '0' token on your strategy card; you are first in initiative order.",
      "Foresight: After another player moves ships into a system that contains 1 or more of your ships, you may place 1 token from your reinforcements in your fleet pool.",
    ],
    promissoryNote: "Gift of Prescience — At the end of the strategy phase: Place the Naalu '0' token on your strategy card; you are first in initiative order. Then return this card to the Naalu player.",
    startingUnits: "1 Carrier, 1 Cruiser, 1 Destroyer, 4 Infantry, 3 Fighters, 1 Space Dock, 1 PDS",
    startingTech: ["Neural Motivator", "Sarween Tools"],
    commodities: 3,
    strategyTip: "Going first every round is enormously powerful. Use Telepathic to always act before your opponents. Score objectives before others can interfere.",
    factionTech: [
      { name: "Neuroglaive", type: "green", prerequisites: "GGG", description: "After another player activates a system that contains 1 or more of your ships, that player removes 1 token from their fleet pool and places it in their reinforcements." },
      { name: "Hybrid Crystal Fighter II", type: "unit", prerequisites: "GB", description: "Cost 1(×2) / Combat 7 / Move 2. This unit may move without being transported. Each fighter in excess of your ships' capacity counts as 1/2 capacity." },
    ],
    agent: { name: "Z'eu", description: "After a player activates a system that contains 1 or more of their fighters: You may exhaust this card to allow that player to place 2 fighters from their reinforcements in the active system." },
    commander: { name: "M'aban", unlock: "Have 6 or more fighters on the game board.", description: "During combat: Apply +1 to the result of each of your fighters' combat rolls." },
    hero: { name: "The Oracle", description: "ACTION: Place this card face-up in your play area. You are always first in initiative order. At the start of the status phase, purge this card." },
  },
  {
    name: "The Nekro Virus",
    shortName: "Nekro",
    color: "0 70% 40%",
    abilities: [
      "Galactic Threat: You cannot vote on agendas. Once per agenda phase, after an agenda is revealed, you may predict aloud the outcome. If correct, gain 1 technology.",
      "Technological Singularity: When you win a combat, you may copy 1 technology from the losing player.",
    ],
    promissoryNote: "Antivirus — At the start of a combat: Place this card face-up in your play area. The Nekro player cannot use their Technological Singularity ability against you. Return this card at the end of the combat.",
    startingUnits: "1 Dreadnought, 1 Carrier, 2 Infantry, 2 Fighters, 1 Space Dock",
    startingTech: ["Dacxive Animators"],
    commodities: 3,
    strategyTip: "You gain tech through combat, not research. Attack frequently to steal technologies. Predict agenda outcomes wisely for free tech gains.",
    factionTech: [
      { name: "Valefar Assimilator X", type: "green", prerequisites: "", description: "When you research a technology, you may exhaust this card to ignore prerequisites and research a non-faction technology that 1 other player has already researched, even if it is not on your faction sheet." },
      { name: "Valefar Assimilator Y", type: "green", prerequisites: "", description: "When you research a technology, you may exhaust this card to ignore prerequisites and research a non-faction technology that 1 other player has already researched, even if it is not on your faction sheet." },
    ],
    agent: { name: "Nekro Malleon", description: "At the start of a player's turn: You may exhaust this card to allow that player to draw 1 action card." },
    commander: { name: "Nekro Acidos", unlock: "Own 3 or more technologies.", description: "After you gain a technology: You may draw 1 action card." },
    hero: { name: "UNIT.DSGN.FLAYESH", description: "ACTION: Destroy any number of your ground forces on the game board. For each unit you destroyed, you may place 1 unit of any type from your reinforcements on a planet you control. Purge this card." },
  },
  {
    name: "Sardakk N'orr",
    shortName: "Sardakk",
    color: "0 60% 30%",
    abilities: [
      "Unrelenting: Apply +1 to the result of each of your unit's combat rolls.",
      "Valefar Assimilator: When you research a technology, you may exhaust 2 planets and replace 1 of your technologies with a faction technology that is not owned by the Sardakk N'orr or the Nekro Virus.",
    ],
    promissoryNote: "Tekklar Legion — At the start of ground combat: Apply +1 to the result of each of your unit's combat rolls during this combat. Then return this card.",
    startingUnits: "2 Carriers, 1 Cruiser, 5 Infantry, 1 Space Dock, 1 PDS",
    startingTech: [],
    commodities: 3,
    strategyTip: "Your +1 combat bonus is devastating. You start with no tech, so plan your tech path carefully. Prioritize combat-boosting technologies to become unstoppable.",
    factionTech: [
      { name: "Exotrireme II", type: "unit", prerequisites: "BBR", description: "Cost 4 / Combat 5 / Move 2 / Capacity 1 / Sustain Damage / Bombardment 4(×2). After a round of space combat, you may destroy this unit to destroy up to 2 of your opponent' ships." },
      { name: "Valkyrja Gate", type: "blue", prerequisites: "BB", description: "After you activate a system that does not contain your ships: You may exhaust this card to place 1 infantry and 1 mech from your reinforcements on a planet you control in that system." },
    ],
    agent: { name: "T'ro", description: "At the start of a ground combat round: You may exhaust this card to choose a player in the active system; that player may reroll any number of their dice during this combat round." },
    commander: { name: "G'hom Sek'kus", unlock: "Win a combat.", description: "At the start of a combat round: Apply +1 to the result of each of your unit's combat rolls during this round." },
    hero: { name: "Sh'val, Harbinger", description: "ACTION: Place this card face-up in your play area. For each combat you win this game round, gain 1 victory point. At the end of the game round, purge this card." },
  },
  {
    name: "The Universities of Jol-Nar",
    shortName: "Jol-Nar",
    color: "260 50% 55%",
    abilities: [
      "Fragile: Apply -1 to the result of each of your unit's combat rolls.",
      "Brilliant: When you spend a command token to resolve the secondary ability of the Technology strategy card, you may resolve the primary ability instead.",
    ],
    promissoryNote: "Research Agreement — After the Jol-Nar player researches a technology that is not a faction technology: Gain that technology. Then return this card.",
    startingUnits: "2 Carriers, 1 Dreadnought, 2 Infantry, 1 Fighter, 1 Space Dock, 2 PDS",
    startingTech: ["Antimass Deflectors", "Neural Motivator", "Sarween Tools", "Plasma Scoring"],
    commodities: 4,
    strategyTip: "You start with 4 technologies—an enormous advantage. Rush high-tier tech to offset Fragile. Avoid direct combat when possible; let your tech carry you.",
    factionTech: [
      { name: "E-Res Siphons", type: "yellow", prerequisites: "YY", description: "After another player activates a system that contains 1 or more of your ships, gain 4 trade goods." },
      { name: "J.N.S. Hylarim", type: "unit", prerequisites: "BB", description: "Cost 8 / Combat 6(×2) / Move 2 / Capacity 3 / Sustain Damage. When making a combat roll for this ship, each result of 9 or 10 (before applying modifiers) produces 2 additional hits." },
    ],
    agent: { name: "Doctor Sucaban", description: "When a player spends a command token from their strategy pool to resolve the secondary ability of a technology strategy card: You may exhaust this card to allow that player to research 1 technology for free." },
    commander: { name: "Ta Zern", unlock: "Own 8 or more technologies.", description: "When you research a technology: You may exhaust 1 of your technologies to ignore 1 prerequisite." },
    hero: { name: "Rin, The Master's Legacy", description: "ACTION: For each non-faction technology you own, you may replace it with any technology of the same color. Purge this card." },
  },
  {
    name: "The Winnu",
    shortName: "Winnu",
    color: "270 40% 45%",
    abilities: [
      "Blood Ties: You do not have to pay influence to remove the custodians token from Mecatol Rex.",
      "Reclamation: After you resolve a tactical action during which you gained control of Mecatol Rex, you may place 1 PDS or 1 space dock from your reinforcements on Mecatol Rex.",
    ],
    promissoryNote: "Acquiescence — At the end of the strategy phase: Exchange your strategy card with the Winnu player's strategy card. Then return this card.",
    startingUnits: "1 Carrier, 1 Cruiser, 2 Infantry, 2 Fighters, 1 Space Dock, 1 PDS",
    startingTech: [],
    commodities: 3,
    strategyTip: "Rush Mecatol Rex—Blood Ties makes it free. Control of the center gives you VP and leverage. Build a strong fleet to hold Mecatol against challengers.",
    factionTech: [
      { name: "Lazax Gate Folding", type: "blue", prerequisites: "BB", description: "During your tactical actions, if you do not control Mecatol Rex, you may exhaust this card to place a Creuss wormhole token in the Mecatol Rex system." },
      { name: "Hegemonic Trade Policy", type: "yellow", prerequisites: "YY", description: "Exhaust this card when 1 or more of your units use Production; swap the resource and influence values of 1 planet you control for this production." },
    ],
    agent: { name: "Berekar Berekon", description: "When a player would spend a command token during the secondary ability of a strategy card: You may exhaust this card; that player does not spend that command token." },
    commander: { name: "Rickar Rickani", unlock: "Control Mecatol Rex or enter a home system during a tactical action.", description: "When you gain control of a planet: You may produce 1 unit on that planet." },
    hero: { name: "Mathis Mathinus", description: "ACTION: During this game round, when you explore a planet, draw 3 cards instead of 1 and choose which to resolve. Purge this card." },
  },
  {
    name: "The Xxcha Kingdom",
    shortName: "Xxcha",
    color: "140 40% 40%",
    abilities: [
      "Peace Accords: After you resolve the primary or secondary ability of the Diplomacy strategy card, you may gain 1 command token.",
      "Quash: When an agenda is revealed, you may spend 1 token from your strategy pool to discard that agenda and reveal the next agenda from the top of the deck.",
    ],
    promissoryNote: "Political Favor — When an agenda is being voted on: Cast your votes for the current agenda. Those votes must be cast for the same outcome as the Xxcha player's votes. Then return this card.",
    startingUnits: "2 Carriers, 1 Cruiser, 4 Infantry, 3 Fighters, 1 Space Dock, 1 PDS",
    startingTech: ["Graviton Laser System"],
    commodities: 4,
    strategyTip: "You excel in the political game. Use Quash to control the Agenda phase. PDS networks with Graviton Laser System create powerful defensive zones.",
    factionTech: [
      { name: "Instinct Training", type: "green", prerequisites: "GG", description: "You may exhaust this card and spend 1 token from your strategy pool when another player plays an action card; cancel that action card." },
      { name: "Nullification Field", type: "yellow", prerequisites: "YY", description: "After another player activates a system that contains 1 or more of your ships, you may exhaust this card and spend 1 token from your fleet pool; that player removes 1 ship from the active system and places it in their reinforcements." },
    ],
    agent: { name: "Elder Qanoj", description: "After an agenda is revealed: You may exhaust this card to read the next card in the agenda deck; place it face up or face down on top of the deck." },
    commander: { name: "Xxekir Grom", unlock: "Have 3 or more PDS on the game board.", description: "After another player activates a system that contains 1 or more of your PDS: You may exhaust this card to use 1 of your PDS' Space Cannon ability." },
    hero: { name: "Xxcha Ancestor", description: "ACTION: After an agenda is revealed, you may cast 5 additional votes for any outcome. Purge this card." },
  },
  {
    name: "The Yin Brotherhood",
    shortName: "Yin",
    color: "0 0% 80%",
    abilities: [
      "Indoctrination: When you gain control of a planet, you may replace 1 of the other player's infantry on that planet with 1 of your own infantry.",
      "Devotion: After each space combat round, you may destroy 1 of your cruisers or destroyers in the active system to produce 1 hit.",
    ],
    promissoryNote: "Greyfire Mutagen — After a system is activated: Place this card face-up in your play area. The Yin player cannot use their Devotion ability during combat in this system. Return this card at the end of combat.",
    startingUnits: "2 Carriers, 1 Destroyer, 4 Infantry, 4 Fighters, 1 Space Dock",
    startingTech: ["Sarween Tools"],
    commodities: 2,
    strategyTip: "Devotion turns your smaller ships into guaranteed hits. Indoctrination helps you take planets efficiently. Build a swarm of expendable ships for maximum combat value.",
    factionTech: [
      { name: "Impulse Core", type: "yellow", prerequisites: "YY", description: "At the start of a space combat, you may destroy 1 of your cruisers or destroyers in the active system to produce 1 hit against your opponent' ships; this hit must be assigned to 1 of your opponent' non-fighter ships if able." },
      { name: "Yin Spinner", type: "green", prerequisites: "GG", description: "After you produce 1 or more units, place 1 infantry from your reinforcements on a planet you control in that system' production." },
    ],
    agent: { name: "Brother Milor", description: "When a player commits 1 or more units to a planet: You may exhaust this card to choose 1 of that player's ground forces on that planet; that ground force does not participate in ground combat on this planet during this invasion." },
    commander: { name: "Brother Omar", unlock: "Control a planet in another player's home system.", description: "When 1 or more of your units use Bombardment or Space Cannon: 1 of those units may use its Bombardment or Space Cannon ability 1 additional time." },
    hero: { name: "Danara Yin", description: "ACTION: Choose 1 system that contains your flagship; each other player's non-structure units in that system are destroyed. Purge this card." },
  },
  {
    name: "The Yssaril Tribes",
    shortName: "Yssaril",
    color: "130 60% 30%",
    abilities: [
      "Stall Tactics: Action: Discard 1 action card from your hand to pass.",
      "Scheming: When you draw action cards, draw 1 additional card. Then return 1 action card to the bottom of the deck.",
    ],
    promissoryNote: "Spy Net — At the start of your turn: Look at the Yssaril player's hand of action cards. Choose 1 and add it to your hand. Then return this card.",
    startingUnits: "2 Carriers, 1 Cruiser, 5 Infantry, 2 Fighters, 1 Space Dock",
    startingTech: ["Neural Motivator"],
    commodities: 3,
    strategyTip: "Action card advantage is your superpower. Use Stall Tactics to always act last when it matters. Hoard action cards for devastating combo plays.",
    factionTech: [
      { name: "Mageon Implants", type: "green", prerequisites: "GGG", description: "ACTION: Exhaust this card to look at another player' hand of action cards. Choose 1 of those cards and add it to your hand." },
      { name: "Transparasteel Plating", type: "green", prerequisites: "G", description: "During your turn of the action phase, players cannot play action cards." },
    ],
    agent: { name: "Ssruu", description: "After a player activates a system: You may exhaust this card to allow that player to look at the top 2 cards of their deck; they place 1 on top and 1 on the bottom." },
    commander: { name: "So Ata", unlock: "Have 7 or more action cards in your hand.", description: "After you draw 1 or more action cards: You may draw 1 additional action card." },
    hero: { name: "Kyver, Blade and Key", description: "ACTION: Each other player places 2 random action cards from their hand face-up in your play area. Take any of those cards into your hand. Return the rest. Purge this card." },
  },
];

export const POK_FACTIONS: Faction[] = [
  {
    name: "The Argent Flight",
    shortName: "Argent",
    color: "0 0% 70%",
    abilities: [
      "Zeal: You may perform a tactical action in a system that contains 1 or more of your command tokens.",
      "Raid Formation: When 1 or more of your units use Anti-Fighter Barrage, for each hit produced in excess of your opponent's fighters, choose 1 of your opponent's non-fighter ships to be destroyed.",
    ],
    promissoryNote: "Strike Wing Ambuscade — When you use Anti-Fighter Barrage: Apply +2 to each of your units' Anti-Fighter Barrage rolls. Then return this card.",
    startingUnits: "2 Carriers, 1 Destroyer, 5 Infantry, 2 Fighters, 1 Space Dock, 1 PDS",
    startingTech: ["Neural Motivator", "Sarween Tools"],
    commodities: 3,
    strategyTip: "Raid Formation makes your destroyers lethal—excess AFB hits kill capital ships. Zeal gives incredible flexibility for re-activating systems.",
    factionTech: [
      { name: "Aerie Hololattice", type: "yellow", prerequisites: "Y", description: "Other players cannot use the secondary abilities of your strategy cards. When you resolve the primary ability of a strategy card, you may resolve the secondary ability of that card without spending a command token." },
      { name: "Strike Wing Alpha II", type: "unit", prerequisites: "YR", description: "Cost 2 / Combat 7 / Move 3 / Capacity 1 / Anti-Fighter Barrage 6(×3). This unit can transport 1 infantry or 1 mech." },
    ],
    agent: { name: "Trillossa Aun Mirik", description: "At the start of a combat round: You may exhaust this card to choose a player in the active system; that player may reroll any of their dice that did not produce a hit." },
    commander: { name: "Trrakan Aun Zulok", unlock: "Have units in 3 or more systems that contain no planets.", description: "At the end of a player's tactical action, if you have 1 or more ships in the active system: You may place 1 destroyer from your reinforcements in the active system." },
    hero: { name: "Mirik Aun Sissiri", description: "ACTION: Place this card face-up in your play area. For each combat this game round: apply +2 to Anti-Fighter Barrage rolls. At the end of the game round, purge this card." },
  },
  {
    name: "The Empyrean",
    shortName: "Empyrean",
    color: "280 50% 50%",
    abilities: [
      "Voidborn: Nebulae do not affect your ship movement.",
      "Aetherpassage: After a player activates a system that is adjacent to 1 or more of your systems, you may allow that player to move their ships through your systems.",
    ],
    promissoryNote: "Blood Pact — Action: Place this card face-up in your play area. The Empyrean player places a command token from their reinforcements in your fleet pool.",
    startingUnits: "1 Carrier, 1 Dreadnought, 3 Infantry, 2 Fighters, 1 Space Dock, 1 PDS",
    startingTech: ["Dark Energy Tap"],
    commodities: 4,
    strategyTip: "Use Aetherpassage as a diplomatic tool—offer passage in exchange for favors. Your flexibility in negotiation is your greatest strength.",
    factionTech: [
      { name: "Aetherstream", type: "blue", prerequisites: "BB", description: "After you or one of your neighbors activates a system that is adjacent to an anomaly: You may apply +1 to the move value of all of the moving player' ships during this tactical action." },
      { name: "Voidwatch", type: "green", prerequisites: "G", description: "After a player activates a system that contains your units: You may exhaust this card; if so, during this tactical action, the other player cannot use ANTI-FIGHTER BARRAGE." },
    ],
    agent: { name: "Acamar", description: "After a player activates a system: You may exhaust this card to allow that player to remove 1 of their command tokens from the game board and place it in their reinforcements." },
    commander: { name: "Xuange", unlock: "Have units in or adjacent to 2 or more anomalies.", description: "Other players must spend 1 influence to activate a system that is adjacent to 1 or more of your systems that contain your ships." },
    hero: { name: "Conservator Procyon", description: "ACTION: Place this card face-up in your play area. Other players cannot activate systems that contain your structures. At the end of the status phase, purge this card." },
  },
  {
    name: "The Mahact Gene-Sorcerers",
    shortName: "Mahact",
    color: "50 50% 40%",
    abilities: [
      "Edict: When you win a combat, place the loser's command token in your fleet pool if it is not already there.",
      "Imperia: While another player's command token is in your fleet pool, you can use that player's commander ability.",
    ],
    promissoryNote: "Scepter of Emelpar — At the start of a combat: Remove 1 token from the Mahact player's fleet pool and return this card. That token is placed in your reinforcements.",
    startingUnits: "2 Carriers, 1 Cruiser, 3 Infantry, 2 Fighters, 1 Space Dock",
    startingTech: ["Bio-Stims", "Predictive Intelligence"],
    commodities: 3,
    strategyTip: "Win combats to steal command tokens and commander abilities. Mahact grows stronger with every victory. Target players with the best commanders first.",
    factionTech: [
      { name: "Genetic Recombination", type: "green", prerequisites: "G", description: "You may exhaust this card before a player casts votes; that player must cast at least 1 vote for an outcome of your choice or abstain from this agenda. You cannot use this ability against the player who nominated this agenda." },
      { name: "Crimson Legionnaire II", type: "unit", prerequisites: "GG", description: "Cost 1(×2) / Combat 7. After this unit is destroyed, if the active player is not you, place this unit on your faction sheet; at the start of your next turn, place each unit on your faction sheet on a planet you control in your home system." },
    ],
    agent: { name: "Jae Mir Kan", description: "After a player resolves a tactical action: You may exhaust this card to allow that player to remove 1 of their command tokens from the game board and place it in their reinforcements." },
    commander: { name: "Il Na Vansen", unlock: "Have another player's command token in your fleet pool.", description: "At the start of combat: You may spend 1 token from your fleet pool that matches another player's faction to apply -2 to the combat value of that player's units during this combat." },
    hero: { name: "Airo Sheredyn, Scion of the Throne", description: "ACTION: For each other player's command token in your fleet pool, you may purge that token. For each token purged, gain 1 victory point. Purge this card." },
  },
  {
    name: "The Naaz-Rokha Alliance",
    shortName: "Naaz-Rokha",
    color: "90 40% 40%",
    abilities: [
      "Distant Suns: When you explore a planet, draw 1 additional card. Then return 1 exploration card to the top or bottom of the deck.",
      "Fabrication: Action: Either purge 2 of your relic fragments of the same type to gain 1 relic, or purge 1 of your relic fragments to gain 1 command token.",
    ],
    promissoryNote: "Black Market Forgery — Action: Purge 2 of your relic fragments of any type to gain 1 relic. Then return this card.",
    startingUnits: "2 Carriers, 1 Destroyer, 3 Infantry, 2 Fighters, 1 Space Dock, 1 Mech",
    startingTech: ["Psychoarchaeology", "AI Development Algorithm"],
    commodities: 3,
    strategyTip: "Explore aggressively to accumulate relic fragments. Fabrication turns fragments into relics or command tokens. Double exploration draws give you massive discovery advantage.",
    factionTech: [
      { name: "Supercharge", type: "red", prerequisites: "R", description: "At the start of a combat round, you may exhaust this card to apply +1 to the result of each of your unit' combat rolls during this combat round." },
      { name: "Z-Grav Eddying II", type: "unit", prerequisites: "GY", description: "Cost 2 / Combat 8 / Move 2. After this unit moves, if it is in the space area of an anomaly, you may explore that planet as if you controlled it. This unit may transport 1 mech or 1 infantry." },
    ],
    agent: { name: "Garv and Gunn", description: "After a player explores a planet: You may exhaust this card; if you do, that player gains 1 trade good." },
    commander: { name: "Dart and Tai", unlock: "Purge 2 or more relic fragments.", description: "After you explore a planet: You may draw 1 relic fragment of any type." },
    hero: { name: "Hesh and Prit", description: "ACTION: Gain 3 relics. Purge this card." },
  },
  {
    name: "The Nomad",
    shortName: "Nomad",
    color: "30 50% 45%",
    abilities: [
      "The Company: During setup, place your flagship in your home system. It does not count against your fleet supply.",
      "Future Sight: During the agenda phase, you may look at the top card of the agenda deck at any time.",
    ],
    promissoryNote: "The Cavalry — At the start of a space combat in a system that is adjacent to the Nomad's flagship: The Nomad places their flagship in the active system.",
    startingUnits: "1 Carrier, 1 Flagship, 1 Destroyer, 4 Infantry, 2 Fighters, 1 Space Dock",
    startingTech: ["Sling Relay"],
    commodities: 4,
    strategyTip: "Your flagship is your mobile base of operations. Future Sight gives you agenda phase intelligence. Use The Cavalry promissory note as a powerful diplomatic bargaining chip.",
    factionTech: [
      { name: "Temporal Command Suite", type: "yellow", prerequisites: "Y", description: "After any player' agent is exhausted, you may exhaust this card to ready that agent. If you ready another player' agent, you may perform a transaction with that player." },
      { name: "Memoria II", type: "unit", prerequisites: "BBY", description: "Cost 8 / Combat 5(×2) / Move 2 / Capacity 6 / Sustain Damage. During combat against your ships in this system, your opponent' fighters and ground forces cannot make combat rolls." },
    ],
    agent: { name: "Artuno the Betrayer", description: "After a player activates a system that contains 1 or more of their ships: You may exhaust this card to allow that player to spend 3 trade goods to place 1 cruiser from their reinforcements in the active system." },
    commander: { name: "Navarch Feng", unlock: "Have your flagship on the game board.", description: "During combat in a system that contains your flagship: Apply +1 to the result of each of your unit's combat rolls." },
    hero: { name: "The Thundarian", description: "ACTION: Place this card face-up in your play area. Your flagship gains Sustain Damage and its combat value becomes 3. At the end of the status phase, purge this card." },
  },
  {
    name: "The Titans of Ul",
    shortName: "Ul",
    color: "20 60% 40%",
    abilities: [
      "Terragenesis: After you explore a planet that does not have a sleeper token, place 1 sleeper token on that planet.",
      "Awaken: After you activate a system that contains 1 or more of your sleeper tokens, you may replace each of your sleeper tokens in that system with 1 PDS.",
    ],
    promissoryNote: "Terraform — Action: Attach this card to a non-home, non-Mecatol Rex planet you control. Its resource and influence values are each increased by 1.",
    startingUnits: "1 Carrier, 1 Cruiser, 1 Dreadnought, 3 Infantry, 1 Fighter, 1 Space Dock, 1 PDS",
    startingTech: ["Antimass Deflectors", "Scanlink Drone Network"],
    commodities: 2,
    strategyTip: "Spread sleeper tokens everywhere, then awaken them into PDS networks. Your defensive infrastructure becomes nearly impenetrable. Control the map through zone denial.",
    factionTech: [
      { name: "Hel-Titan II", type: "unit", prerequisites: "RY", description: "Production 1 / Sustain Damage / Space Cannon 5. This unit is treated as both a structure and a ground force. It cannot be transported. You may use this unit' Space Cannon against ships that are in its system." },
      { name: "Saturn Engine II", type: "unit", prerequisites: "GBRY", description: "Cost 2 / Combat 7 / Move 3 / Capacity 1 / Sustain Damage. This unit may transport 1 infantry or 1 mech." },
    ],
    agent: { name: "Hecatoncheires", description: "After a player explores a planet: You may exhaust this card to allow that player to place 1 PDS or 1 infantry from their reinforcements on that planet." },
    commander: { name: "Tungstantus", unlock: "Have 5 or more PDS or structures on the game board.", description: "When you use Production: You may produce 1 PDS or 1 infantry for free." },
    hero: { name: "Ul the Progenitor", description: "ACTION: Place this card face-up in your play area. Your PDS gain Space Cannon 3 and lose Planetary Shield. At the end of the status phase, purge this card." },
  },
  {
    name: "The Vuil'Raith Cabal",
    shortName: "Vuil'Raith",
    color: "340 70% 35%",
    abilities: [
      "Dimensional Anchors: After you win a space combat, you may purge 1 of the losing player's captured units to gain 1 command token.",
      "The Rift: Whenever 1 of your ships is destroyed during combat, you may capture it instead.",
    ],
    promissoryNote: "Parasitic Oblation — At the start of your turn: Return this card to purge 1 of the Cabal player's captured units. Then gain command tokens equal to that unit's cost.",
    startingUnits: "1 Carrier, 1 Dreadnought, 3 Infantry, 2 Fighters, 1 Space Dock",
    startingTech: ["Self Assembly Routines"],
    commodities: 2,
    strategyTip: "Capture enemy units instead of destroying them—then purge them for command tokens. The Rift means your ships are never truly lost. Fight often to fuel your war machine.",
    factionTech: [
      { name: "Dimensional Tear II", type: "unit", prerequisites: "RR", description: "Production 7. When you activate a system that contains a dimensional tear space dock, you may remove up to 2 of your captured units and place them in the active system as your units." },
      { name: "Vortex", type: "red", prerequisites: "R", description: "ACTION: Exhaust this card to choose another player' non-structure unit in a system that is adjacent to 1 or more of your units that have Capacity; capture that unit." },
    ],
    agent: { name: "It Feeds on Carrion", description: "After a player's unit is destroyed: You may exhaust this card; if you do, the player who destroyed that unit may place 1 infantry from their reinforcements on a planet they control in that system." },
    commander: { name: "Riftwalker Meian", unlock: "Have 2 or more captured units.", description: "After you win a space combat: You may replace 1 of the loser's non-structure units with 1 of your own from your reinforcements." },
    hero: { name: "Kordhek Yeel", description: "ACTION: Place all captured units on planets you control in your home system. These units are now your units. Purge this card." },
  },
];
