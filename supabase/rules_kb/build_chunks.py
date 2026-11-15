"""Build curated RAG chunks from the two Czech PoK PDFs.

Rules booklet: sliced by section headings (lore, component art, map diagrams
and credits skipped). Faction sheets: the text layer has abilities, but unit
stats, starting units/tech and commodities are graphics, so those were read
off the page images and are written out by hand below.
"""
import json
import re
import sys

import pymupdf

# Usage: python3 build_chunks.py Zakladni_pravidla.pdf rasy.pdf supabase/rules_kb/pok_cs.json
# (needs PyMuPDF: pip install pymupdf)
RULES_PDF, RASY_PDF, OUT = sys.argv[1:4]


def clean(s: str) -> str:
    s = s.replace(" ", " ")
    s = re.sub(r"(\w)-\n(\w)", r"\1\2", s)  # de-hyphenate line breaks
    s = re.sub(r"[ \t]*\n[ \t]*", "\n", s)
    # join wrapped lines, keep bullets / headings on their own line
    lines = s.split("\n")
    out = []
    for ln in lines:
        ln = ln.strip()
        if not ln:
            continue
        starts_block = ln[0] in "✦✧•" or (ln.isupper() and len(ln) < 60)
        if out and not starts_block and not (out[-1].isupper() and len(out[-1]) < 60):
            out[-1] += " " + ln
        else:
            out.append(ln)
    s = "\n".join(out)
    s = re.sub(r" {2,}", " ", s)
    return s.strip()


rules = pymupdf.open(RULES_PDF)
rp = {i + 1: p.get_text() for i, p in enumerate(rules)}


def between(page: int, start: str, end: str | None) -> str:
    t = rp[page]
    a = t.index(start)
    b = t.index(end, a + len(start)) if end else len(t)
    return t[a:b]


RULES_LABEL = "Proroctví králů – pravidla rozšíření (CZ)"
FACT_LABEL = "Proroctví králů – listy frakcí (CZ)"

chunks = []


def add(source, page, section, content, page_end=None):
    chunks.append({
        "source": source,
        "page_start": page,
        "page_end": page_end or page,
        "section": section,
        "content": content.strip(),
    })


# ---------------- Rules booklet ----------------
removed_agendas = re.findall(r"✦\s*(.+)", between(6, "✦Těžba", None))
add(RULES_LABEL, 6, "Začlenění rozšíření (Integrating the expansion)",
    "ZAČLENĚNÍ ROZŠÍŘENÍ\n" + clean(between(6, "Před smícháním", " Poté zkombinujte"))
    + "\n" + "\n".join(f"✦ {a.strip()}" for a in removed_agendas)
    + "\n" + clean(between(6, " Poté zkombinujte", "PŘEHLED")))

add(RULES_LABEL, 6, "Přehled, identifikátor rozšíření, dlouhá válka (Overview, expansion icon, 14-point game)",
    clean(between(6, "PŘEHLED", "VÝFUKOVÉ VENTILY")))

add(RULES_LABEL, 7, "Herní součásti (Components)", """HERNÍ SOUČÁSTI rozšíření Proroctví králů
✦ 40 dílků systémů a hypercest (systémy rozšíření mají čísla 52–91)
✦ 20 karet akcí
✦ 13 karet agendy
✦ 128 karet technologií
✦ 24 karet jednotek mechů
✦ 40 karet planet
✦ 40 karet cílů
✦ 24 karet směnek
✦ 74 karet průzkumu (20 kulturních, 20 průmyslových, 20 nebezpečných a 14 hraničních)
✦ 10 karet relikvií
✦ 7 karet frakcí""")

add(RULES_LABEL, 8, "Příprava hry s rozšířením (Setup changes)",
    clean(between(8, "PŘÍPRAVA HRY", "Dodatečné frakční komponenty")).replace("vůdců Každý", "vůdců\nKaždý")
    + "\nPoznámka: v kroku 7 jde o žetony hranic (frontier tokens).")

add(RULES_LABEL, 8, "Quick reference card (EN): agenda phase, leaders, terminology, exploration tokens",
    "\n".join(ln.strip() for ln in between(8, "AGENDA PHASE", "QUICK REFERENCE").split("\n") if ln.strip()))

add(RULES_LABEL, 9, "Příprava herního plánu pro 5, 7 nebo 8 hráčů (Hyperlanes setup)",
    clean(between(9, "PŘÍPRAVA Herního PLÁNU", "PŘÍPRAVA HERNÍHO PLÁNU PRO 5, 7")))

