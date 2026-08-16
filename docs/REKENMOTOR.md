# Rekenmotor — voorbeeldberekeningen

Dit document hoort bij [`src/utils/begroting.calc.ts`](../src/utils/begroting.calc.ts)
en [`src/utils/periode.ts`](../src/utils/periode.ts). Elke uitkomst hieronder komt
uit de code en is met een rekenmachine na te rekenen.

De cijfers komen uit **Begroting_ZZP_pakket.xlsx**, de Excel-begroting die aan
deze app ten grondslag ligt. Sectie 9 zet die sheets regel voor regel naast de
motor.

**Maand is overal de rekenbasis.** Alle bedragen zijn per maand, tenzij er
expliciet iets anders staat.

---

## 1. Omrekenen tussen eenheden

Met de aannames uit de seed: `dagenPerMaand = 26`, `contracturenPerWeek = 40`.

| Van | Naar maand | Voorbeeld |
|---|---|---|
| jaar | `÷ 12` | € 24.000 per jaar = € 2.000 per maand |
| maand | `× 1` | € 2.000 per maand = € 2.000 |
| week | `× 52 ÷ 12` | € 500 per week = € 2.166,67 |
| dag | `× dagenPerMaand` | € 80 per dag = € 2.080 |
| uur | `× contracturenPerWeek × 52 ÷ 12` | € 12 per uur = € 2.080 |

De omrekening van en naar uur gaat via de **contracturen**, niet via rijdagen maal
uren per dag. Een uurloon hoort bij een contract, niet bij het aantal dagen dat er
gereden wordt.

Andersom deel je door dezelfde factor:

> € 190 leasetermijn per maand ÷ (40 × 52 ÷ 12) = 190 ÷ 173,3333 = **€ 1,0962 per uur**

**Controle 6** doet dit voor elk totaal, in alle vijf de eenheden, en meldt het als
heen en terug niet op hetzelfde uitkomt.

---

## 2. Opbrengst per opdracht

### Per stuk — de routes

```
stuksPerDag × tariefPerStuk × dagenPerMaand
```

| Route | Berekening | Per maand |
|---|---|---|
| Route 1 | 100 × € 2,60 × 26 | **€ 6.760,00** |
| Route 2 | 70 × € 2,60 × 26 | **€ 4.732,00** |
| ZZP-routes | 200 × € 2,60 × 26 | **€ 13.520,00** |
| | | **€ 25.012,00** |

### Per uur — Riset bij De Installatie

```
aantalMensen × urenPerWeek × 52 ÷ 12 × productiviteit × tariefPerUur
3 × 32 × 52 ÷ 12 × 0,92 × € 43,31
```

> 3 × 32 = 96 uur per week
> 96 × 52 ÷ 12 = 416 uur per maand
> 416 × 0,92 = 382,72 declarabele uren
> 382,72 × 43,31 = **€ 16.575,60 per maand**

De productiviteit van 0,92 betekent dat 8% van de uren niet declarabel is.

### Vast bedrag

Een servicecontract van € 12.000 per jaar: € 12.000 ÷ 12 = **€ 1.000 per maand**.

### Toeslagen en overige opbrengst

Elke opdracht heeft daarnaast een veld voor toeslagen en een voor overige
opbrengst, met een eigen eenheid — de kolommen F en G van de sheet Omzet. Die
komen bovenop het model. In de seed staan ze op nul.

---

## 3. Kosten van een middel

Financieringslast, brandstof, verzekering, wegenbelasting, onderhoud en overig.

| Post | Opel Combo | Ford grote bus |
|---|---|---|
| Lease | € 190 | € 390 |
| Brandstof | € 1.000 | € 1.000 |
| Verzekering | € 150 | € 150 |
| Wegenbelasting | € 50 | € 50 |
| Onderhoud | € 150 | € 150 |
| **Totaal** | **€ 1.540,00** | **€ 1.740,00** |

