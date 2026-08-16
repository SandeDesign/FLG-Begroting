# Rekenmotor — voorbeeldberekeningen

Dit document hoort bij [`src/utils/begroting.calc.ts`](../src/utils/begroting.calc.ts)
en [`src/utils/periode.ts`](../src/utils/periode.ts). Elke uitkomst hieronder komt
uit de code en is met een rekenmachine na te rekenen.

De cijfers komen uit **Begroting_ZZP_pakket.xlsx**, de Excel-begroting die aan deze
app ten grondslag ligt. Sectie 11 zet die sheet regel voor regel naast de motor.

**Maand is overal de rekenbasis.** Alle bedragen hieronder zijn per maand, tenzij
er expliciet iets anders staat.

---

## 1. Omrekenen tussen eenheden

Met de standaard aannames: `dagenPerMaand = 26`, `contracturenPerWeek = 40`.

| Van | Naar maand | Voorbeeld |
|---|---|---|
| jaar | `÷ 12` | € 24.000 per jaar = € 2.000 per maand |
| maand | `× 1` | € 2.000 per maand = € 2.000 |
| week | `× 52 ÷ 12` | € 500 per week = € 2.166,67 |
| dag | `× dagenPerMaand` | € 80 per dag = € 2.080 |
| uur | `× contracturenPerWeek × 52 ÷ 12` | € 12 per uur = € 2.080 |

De omrekening van en naar uur gaat via de contracturen, niet via rijdagen maal
uren per dag. Een uurloon hoort bij een contract, niet bij het aantal dagen dat
er gereden wordt.

Andersom, van maand naar een andere eenheid, deel je door dezelfde factor:

> € 200 leasetermijn per maand ÷ (40 × 52 ÷ 12) = € 200 ÷ 173,3333 = **€ 1,1538 per uur**

**Controle 6** in `controleerBegroting` doet precies dit voor elk totaal, in alle
vijf de eenheden, en meldt het als heen en terug niet op hetzelfde uitkomt.

---

## 2. Opbrengst per opdracht

### Bezorging — per stuk

```
stuksPerDag × tariefPerStuk × dagenPerMaand
165 × € 2,60 × 26
```

> 165 × 2,60 = 429 per dag · 429 × 26 = **€ 11.154,00 per maand**

### Riset bij De Installatie — per uur

```
aantalMensen × urenPerWeek × 52 ÷ 12 × productiviteit × tariefPerUur
2 × 32 × 52 ÷ 12 × 0,92 × € 43,31
```

> 2 × 32 = 64 uur per week
> 64 × 52 ÷ 12 = 277,3333 uur per maand
> 277,3333 × 0,92 = 255,1467 declarabele uren
> 255,1467 × 43,31 = **€ 11.050,40 per maand**

De productiviteit van 0,92 betekent dat 8% van de uren niet declarabel is.

### Vast bedrag

Een servicecontract van € 12.000 per jaar wordt gewoon omgerekend:
€ 12.000 ÷ 12 = **€ 1.000 per maand**.

---

## 3. Kosten van een middel

Alle kosten van een middel bij elkaar: financieringslast, brandstof, verzekering,
wegenbelasting, onderhoud en overig.

### Opel Combo (lease)

| Post | Bedrag |
|---|---|
| Leasetermijn | € 200 |
| Brandstof | € 1.000 |
| Verzekering | € 150 |
| Wegenbelasting | € 50 |
| Onderhoud | € 150 |
| **Totaal** | **€ 1.550,00** |

### Ford grote bus (lease)

Zelfde posten met een leasetermijn van € 390: **€ 1.740,00**.

Samen: **€ 3.290,00 per maand aan middelen** voor de opdracht Bezorging.

### De drie soorten financiering

- **lease** → de leasetermijn, omgerekend vanuit de eenheid van het middel.
- **financial lease** → een annuïteit over de looptijd:

  ```
  PMT = hoofdsom × maandrente ÷ (1 − (1 + maandrente)^−looptijd)
  ```

  Bij € 30.000 (waarde min restwaarde), 60 maanden en 7,5% rente per jaar:

  > maandrente = 0,075 ÷ 12 = 0,00625
  > 1,00625^60 = 1,45329 · 1 ÷ 1,45329 = 0,688094
  > 30.000 × 0,00625 = 187,50
  > 187,50 ÷ (1 − 0,688094) = 187,50 ÷ 0,311906 = **€ 601,14 per maand**