add(RULES_LABEL, 10, "Zajetí (Capture)", clean(between(10, "ZAJeTÍ", "LEGENDÁRNÍ PLANETY")))

add(RULES_LABEL, 10, "Legendární planety (Legendary planets)",
    clean(between(10, "LEGENDÁRNÍ PLANETY", "PRIMOR"))
    + "\nPříklad: legendární planeta Primor (1 surovina / 2 vliv). Karta legendární schopnosti "
      "„The Atrament“: Na konci svého tahu můžeš tuto kartu vyčerpat a umístit až 2 pěchoty ze "
      "svých zásob na libovolnou planetu, kterou ovládáš.")

add(RULES_LABEL, 10, "Další hráči a vůdcové – agent, velitel, hrdina (Leaders)",
    clean(between(10, "PRAVIDLA", "JEDNOTKY MECHŮ")))

add(RULES_LABEL, 10, "Jednotky mechů a schopnost Nasazení (Mechs, Deploy)",
    clean(between(10, "JEDNOTKY MECHŮ", "Ikona slotu")))

add(RULES_LABEL, 11, "Odhození a červí díra Nexus (Purge, Wormhole Nexus)",
    clean(between(11, "ODHOZENÍ", "hypercesty")))

add(RULES_LABEL, 11, "Hypercesty (Hyperlanes)",
    clean(between(11, "hypercesty", "Neaktiví"))
    + "\n" + clean(between(11, "Hypercesty vytvářejí", "PRŮZKUM")))

add(RULES_LABEL, 11, "Průzkum (Exploration)", clean(between(11, "PRŮZKUM", "PŘIPOJENÉ KARTY")))

add(RULES_LABEL, 11, "Připojené karty, fragmenty relikvií a relikvie (Attach, relic fragments, relics)",
    clean(between(11, "PŘIPOJENÉ KARTY", "Žeton \nhranice")))

add(RULES_LABEL, 12, "Dodatek – mapy: předpřipravené mapy, alternativní hypercesty, velká galaxie",
    clean(between(12, "DODATEK-MAPY", "PŘÍPRAVA PRO SEDM HRÁČŮ"))
    + "\n" + clean(between(12, "PŘÍPRAVA PRO SEDM HRÁČŮ", "p\n"))
    + "\n" + clean(between(12, "PŘÍPRAVA PRO OSM HRÁČŮ", "VELKÁ GALAXIE"))
    + "\n" + clean(between(12, "VELKÁ GALAXIE", "PŘÍPRAVA PRO ŠEST HRÁČŮ"))
    + "\n" + clean(between(12, "PŘÍPRAVA PRO ŠEST HRÁČŮ", " \nDODATEK"))
    + "\nSchémata předpřipravených galaxií pro 3, 4, 5 (s hypercestami), 6, 7 (s hypercestami) "
      "a 8 hráčů jsou na stranách 13–15 (pouze obrázky).", page_end=15)

# ---------------- Faction sheets ----------------
rasy = pymupdf.open(RASY_PDF)
sp = {i + 1: p.get_text() for i, p in enumerate(rasy)}

add(FACT_LABEL, 1, "Standardní jednotky (Standard unit stats)", """STANDARDNÍ JEDNOTKY (úroveň I, stejné pro všechny frakce, pokud frakce nemá vlastní verzi)
Formát: cena / boj / dolet / kapacita
✦ Bojové slunce: nelze vyrábět bez technologie vylepšení této jednotky.
✦ Křižník I: 2 / 7 / 2 / –
✦ Bitevník I: 4 / 5 / 1 / 1; ODOLNOST, BOMBARDOVÁNÍ 5
✦ Torpédoborec I: 1 / 9 / 2; PALEBNÁ CLONA 9 (x2)
✦ Transportér I: 3 / 9 / 1 / 4
✦ Stíhač I: 1 (za 2 jednotky) / 9 / –
✦ Pěchota I: 1 (za 2 jednotky) / boj 8
✦ POS I: PLANETÁRNÍ ŠTÍT, VESMÍRNÉ DĚLO 6
✦ Vesmírný dok I: VÝROBA X – hodnota VÝROBY je o 2 vyšší než hodnota zdrojů planety. Až 3 stíhače v tomto systému se nepočítají do limitu kapacity tvých lodí.""", page_end=13)