Samen **€ 3.280,00 per maand**.

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
gaat dus niet nog eens door de eenheid-omrekening. Bij lease wel, want een
leasetermijn kun je ook per jaar invoeren.

### Onderhoud laten berekenen

```
kmPerDagPerMiddel × dagenPerMaand × onderhoudPerKm
120 × 26 × € 0,05 = € 156,00 per maand
```

---

## 4. Wat de inzet ons kost

### Loondienst

```
bruto            = uurloon × urenPerWeek × 52 ÷ 12
vakantiegeld     = bruto × vakantiegeldPct
werkgeverslasten = (bruto + vakantiegeld) × werkgeverslastenPct
totaal           = bruto + vakantiegeld + werkgeverslasten + pensioen + overig
```

Uurloon € 17,3885 · 40 uur per week · vakantiegeld 8% · werkgeverslasten 22% ·
kleding, telefoon en scanner € 50:

> bruto = 17,3885 × 40 × 52 ÷ 12 = 17,3885 × 173,3333 = **€ 3.014,00**
> vakantiegeld = 3.014,00 × 0,08 = **€ 241,12**
> werkgeverslasten = (3.014,00 + 241,12) × 0,22 = 3.255,12 × 0,22 = **€ 716,13**
> totaal = 3.014,00 + 241,12 + 716,13 + 0 + 50 = **€ 4.021,26 per maand**

De werkgeverslasten gaan over bruto **plus** vakantiegeld, niet over bruto alleen.

### ZZP per stuk

`tariefPerStuk × stuksPerDag × dagenPerMaand`

> € 2,25 × 200 × 26 = **€ 11.700,00 per maand**

Jouw tarief op die routes is € 2,60 per pakket. De marge is dus
**€ 2,60 − € 2,25 = € 0,35 per pakket**.

### ZZP per dag

`dagtarief × dagenPerMaand` — bij € 280 × 26 = € 7.280.

**Loondienst mag alleen op een entiteit met personeel.** In de UI is dat
geblokkeerd; de motor geeft daarnaast een waarschuwing, want data kan van elders
komen. ZZP mag overal.

---

## 5. Onderlinge levering

Buddy detacheert drie medewerkers aan De Installatie voor € 3.000 per persoon:
een vast bedrag van **€ 9.000 per maand**.

Deze ene regel telt **twee keer**, met een tegengesteld teken:

- bij **Buddy** als opbrengst: + € 9.000
- bij **De Installatie** als directe kost: − € 9.000

In het ketenoverzicht vallen ze tegen elkaar weg.

> De opdracht *Detachering Riset* bij Buddy heeft zelf een opbrengst van € 0. Dat
> is geen fout. Wat Buddy daaraan verdient loopt via deze levering; zou de
> opdracht óók een tarief hebben, dan telde je die opbrengst dubbel.

---

## 6. De vaste lasten zitten bij de holding

In de Excel staan de vaste lasten op een eigen sheet en tellen ze mee in het
totaal van de bezorging. In de app horen ze bij **FLG Holding**, die boven de
entiteiten staat. Een werkende entiteit draagt ze dus niet.

| Post | Per maand |
|---|---|
| Kantoorhuur | € 2.000 |
| Gas, water en licht | € 330 |
| Internet en telefonie | € 150 |
| Boekhouding en salarisadministratie | € 200 |
| Software | € 130 |
| Bankkosten | € 60 |
| **Totaal** | **€ 2.870,00** |

De holding heeft geen opdrachten, dus haar resultaat is **− € 2.870,00** per
maand. In het ketenoverzicht staat ze onderaan apart.

---

## 6b. BTW — overal bijgehouden, nergens meegerekend

Vrijwel elke factuur bevat BTW. Alleen wat wij naar de bezorging factureren gaat
met **verlegde BTW**, zo afgesproken met de opdrachtgever.