- **eigendom** → lineair: (waarde − restwaarde) ÷ looptijdMaanden.
  € 30.000 over 60 maanden = € 500 per maand.

Bij financial lease en eigendom komt er per definitie al een maandbedrag uit; die
wordt dus niet nog eens door de eenheid-omrekening gehaald. Bij lease wel, want
een leasetermijn kun je ook per jaar invoeren.

### Onderhoud laten berekenen

Staat `onderhoudBerekenen` aan, dan volgt het onderhoud uit de kilometers:

```
kmPerDagPerMiddel × dagenPerMaand × onderhoudPerKm
120 × 26 × € 0,05 = € 156,00 per maand
```

---

## 4. Wat de inzet ons kost

### Loondienst — medewerker Bezorging

Uurloon € 17,39 · 40 uur per week · vakantiegeld 8% · werkgeverslasten 22% ·
overig € 50.

```
bruto            = uurloon × urenPerWeek × 52 ÷ 12
vakantiegeld     = bruto × vakantiegeldPct
werkgeverslasten = (bruto + vakantiegeld) × werkgeverslastenPct
totaal           = bruto + vakantiegeld + werkgeverslasten + pensioen + overig
```

> bruto = 17,39 × 40 × 52 ÷ 12 = 17,39 × 173,3333 = **€ 3.014,27**
> vakantiegeld = 3.014,27 × 0,08 = **€ 241,14**
> werkgeverslasten = (3.014,27 + 241,14) × 0,22 = 3.255,41 × 0,22 = **€ 716,19**
> totaal = 3.014,27 + 241,14 + 716,19 + 0 + 50 = **€ 4.021,60 per maand**

Twee medewerkers: **€ 8.043,20 per maand**.

De werkgeverslasten worden dus over bruto **plus** vakantiegeld berekend, niet
over bruto alleen.

### ZZP per stuk

`tariefPerStuk × stuksPerDag × dagenPerMaand` — bij € 1,20 × 165 × 26 = € 5.148.

### ZZP per dag

`dagtarief × dagenPerMaand` — bij € 280 × 26 = € 7.280.

**Loondienst mag alleen op een entiteit met personeel.** In de UI is dat
geblokkeerd; de rekenmotor geeft daarnaast een waarschuwing, want data kan ook
van elders komen. ZZP mag overal.

---

## 5. Onderlinge levering

Buddy levert mensen aan De Installatie voor de opdracht Detachering Riset,
tegen € 26,00 per uur, voor 255,1467 uur per maand (dezelfde declarabele uren als
hierboven).

> 26,00 × 255,1467 = **€ 6.633,81 per maand**

Deze ene regel telt **twee keer**, met een tegengesteld teken:

- bij **Buddy** als opbrengst: + € 6.633,81
- bij **De Installatie** als directe kost: − € 6.633,81

In het ketenoverzicht vallen ze tegen elkaar weg.

> Let op: de opdracht *Detachering Riset* bij Buddy heeft zelf een opbrengst van
> € 0. Dat is geen fout. Wat Buddy aan die detachering verdient loopt via de
> onderlinge levering; zou de opdracht óók een tarief hebben, dan telde je die
> opbrengst dubbel.

---

## 6. Resultatenstaat — Buddy BV

Vaste lasten: kantoorhuur € 2.000, gas/water/licht € 330, internet € 150,
boekhouding € 200, software € 130, bankkosten € 60 = **€ 2.870,00**.

| Regel | Bedrag |
|---|---|
| Opbrengsten uit opdrachten | € 11.154,00 |
| Opbrengst onderlinge leveringen (uitgaand) | € 6.633,81 |
| **Totale opbrengst** | **€ 17.787,81** |
| Subsidies | € 1.500,00 |
| Directe kosten — middelen | € 3.290,00 |
| Directe kosten — inzet | € 8.043,20 |
| Kosten onderlinge leveringen (inkomend) | € 0,00 |
| Vaste lasten | € 2.870,00 |
| **Totale kosten** | **€ 14.203,20** |
| **Resultaat** | **€ 5.084,62** |
| Resultaat zonder subsidie | € 3.584,62 |

> 17.787,81 + 1.500,00 − 14.203,20 = **€ 5.084,62**

De subsidie is een **eigen regel** tussen opbrengsten en kosten. Hij wordt nooit
van de loonkosten afgetrokken, en in de scenariovergelijking staat altijd ook de
variant zonder subsidie.

### Per opdracht