FACTIONS = [
    dict(page=1, cz="Nebešťané", en="The Empyrean", comm=4,
         flag="DYNAMO – vlajková loď Nebešťanů: 8 / 5 (x2) / 1 / 3; ODOLNOST. Pokud jednotka jakéhokoli hráče v tomto nebo sousedním systému použije schopnost ODOLNOST, můžeš spotřebovat 2 body vlivu a opravit ji.",
         special=[],
         abil=["DĚTI PRÁZDNOTY", "AETHEROVÝ PRŮCHOD", "TEMNÉ ŠEPOTY"],
         tech="Čerpadlo temné energie",
         units="2 transportéry, 1 torpédoborec, 2 stíhače, 4 pěchoty, 1 vesmírný dok"),
    dict(page=3, cz="Mahactští genočarodějové", en="The Mahact Gene-Sorcerers", comm=3,
         flag="ARVICON REX – vlajková loď Mahactů: 8 / 5 (x2) / 1 / 3; ODOLNOST. Během souboje se soupeřem, jehož žeton rozkazu nemáš ve svém úseku flotily, přidej +2 ke všem bojovým hodům této jednotky.",
         special=["ŠARLATOVÝ LEGIONÁŘ I – mahactská pěchota: 1 (za 2) / boj 8. Poté, co je tato jednotka zničena, získáváš 1 surovinu nebo přeměň 1 surovinu na zboží."],
         abil=["EDIKT", "IMPERIA", "NADUTOST"],
         tech="Biostimulátory, Prediktivní inteligence",
         units="1 bitevník, 1 transportér, 1 křižník, 2 stíhače, 3 pěchoty, 1 vesmírný dok"),
    dict(page=5, cz="Aliance Naaz-Rokha", en="The Naaz-Rokha Alliance", comm=3,
         flag="VISZ EL VIR – vlajková loď Naaz-Rokha: 8 / 9 (x2) / 1 / 4; ODOLNOST. Tví mechové v tomto systému házejí v souboji 1 kostkou navíc.",
         special=[],
         abil=["VZDÁLENÁ SLUNCE", "PŘETVÁŘENÍ"],
         tech="Psychoarcheologie, Algoritmus evoluce UI",
         units="2 transportéry, 1 torpédoborec, 2 stíhače, 1 mech, 3 pěchoty, 1 vesmírný dok"),
    dict(page=7, cz="Vuil'raithský kabal", en="The Vuil'Raith Cabal", comm=2,
         flag="HRŮZA Z MEZIPROSTORU – vlajková loď Vuil'raithů: 8 / 5 (x2) / 1 / 3; ODOLNOST, BOMBARDOVÁNÍ 5. Zajmi všechny ostatní jednotky, které jsou v tomto systému zničeny, včetně svých vlastních.",
         special=["DIMENZIONÁLNÍ TRHLINA I – vesmírný dok Vuil'raithů: VÝROBA 5. Tento systém je gravitační propast; tvé lodě kvůli této gravitační propasti neházejí. Pod tuto jednotku umísti žeton dimenzionální trhliny jako připomínku. Až 6 stíhačů v tomto systému se nepočítá do kapacity tvých lodí."],
         abil=["POHLCENÍ", "ASIMILACE", "ZLOMOFÚZE"],
         tech="Sebesestavovací programy",
         units="1 bitevník, 1 transportér, 1 křižník, 3 stíhače, 3 pěchoty, 1 vesmírný dok"),
    dict(page=9, cz="Titáni Ulovi", en="The Titans of Ul", comm=2,
         flag="OURANOS – vlajková loď Ulova: 8 / 7 (x2) / 1 / 3; ODOLNOST. NASAZENÍ: Poté, co aktivuješ systém, který obsahuje 1 nebo více tvých POS, můžeš jeden z těchto POS nahradit touto jednotkou.",
         special=["STROJ SATURN I – křižník Ulova: 2 / 7 / 2 / 1.",
                  "HEL-TITÁN I – Ulův POS: boj 7; PLANETÁRNÍ ŠTÍT, VESMÍRNÉ DĚLO 6, ODOLNOST, VÝROBA 1. Tato jednotka je považována za budovu i za pozemní jednotku. Nemůže být transportována."],
         abil=["TERRAGENEZE", "PROCITNUTÍ", "SPLÝVÁNÍ"],
         tech="Antihmotové deflektory, Průzkumná dronová síť",
         units="1 bitevník, 2 křižníky, 2 stíhače, 3 pěchoty, 1 vesmírný dok"),
    dict(page=11, cz="Nomád", en="The Nomad", comm=4,
         flag="MEMORIA – vlajková loď Nomáda: 8 / 7 (x2) / 1 / 3; ODOLNOST, PALEBNÁ CLONA 8 (x3). Můžeš tuto jednotku považovat za sousední se systémy, ve kterých se nachází 1 nebo více tvých mechů. Tato vlajková loď má technologii vylepšení.",
         special=[],
         abil=["DRUŽINA", "VHLED DO BUDOUCNOSTI"],
         tech="Prakové relé",
         units="1 vlajková loď, 1 transportér, 1 torpédoborec, 3 stíhače, 4 pěchoty, 1 vesmírný dok"),
    dict(page=13, cz="Stříbrná letka", en="The Argent Flight", comm=3,
         flag="QUETZECOATL – vlajková loď Letky: 8 / 7 (x2) / 1 / 3; ODOLNOST. Ostatní hráči nemohou proti lodím v tomto systému používat VESMÍRNÉ DĚLO.",
         special=["ÚTOČNÁ LETKA ALFA I – torpédoborec Letky: 1 / 8 / 2 / 1; PALEBNÁ CLONA 9 (x2)."],
         abil=["SVATÉ NADŠENÍ", "PŘEPADOVÁ FORMACE"],
         tech="vyber si 2 ze 3: Neurální motivátor, Sarweenské nástroje, Plazmové drážkování",
         units="1 transportér, 2 torpédoborce, 2 stíhače, 5 pěchot, 1 vesmírný dok, 1 POS"),
]