Elke regel met een bedrag heeft daarom een tarief: `hoog` (21%), `laag` (9%),
`geen` of `verlegd`. Verlegd en geen leveren allebei € 0 BTW op, maar betekenen
iets anders: bij verlegd geeft de ontvanger hem zelf aan.

De BTW komt **nooit** in het resultaat terecht — dat is van begin tot eind
exclusief. Hij wordt apart opgeteld:

```
af te dragen      = BTW over de opdrachten
                  + BTW over de onderlinge leveringen die wij uitsturen

terug te vorderen = BTW over de middelen
                  + BTW over de ZZP-inzet        (over loon zit geen BTW)
                  + BTW over de vaste lasten
                  + BTW over de onderlinge leveringen aan ons

saldo             = af te dragen − terug te vorderen
```

### Voorbeeld, met de hand na te rekenen

| Regel | Bedrag | Tarief | BTW |
|---|---|---|---|
| Opdracht Bezorging | € 1.000 | verlegd | € 0,00 |
| Opdracht Installatie | € 500 | 21% | € 105,00 |
| Onderlinge levering uit | € 900 | 21% | € 189,00 |
| **Af te dragen** | | | **€ 294,00** |
| Middel — bus | € 200 | 21% | € 42,00 |
| Inzet — ZZP'er | € 300 | 21% | € 63,00 |
| Inzet — loondienst | € 400 | — | € 0,00 |
| Vaste last — verzekering | € 100 | geen | € 0,00 |
| Vaste last — software | € 100 | 21% | € 21,00 |
| **Terug te vorderen** | | | **€ 126,00** |
| **Saldo naar de Belastingdienst** | | | **€ 168,00** |

Het resultaat van deze begroting is € 2.400 − € 1.100 = **€ 1.300**, en dat
verandert niet door de BTW.

In het ketenoverzicht worden de saldi van de entiteiten opgeteld. De BTW op de
onderlinge facturen valt daar vanzelf tegen elkaar weg: wat de één afdraagt
vordert de ander terug.

---

## 7. Resultatenstaat — Buddy BV

| Regel | Bedrag |
|---|---|
| Opbrengsten uit opdrachten | € 25.012,00 |
| Opbrengst onderlinge leveringen (uitgaand) | € 9.000,00 |
| **Totale opbrengst** | **€ 34.012,00** |
| Subsidies | € 1.500,00 |
| Directe kosten — middelen | € 3.280,00 |
| Directe kosten — inzet | € 31.806,28 |
| Kosten onderlinge leveringen (inkomend) | € 0,00 |
| Vaste lasten | € 0,00 |
| **Totale kosten** | **€ 35.086,28** |
| **Resultaat** | **€ 425,72** |
| Resultaat zonder subsidie | − € 1.074,28 |

> 34.012,00 + 1.500,00 − 35.086,28 = **€ 425,72**

De inzet bestaat uit twee medewerkers op de routes (2 × € 4.021,26), de ZZP'ers
op de ZZP-routes (€ 11.700) en drie gedetacheerden (3 × € 4.021,26).

De subsidie is een **eigen regel** tussen opbrengsten en kosten. Hij wordt nooit
van de loonkosten afgetrokken. Zonder subsidie draait Buddy verlies — dat is
precies waarom die variant altijd zichtbaar is.

### Per opdracht

| Opdracht | Opbrengst | Directe kosten | Over ná vaste lasten | Per stuk / uur |
|---|---|---|---|---|
| Route 1 | € 6.760,00 | € 5.561,26 | € 1.198,74 | € 0,46 per stuk |
| Route 2 | € 4.732,00 | € 5.761,26 | − € 1.029,26 | − € 0,57 per stuk |
| ZZP-routes | € 13.520,00 | € 11.700,00 | € 1.820,00 | **€ 0,35 per stuk** |
| Detachering Riset | € 0,00 | € 12.063,79 | − € 12.063,79 | − € 31,52 per uur |

