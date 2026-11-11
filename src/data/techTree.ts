export interface TechTreeNode {
  name: string;
  type: "green" | "blue" | "yellow" | "red";
  tier: 1 | 2 | 3;
  prerequisites: string; // e.g. "G", "GG", "BB"
  description: string;
}

// Full generic tech tree (base + PoK)
export const TECH_TREE: TechTreeNode[] = [
  // === BIOTIC (Green) ===
  { name: "Neural Motivator", type: "green", tier: 1, prerequisites: "", description: "During the status phase, draw 2 action cards instead of 1." },
  { name: "Psychoarchaeology", type: "green", tier: 1, prerequisites: "", description: "You can use technology specialties on planets you control without exhausting them. During the action phase, you may exhaust a planet you control that has a technology specialty to gain 1 trade good." },
  { name: "Dacxive Animators", type: "green", tier: 2, prerequisites: "G", description: "After you win a ground combat, you may place 1 infantry from your reinforcements on that planet." },
  { name: "Bio-Stims", type: "green", tier: 2, prerequisites: "G", description: "You may exhaust this card at the end of your turn to ready 1 of your other technologies." },
  { name: "Hyper Metabolism", type: "green", tier: 3, prerequisites: "GG", description: "During the status phase, gain 3 command tokens instead of 2." },
  { name: "X-89 Bacterial Weapon Ω", type: "green", tier: 3, prerequisites: "GGG", description: "After 1 or more of your units use Bombardment against a planet, exhaust this card and destroy all infantry on that planet." },

  // === PROPULSION (Blue) ===
  { name: "Antimass Deflectors", type: "blue", tier: 1, prerequisites: "", description: "Your ships can move into and through asteroid fields. When other players' units use Space Cannon against your units, apply −1 to the result of each die roll." },
  { name: "Dark Energy Tap", type: "blue", tier: 1, prerequisites: "", description: "After you perform a tactical action in a system that contains a frontier token, if you have 1 or more ships in that system, explore that frontier token." },
  { name: "Gravity Drive", type: "blue", tier: 2, prerequisites: "B", description: "After you activate a system, apply +1 to the move value of 1 of your ships during this tactical action." },
  { name: "Sling Relay", type: "blue", tier: 1, prerequisites: "", description: "During a ground combat, if your opponent is the active player, you may exhaust this card to produce 1 infantry on that planet." },
  { name: "Fleet Logistics", type: "blue", tier: 3, prerequisites: "BB", description: "During each of your turns, you may perform 2 actions instead of 1." },
  { name: "Light/Wave Deflector", type: "blue", tier: 3, prerequisites: "BBB", description: "Your ships can move through systems that contain other players' ships." },

  // === CYBERNETIC (Yellow) ===
  { name: "Sarween Tools", type: "yellow", tier: 1, prerequisites: "", description: "When 1 or more of your units use Production, reduce the combined cost of the produced units by 1." },
  { name: "Scanlink Drone Network", type: "yellow", tier: 1, prerequisites: "", description: "When you activate a system, you may explore each planet in that system that contains 1 or more of your units." },
  { name: "Graviton Laser System", type: "yellow", tier: 2, prerequisites: "Y", description: "You may exhaust this card before 1 or more of your units use Space Cannon; hits produced by those units must be assigned to non-fighter ships." },
  { name: "Predictive Intelligence", type: "yellow", tier: 2, prerequisites: "Y", description: "At the end of your turn, you may exhaust this card to redistribute your command tokens." },
  { name: "Integrated Economy", type: "yellow", tier: 3, prerequisites: "YYY", description: "After you gain control of a planet, you may produce any number of units on that planet that have a combined cost equal to or less than that planet's resource value." },
  { name: "Transit Diodes", type: "yellow", tier: 2, prerequisites: "YY", description: "You may exhaust this card at the start of a tactical action to place up to 4 of your ground forces from other systems on 1 or more planets you control in the active system." },

  // === WARFARE (Red) ===
  { name: "Plasma Scoring", type: "red", tier: 1, prerequisites: "", description: "When 1 or more of your units use Bombardment or Space Cannon, 1 of those units may roll 1 additional die." },
  { name: "AI Development Algorithm", type: "red", tier: 1, prerequisites: "", description: "When you research a unit upgrade technology, you may exhaust this card to ignore any 1 prerequisite." },
  { name: "Magen Defense Grid", type: "red", tier: 2, prerequisites: "R", description: "At the start of ground combat on a planet that contains 1 or more of your units that have Planetary Shield, your opponent cannot make combat rolls during the first round of ground combat." },
  { name: "Self Assembly Routines", type: "red", tier: 2, prerequisites: "R", description: "After 1 or more of your units is destroyed during combat, you may place 1 mech from your reinforcements on the planet or in the space area of that system." },
  { name: "Duranium Armor", type: "red", tier: 3, prerequisites: "RR", description: "During each combat round, after you assign hits, repair 1 of your units that has Sustain Damage in that combat." },
  { name: "Assault Cannon", type: "red", tier: 3, prerequisites: "RRR", description: "At the start of a space combat in a system that contains 3 or more of your non-fighter ships, your opponent must destroy 1 of their non-fighter ships." },
];

// Unit upgrade techs (generic, not faction-specific)
export const UNIT_UPGRADES: TechTreeNode[] = [
  { name: "Infantry II", type: "green", tier: 2, prerequisites: "GG", description: "Cost 1(×2) / Combat 7 / Burst: After this unit is destroyed, roll 1 die. On a 6+, place the unit on this card; at the start of your next turn, place it on a planet you control." },
  { name: "Fighter II", type: "blue", tier: 2, prerequisites: "BB", description: "Cost 1(×2) / Combat 8 / Move 2. No longer requires capacity." },
  { name: "PDS II", type: "yellow", tier: 2, prerequisites: "YY", description: "Planetary Shield / Space Cannon 5 / Deep Space Cannon: Can use Space Cannon against ships in adjacent systems." },
  { name: "Carrier II", type: "blue", tier: 2, prerequisites: "BB", description: "Cost 3 / Combat 9 / Move 2 / Capacity 6. Faster and carries more." },
  { name: "Cruiser II", type: "red", tier: 2, prerequisites: "RRY", description: "Cost 2 / Combat 6 / Move 3 / Capacity 1. Faster, hits harder, gains capacity." },
  { name: "Destroyer II", type: "red", tier: 2, prerequisites: "RR", description: "Cost 1 / Combat 8 / Move 2 / Anti-Fighter Barrage 6(×3). Better barrage and combat value." },
  { name: "Dreadnought II", type: "blue", tier: 3, prerequisites: "BBR", description: "Cost 4 / Combat 5 / Move 2 / Capacity 1 / Sustain Damage / Bombardment 5 / Direct Hit Immunity. Faster movement." },
  { name: "War Sun", type: "red", tier: 3, prerequisites: "RRRR", description: "Cost 12(×3) / Combat 3(×3) / Move 2 / Capacity 6 / Sustain Damage / Bombardment 3(×3). Devastating super-unit." },
  { name: "Space Dock II", type: "yellow", tier: 2, prerequisites: "YY", description: "Production 9 / Capacity: Can produce 3 additional fighters beyond capacity in its system." },
];