def ability_texts(page: int, names: list[str]) -> dict[str, str]:
    """Ability texts sit after 'SUROVINY' in the same order as the names that follow them."""
    t = sp[page]
    block = t[t.index("SUROVINY") + len("SUROVINY"):]
    # Names are standalone lines; the same word can also occur inside an ability text.
    def pos(n):
        return re.search(r"\n" + re.escape(n) + r"[ \t]*\n", block).start()
    name_pos = min(pos(n) for n in names)
    texts_raw = block[:name_pos].strip()
    # Split into paragraphs: each ability text ends with a period followed by a new sentence start line.
    paras, cur = [], []
    for ln in texts_raw.split("\n"):
        cur.append(ln)
        if ln.rstrip().endswith((".", ".”")):
            paras.append(clean("\n".join(cur)))
            cur = []
    if cur:
        paras.append(clean("\n".join(cur)))
    # Names appear in reverse order of the visual list but in the same order as the texts.
    names_in_order = sorted(names, key=pos)
    assert len(paras) == len(names), (page, paras, names_in_order)
    return dict(zip(names_in_order, paras))


for f in FACTIONS:
    abil = ability_texts(f["page"], f["abil"])
    body = [f"FRAKCE: {f['cz'].upper()} ({f['en']})",
            f"Suroviny (commodities): {f['comm']}",
            "Frakční schopnosti:"]
    body += [f"✦ {n}: {abil[n]}" for n in sorted(abil, key=lambda n: f['abil'].index(n))]
    body.append("Vlajková loď (cena / boj / dolet / kapacita):")
    body.append(f"✦ {f['flag']}")
    if f["special"]:
        body.append("Frakční jednotky (cena / boj / dolet / kapacita):")
        body += [f"✦ {s}" for s in f["special"]]
    body.append(f"Startovní technologie: {f['tech']}")
    body.append(f"Startovní jednotky: {f['units']}")
    add(FACT_LABEL, f["page"], f"{f['cz']} ({f['en']}) – list frakce", "\n".join(body), page_end=f["page"] + 1)

    lore = clean(sp[f["page"] + 1]).replace("\n", " ")
    add(FACT_LABEL, f["page"] + 1, f"{f['cz']} ({f['en']}) – příběh frakce (lore)",
        f"PŘÍBĚH FRAKCE {f['cz'].upper()} ({f['en']})\n{lore}")

json.dump(chunks, open(OUT, "w"), ensure_ascii=False, indent=1)
print(len(chunks), "chunks;", sum(len(c["content"]) for c in chunks), "chars")
for c in chunks:
    print(f"{len(c['content']):5d}  p{c['page_start']}  {c['section']}")