De vaste lasten zijn nul bij Buddy, dus "over ná vaste lasten" is hier gelijk aan
"over vóór vaste lasten".

Twee dingen springen eruit. **Route 2 draait verlies**: 70 pakketten per dag is te
weinig voor een bus plus een medewerker. En de **ZZP-routes leveren exact € 0,35
per pakket** op — precies de marge uit de Excel.

### Break-even Route 2

Te dekken: € 5.761,26 aan directe kosten.

> € 5.761,26 ÷ (€ 2,60 × 26 dagen) = 5.761,26 ÷ 67,60 = **85,2 pakketten per dag**

Bij 70 per dag nu moeten er dus ruim 15 pakketten per dag bij.

---

## 8. Ketenoverzicht

| Regel | Bedrag |
|---|---|
| Opbrengst van alle entiteiten samen | € 50.587,60 |
| Onderling — valt tegen elkaar weg | − € 9.000,00 |
| **Opbrengst naar buiten toe** | **€ 41.587,60** |
| Subsidies | € 1.500,00 |
| Kosten naar buiten toe | € 37.956,28 |
| Waarvan vaste lasten bij de holding | € 2.870,00 |
| **Resultaat** | **€ 5.131,33** |

Twee wegen naar hetzelfde antwoord — en dat is meteen een van de controles:

> via de keten: 41.587,60 + 1.500,00 − 37.956,28 = **€ 5.131,32**
> via de entiteiten: − 2.870,00 + 425,72 + 7.575,60 = **€ 5.131,32**

(Het laatste cijfer verschilt een cent door afronding in dit document; de code
rekent met volledige precisie en houdt een tolerantie van een halve cent aan.)

---

## 9. Vergelijking met de Excel-begroting

| Regel uit de Excel | Excel | Rekenmotor |
|---|---|---|
| Route 1 — 100 pakketten × € 2,60 × 26 | € 6.760,00 | **€ 6.760,00** |
| Route 2 — 70 pakketten × € 2,60 × 26 | € 4.732,00 | **€ 4.732,00** |
| ZZP-routes — 200 pakketten × € 2,60 × 26 | € 13.520,00 | **€ 13.520,00** |
| Opel Combo — 190 + 1.000 + 150 + 50 + 150 | € 1.540,00 | **€ 1.540,00** |
| Ford grote bus — 390 + 1.000 + 150 + 50 + 150 | € 1.740,00 | **€ 1.740,00** |
| ZZP-kosten — € 2,25 × 200 × 26 | € 11.700,00 | **€ 11.700,00** |
| Marge per pakket ZZP — 2,60 − 2,25 | € 0,35 | **€ 0,35** |
| Medewerker — 3.014 + 241 + 716 + 50 | € 4.021,00 | € 4.021,26 |

De medewerker wijkt **26 cent** af. Dat komt doordat de Excel vakantiegeld en
werkgeverslasten als **afgeronde bedragen** invult (241 en 716), terwijl de motor
ze uit percentages berekent (8% en 22%). Op € 4.021 is dat 0,006%.

Wil je exact het Excel-bedrag, zet dan de percentages iets anders of vul het
verschil in bij "Overig".

### Wat de Excel had en de app nu ook heeft

- **Toeslagen en overige opbrengst per route** (kolom F en G, sheet Omzet)
- **Marge per pakket op ZZP-routes** (Input B50) — als "per stuk" in de tabel per
  opdracht
- **Resultaat per pakket en per opdracht** (Totaal B31 en B32) — onder "In het
  kort" op het tabblad Overzicht
- **De controlerijen onder elke sheet** — dat is wat `controleerBegroting` doet,
  alleen automatisch en met de afwijking erbij in plaats van een 0

### De schaalknoppen

De sheet Input zit er nu ook in, als eigen tabblad **Schaal**. Je draait aan één
getal en de routes, bussen en mensen schalen mee. Op de cijfers van die sheet —
3 extra routes en 2 ZZP-routes:

| Afgeleide uit de Excel | Excel | App |
|---|---|---|
| Extra bussen (B15) | 3 | **3** |
| Extra medewerkers (B16) | 3 | **3** |
| Extra pakketten per dag (B17) | 300 | **300** |
| Totaal per extra bus (B27) | € 1.600 | **€ 1.600,00** |
| Totaal per extra medewerker (B37) | € 4.021 | **€ 4.021,00** |
| ZZP-pakketten per dag (B48) | 200 | **200** |
| Kosten per ZZP-route (B49) | € 5.850 | **€ 5.850,00** |
| Marge per pakket (B50) | € 0,35 | **€ 0,35** |
| Impliciet ZZP-dagtarief (B51) | € 225 | **€ 225,00** |

Twee dingen die anders werken dan in de Excel, allebei met opzet:

**De standaardmedewerker vul je in als bedragen**, net als in de sheet: bruto,
vakantiegeld, werkgeverslasten, pensioen en overig. De motor rekent intern met
percentages, dus die worden teruggerekend uit jouw bedragen. Daardoor komt er
exact € 4.021 uit en niet € 4.021,26 zoals bij een handmatige medewerker.

**De geschaalde regels verschijnen gewoon in de lijsten**, met een stippellijn en
het label "uit de schaalknoppen". Je kunt ze daar niet aanpassen — ze volgen de
knoppen. Wil je per bus iets anders, dan zet je ze met één knop vast als losse
regels; de schaalknoppen gaan daarna uit zodat er niets dubbel telt.

---

## 10. Wat `controleerBegroting` controleert

Elk totaal wordt langs een tweede, onafhankelijke weg herberekend. Een verschil
groter dan een halve cent verschijnt als afwijking in de balk bovenaan de
begrotingspagina.

| # | Controle |
|---|---|
| 1 | De opdrachtregels tellen op tot de opbrengst uit opdrachten |
| 2 | De middelen per opdracht plus die op de entiteit vormen het totaal aan middelkosten |
| 3 | Hetzelfde voor de inzet |
| 4 | De verdeelde vaste lasten plus het niet-verdeelde deel zijn samen het totaal |
| 5 | De resultaten per opdracht, plus wat niet aan een opdracht hangt, komen uit op het totaalresultaat |
| 5b | En langs de staat: totale opbrengst plus subsidies min totale kosten |
| 5c | De opbrengst- en kostenregels tellen op tot hun eigen totaal |
| 6 | Elk totaal heen en terug door de omrekening, in alle vijf eenheden |
| 7 | *(keten)* Elke uitgaande onderlinge levering heeft een gelijke inkomende tegenhanger |
| 7b | *(keten)* De som van de resultaten per entiteit is gelijk aan het ketenresultaat |

Op de seed-cijfers geeft de motor **nul afwijkingen** — voor FLG Holding, Buddy,
De Installatie en de keten.

---

## 11. Verdeelsleutel voor de vaste lasten

Instelbaar per begroting, onder Aannames. Alle drie verdelen de vaste lasten over
de actieve opdrachten, waarbij de aandelen altijd optellen tot het volledige
bedrag.

- **naar rato van opbrengst** (standaard) — een opdracht die twee keer zoveel
  opbrengt, draagt twee keer zoveel vaste lasten. Bij nul opbrengst valt hij terug
  op gelijk verdelen.
- **gelijk over de opdrachten** — elke actieve opdracht een even groot deel.
- **handmatig** — de percentages die je zelf invult. Komen ze niet op 100 uit, dan
  worden ze naar rato genormaliseerd, zodat er nooit vaste lasten zoekraken.

Zijn er geen actieve opdrachten, dan blijven de vaste lasten staan als *niet
verdeeld* en drukken ze rechtstreeks op het resultaat van de entiteit. Dat is
precies wat er bij FLG Holding gebeurt.