| Opdracht | Opbrengst | Directe kosten | Over vóór vaste lasten | Aandeel vaste lasten | Over ná vaste lasten |
|---|---|---|---|---|---|
| Bezorging | € 11.154,00 | € 11.333,20 | − € 179,20 | € 2.870,00 | − € 3.049,20 |
| Detachering Riset | € 0,00 | € 0,00 | € 0,00 | € 0,00 | € 0,00 |

De verdeelsleutel staat op *naar rato van opbrengst*. Bezorging is de enige
opdracht met opbrengst, dus die draagt alle vaste lasten.

Dat Bezorging op zichzelf verliesgevend is, is precies wat deze begroting moet
laten zien: € 11.154 aan opbrengst tegen € 11.333,20 aan directe kosten. Buddy
komt als geheel positief uit doordat de detachering en de subsidie erbij komen.

### Break-even Bezorging

Te dekken: directe kosten € 11.333,20 + aandeel vaste lasten € 2.870,00 = € 14.203,20.

> € 14.203,20 ÷ (€ 2,60 × 26 dagen) = 14.203,20 ÷ 67,60 = **210,11 stuks per dag**

Bij 165 stuks per dag nu, moeten er dus ruim 45 stuks per dag bij om quitte te draaien.

Voor een opdracht op uren komt er een uurtarief uit, en voor een vaste opdracht
een maandbedrag.

---

## 7. Resultatenstaat — De Installatie BV

Vaste lasten: kantoorkosten € 400 + boekhouding € 150 = € 550.

| Regel | Bedrag |
|---|---|
| Opbrengsten uit opdrachten (Riset) | € 11.050,40 |
| **Totale opbrengst** | **€ 11.050,40** |
| Subsidies | € 0,00 |
| Kosten onderlinge leveringen (inkomend, van Buddy) | € 6.633,81 |
| Vaste lasten | € 550,00 |
| **Totale kosten** | **€ 7.183,81** |
| **Resultaat** | **€ 3.866,59** |

> 11.050,40 − 6.633,81 − 550,00 = **€ 3.866,59**

Zo leest de Riset-keten:

> De Installatie factureert Riset **€ 43,31 per uur** · Buddy levert de mensen en
> rekent De Installatie **€ 26,00 per uur** · Wat er bij De Installatie overblijft:
> **€ 17,31 per uur**.

---

## 8. Ketenoverzicht

| Regel | Bedrag |
|---|---|
| Opbrengst van alle entiteiten samen | € 28.838,22 |
| Onderling — valt tegen elkaar weg | − € 6.633,81 |
| **Opbrengst naar buiten toe** | **€ 22.204,40** |
| Subsidies | € 1.500,00 |
| Kosten van alle entiteiten samen | € 21.387,01 |
| Onderling — valt tegen elkaar weg | − € 6.633,81 |
| **Kosten naar buiten toe** | **€ 14.753,20** |
| **Resultaat** | **€ 8.951,21** |

Twee wegen naar hetzelfde antwoord — en dat is meteen een van de controles:

> via de keten: 22.204,40 + 1.500,00 − 14.753,20 = **€ 8.951,20**
> via de entiteiten: 5.084,62 + 3.866,59 = **€ 8.951,21**

(Het verschil van een cent is afronding in dit document; de code rekent met de
volledige precisie en houdt een tolerantie van een halve cent aan.)

---

## 9. Wat `controleerBegroting` controleert

Elk totaal wordt langs een tweede, onafhankelijke weg herberekend. Komt er een
verschil groter dan een halve cent uit, dan verschijnt dat als afwijking in de
balk bovenaan de begrotingspagina.

| # | Controle |
|---|---|
| 1 | De opdrachtregels tellen op tot de opbrengst uit opdrachten |
| 2 | De middelen per opdracht plus die op de entiteit vormen het totaal aan middelkosten |
| 3 | Hetzelfde voor de inzet |
| 4 | De verdeelde vaste lasten plus het niet-verdeelde deel zijn samen het totaal aan vaste lasten |
| 5 | De resultaten per opdracht, plus wat niet aan een opdracht hangt, komen uit op het totaalresultaat |
| 5b | En langs de staat: totale opbrengst plus subsidies min totale kosten |
| 5c | De opbrengst- en kostenregels tellen op tot hun eigen totaal |
| 6 | Elk totaal heen en terug door de omrekening, in alle vijf eenheden, levert hetzelfde op |
| 7 | *(keten)* Elke uitgaande onderlinge levering heeft een gelijke inkomende tegenhanger |
| 7b | *(keten)* De som van de resultaten per entiteit is gelijk aan het ketenresultaat |

