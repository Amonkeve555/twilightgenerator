export interface FactionTech {
  name: string;
  type: "unit" | "green" | "blue" | "yellow" | "red" | "none";
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

export interface FactionUnit {
  name: string;
  stats: string;
  description: string;
  /** For faction units that replace a standard unit (e.g. "destroyer"). */
  replaces?: string;
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
  /** When set, the player picks this many of startingTech (e.g. Argent: 2 of 3). */
  startingTechChoose?: number;
  commodities?: number;
  strategyTip?: string;
  flagship?: FactionUnit;
  mech?: FactionUnit;
  factionUnits?: FactionUnit[];
  factionTech?: FactionTech[];
  agent?: FactionAgent;
  /** Nomad ("The Company") has 3 agents. */
  additionalAgents?: FactionAgent[];
  commander?: FactionCommander;
  hero?: FactionHero;
}

// Generic tech reference for starting techs
export const GENERIC_TECH: Record<string, { type: "green" | "blue" | "yellow" | "red"; description: string }> = {
  "Antimass Deflectors": { type: "blue", description: "Your ships can move into and through asteroid fields. When other players' units use SPACE CANNON against your units, apply -1 to the result of each die roll." },
  "Plasma Scoring": { type: "red", description: "When 1 or more of your units use BOMBARDMENT or SPACE CANNON, 1 of those units may roll 1 additional die." },
  "Neural Motivator": { type: "green", description: "During the status phase, draw 2 action cards instead of 1." },
  "Sarween Tools": { type: "yellow", description: "When 1 or more of your units use PRODUCTION, reduce the combined cost of the produced units by 1." },
  "Gravity Drive": { type: "blue", description: "After you activate a system, apply +1 to the move value of 1 of your ships during this tactical action." },
  "Magen Defense Grid": { type: "red", description: "You may exhaust this card at the start of a round of ground combat on a planet that contains 1 or more of your units that have PLANETARY SHIELD; your opponent cannot make combat rolls this combat round." },
  "Graviton Laser System": { type: "yellow", description: "You may exhaust this card before 1 or more of your units uses SPACE CANNON; hits produced by those units must be assigned to non-fighter ships if able." },
  "Dacxive Animators": { type: "green", description: "After you win a ground combat, you may place 1 infantry from your reinforcements on that planet." },
  "Dark Energy Tap": { type: "blue", description: "After you perform a tactical action in a system that contains a frontier token, if you have 1 or more ships in that system, explore that token. Your ships can retreat into adjacent systems that do not contain other players' units, even if you do not have units or control planets in that system." },
  "Bio-Stims": { type: "green", description: "You may exhaust this card at the end of your turn to ready 1 of your planets that has a technology specialty or 1 of your other technologies." },
  "Predictive Intelligence": { type: "yellow", description: "At the end of your turn, you may exhaust this card to redistribute your command tokens. When you cast votes during the agenda phase, you may cast 3 additional votes; if you do, and the outcome you voted for is not resolved, exhaust this card." },
  "Psychoarchaeology": { type: "green", description: "You can use technology specialties on planets you control without exhausting them, even if those planets are exhausted. During the action phase, you can exhaust planets you control that have technology specialties to gain 1 trade good." },
  "AI Development Algorithm": { type: "red", description: "When you research a unit upgrade technology, you may exhaust this card to ignore any 1 prerequisite. When 1 or more of your units use PRODUCTION, you may exhaust this card to reduce the combined cost of the produced units by the number of unit upgrade technologies that you own." },
  "Sling Relay": { type: "blue", description: "ACTION: Exhaust this card to produce 1 ship in any system that contains one of your space docks." },
  "Scanlink Drone Network": { type: "yellow", description: "When you activate a system, you may explore 1 planet in that system which contains 1 or more of your units." },
  "Self Assembly Routines": { type: "red", description: "After 1 or more of your units use PRODUCTION, you may exhaust this card to place 1 mech from your reinforcements on a planet you control in that system. After 1 of your mechs is destroyed, gain 1 trade good." },
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
  "Space Dock": "Production X (2 more than the resource value of its planet). Up to 3 fighters in its system don't count against your ships' capacity.",
  "War Sun": "Cost 12 / Combat 3(×3) / Move 2 / Capacity 6 / Sustain Damage / Bombardment 3(×3). Requires the War Sun technology to produce. Other players' units on planets in its system lose Planetary Shield.",
  "Flagship": "Unique to each faction. Powerful capital ship with a special ability.",
  "Mech": "Cost 2 / Combat 6 / Sustain Damage. Durable ground force with a faction-specific ability.",
};

// Faction card text below (both lists) is generated from the AsyncTI4 bot's card data
// (github.com/AsyncTI4/TI4_map_generator_bot, src/main/resources/data), using the printed
// base-game and Prophecy of Kings versions — not Codex Ω revisions or Thunder's Edge cards.
// The PoK factions were cross-checked against the official Czech faction sheets.
// Don't hand-edit rules text from memory; strategy tips are the only hand-written part.
export const TI4_FACTIONS: Faction[] = [
  {
    name: "The Arborec",
    shortName: "Arborec",
    color: "120 50% 35%",
    abilities: [
      "Mitosis: Your space docks cannot produce infantry. At the start of the status phase, place 1 infantry from your reinforcements on any planet you control.",
    ],
    promissoryNote: "Stymie — After another player moves ships into a system that contains 1 or more of your units: You may place 1 command token from that player's reinforcements in any non-home system. Then, return this card to the Arborec player.",
    startingUnits: "1 Carrier, 1 Cruiser, 2 Fighters, 4 Infantry, 1 Space Dock, 1 PDS",
    startingTech: ["Magen Defense Grid"],
    commodities: 3,
    strategyTip: "Mitosis adds a free infantry every status phase, but your space docks cannot produce infantry, so spread out and let the board fill itself. Letani Warriors have Production, and Duha Menaimon can produce up to 5 units wherever it is activated.",
    flagship: { name: "Duha Menaimon", stats: "Cost 8 / Combat 7(×2) / Move 1 / Capacity 5 / Sustain Damage", description: "After you activate this system, you may produce up to 5 units in this system." },
    mech: { name: "Letani Behemoth", stats: "Cost 2 / Combat 6 / Sustain Damage / Planetary Shield / Production 2", description: "DEPLOY: When you would use your Mitosis faction ability you may replace 1 of your infantry with 1 mech from your reinforcements instead." },
    factionUnits: [
      { name: "Letani Warrior I", stats: "Cost 1(×2) / Combat 8 / Production 1", description: "", replaces: "infantry" },
    ],
    factionTech: [
      { name: "Bioplasmosis", type: "green", prerequisites: "GG", description: "At the end of the status phase, you may remove any number of infantry from planets you control and place them on 1 or more planets you control in the same or adjacent systems." },
      { name: "Letani Warrior II", type: "unit", prerequisites: "GG", description: "Cost 1(×2), Combat 7. PRODUCTION 2. After this unit is destroyed, roll 1 die. If the result is 6 or greater, place the unit on this card. At the start of your next turn, place each unit that is on this card on a planet you control in your home system." },
    ],
    agent: { name: "Letani Ospha", description: "ACTION: Exhaust this card and choose a player's non-fighter ship: that player may replace that ship with one from their reinforcements that costs up to 2 more than the replaced ship." },
    commander: { name: "Dirzuga Rophal", unlock: "Have 12 ground forces on planets you control.", description: "After another player activates a system that contains 1 or more of your units that have PRODUCTION: You may produce 1 unit in that system." },
    hero: { name: "Letani Miasmiala", description: "ACTION: Produce any number of units in any number of systems that contain 1 or more of your ground forces. Then, purge this card." },
  },
  {
    name: "The Barony of Letnev",
    shortName: "Letnev",
    color: "0 0% 25%",
    abilities: [
      "Munitions Reserves: At the start of each round of space combat, you may spend 2 trade goods to re-roll any number of your dice during that combat round.",
      "Armada: The maximum number of non-fighter ships you can have in each system is equal to 2 more than the number of tokens in your fleet pool.",
    ],
    promissoryNote: "War Funding — After you and your opponent roll dice during space combat: You may reroll all of your opponent's dice. You may reroll any number of your dice. Then, return this card to the Letnev player.",
    startingUnits: "1 Dreadnought, 1 Carrier, 1 Destroyer, 1 Fighter, 3 Infantry, 1 Space Dock",
    startingTech: ["Antimass Deflectors", "Plasma Scoring"],
    commodities: 2,
    strategyTip: "Armada lets you have 2 more non-fighter ships per system than your fleet pool tokens, and Munitions Reserves re-rolls dice for 2 trade goods. Arc Secundus repairs itself and strips Planetary Shield.",
    flagship: { name: "Arc Secundus", stats: "Cost 8 / Combat 5(×2) / Move 1 / Capacity 3 / Sustain Damage / Bombardment 5(×3)", description: "Other players' units in this system lose PLANETARY SHIELD. At the start of each space combat round, repair this ship." },
    mech: { name: "Dunlain Reaper", stats: "Cost 2 / Combat 6 / Sustain Damage", description: "DEPLOY: At the start of a round of ground combat, you may spend 2 resources to replace 1 of your infantry in that combat with 1 mech." },
    factionTech: [
      { name: "L4 Disruptors", type: "yellow", prerequisites: "Y", description: "During an invasion, units cannot use SPACE CANNON against your units." },
      { name: "Non-Euclidean Shielding", type: "red", prerequisites: "RR", description: "When 1 of your units uses SUSTAIN DAMAGE, cancel 2 hits instead of 1." },
    ],
    agent: { name: "Viscount Unlenn", description: "At the start of a space combat round: You may exhaust this card to choose 1 ship in the active system: that ship rolls 1 additional die during this combat round." },
    commander: { name: "Rear Admiral Farran", unlock: "Have 5 non-fighter ships in 1 system.", description: "After 1 of your units uses SUSTAIN DAMAGE: You may gain 1 trade good." },
    hero: { name: "Darktalon Treilla", description: "ACTION: Place this card near the game board. the number of non-fighter ships you can have in systems is not limited by laws or by the number of command tokens in your fleet pool during this game round. At the end of that game round, purge this card." },
  },
  {
    name: "The Clan of Saar",
    shortName: "Saar",
    color: "35 70% 45%",
    abilities: [
      "Scavenge: After you gain control of a planet, gain 1 trade good.",
      "Nomadic: You can score objectives even if you do not control the planets in your home system.",
    ],
    promissoryNote: "Raghs Call — After you commit 1 or more units to land on a planet: Remove all of the Saar player's ground forces from that planet and place them on a planet controlled by the Saar player. Then, return this card to the Saar player.",
    startingUnits: "2 Carriers, 1 Cruiser, 2 Fighters, 4 Infantry, 1 Space Dock",
    startingTech: ["Antimass Deflectors"],
    commodities: 3,
    strategyTip: "Your Floating Factories sit in space and move with your fleet, and Nomadic lets you score without controlling your home planets. Scavenge pays a trade good for every planet you take — keep expanding.",
    flagship: { name: "Son of Ragh", stats: "Cost 8 / Combat 5(×2) / Move 1 / Capacity 3 / Sustain Damage / Anti-Fighter Barrage 6(×4)", description: "" },
    mech: { name: "Scavenger Zeta", stats: "Cost 2 / Combat 6 / Sustain Damage", description: "DEPLOY: After you gain control of a planet, you may spend 1 trade good to place 1 mech on that planet" },
    factionUnits: [
      { name: "Floating Factory I", stats: "Move 1 / Capacity 4 / Production 5", description: "This unit is placed in the space area instead of on a planet. This unit can move and retreat as if it were a ship. If this unit is blockaded, it is destroyed.", replaces: "spacedock" },
    ],
    factionTech: [
      { name: "Floating Factory II", type: "unit", prerequisites: "YY", description: "Move 2, Capacity 5. PRODUCTION 7. This unit is placed in the space area instead of on a planet. This unit can move and retreat as if it were a ship. If this unit is blockaded, it is destroyed." },
      { name: "Chaos Mapping", type: "blue", prerequisites: "B", description: "Other players cannot activate asteroid fields that contain 1 or more of your ships. At the start of your turn during the action phase, you may produce 1 unit in a system that contains at least 1 of your units that has PRODUCTION." },
    ],
    agent: { name: "Captain Mendosa", description: "When a player activates a system: You may exhaust this card to increase the move value of 1 of that player's ships to match the move value of the ship on the game board that has the highest move value." },
    commander: { name: "Rowl Sarrig", unlock: "Have 3 space docks on the game board.", description: "When you produce fighters or infantry: You may place each of those units at any of your space docks that are not blockaded." },
    hero: { name: "Gurno Aggero", description: "ACTION: Choose 1 system that is adjacent to 1 of your space docks. Destroy all other players' infantry and fighters in that system. Then, purge this card." },
  },
  {
    name: "The Embers of Muaat",
    shortName: "Muaat",
    color: "15 80% 50%",
    abilities: [
      "Star Forge: ACTION: Spend 1 token from your strategy pool to place either 2 fighters or 1 destroyer from your reinforcements in a system that contains 1 or more of your war suns.",
      "Gashlai Physiology: Your ships can move through supernovas.",
    ],
    promissoryNote: "Fires of the Gashlai — ACTION: Remove 1 token from the Muaat player's fleet pool and return it to their reinforcements. Then, gain your war sun unit upgrade technology card.  Then, return this card to the Muaat Player.",
    startingUnits: "1 War Sun, 2 Fighters, 4 Infantry, 1 Space Dock",
    startingTech: ["Plasma Scoring"],
    commodities: 4,
    strategyTip: "You start with a war sun: Star Forge spends strategy tokens to place fighters or a destroyer next to it, and The Inferno places cruisers the same way. Gashlai Physiology lets you fly through supernovas.",
    flagship: { name: "The Inferno", stats: "Cost 8 / Combat 5(×2) / Move 1 / Capacity 3 / Sustain Damage", description: "ACTION: Spend 1 token from your strategy pool to place 1 cruiser in this system." },
    mech: { name: "Ember Colossus", stats: "Cost 2 / Combat 6 / Sustain Damage", description: "When you use your Star Forge faction ability in this system or an adjacent system, you may place 1 infantry from your reinforcements with this unit." },
    factionUnits: [
      { name: "Prototype War Sun I", stats: "Cost 12 / Combat 3(×3) / Move 1 / Capacity 6 / Sustain Damage / Bombardment 3(×3)", description: "Other players' units in this system lose the PLANETARY SHIELD ability.", replaces: "warsun" },
    ],
    factionTech: [
      { name: "Prototype War Sun II", type: "unit", prerequisites: "RRRY", description: "Cost 10, Combat 3(×3), Move 3, Capacity 6. SUSTAIN DAMAGE, BOMBARDMENT 3(×3). Other players' units in this system lose PLANETARY SHIELD." },
      { name: "Magmus Reactor", type: "red", prerequisites: "RR", description: "Your ships can move into supernovas. Each supernova that contains 1 or more of your units gains the PRODUCTION 5 ability as if it were 1 of your units." },
    ],
    agent: { name: "Umbat", description: "ACTION: Exhaust this card to choose a player: that player may produce up to 2 units that each have a cost of 4 or less in a system that contains one of their war suns or their flagship." },
    commander: { name: "Magmus", unlock: "Produce a war sun.", description: "After you spend a token from your strategy pool: You may gain 1 trade good." },
    hero: { name: "Adjudicator Ba'al", description: "After you move a war sun into a non-home system other than Mecatol Rex: You may destroy all other players' units in that system and replace that system tile with the Muaat supernova tile. If you do, purge this card and each planet card that corresponds to the replaced system tile." },
  },
  {
    name: "The Emirates of Hacan",
    shortName: "Hacan",
    color: "45 80% 50%",
    abilities: [
      "Masters of Trade: You do not have to spend a command token to resolve the secondary ability of the \"Trade\" strategy card.",
      "Guild Ships: You can negotiate transactions with players who are not your neighbor.",
      "Arbiters: When you are negotiating a transaction, action cards can be exchanged as part of that transaction.",
    ],
    promissoryNote: "Trade Convoys — ACTION: Place this card faceup in your play area. While this card is in your play area, you may negotiate transactions with players who are not your neighbor.  If you activate a system that contains 1 or more of the Hacan player's units, return this card to the Hacan player.",
    startingUnits: "2 Carriers, 1 Cruiser, 2 Fighters, 4 Infantry, 1 Space Dock",
    startingTech: ["Sarween Tools", "Antimass Deflectors"],
    commodities: 6,
    strategyTip: "You are the galaxy's trader: follow Trade without a command token, deal with non-neighbours, and swap action cards in transactions. Wrath of Kenara turns trade goods into +1 combat rolls.",
    flagship: { name: "Wrath of Kenara", stats: "Cost 8 / Combat 7(×2) / Move 1 / Capacity 3 / Sustain Damage", description: "After you roll a die during a space combat in this system, you may spend 1 trade good to apply +1 to the result." },
    mech: { name: "Pride of Kenara", stats: "Cost 2 / Combat 6 / Sustain Damage", description: "This planet's card may be traded as part of a transaction; if you do, move all of your units from this planet to another planet you control." },
    factionTech: [
      { name: "Quantum Datahub Node", type: "yellow", prerequisites: "YYY", description: "At the end of the strategy phase, you may spend 1 token from your strategy pool and give another player 3 of your trade goods. If you do, give 1 of your strategy cards to that player and take 1 of their strategy cards." },
      { name: "Production Biomes", type: "green", prerequisites: "GG", description: "ACTION: Exhaust this card and spend 1 token from your strategy pool to gain 4 trade goods and choose 1 other player; that player gains 2 trade goods." },
    ],
    agent: { name: "Carth of Golden Sands", description: "During the action phase: You may exhaust this card to gain 2 commodities or replenish another player's commodities." },
    commander: { name: "Gila the Silvertongue", unlock: "Have 10 trade goods.", description: "When you cast votes: You may spend any number of trade goods: cast 2 additional votes for each trade good spent." },
    hero: { name: "Harrugh Gefhara", description: "When 1 or more of your units use PRODUCTION: You may reduce the cost of each of your units to 0 during this use of PRODUCTION. If you do, purge this card." },
  },
  {
    name: "The Federation of Sol",
    shortName: "Sol",
    color: "210 60% 50%",
    abilities: [
      "Orbital Drop: ACTION: Spend 1 token from your strategy pool to place 2 infantry from your reinforcements on 1 planet you control.",
      "Versatile: When you gain command tokens during the status phase, gain 1 additional command token.",
    ],
    promissoryNote: "Military Support — At the start of the Sol player's turn: Remove 1 token from the Sol player's strategy pool, if able, and return it to their reinforcements. Then, you may place 2 infantry from your reinforcements on any planet you control. Then, return this card to the Sol player.",
    startingUnits: "2 Carriers, 1 Destroyer, 3 Fighters, 5 Infantry, 1 Space Dock",
    startingTech: ["Antimass Deflectors", "Neural Motivator"],
    commodities: 4,
    strategyTip: "Versatile gives an extra command token every status phase, and Orbital Drop places 2 infantry on a planet you control. Advanced Carriers and Spec Ops infantry make strong invasions; Genesis adds infantry each status phase.",
    flagship: { name: "Genesis", stats: "Cost 8 / Combat 5(×2) / Move 1 / Capacity 12 / Sustain Damage", description: "At the end of the status phase, place 1 infantry from your reinforcements in this system's space area." },
    mech: { name: "ZS Thunderbolt M2", stats: "Cost 2 / Combat 6 / Sustain Damage", description: "DEPLOY: After you use your Orbital Drop faction ability, you may spend 3 resources to place 1 mech on that planet." },
    factionUnits: [
      { name: "Advanced Carrier I", stats: "Cost 3 / Combat 9 / Move 1 / Capacity 6", description: "", replaces: "carrier" },
      { name: "Spec Ops I", stats: "Cost 1(×2) / Combat 7", description: "", replaces: "infantry" },
    ],
    factionTech: [
      { name: "Spec Ops II", type: "unit", prerequisites: "GG", description: "Cost 1(×2), Combat 6. After this unit is destroyed, roll 1 die. If the result is 5 or greater, place the unit on this card. At the start of your next turn, place each unit that is on this card on a planet you control in your home system." },
      { name: "Advanced Carrier II", type: "unit", prerequisites: "BB", description: "Cost 3, Combat 9, Move 2, Capacity 8. SUSTAIN DAMAGE" },
    ],
    agent: { name: "Evelyn DeLouis", description: "At the start of a ground combat round: You may exhaust this card to choose 1 ground force in the active system: that ground force rolls 1 additional die during this combat round." },
    commander: { name: "Claire Gibson", unlock: "Control planets that have a combined total of at least 12 resources.", description: "At the start of a ground combat on a planet you control: You may place 1 infantry from your reinforcements on that planet." },
    hero: { name: "Jace X, 4th Air Legion", description: "ACTION: Remove each of your command tokens from the game board and return them to your reinforcements. Then, purge this card." },
  },
  {
    name: "The Ghosts of Creuss",
    shortName: "Creuss",
    color: "220 70% 60%",
    abilities: [
      "Quantum Entanglement: You treat all systems that contain either an alpha or beta wormhole as adjacent to each other. Game effects cannot prevent you from using this ability.",
      "Slipstream: During your tactical actions, apply +1 to the move value of each of your ships that starts its movement in your home system or in a system that contains either an alpha or beta wormhole.",
      "Creuss Gate: When you create the game board, place the Creuss Gate (tile 17) where your home system would normally be placed. The Creuss Gate system is not a home system. Then, place your home system (tile 51) in your play area.",
    ],
    promissoryNote: "Creuss Iff — At the start of your turn during the action phase: Place or move a Creuss wormhole token into either a system that contains a planet you control or a non-home system that does not contain another players' ships. Then, return this card to the Creuss player.",
    startingUnits: "1 Carrier, 2 Destroyers, 2 Fighters, 4 Infantry, 1 Space Dock",
    startingTech: ["Gravity Drive"],
    commodities: 4,
    strategyTip: "Wormholes are your roads: all alpha and beta wormhole systems are adjacent for you, and Slipstream adds +1 move to ships starting in them or at home. Your home sits off-board behind the Creuss Gate, and Hil Colish carries a delta wormhole.",
    flagship: { name: "Hil Colish", stats: "Cost 8 / Combat 5 / Move 1 / Capacity 3 / Sustain Damage", description: "This ship's system contains a delta wormhole. During movement, this ship may move before or after your other ships." },
    mech: { name: "Icarus Drive", stats: "Cost 2 / Combat 6 / Sustain Damage", description: "After any player activates a system, you may remove this unit from the game board to place or move a Creuss wormhole token into this system." },
    factionTech: [
      { name: "Dimensional Splicer", type: "red", prerequisites: "R", description: "At the start of space combat in a system that contains a wormhole and 1 or more of your ships, you may produce 1 hit and assign it to 1 of your opponent's ships." },
      { name: "Wormhole Generator", type: "blue", prerequisites: "BB", description: "ACTION: Exhaust this card to place or move a Creuss wormhole token into either a system that contains a planet you control or a non-home system that does not contain another players' ships." },
    ],
    agent: { name: "Emissary Taivra", description: "After a player activates a system that contains a non-delta wormhole: You may exhaust this card: if you do, that system is adjacent to all other systems that contain a wormhole during this tactical action." },
    commander: { name: "Sai Seravus", unlock: "Have units in 3 systems that contain alpha or beta wormholes.", description: "After your ships move: For each ship that has a capacity value and moved through 1 or more wormholes, you may place 1 fighter from your reinforcements with that ship if you have unused capacity in the active system." },
    hero: { name: "Riftwalker Meian", description: "ACTION: Swap the positions of any 2 non-Fracture systems that contain wormholes or your units, other than the Creuss system, Ahk Creuxx system, or the Wormhole Nexus." },
  },
  {
    name: "The L1Z1X Mindnet",
    shortName: "L1Z1X",
    color: "200 30% 35%",
    abilities: [
      "Assimilate: When you gain control of a planet, replace each PDS and space dock that is on that planet with a matching unit from your reinforcements.",
      "Harrow: At the end of each round of ground combat, your ships in the active system may use their BOMBARDMENT abilities against your opponent's ground forces on the planet.",
    ],
    promissoryNote: "Cybernetic Enhancements — When you gain command tokens during the status phase: Gain 1 additional command token. Then, return this card to the L1Z1X player.",
    startingUnits: "1 Dreadnought, 1 Carrier, 3 Fighters, 5 Infantry, 1 Space Dock, 1 PDS",
    startingTech: ["Plasma Scoring", "Neural Motivator"],
    commodities: 2,
    strategyTip: "Assimilate swaps captured PDS and space docks for your own, and Harrow lets your ships bombard after every ground-combat round. Super-Dreadnoughts and [0.0.1] force hits onto non-fighter ships — play aggressively.",
    flagship: { name: "[0.0.1]", stats: "Cost 8 / Combat 5(×2) / Move 1 / Capacity 5 / Sustain Damage", description: "During a space combat, hits produced by this ship and by your dreadnoughts in this system must be assigned to non-fighter ships if able." },
    mech: { name: "Annihilator", stats: "Cost 2 / Combat 6 / Sustain Damage / Bombardment 8", description: "While not participating in ground combat, this unit can use its BOMBARDMENT ability on planets in its system as if it were a ship." },
    factionUnits: [
      { name: "Super Dreadnought I", stats: "Cost 4 / Combat 5 / Move 1 / Capacity 2 / Sustain Damage / Bombardment 5", description: "", replaces: "dreadnought" },
    ],
    factionTech: [
      { name: "Inheritance Systems", type: "yellow", prerequisites: "YY", description: "You may exhaust this card and spend 2 resources when you research a technology; ignore all of that technology's prerequisites." },
      { name: "Super Dreadnought II", type: "unit", prerequisites: "BBY", description: "Cost 4, Combat 4, Move 2, Capacity 2. SUSTAIN DAMAGE, BOMBARDMENT 4. This unit cannot be destroyed by \"Direct Hit\" action cards." },
    ],
    agent: { name: "I48S", description: "After a player activates a system: You may exhaust this card to allow that player to replace 1 of their infantry in the active system with 1 mech from their reinforcements." },
    commander: { name: "2RAM", unlock: "Have 4 dreadnoughts on the game board.", description: "At any time: Units that have PLANETARY SHIELD do not prevent you from using BOMBARDMENT." },
    hero: { name: "The Helmsman", description: "ACTION: Choose 1 system that does not contain other players' ships. you may move your flagship and any number of your dreadnoughts from other systems into the chosen system. Then, purge this card." },
  },
  {
    name: "The Mentak Coalition",
    shortName: "Mentak",
    color: "40 60% 45%",
    abilities: [
      "Ambush: At the start of a space combat, you may roll 1 die for each of up to 2 of your cruisers or destroyers in the system. For each result equal to or greater than that ship's combat value, produce 1 hit; your opponent must assign it to 1 of their ships.",
      "Pillage: After 1 of your neighbors gains trade goods or resolves a transaction, if they have 3 or more trade goods, you may take 1 of their trade goods or commodities.",
    ],
    promissoryNote: "Promise of Protection — ACTION: Place this card faceup in your play area. While this card is in your play area, the Mentak player cannot use their Pillage faction ability against you. If you activate a system that contains 1 or more of the Mentak player's units, return this card to the Mentak player.",
    startingUnits: "1 Carrier, 2 Cruisers, 3 Fighters, 4 Infantry, 1 Space Dock, 1 PDS",
    startingTech: ["Plasma Scoring", "Sarween Tools"],
    commodities: 2,
    strategyTip: "Ambush lets up to 2 cruisers or destroyers fire before space combat, and Pillage skims trade goods from wealthy neighbours. Fourth Moon stops enemies using Sustain Damage in its system.",
    flagship: { name: "Fourth Moon", stats: "Cost 8 / Combat 7(×2) / Move 1 / Capacity 3 / Sustain Damage", description: "Other players' ships in this system cannot use SUSTAIN DAMAGE." },
    mech: { name: "Moll Terminus", stats: "Cost 2 / Combat 6 / Sustain Damage", description: "Other players' ground forces on this planet cannot use SUSTAIN DAMAGE." },
    factionTech: [
      { name: "Mirror Computing", type: "yellow", prerequisites: "YYY", description: "When you spend trade goods, each trade good is worth 2 resources or influence instead of 1." },
      { name: "Salvage Operations", type: "yellow", prerequisites: "YY", description: "After you win or lose a space combat, gain 1 trade good; if you won the combat, you may also produce 1 ship in that system of any ship type that was destroyed during the combat." },
    ],
    agent: { name: "Suffi An", description: "After the Pillage faction ability is used against another player: You may exhaust this card: if you do, you and that player each draw 1 action card." },
    commander: { name: "S'ula Mentarion", unlock: "Have 4 cruisers on the game board.", description: "After you win a space combat: You may force your opponent to give you 1 promissory note from their hand." },
    hero: { name: "Ipswitch, Loose Cannon", description: "At the start of a space combat that you are participating in: You may purge this card. if you do, for each other player's ship that is destroyed during this combat, place 1 ship of that type from your reinforcements in the active system." },
  },
  {
    name: "The Naalu Collective",
    shortName: "Naalu",
    color: "50 70% 50%",
    abilities: [
      "Telepathic: At the end of the strategy phase, place the Naalu \"0\" token on your strategy card; you are first in initiative order.",
      "Foresight: After another player moves ships into a system that contains 1 or more of your ships, you may place 1 token from your strategy pool in an adjacent system that does not contain another players' ships; move your ships from the active system into that system.",
    ],
    promissoryNote: "Gift of Prescience — At the end of the Strategy Phase: Place this card faceup in your play area and place the Naalu '0' token on your strategy card, you are the first in initiative order. The Naalu player cannot use their Telepathic faction ability during this game round. Return this card to the Naalu player at the end of the status phase.",
    startingUnits: "1 Carrier, 1 Cruiser, 1 Destroyer, 3 Fighters, 4 Infantry, 1 Space Dock, 1 PDS",
    startingTech: ["Sarween Tools", "Neural Motivator"],
    commodities: 3,
    strategyTip: "Telepathic makes you first in initiative every round. Foresight lets your ships slip into an adjacent system when attacked, and Hybrid Crystal Fighters plus Matriarch let fighters fight on the ground.",
    flagship: { name: "Matriarch", stats: "Cost 8 / Combat 9(×2) / Move 1 / Capacity 6 / Sustain Damage", description: "During an invasion in this system, you may commit fighters to planets as if they were ground forces. After combat, return those units to the space area." },
    mech: { name: "Iconoclast", stats: "Cost 2 / Combat 6 / Sustain Damage", description: "During combat against an opponent who has at least 1 relic fragment, apply +2 to the results of this unit's combat rolls." },
    factionUnits: [
      { name: "Hybrid Crystal Fighter I", stats: "Cost 1(×2) / Combat 8", description: "", replaces: "fighter" },
    ],
    factionTech: [
      { name: "Neuroglaive", type: "green", prerequisites: "GGG", description: "After another player activates a system that contains 1 or more of your ships, that player removes 1 token from their fleet pool and returns it to their reinforcements." },
      { name: "Hybrid Crystal Fighter II", type: "unit", prerequisites: "GB", description: "Cost 1(×2), Combat 7, Move 2. This unit may move without being transported. Fighters in excess of your ships' capacity count as 1/2 of a ship against your fleet pool." },
    ],
    agent: { name: "Z'eu", description: "ACTION: Exhaust this card and choose a player. That player may perform a tactical action in a non-home system without placing a command token. That system still counts as being activated." },
    commander: { name: "M'aban", unlock: "Have ground forces in or adjacent to the Mecatol Rex system.", description: "At any time: You may look at your neighbors' hands of promissory notes and the top and bottom card of the agenda deck." },
    hero: { name: "The Oracle", description: "At the end of the status phase: You may force each other player to give you 1 promissory note from their hand. If you do, purge this card." },
  },
  {
    name: "The Nekro Virus",
    shortName: "Nekro",
    color: "0 70% 40%",
    abilities: [
      "Galactic Threat: You cannot vote on agendas. Once per agenda phase, after an agenda is revealed, you may predict aloud the outcome of that agenda. If your prediction is correct, gain 1 technology that is owned by a player who voted how you predicted.",
      "Technological Singularity: Once per combat, after 1 of your opponent's units is destroyed, you may gain 1 technology that is owned by that player.",
      "Propagation: You cannot research technology. When you would research a technology, gain 3 command tokens instead.",
    ],
    promissoryNote: "Antivirus — At the start of a combat: Place this card faceup in your play area. While this card is in your play area, the Nekro player cannot use their Technological Singularity faction ability against you. If you activate a system that contains 1 or more of the Nekro player's units, return this card to the Nekro player.",
    startingUnits: "1 Dreadnought, 1 Carrier, 1 Cruiser, 2 Fighters, 2 Infantry, 1 Space Dock",
    startingTech: ["Dacxive Animators"],
    commodities: 3,
    strategyTip: "You cannot research technology (Propagation gives 3 command tokens instead) and cannot vote. Gain tech by destroying units (Technological Singularity) and by predicting agendas (Galactic Threat).",
    flagship: { name: "The Alastor", stats: "Cost 8 / Combat 9(×2) / Move 1 / Capacity 3 / Sustain Damage", description: "At the start of a space combat, choose any number of your ground forces in this system to participate in that combat as if they were ships." },
    mech: { name: "Mordred", stats: "Cost 2 / Combat 6 / Sustain Damage", description: "During combat against an opponent who has an \"X\" or \"Y\" token on 1 or more of their technologies, apply +2 to the result of each of this unit's combat rolls." },
    factionTech: [
      { name: "Valefar Assimilator X", type: "none", prerequisites: "", description: "When you would gain another player's technology using 1 of your faction abilities, you may place the \"X\" assimilator token on a faction technology owned by that player instead. While that token is on a technology, this card gains that technology's text. You cannot place an assimilator token on technology that already has an assimilator token." },
      { name: "Valefar Assimilator Y", type: "none", prerequisites: "", description: "When you would gain another player's technology using 1 of your faction abilities, you may place the \"Y\" assimilator token on a faction technology owned by that player instead. While that token is on a technology, this card gains that technology's text. You cannot place an assimilator token on technology that already has an assimilator token." },
    ],
    agent: { name: "Nekro Malleon", description: "During the action phase: You may exhaust this card to choose a player: that player may discard 1 action card or spend 1 command token from their command sheet to gain 2 trade goods." },
    commander: { name: "Nekro Acidos", unlock: "Own 3 technologies. A \"Valefar Assimilator\" technology counts only if its X or Y token is on a technology.", description: "After you gain a technology: You may draw 1 action card." },
    hero: { name: "UNIT.DSGN.FLAYESH", description: "ACTION: Choose a planet that has a technology specialty in a system that contains your units. Destroy any other player's units on that planet. Gain trade goods equal to the planet's combined resource and influence values and gain 1 technology that matches the specialty of that planet. Then, purge this card." },
  },
  {
    name: "Sardakk N'orr",
    shortName: "Sardakk",
    color: "0 60% 30%",
    abilities: [
      "Unrelenting: Apply +1 to the result of each of your unit's combat rolls.",
    ],
    promissoryNote: "Tekklar Legion — At the start of an invasion combat: Apply +1 to the result of each of your unit's combat rolls during this combat. If your opponent is the N'orr player, apply -1 to the result of each of their unit's combat rolls during this combat. Then, return this card to the N'orr player.",
    startingUnits: "2 Carriers, 1 Cruiser, 5 Infantry, 1 Space Dock, 1 PDS",
    startingTech: [],
    commodities: 3,
    strategyTip: "Unrelenting adds +1 to every combat roll and C'morran N'orr adds +1 to your other ships in its system — pick fights. Exotrireme dreadnoughts back up your invasions.",
    flagship: { name: "C'morran N'orr", stats: "Cost 8 / Combat 6(×2) / Move 1 / Capacity 3 / Sustain Damage", description: "Apply +1 to the result of each of your other ship's combat rolls in this system." },
    mech: { name: "Valkyrie Exoskeleton", stats: "Cost 2 / Combat 6 / Sustain Damage", description: "After this unit uses its SUSTAIN DAMAGE ability during ground combat, it produces 1 hit against your opponent's ground forces on this planet." },
    factionUnits: [
      { name: "Exotrireme I", stats: "Cost 4 / Combat 5 / Move 1 / Capacity 1 / Sustain Damage / Bombardment 4(×2)", description: "", replaces: "dreadnought" },
    ],
    factionTech: [
      { name: "Exotrireme II", type: "unit", prerequisites: "BBY", description: "Cost 4, Combat 5, Move 2, Capacity 1. SUSTAIN DAMAGE, BOMBARDMENT 4(×2). This unit cannot be destroyed by \"Direct Hit\" action cards. After a round of space combat, you may destroy this unit to destroy up to 2 ships in this system." },
      { name: "Valkyrie Particle Weave", type: "red", prerequisites: "RR", description: "After making combat rolls during a round of ground combat, if your opponent produced 1 or more hits, you produce 1 additional hit." },
    ],
    agent: { name: "T'ro", description: "At the end of a player's tactical action: You may exhaust this card: if you do, that player may place 2 infantry from their reinforcements on a planet they control in the active system." },
    commander: { name: "G'hom Sek'kus", unlock: "Control 5 planets in non-home systems.", description: "During the \"Commit Ground Forces\" step: You can commit (move) up to 1 ground force from each planet in the active system and each planet in adjacent systems that do not contain 1 of your command tokens." },
    hero: { name: "Sh'val, Harbinger", description: "After you move ships into the active system: You may skip directly to the \"Commit Ground Forces\" step. If you do, after you commit ground forces to land on planets, purge this card and return each of your ships in the active system to your reinforcements." },
  },
  {
    name: "The Universities of Jol-Nar",
    shortName: "Jol-Nar",
    color: "260 50% 55%",
    abilities: [
      "Fragile: Apply -1 to the result of each of your unit's combat rolls.",
      "Brilliant: When you spend a command token to resolve the secondary ability of the \"Technology\" strategy card, you may resolve the primary ability instead.",
      "Analytical: When you research a technology that is not a unit upgrade technology, you may ignore 1 prerequisite.",
    ],
    promissoryNote: "Research Agreement — After the Jol-Nar player researches a technology that is not a faction technology: Gain that technology. Then, return this card to the Jol-Nar player.",
    startingUnits: "1 Dreadnought, 2 Carriers, 1 Fighter, 2 Infantry, 1 Space Dock, 2 PDS",
    startingTech: ["Antimass Deflectors", "Sarween Tools", "Neural Motivator", "Plasma Scoring"],
    commodities: 4,
    strategyTip: "Fragile gives -1 to all your combat rolls, so win with technology: Brilliant lets you use Technology's primary when following, and Analytical skips a prerequisite. J.N.S. Hylarim turns 9s and 10s into 3 hits.",
    flagship: { name: "J.N.S. Hylarim", stats: "Cost 8 / Combat 6(×2) / Move 1 / Capacity 3 / Sustain Damage", description: "When making a combat roll for this ship, each result of 9 or 10, before applying modifiers, produces 2 additional hits." },
    mech: { name: "Shield Paling", stats: "Cost 2 / Combat 6 / Sustain Damage", description: "Your infantry on this planet are not affected by your Fragile faction ability." },
    factionTech: [
      { name: "E-Res Siphons", type: "yellow", prerequisites: "YY", description: "After another player activates a system that contains 1 or more of your ships, gain 4 trade goods." },
      { name: "Spatial Conduit Cylinder", type: "blue", prerequisites: "BB", description: "You may exhaust this card after you activate a system that contains 1 or more of your units; that system is adjacent to all other systems that contain 1 or more of your units during this activation." },
    ],
    agent: { name: "Doctor Sucaban", description: "When a player spends resources to research: You may exhaust this card to allow that player to remove any number of their infantry from the game board. For each unit removed, reduce the resources spent by 1." },
    commander: { name: "Agnlan Oln", unlock: "Own 8 technologies.", description: "After you roll dice for a unit ability: You may reroll any of those dice." },
    hero: { name: "Rin, the Master's Legacy", description: "ACTION: For each non-unit upgrade technology you own, you may replace that technology with any technology of the same color from the deck. Then, purge this card." },
  },
  {
    name: "The Winnu",
    shortName: "Winnu",
    color: "270 40% 45%",
    abilities: [
      "Blood Ties: You do not have to spend influence to remove the custodians token from Mecatol Rex.",
      "Reclamation: After you resolve a tactical action during which you gained control of Mecatol Rex, you may place 1 PDS and 1 space dock from your reinforcements on Mecatol Rex.",
    ],
    promissoryNote: "Acquiescence — When the Winnu player resolves a strategic action: You do not have to spend or place a command token to resolve the secondary ability of that strategy card. Then, return this card to the Winnu player.",
    startingUnits: "1 Carrier, 1 Cruiser, 2 Fighters, 2 Infantry, 1 Space Dock, 1 PDS",
    startingTech: ["Antimass Deflectors", "Dark Energy Tap", "Neural Motivator", "Psychoarchaeology", "Sarween Tools", "Scanlink Drone Network", "Plasma Scoring", "AI Development Algorithm"],
    startingTechChoose: 1,
    commodities: 3,
    strategyTip: "Blood Ties lets you take the custodians token from Mecatol Rex without spending influence, and Reclamation then builds a PDS and space dock there. Head for the centre early.",
    flagship: { name: "Salai Sai Corian", stats: "Cost 8 / Combat 7 / Move 1 / Capacity 3 / Sustain Damage", description: "When this unit makes a combat roll, it rolls a number of dice (hit on a 7) equal to the number of your opponent's non-fighter ships in this system." },
    mech: { name: "Reclaimer", stats: "Cost 2 / Combat 6 / Sustain Damage", description: "After you resolve a tactical action where you gained control of this planet, you may place 1 PDS or 1 Space Dock from your reinforcements on this planet." },
    factionTech: [
      { name: "Lazax Gate Folding", type: "blue", prerequisites: "BB", description: "During your tactical actions, if you do not control Mecatol Rex, treat its system as if it has both an α and β wormhole. ACTION: If you control Mecatol Rex, exhaust this card to place 1 infantry from your reinforcements on Mecatol Rex." },
      { name: "Hegemonic Trade Policy", type: "yellow", prerequisites: "YY", description: "Exhaust this card when 1 or more of your units use PRODUCTION; swap the resource and influence values of 1 planet you control during that use of Production." },
    ],
    agent: { name: "Berekar Berekon", description: "When 1 or more of a player's units use PRODUCTION: You may exhaust this card to reduce the combined cost of the produced units by 2." },
    commander: { name: "Rickar Rickani", unlock: "Control Mecatol Rex or enter into a combat in the Mecatol Rex system.", description: "During combat: Apply +2 to the result of each of your unit's combat rolls in the Mecatol Rex system, your home system, and each system that contains a legendary planet." },
    hero: { name: "Mathis Mathinus", description: "ACTION: Perform the primary ability of any strategy card. Then, choose any number of other players. Those players may perform the secondary ability of that strategy card. Then, purge this card." },
  },
  {
    name: "The Xxcha Kingdom",
    shortName: "Xxcha",
    color: "140 40% 40%",
    abilities: [
      "Peace Accords: After you resolve the primary or secondary ability of the \"Diplomacy\" strategy card, you may gain control of 1 planet other than Mecatol Rex that does not contain any units and is in a system that is adjacent to a planet you control.",
      "Quash: When an agenda is revealed, you may spend 1 token from your strategy pool to discard that agenda and reveal 1 agenda from the top of the deck. Players vote on this agenda instead.",
    ],
    promissoryNote: "Political Favor — When an agenda is revealed: Remove 1 token from the Xxcha player's strategy pool and return it to their reinforcements. Then, discard the revealed agenda and reveal 1 agenda from the top of the deck. Players vote on this agenda instead. Then, return this card to the Xxcha player.",
    startingUnits: "1 Carrier, 2 Cruisers, 3 Fighters, 4 Infantry, 1 Space Dock, 1 PDS",
    startingTech: ["Graviton Laser System"],
    commodities: 4,
    strategyTip: "Peace Accords takes empty adjacent planets whenever you use Diplomacy, and Quash replaces agendas you don't like. Loncara Ssodu's Space Cannon reaches adjacent systems — defend and out-politic.",
    flagship: { name: "Loncara Ssodu", stats: "Cost 8 / Combat 7(×2) / Move 1 / Capacity 3 / Sustain Damage / Space Cannon 5(×3)", description: "You may use this unit's SPACE CANNON against ships that are in adjacent systems." },
    mech: { name: "Indomitus", stats: "Cost 2 / Combat 6 / Sustain Damage / Space Cannon 8", description: "You may use this unit's SPACE CANNON against ships that are in adjacent systems." },
    factionTech: [
      { name: "Instinct Training", type: "green", prerequisites: "G", description: "You may exhaust this card and spend 1 token from your strategy pool when another player plays an action card; cancel that action card." },
      { name: "Nullification Field", type: "yellow", prerequisites: "YY", description: "After another player activates a system that contains 1 or more of your ships, you may exhaust this card and spend 1 token from your strategy pool; immediately end that player's turn." },
    ],
    agent: { name: "Ggrocuto Rinn", description: "ACTION: Exhaust this card to ready any planet; if that planet is in a system that is adjacent to a planet you control, you may remove 1 infantry from that planet and return it to its reinforcements." },
    commander: { name: "Elder Qanoj", unlock: "Control planets that have a combined total of at least 12 influence.", description: "When you vote: Each planet you exhaust to cast votes provides 1 additional vote. Game effects cannot prevent you from voting on an agenda." },
    hero: { name: "Xxekir Grom", description: "When you exhaust planets: Combine the values of their resources and influence. Treat the combined value as if it were both resources and influence." },
  },
  {
    name: "The Yin Brotherhood",
    shortName: "Yin",
    color: "0 0% 80%",
    abilities: [
      "Indoctrination: At the start of a ground combat, you may spend 2 influence to replace 1 of your opponent's participating infantry with 1 infantry from your reinforcements.",
      "Devotion: After each space combat round, you may destroy 1 of your cruisers or destroyers in the active system to produce 1 hit and assign it to 1 of your opponent's ships in that system.",
    ],
    promissoryNote: "Greyfire Mutagen — At the start of a ground combat against 2 or more ground forces that are not controlled by the Yin player: Replace 1 of your opponent's infantry with 1 infantry from your reinforcements. Then, return this card to the Yin player.",
    startingUnits: "2 Carriers, 1 Destroyer, 4 Fighters, 4 Infantry, 1 Space Dock",
    startingTech: ["Sarween Tools"],
    commodities: 2,
    strategyTip: "Indoctrination converts enemy infantry for 2 influence, and Devotion sacrifices cruisers or destroyers to deal hits. Van Hauge destroys every ship in its system when it dies — a deterrent.",
    flagship: { name: "Van Hauge", stats: "Cost 8 / Combat 9(×2) / Move 1 / Capacity 3 / Sustain Damage", description: "When this ship is destroyed, destroy all ships in this system." },
    mech: { name: "Moyin's Ashes", stats: "Cost 2 / Combat 6 / Sustain Damage", description: "DEPLOY: When you use your Indoctrination faction ability, you may spend 1 additional influence to replace your opponent's unit with 1 mech instead of 1 infantry." },
    factionTech: [
      { name: "Yin Spinner Omega", type: "green", prerequisites: "GG", description: "After you produce units, place up to 2 infantry from your reinforcements on any planet you control or in any space area that contains 1 or more of your ships." },
      { name: "Impulse Core", type: "yellow", prerequisites: "YY", description: "At the start of a space combat, you may destroy 1 of your cruisers or destroyers in the active system to produce 1 hit against your opponent's ships; that hit must be assigned by your opponent to 1 of their non-fighters ships if able." },
    ],
    agent: { name: "Brother Milor", description: "After a player's unit is destroyed during combat: You may exhaust this card to allow that player to place 2 fighters in the destroyed unit's system if it was a ship, or 2 infantry on its planet if it was a ground force." },
    commander: { name: "Brother Omar", unlock: "Use one of your faction abilities.", description: "At any time: This card satisfies a green technology prerequisite. When you research a tech owned by another player, you may return 1 of your infantry to reinforcements to ignore its prerequisites." },
    hero: { name: "Dannel of the Tenth", description: "ACTION: Commit up to 3 infantry from your reinforcements to any non-home planets and resolve ground combats on those planets. Players cannot use SPACE CANNON against these units. Then, purge this card." },
  },
  {
    name: "The Yssaril Tribes",
    shortName: "Yssaril",
    color: "130 60% 30%",
    abilities: [
      "Stall Tactics: ACTION: Discard 1 action card from your hand.",
      "Scheming: When you draw 1 or more action cards, draw 1 additional action card. Then, choose and discard 1 action card from your hand.",
      "Crafty: You can have any number of action cards in your hand. Game effects cannot prevent you from using this ability.",
    ],
    promissoryNote: "Spy Net — At the start of your turn: Look at the Yssaril player's hand of action cards. Choose 1 of those cards and add it to your hand. Then, return this card to the Yssaril player.",
    startingUnits: "2 Carriers, 1 Cruiser, 2 Fighters, 5 Infantry, 1 Space Dock, 1 PDS",
    startingTech: ["Neural Motivator"],
    commodities: 3,
    strategyTip: "Scheming draws an extra action card, Crafty removes the hand limit, and Stall Tactics lets you pass time by discarding one. Y'sia Y'ssrila moves through enemy ships — out-wait and out-trick everyone.",
    flagship: { name: "Y'sia Y'ssrila", stats: "Cost 8 / Combat 5(×2) / Move 2 / Capacity 3 / Sustain Damage", description: "This ship can move through systems that contain other players' ships." },
    mech: { name: "Blackshade Infiltrator", stats: "Cost 2 / Combat 6 / Sustain Damage", description: "DEPLOY: After you use your Stall Tactics faction ability, you may place 1 mech on a planet you control." },
    factionTech: [
      { name: "Transparasteel Plating", type: "green", prerequisites: "G", description: "During your turn of the action phase, players that have passed cannot play action cards." },
      { name: "Mageon Implants", type: "green", prerequisites: "GGG", description: "ACTION: Exhaust this card to look at another player's hand of action cards.  Choose 1 of those cards and add it to your hand." },
    ],
    agent: { name: "Ssruu", description: "At any time: This card has the text ability of each other player's agent, even if that agent is exhausted." },
    commander: { name: "So Ata", unlock: "Have 7 action cards.", description: "After another player activates a system that contains your units: You may look at that player's action cards, promissory notes, or secret objectives." },
    hero: { name: "Kyver, Blade and Key", description: "ACTION: Each other player shows you 1 action card from their hand. For each player, you may either take that card or force that player to discard 3 random action cards from their hand. Then, purge this card." },
  },
];

export const POK_FACTIONS: Faction[] = [
  {
    name: "The Argent Flight",
    shortName: "Argent",
    color: "0 0% 70%",
    abilities: [
      "Zeal: You always vote first during the agenda phase. When you cast at least 1 vote, cast 1 additional vote for each player in the game including you.",
      "Raid Formation: When 1 or more of your units uses ANTI-FIGHTER BARRAGE, for each hit produced in excess of your opponent's fighters, choose 1 of your opponent's ships that has SUSTAIN DAMAGE to become damaged.",
    ],
    promissoryNote: "Strike Wing Ambuscade — When 1 or more of your units make a roll for a unit ability: Choose 1 of those units to roll 1 additional die. Then, return this card to the Argent player.",
    startingUnits: "1 Carrier, 2 Destroyers, 2 Fighters, 5 Infantry, 1 Space Dock, 1 PDS",
    startingTech: ["Neural Motivator", "Sarween Tools", "Plasma Scoring"],
    startingTechChoose: 2,
    commodities: 3,
    strategyTip: "Zeal makes you a kingmaker in the agenda phase — trade your votes. Raid Formation turns destroyer screens into a threat to capital ships, and Strike Wing Alpha II also kills infantry in space.",
    flagship: { name: "Quetzecoatl", stats: "Cost 8 / Combat 7(×2) / Move 1 / Capacity 3 / Sustain Damage", description: "Other players cannot use space cannon against your ships in this system." },
    mech: { name: "Aerie Sentinel", stats: "Cost 2 / Combat 6 / Sustain Damage", description: "This unit does not count against capacity if it is being transported or if it is in a space area with 1 or more of your ships that have capacity values." },
    factionUnits: [
      { name: "Strike Wing Alpha I", stats: "Cost 1 / Combat 8 / Move 2 / Capacity 1 / Anti-Fighter Barrage 9(×2)", description: "", replaces: "destroyer" },
    ],
    factionTech: [
      { name: "Aerie Hololattice", type: "yellow", prerequisites: "Y", description: "Other players cannot move ships through systems that contain your structures. Each planet that contains 1 or more of your structures gains the PRODUCTION 1 ability as if it were a unit." },
      { name: "Strike Wing Alpha II", type: "unit", prerequisites: "RR", description: "Cost 1, Combat 7, Move 2, Capacity 1. ANTI-FIGHTER BARRAGE 6(×3). When this unit uses ANTI-FIGHTER BARRAGE, each result of 9 or 10 also destroys 1 of your opponent's infantry in the space area of the active system." },
    ],
    agent: { name: "Trilossa Aun Mirik", description: "When a player produces ground forces in a system: You may exhaust this card: that player may place those units on any planets they control in that system and any adjacent systems." },
    commander: { name: "Trrakan Aun Zulok", unlock: "Have 6 units that have ANTI-FIGHTER BARRAGE, SPACE CANNON, or BOMBARDMENT on the game board.", description: "When 1 or more of your units make a roll for a unit ability: You may choose 1 of those units to roll 1 additional die." },
    hero: { name: "Mirik Aun Sissiri", description: "ACTION: Move any number of your ships from any systems to any number of other systems that contain 1 of your command tokens and no other players' ships. Then, purge this card." },
  },
  {
    name: "The Empyrean",
    shortName: "Empyrean",
    color: "280 50% 50%",
    abilities: [
      "Voidborn: Nebulae do not affect your ships' movement.",
      "Aetherpassage: After a player activates a system, you may allow that player to move their ships through systems that contain your ships.",
      "Dark Whispers: During setup, take the additional Empyrean faction promissory note; you have 2 faction promissory notes.",
    ],
    promissoryNote: "Dark Pact — ACTION: Place this card faceup in your play area. When you give a number of commodities to the Empyrean player equal to your maximum commodity value, you each gain 1 trade good. If you activate a system that contains 1 or more of the Empyrean player's units, return this card to the Empyrean player. Blood Pact — ACTION: Place this card faceup in your play area. When you and the Empyrean player cast votes for the same outcome, cast 4 additional votes for that outcome. If you activate a system that contains 1 or more of the Empyrean player's units, return this card to the Empyrean player.",
    startingUnits: "2 Carriers, 1 Destroyer, 2 Fighters, 4 Infantry, 1 Space Dock",
    startingTech: ["Dark Energy Tap"],
    commodities: 4,
    strategyTip: "Play the diplomat: Aetherpassage and your two promissory notes are bargaining chips. Nebulae are highways for you, and Dynamo keeps your neighbours' (and your) sustained ships repaired.",
    flagship: { name: "Dynamo", stats: "Cost 8 / Combat 5(×2) / Move 1 / Capacity 3 / Sustain Damage", description: "After any player's unit in this system or an adjacent system uses SUSTAIN DAMAGE, you may spend 2 influence to repair that unit." },
    mech: { name: "Watcher", stats: "Cost 2 / Combat 6 / Sustain Damage", description: "You may remove this unit from a system that contains or is adjacent to another player's units to cancel an action card played by that player." },
    factionTech: [
      { name: "Voidwatch", type: "green", prerequisites: "G", description: "After a player moves ships into a system that contains 1 or more of your units, they must give you 1 promissory note from their hand, if able." },
      { name: "Aetherstream", type: "blue", prerequisites: "BB", description: "After you or one of your neighbors activates a system that is adjacent to an anomaly, you may apply +1 to the move value of all of that player's ships during this tactical action." },
    ],
    agent: { name: "Acamar", description: "After a player moves ships into a system that does not contain any planets: You may exhaust this card: that player gains 1 command token." },
    commander: { name: "Xuange", unlock: "Be neighbors with all other players.", description: "After another player moves ships into a system that contains 1 of your command tokens: You may return that token to your reinforcements." },
    hero: { name: "Conservator Procyon", description: "ACTION: Place 1 frontier token in each system that does not contain any planets and does not already have a frontier token. Then, explore each frontier token that is in a system that contains 1 or more of your ships. Then, purge this card." },
  },
  {
    name: "The Mahact Gene-Sorcerers",
    shortName: "Mahact",
    color: "50 50% 40%",
    abilities: [
      "Edict: When you win a combat, place 1 command token from your opponent's reinforcements in your fleet pool if it does not already contain 1 of that player's tokens. Other players' tokens in your fleet pool increase your fleet limit but cannot be redistributed.",
      "Imperia: While another player's command token is in your fleet pool, you can use the ability of that player's commander, if it is unlocked.",
      "Hubris: During setup, purge your \"Alliance\" promissory note. Other players cannot give you their \"Alliance\" promissory note.",
    ],
    promissoryNote: "Scepter of Dominion — At the start of the strategy phase: Choose 1 non-home system that contains your units, each other player who has a token on the Mahact player's command sheet places a token from their reinforcements in that system. Then, return this card to the Mahact player.",
    startingUnits: "1 Dreadnought, 1 Carrier, 1 Cruiser, 2 Fighters, 3 Infantry, 1 Space Dock",
    startingTech: ["Predictive Intelligence", "Bio-Stims"],
    commodities: 3,
    strategyTip: "Every won combat steals a command token, raising your fleet limit and letting you borrow that player's commander via Imperia. You cannot use Alliance notes, so lean on Edict instead.",
    flagship: { name: "Arvicon Rex", stats: "Cost 8 / Combat 5(×2) / Move 1 / Capacity 3 / Sustain Damage", description: "During combat against an opponent whose command token is not in your fleet pool, apply +2 to the results of this unit's combat rolls." },
    mech: { name: "Starlancer", stats: "Cost 2 / Combat 6 / Sustain Damage", description: "After a player whose command token is in your fleet pool activates this system, you may spend their token from your fleet pool to end their turn; they gain that token." },
    factionUnits: [
      { name: "Crimson Legionnaire I", stats: "Cost 1(×2) / Combat 8", description: "After this unit is destroyed, gain 1 commodity or convert 1 of your commodities to a trade good.", replaces: "infantry" },
    ],
    factionTech: [
      { name: "Crimson Legionnaire II", type: "unit", prerequisites: "GG", description: "Cost 1(×2), Combat 7. After this unit is destroyed, gain 1 commodity or convert 1 of your commodities to a trade good. Then, place the unit on this card. At the start of your next turn, place each unit that is on this card on a planet you control in your home system." },
      { name: "Genetic Recombination", type: "green", prerequisites: "G", description: "You may exhaust this card before a player casts votes; that player must cast at least 1 vote for an outcome of your choice or remove 1 token from their fleet pool and return it to their reinforcements." },
    ],
    agent: { name: "Jae Mir Kan", description: "When you would spend a command token during the secondary ability of a strategic action: You may exhaust this card to remove 1 of the active player's command tokens from the board and use it instead." },
    commander: { name: "Il Na Viroset", unlock: "Have 2 other factions' command tokens in your fleet pool.", description: "During your tactical actions: You can activate systems that contain your command tokens. If you do, return both command tokens to your reinforcements and end your turn." },
    hero: { name: "Airo Shir Aur", description: "ACTION: Move all units in the space area of any system to an adjacent system that contains a different player's ships. Space combat is resolved in that system. neither player can retreat or resolve abilities that would move their ships. Then, purge this card." },
  },
  {
    name: "The Naaz-Rokha Alliance",
    shortName: "Naaz-Rokha",
    color: "90 40% 40%",
    abilities: [
      "Distant Suns: When you explore a planet that contains 1 of your mechs, you may draw 1 additional card; choose 1 to resolve and discard the rest.",
      "Fabrication: ACTION: Either purge 2 of your relic fragments of the same type to gain 1 relic; or purge 1 of your relic fragments to gain 1 command token.",
    ],
    promissoryNote: "Black Market Forgery — ACTION: Purge 2 of your relic fragments of the same type to gain 1 relic. Then, return this card to the Naaz-Rokha player.",
    startingUnits: "2 Carriers, 1 Destroyer, 2 Fighters, 1 Mech, 3 Infantry, 1 Space Dock",
    startingTech: ["Psychoarchaeology", "AI Development Algorithm"],
    commodities: 3,
    strategyTip: "Get mechs onto unexplored planets: Distant Suns lets you pick the better exploration card, and Fabrication turns relic fragments into relics or command tokens. Your flagship makes mechs hit much harder.",
    flagship: { name: "Visz El Vir", stats: "Cost 8 / Combat 9(×2) / Move 1 / Capacity 4 / Sustain Damage", description: "Your mechs in this system roll 1 additional die during combat." },
    mech: { name: "Eidolon", stats: "Cost 2 / Combat 6(×2) / Sustain Damage", description: "If this unit is in the space area of the active system at the start of a space combat, flip this card." },
    factionTech: [
      { name: "Pre-Fab Arcologies", type: "green", prerequisites: "GGG", description: "After you explore a planet, ready that planet." },
      { name: "Supercharge", type: "red", prerequisites: "R", description: "At the start of a combat round, you may exhaust this card to apply +1 to the result of each of your unit's combat rolls during this combat round." },
    ],
    agent: { name: "Garv and Gunn", description: "At the end of a player's turn: You may exhaust this card to allow that player to explore 1 of their planets." },
    commander: { name: "Dart and Tai", unlock: "Have mechs in 3 systems.", description: "After you gain control of a planet that was controlled by another player: You may explore that planet." },
    hero: { name: "Hesh and Prit", description: "ACTION: Gain 1 relic and perform the secondary ability of up to 2 readied or unchosen strategy cards. during this action, spend command tokens from your reinforcements instead of your strategy pool. Then, purge this card." },
  },
  {
    name: "The Nomad",
    shortName: "Nomad",
    color: "30 50% 45%",
    abilities: [
      "The Company: During setup, take the 2 additional Nomad faction agents and place them next to your faction sheet; you have 3 agents.",
      "Future Sight: During the Agenda phase, after an outcome that you voted for or predicted is resolved, gain 1 trade good.",
    ],
    promissoryNote: "The Cavalry — At the start of a space combat against a player other than the Nomad: During this combat, treat 1 of your non-fighter ships as if it has the SUSTAIN DAMAGE ability, combat value, and ANTI-FIGHTER BARRAGE value of the Nomad's flagship. Return this card to the Nomad player at the end of the combat.",
    startingUnits: "1 Flagship, 1 Carrier, 1 Destroyer, 3 Fighters, 4 Infantry, 1 Space Dock",
    startingTech: ["Sling Relay"],
    commodities: 4,
    strategyTip: "Three agents give you more flexible timing than anyone. Your flagship is your strongest piece — Memoria II is one of the best flagships in the game, and The Cavalry note lends its power to allies.",
    flagship: { name: "Memoria I", stats: "Cost 8 / Combat 7(×2) / Move 1 / Capacity 3 / Sustain Damage / Anti-Fighter Barrage 8(×3)", description: "You may treat this unit as if it were adjacent to systems that contain 1 or more of your mechs." },
    mech: { name: "Quantum Manipulator", stats: "Cost 2 / Combat 6 / Sustain Damage", description: "While this unit is in a space area during combat, you may use its SUSTAIN DAMAGE ability to cancel a hit that is produced against your ships in this system." },
    factionTech: [
      { name: "Memoria II", type: "unit", prerequisites: "GBY", description: "Cost 8, Combat 5(×2), Move 2, Capacity 6. SUSTAIN DAMAGE, ANTI-FIGHTER BARRAGE 5(×3). You may treat this unit as if it were adjacent to systems that contain one or more of your mechs." },
      { name: "Temporal Command Suite", type: "yellow", prerequisites: "Y", description: "After any player's agent becomes exhausted, you may exhaust this card to ready that agent; if you ready another player's agent, you may perform a transaction with that player." },
    ],
    agent: { name: "Artuno the Betrayer", description: "When you gain trade goods from the supply: You may exhaust this card to place an equal number of trade goods on this card. When this card readies, gain the trade goods on this card." },
    additionalAgents: [
      { name: "Field Marshal Mercer", description: "At the end of a player's turn: You may exhaust this card to allow that player to remove up to 2 of their ground forces from the game board and place them on planets they control in the active system." },
      { name: "The Thundarian", description: "After the \"Roll Dice\" step of combat: You may exhaust this card. If you do, hits are not assigned to either player's units. Return to the start of this combat round's \"Roll Dice\" step." },
    ],
    commander: { name: "Navarch Feng", unlock: "Have 1 scored secret objective.", description: "When you produce: You can produce your flagship without spending resources." },
    hero: { name: "Ahk-Syl Siven", description: "ACTION: Place this card near the game board. your flagship and units it transports can move out of systems that contain your command tokens during this game round. At the end of that game round, purge this card." },
  },
  {
    name: "The Titans of Ul",
    shortName: "Ul",
    color: "20 60% 40%",
    abilities: [
      "Terragenesis: After you explore a planet that does not have a sleeper token, you may place or move 1 sleeper token onto that planet.",
      "Awaken: After you activate a system that contains 1 or more of your sleeper tokens, you may replace each of those tokens with 1 PDS from your reinforcements.",
      "Coalescence: If your flagship or your AWAKEN faction ability places your units into the same space area or onto the same planet as another player's units, your units must participate in combat during \"Space Combat\" or \"Ground Combat\" steps.",
    ],
    promissoryNote: "Terraform — ACTION: Attach this card to a non-home planet you control other than Mecatol Rex. Its resource and influence values are each increased by 1, and it is treated as having all 3 planet traits (cultural, hazardous, and industrial).",
    startingUnits: "1 Dreadnought, 2 Cruisers, 2 Fighters, 3 Infantry, 1 Space Dock",
    startingTech: ["Antimass Deflectors", "Scanlink Drone Network"],
    commodities: 2,
    strategyTip: "Explore to seed sleeper tokens, then Awaken them into PDS. Your Hel-Titan PDS also count as ground forces with production, so your structures defend and build. Ouranos can deploy onto any of your PDS.",
    flagship: { name: "Ouranos", stats: "Cost 8 / Combat 7(×2) / Move 1 / Capacity 3 / Sustain Damage", description: "DEPLOY: After you activate a system that contains 1 or more of your PDS, you may replace 1 of those PDS with this unit." },
    mech: { name: "Hecatoncheires", stats: "Cost 2 / Combat 6 / Sustain Damage", description: "DEPLOY: When you would place a PDS on a planet, you may place 1 mech and 1 infantry on that planet instead." },
    factionUnits: [
      { name: "Saturn Engine I", stats: "Cost 2 / Combat 7 / Move 2 / Capacity 1", description: "", replaces: "cruiser" },
      { name: "Hel-Titan I", stats: "Combat 7 / Sustain Damage / Planetary Shield / Space Cannon 6 / Production 1", description: "This unit is treated as both a structure and a ground force. It cannot be transported.", replaces: "pds" },
    ],
    factionTech: [
      { name: "Hel-Titan II", type: "unit", prerequisites: "YR", description: "Combat 6. PLANETARY SHIELD, SPACE CANNON 5, SUSTAIN DAMAGE, PRODUCTION 1. This unit is treated as both a structure and a ground force. It cannot be transported. You may use this unit's SPACE CANNON against ships that are adjacent to this unit's systems." },
      { name: "Saturn Engine II", type: "unit", prerequisites: "GYR", description: "Cost 2, Combat 6, Move 3, Capacity 2. SUSTAIN DAMAGE" },
    ],
    agent: { name: "Tellurian", description: "Before a hit would be assigned: You may exhaust this card to cancel that hit." },
    commander: { name: "Tungstantus", unlock: "Have 5 structures on the game board.", description: "When 1 or more of your units use PRODUCTION: You may gain 1 trade good." },
    hero: { name: "Ul the Progenitor", description: "ACTION: Ready Elysium and attach this card to it. Its resource and influence values are each increased by 3, and it gains the SPACE CANNON 5(×3) ability as if it were a unit." },
  },
  {
    name: "The Vuil'Raith Cabal",
    shortName: "Vuil'Raith",
    color: "340 70% 35%",
    abilities: [
      "Devour: Capture your opponent's non-structure units that are destroyed during combat.",
      "Amalgamation: When you produce a unit, you may return 1 captured unit of that type to produce that unit without spending resources.",
      "Riftmeld: When you research a unit upgrade technology, you may return 1 captured unit of that type to ignore all of the technology's prerequisites.",
    ],
    promissoryNote: "Crucible — After you activate a system: Your ships do not roll for gravity rifts during this movement, apply an additional +1 to the move values of your ships that would move out of or through a gravity rift instead. Then, return this card to the Vuil'raith player.",
    startingUnits: "1 Dreadnought, 1 Carrier, 1 Cruiser, 3 Fighters, 3 Infantry, 1 Space Dock",
    startingTech: ["Self-Assembly Routines"],
    commodities: 2,
    strategyTip: "Fight often: Devour captures destroyed enemy units, which you then spend through Amalgamation for free production or Riftmeld to skip tech prerequisites. Your dimensional tear space docks are gravity rifts your ships ignore.",
    flagship: { name: "The Terror Between", stats: "Cost 8 / Combat 5(×2) / Move 1 / Capacity 3 / Sustain Damage / Bombardment 5", description: "Capture all other non-structure units that are destroyed in this system, including your own." },
    mech: { name: "Reanimator", stats: "Cost 2 / Combat 6 / Sustain Damage", description: "When your infantry on this planet are destroyed, place them on your faction sheet; those units are captured." },
    factionUnits: [
      { name: "Dimensional Tear I", stats: "Production 5", description: "This system is a gravity rift; your ships do not roll for this gravity rift. Place a dimensional tear token beneath this unit as a reminder. Up to 6 fighters in this system do not count against your ships' capacity.", replaces: "spacedock" },
    ],
    factionTech: [
      { name: "Dimensional Tear II", type: "unit", prerequisites: "YY", description: "PRODUCTION 7. This system is a gravity rift; your ships do not roll for this gravity rift. Place a dimensional tear token beneath this unit as a reminder. Up to 12 fighters in this system do not count against your ships' capacity." },
      { name: "Vortex", type: "red", prerequisites: "R", description: "ACTION: Exhaust this card to choose another player's non-structure unit in a system that is adjacent to 1 or more of your space docks. Capture 1 unit of that type from that player's reinforcements." },
    ],
    agent: { name: "The Stillness of Stars", description: "After another player replenishes commodities: You may exhaust this card to convert their commodities to trade goods and capture 1 unit from their reinforcements that has a cost equal to or lower than their commodity value." },
    commander: { name: "That Which Molds Flesh", unlock: "Have units in 3 gravity rifts.", description: "When you produce fighter or infantry units: Up to 2 of those units do not count against your PRODUCTION limit." },
    hero: { name: "It Feeds on Carrion", description: "ACTION: Each other player rolls a die for each of his non-fighter ships that are in or adjacent to a system that contains a dimensional tear. on a 1-3, capture that unit. If this causes a player's ground forces or fighter to be removed, also capture those units. Then, purge this card." },
  },
];