Op de cijfers hierboven geeft de motor **nul afwijkingen** — voor Buddy, voor
De Installatie en voor de keten.

---

## 10. Verdeelsleutel voor de vaste lasten

Instelbaar per begroting, onder Aannames. Alle drie doen hetzelfde: ze verdelen
de vaste lasten over de actieve opdrachten, waarbij de aandelen altijd optellen
tot het volledige bedrag.

- **naar rato van opbrengst** (standaard) — een opdracht die twee keer zoveel
  opbrengt, draagt twee keer zoveel vaste lasten. Bij nul opbrengst valt hij
  terug op gelijk verdelen.
- **gelijk over de opdrachten** — elke actieve opdracht een even groot deel.
- **handmatig** — de percentages die je zelf invult. Komen ze niet op 100 uit,
  dan worden ze naar rato genormaliseerd, zodat er nooit vaste lasten
  zoekraken.

Zijn er helemaal geen actieve opdrachten, dan blijven de vaste lasten staan als
*niet verdeeld* en drukken ze rechtstreeks op het resultaat van de entiteit.


---

## 11. Vergelijking met de Excel-begroting

De bezorgingskant komt uit de sheets Input, Omzet, Bussen, Personeel en ZZP. De
motor geeft daar exact dezelfde uitkomsten:

| Regel uit de Excel | Excel | Rekenmotor |
|---|---|---|
| Route 1 — 100 pakketten × € 2,60 × 26 | € 6.760,00 | **€ 6.760,00** |
| Route 2 — 70 pakketten × € 2,60 × 26 | € 4.732,00 | **€ 4.732,00** |
| ZZP-routes — 200 pakketten × € 2,60 × 26 | € 13.520,00 | **€ 13.520,00** |
| Opel Combo — 190 + 1.000 + 150 + 50 + 150 | € 1.540,00 | **€ 1.540,00** |
| Ford grote bus — 390 + 1.000 + 150 + 50 + 150 | € 1.740,00 | **€ 1.740,00** |
| ZZP-kosten — € 2,25 × 200 × 26 | € 11.700,00 | **€ 11.700,00** |
| Medewerker — 3.014 + 241 + 716 + 50 | € 4.021,00 | € 4.021,26 |

De medewerker wijkt 26 cent af. Dat komt doordat de Excel het vakantiegeld en de
werkgeverslasten als **afgeronde bedragen** invult (241 en 716), terwijl de motor
ze uit percentages berekent (8% en 22%). Op € 4.021 is dat 0,006% — te
verwaarlozen, maar wel goed om te weten waar het vandaan komt.

Wil je exact de Excel-bedragen, zet dan het uurloon en de percentages zo dat de
uitkomst klopt, of vul het verschil in bij "Overig".

### Wat de Excel wél had en de motor nu ook

- **Toeslagen en overige opbrengst per route** (kolom F en G op de sheet Omzet).
  Staan nu per opdracht, met een eigen eenheid.
- **Marge per pakket op ZZP-routes** (Input B50). Verschijnt als "per stuk" in de
  tabel per opdracht: € 2,60 − € 2,25 = **€ 0,35 per pakket**.
- **Resultaat per pakket en per route** (Totaal B31 en B32). Staan onder "In het
  kort" op het tabblad Overzicht.
- **De controlerijen onder elke sheet.** Dat is precies wat `controleerBegroting`
  doet, alleen dan automatisch en met de afwijking erbij in plaats van een 0.

### Wat er bewust anders is

**De vaste lasten staan niet bij een werkende entiteit.** In de Excel staan ze op
een eigen sheet en tellen ze mee in het totaal van de bezorging. In de app horen
ze bij **FLG Holding**, die boven de entiteiten staat. Buddy draagt ze dus niet;
de holding laat ze zien als eigen resultaat, en in het ketenoverzicht tellen ze
gewoon mee in het geheel.

Concreet voor de seed:

| | Per maand |
|---|---|
| FLG Holding — alleen vaste lasten | − € 2.870,00 |
| Buddy BV — bezorging, detachering en subsidie | € 425,72 |
| De Installatie BV — Riset min de inkoop bij Buddy | € 7.575,60 |
| **Keten, na wegstrepen van de € 9.000 onderling** | **€ 5.131,33** |

Op alle drie de begrotingen en op de keten geeft de motor **nul afwijkingen**.
