// src/components/handboek/handboekInhoud.ts
// De inhoud van het handboek. Losgetrokken van de weergave, zodat er tekst bij
// kan zonder aan het component te komen.
//
// Elk onderwerp kan verwijzingen hebben. Een verwijzing brengt je naar de juiste
// pagina en opent daar zo nodig meteen het juiste scherm, zodat je niet hoeft te
// zoeken naar wat er in de uitleg staat.

/** Waar een "laat me zien"-knop je heen brengt. */
export interface Verwijzing {
  /** De tekst op de knop. */
  label: string;
  /**
   * Het pad, of 'begroting' als de link naar de begroting gaat die je open hebt.
   * In dat laatste geval wordt het id ingevuld door het handboek zelf.
   */
  pad: string | 'begroting';
  /** Het tabblad binnen het werkblad, bijvoorbeeld 'inzet'. */
  tab?: string;
  /**
   * Welk scherm er meteen open moet. Het werkblad leest dit uit de URL en opent
   * de bijbehorende modal.
   */
  opent?: 'opdracht' | 'middel' | 'inzet' | 'subsidie' | 'levering' | 'entiteit' | 'begroting';
}

export interface HandboekOnderwerp {
  id: string;
  titel: string;
  /** Korte samenvatting, getoond in de lijst. */
  kort: string;
  /** De uitleg zelf. Elke regel wordt een alinea; een regel die met "- " begint wordt een opsomming. */
  tekst: string[];
  verwijzingen?: Verwijzing[];
}

export interface HandboekHoofdstuk {
  id: string;
  titel: string;
  emoji: string;
  onderwerpen: HandboekOnderwerp[];
}

export const HANDBOEK: HandboekHoofdstuk[] = [
  {
    id: 'begin',
    titel: 'Hoe het in elkaar zit',
    emoji: '🧭',
    onderwerpen: [
      {
        id: 'opbouw',
        titel: 'De opbouw in één alinea',
        kort: 'Entiteit, begroting, opdracht, middel, inzet — wat waar hoort',
        tekst: [
          'Bovenaan staan de **entiteiten**: de BV\'s van de groep. Eén daarvan is de holding; die draagt de vaste lasten en heeft zelf geen opdrachten.',
          'Onder een entiteit hangen **begrotingen**. Een begroting loopt over een periode en is de plek waar je rekent. Wil je hetzelfde doorrekenen met andere cijfers, dan dupliceer je hem als **scenario**.',
          'In een begroting zitten **opdrachten**: wat je doet en voor wie. Een opdracht levert geld op, per uur, per stuk of als vast bedrag.',
          'Aan een opdracht hangen **middelen** (bussen, machines) en **inzet** (wie het uitvoert: loondienst of ZZP). Dat zijn de directe kosten van die opdracht.',
          'Wat entiteiten aan elkaar leveren staat onder **Onderling**. Dat telt bij de één als opbrengst en bij de ander als kost, en valt in het ketenoverzicht tegen elkaar weg.',
        ],
        verwijzingen: [
          { label: 'Naar de entiteiten', pad: '/entiteiten' },
          { label: 'Naar de begrotingen', pad: '/begrotingen' },
        ],
      },
      {
        id: 'eenheden',
        titel: 'Alles rekent per maand',
        kort: 'Waarom je overal een eenheid kiest en wat de schakelaar bovenaan doet',
        tekst: [
          'Intern rekent de app altijd per maand. Elk bedrag dat je invoert heeft een eigen eenheid — per uur, dag, week, maand of jaar — en wordt meteen naar maand omgerekend.',
          'Een leasetermijn voer je dus per maand in, een uurloon per uur, en een verzekering desnoods per jaar. Ze komen allemaal op hetzelfde uit.',
          'Bovenaan het tabblad Overzicht staat een schakelaar die de hele resultatenstaat omrekent naar uur, dag, week, maand of jaar. Die raakt je gegevens niet aan; alleen de weergave verandert.',
          'De omrekening naar uur gaat via de contracturen per week uit de aannames, niet via rijdagen maal uren per dag. Een uurloon hoort bij een contract.',
        ],
      },
      {
        id: 'btw',
        titel: 'Alle bedragen zijn exclusief BTW',
        kort: 'Waarom BTW niet meetelt in het resultaat',
        tekst: [
          'Overal in de begroting werk je met bedragen exclusief BTW. Dat is bewust: BTW die je afdraagt vorder je elders weer terug, dus per saldo is het geen kost.',
          'Bij een **onderlinge levering** kies je wel een BTW-tarief: 21%, 9%, geen of verlegd. Dat bepaalt wat er op de factuur komt te staan tussen de twee BV\'s.',
          'Die BTW telt niet mee in het resultaat — de leverende entiteit draagt hem af en de ontvangende vordert hem terug — maar staat er wel bij, zodat het factuurbedrag klopt met wat je in de begroting ziet.',
        ],
      },
    ],
  },
  {
    id: 'inrichten',
    titel: 'Inrichten',
    emoji: '🏗️',
    onderwerpen: [
      {
        id: 'entiteit-toevoegen',
        titel: 'Een entiteit toevoegen',
        kort: 'Een BV, een BV met personeel of de holding',
        tekst: [
          'Kies bij het aanmaken wat voor entiteit het is. Die keuze bepaalt wat je erin kunt zetten:',
          '- **BV** — een werkende BV zonder eigen personeel. Inzet gaat via ZZP of via een andere entiteit.',
          '- **BV met personeel** — hier kun je inzet in loondienst toevoegen. Alleen hier.',
          '- **Holding** — staat boven de entiteiten en draagt de vaste lasten van de groep. Heeft normaal geen eigen opdrachten.',
          'De kleur die je kiest gebruikt de app om de entiteit herkenbaar te maken in het ketenoverzicht en de lijsten.',
          'Zet **Actief** uit voor een BV die nog niet bestaat. Hij blijft dan zichtbaar zodat je er alvast naartoe kunt begroten.',
        ],
        verwijzingen: [
          { label: 'Laat me zien', pad: '/entiteiten', opent: 'entiteit' },
        ],
      },
      {
        id: 'vaste-lasten',
        titel: 'Vaste lasten instellen',
        kort: 'Kantoorhuur, verzekeringen, software — meestal bij de holding',
        tekst: [
          'Vaste lasten zijn kosten die doorlopen ongeacht het aantal opdrachten: huur, boekhouding, software, bankkosten.',
          'Ze horen bij een entiteit, niet bij een opdracht. In deze groep staan ze bij **FLG Holding**, zodat ze niet op een werkende BV drukken.',
          'Binnen een begroting worden de vaste lasten van die entiteit over de opdrachten verdeeld. Hoe dat gebeurt stel je in onder Aannames.',
        ],
        verwijzingen: [
          { label: 'Naar de entiteiten', pad: '/entiteiten' },
        ],
      },
      {
        id: 'begroting-maken',
        titel: 'Een begroting maken',
        kort: 'Leeg beginnen of een bestaand scenario dupliceren',
        tekst: [
          'Een begroting hoort bij één entiteit en loopt over een periode, bijvoorbeeld van 2026-01 tot en met 2026-12.',
          'Je kunt leeg beginnen, of een bestaande begroting dupliceren. Bij dupliceren gaat alles mee: opdrachten, middelen, inzet, subsidies, onderlinge leveringen en de aannames. Zo vergelijk je twee varianten zonder alles opnieuw in te voeren.',
          'Een begroting begint als **concept**. Zet hem op **vastgesteld** als hij klopt — die telt dan standaard mee in het ketenoverzicht.',
        ],
        verwijzingen: [
          { label: 'Laat me zien', pad: '/begrotingen/nieuw' },
        ],
      },
    ],
  },
  {
    id: 'werken',
    titel: 'Werken aan een begroting',
    emoji: '📋',
    onderwerpen: [
      {
        id: 'opdracht-toevoegen',
        titel: 'Een opdracht toevoegen',
        kort: 'Wat je doet, voor wie, en hoe je ervoor betaald krijgt',
        tekst: [
          'Een opdracht is het werk waar geld voor binnenkomt. Kies hoe er betaald wordt:',
          '- **Per stuk** — bezorging. Stuks per dag maal het tarief maal de dagen per maand.',
          '- **Per uur** — detachering. Aantal mensen maal uren per week, omgerekend naar maand, maal de productiviteit maal het uurtarief.',
          '- **Vast bedrag** — een servicecontract. Eén bedrag, met een eigen eenheid.',
          'De **productiviteit** bij uren is de factor voor niet-declarabele tijd. 0,92 betekent dat 8% van de uren niet gefactureerd wordt.',
          'Onder in het scherm staat direct wat de opdracht per maand oplevert, met de berekening erbij. Klopt dat bedrag niet met wat je verwacht, dan zie je meteen waar het misgaat.',
          'Een opbrengst van nul is prima als een andere entiteit voor dit werk betaalt. Leg dat dan vast onder Onderling, anders draagt de opdracht alleen kosten.',
        ],
        verwijzingen: [
          { label: 'Laat me zien', pad: 'begroting', tab: 'opdrachten', opent: 'opdracht' },
        ],
      },
      {
        id: 'koerier-toevoegen',
        titel: 'Een koerier in loondienst toevoegen',
        kort: 'Uurloon, uren per week, vakantiegeld en werkgeverslasten',
        tekst: [
          'Ga naar het tabblad **Inzet** en voeg een nieuwe inzet toe. Kies **Loondienst** — die optie verschijnt alleen bij een entiteit met personeel.',
          'Koppel de inzet aan de opdracht waar de koerier op rijdt. Elke inzet hoort bij precies één opdracht; daarmee weet de app welke opdracht deze kosten draagt.',
          'Vul in: uurloon, uren per week, vakantiegeld en werkgeverslasten **als percentage**, plus pensioen en overige kosten als bedrag per maand.',
          'Let op het verschil: vakantiegeld vul je in als **8**, niet als 241 euro. Onder in het scherm zie je live wat eruit komt — staat daar een onmogelijk bedrag, dan heb je een bedrag in een percentageveld gezet.',
          'De werkgeverslasten worden berekend over bruto **plus** vakantiegeld, niet over bruto alleen.',
        ],
        verwijzingen: [
          { label: 'Laat me zien', pad: 'begroting', tab: 'inzet', opent: 'inzet' },
        ],
      },
      {
        id: 'zzp-toevoegen',
        titel: "Een ZZP'er toevoegen",
        kort: 'Wat de ZZP\'er per stuk of per dag krijgt',
        tekst: [
          'Kies bij een nieuwe inzet **ZZP per stuk** of **ZZP per dag**. Dat kan bij elke entiteit, ook zonder personeel.',
          'Bij per stuk vul je in wat de ZZP\'er per stuk krijgt, hoeveel stuks per dag en hoeveel dagen per maand. Het verschil met jouw tarief op de opdracht is je marge.',
          'Voorbeeld: jij rekent 2,60 per pakket aan de opdrachtgever en betaalt de ZZP\'er 2,25. Dan houd je 0,35 per pakket over. Dat bedrag zie je terug in de kolom "per stuk" op het tabblad Overzicht.',
          'In de lijst op het tabblad Inzet staat bij elke regel wat de uitvoerder krijgt, zodat je dat niet hoeft op te zoeken.',
          '**Voeg je routes toe die als geheel meeschalen?** Gebruik dan het tabblad Schaal in plaats van losse regels — daar hoef je het aantal maar op één plek in te vullen.',
        ],
        verwijzingen: [
          { label: 'Laat me zien', pad: 'begroting', tab: 'inzet', opent: 'inzet' },
          { label: 'Of gebruik de schaalknoppen', pad: 'begroting', tab: 'schaal' },
        ],
      },
      {
        id: 'middel-toevoegen',
        titel: 'Een bus of ander middel toevoegen',
        kort: 'Lease, financial lease of eigendom, met alle bijkomende kosten',
        tekst: [
          'Een middel hoort bij een opdracht, of bij de entiteit zelf als het niet aan één opdracht toe te wijzen is.',
          'Kies de financiering:',
          '- **Lease** — je vult de leasetermijn in.',
          '- **Financial lease** — je vult de waarde, restwaarde en looptijd in. De app rekent de maandtermijn uit als annuïteit, met de rente uit de aannames.',
          '- **Eigendom** — waarde min restwaarde, gelijkmatig verdeeld over de looptijd.',
          'Daarnaast vul je brandstof, verzekering, wegenbelasting, onderhoud en overige kosten in. Onderhoud kun je ook laten berekenen uit de kilometers in de aannames.',
          'De eenheid die je kiest geldt voor alle bedragen van dat middel samen.',
        ],
        verwijzingen: [
          { label: 'Laat me zien', pad: 'begroting', tab: 'middelen', opent: 'middel' },
        ],
      },
      {
        id: 'schaal-gebruiken',
        titel: 'Snel opschalen met de schaalknoppen',
        kort: 'Eén getal veranderen en alles telt door — zoals in de Excel',
        tekst: [
          'Dit is de snelste manier om te zien wat er gebeurt als er routes bij komen, en de reden dat je zelden losse regels hoeft in te voeren.',
          'Op het tabblad **Schaal** vul je per soort route in: hoeveel routes, hoeveel stuks per route per dag, wat je rekent, en hoeveel bussen en mensen er per route bij horen. Bij ZZP-routes vul je daarnaast in wat je de ZZP\'er per stuk betaalt.',
          'De app maakt daar in één keer de opdracht, de bussen en de inzet van. Het aantal stuks staat op één plek, dus verander je dat, dan schuiven de omzet én de kosten mee. Precies zoals in de Excel.',
          'Daaronder staan de standaardposten: wat één bus en één medewerker per maand kosten. Die gelden voor alle blokken samen. De medewerker vul je hier in als **bedragen**, niet als percentages.',
          'De regels die hieruit volgen verschijnen gewoon op de andere tabbladen, met een stippellijn en het label "uit de schaalknoppen". Aanpassen kan daar niet — ze volgen deze knoppen.',
          'Wil je één bus of medewerker toch apart zetten, klik dan rechtsonder op **Vastzetten als losse regels**. Alles wordt dan een gewone regel die je per stuk kunt aanpassen, en de schaalknoppen gaan uit zodat er niets dubbel telt.',
        ],
        verwijzingen: [
          { label: 'Laat me zien', pad: 'begroting', tab: 'schaal' },
        ],
      },
      {
        id: 'onderling',
        titel: 'Onderling doorbelasten',
        kort: 'Wat de ene BV aan de andere levert, inclusief BTW',
        tekst: [
          'Levert de ene entiteit iets aan de andere — mensen, bussen, administratie, huur — dan leg je dat vast onder **Onderling**, bij de entiteit die levert.',
          'Elke post is een eigen regel. Voeg er zoveel toe als er zijn; onderaan zie je per ontvangende entiteit het totaal.',
          'Je kiest een grondslag: per uur, per stuk of een vast bedrag. Daarnaast het BTW-tarief dat op de factuur komt.',
          'De regel telt bij de leverende entiteit als opbrengst en bij de ontvangende als directe kost. In het ketenoverzicht vallen ze tegen elkaar weg, zodat de groep niet groter lijkt dan hij is.',
          'Bij de ontvangende entiteit zie je de levering wel staan, maar kun je hem niet aanpassen. Dat doe je bij de entiteit die levert.',
        ],
        verwijzingen: [
          { label: 'Laat me zien', pad: 'begroting', tab: 'onderling', opent: 'levering' },
        ],
      },
      {
        id: 'subsidie',
        titel: 'Een subsidie toevoegen',
        kort: 'Altijd een eigen regel, nooit van een kost afgetrokken',
        tekst: [
          'Een subsidie is een eigen regel in de resultatenstaat, tussen de opbrengsten en de kosten. Hij wordt nooit van een loonkost afgetrokken.',
          'Dat is met opzet: zo zie je altijd wat de begroting doet met én zonder subsidie. Onderaan de resultatenstaat en in de scenariovergelijking staat de variant zonder subsidie er standaard bij.',
          'Je kunt een subsidie koppelen aan een inzet om te tonen bij wie hij hoort. Dat verandert niets aan de berekening.',
          'Vul je een einddatum in die vóór het einde van de begroting ligt, dan krijg je een waarschuwing. De app rekent namelijk met één maandbedrag en weet niet welke maand het is.',
        ],
        verwijzingen: [
          { label: 'Laat me zien', pad: 'begroting', tab: 'subsidies', opent: 'subsidie' },
        ],
      },
      {
        id: 'aannames',
        titel: 'De aannames',
        kort: 'Dagen per maand, contracturen, rente en de verdeling van vaste lasten',
        tekst: [
          'De aannames gelden voor de hele begroting en bepalen hoe bedragen worden omgerekend:',
          '- **Dagen per maand** — 26 bij maandag tot en met zaterdag, 22 bij maandag tot en met vrijdag.',
          '- **Contracturen per week** — de basis voor de omrekening van en naar uur.',
          '- **Kilometers per dag en onderhoud per kilometer** — gebruikt als je onderhoud laat berekenen.',
          '- **Rente** — gebruikt bij financial lease.',
          'Onderaan stel je in hoe de vaste lasten over de opdrachten verdeeld worden: naar rato van opbrengst, gelijk, of handmatig met eigen percentages. Bij handmatig worden de percentages genormaliseerd, zodat er nooit vaste lasten zoekraken.',
        ],
        verwijzingen: [
          { label: 'Laat me zien', pad: 'begroting', tab: 'aannames' },
        ],
      },
      {
        id: 'verplaatsen',
        titel: 'Een opdracht naar een andere entiteit verplaatsen',
        kort: 'Als een opdracht een eigen BV krijgt',
        tekst: [
          'Krijgt een opdracht een eigen entiteit — bijvoorbeeld de bezorging die naar Smart Transport gaat — dan verplaats je hem in één keer.',
          'Ga naar het tabblad Opdrachten, open het menu bij de opdracht en kies **Verplaats naar andere entiteit**.',
          'Alles gaat mee: de middelen en de inzet die aan die opdracht hangen, en de onderlinge leveringen die hem betreffen. Die worden vanaf dan geleverd door de nieuwe entiteit.',
          'De ontvangende entiteit moet wel al een begroting hebben om naartoe te verplaatsen.',
        ],
        verwijzingen: [
          { label: 'Laat me zien', pad: 'begroting', tab: 'opdrachten' },
        ],
      },
    ],
  },
  {
    id: 'uitkomsten',
    titel: 'De uitkomsten lezen',
    emoji: '📊',
    onderwerpen: [
      {
        id: 'resultatenstaat',
        titel: 'De resultatenstaat',
        kort: 'Van opbrengst naar resultaat, regel voor regel',
        tekst: [
          'De staat loopt van boven naar beneden: eerst de opbrengsten uit opdrachten, dan wat je onderling levert, samen de totale opbrengst.',
          'Daaronder de subsidies als eigen regel, en dan de kosten: middelen, inzet, wat anderen aan jou leveren, en de vaste lasten.',
          'Onderaan het resultaat, met daaronder wat het zou zijn zonder subsidie.',
          'Naast de staat staat de tabel **per opdracht**: wat elke opdracht opbrengt, wat hij kost, wat er overblijft vóór en ná het aandeel in de vaste lasten, en wat dat per stuk of per uur betekent.',
        ],
        verwijzingen: [
          { label: 'Laat me zien', pad: 'begroting', tab: 'overzicht' },
        ],
      },
      {
        id: 'controles',
        titel: 'De controlebalk',
        kort: 'Groen betekent dat elk totaal langs twee wegen klopt',
        tekst: [
          'Bovenaan elke begroting staat een balk. Groen betekent dat alle controles kloppen; rood toont per regel wat er niet klopt, met het verschil erbij.',
          'De app herberekent elk totaal langs een tweede, onafhankelijke weg. Bijvoorbeeld: tellen de opdrachtregels op tot de totale opbrengst? Tellen de verdeelde vaste lasten op tot het totaal? Komt elk bedrag heen en terug door de eenheid-omrekening op hetzelfde uit?',
          'Een verschil groter dan een halve cent verschijnt als afwijking. Kleinere verschillen zijn afrondingsruis.',
          'Naast afwijkingen kan de balk **aandachtspunten** tonen: loondienst bij een entiteit zonder personeel, een opdracht met kosten maar zonder opbrengst, of een subsidie die afloopt binnen de looptijd.',
        ],
        verwijzingen: [
          { label: 'Laat me zien', pad: 'begroting', tab: 'controles' },
        ],
      },
      {
        id: 'break-even',
        titel: 'Break-even: wanneer draai je quitte',
        kort: 'Hoeveel stuks of welk tarief je nodig hebt',
        tekst: [
          'In de tabel per opdracht staat rechts wat er nodig is om precies de directe kosten plus het aandeel in de vaste lasten te dekken.',
          'Bij een opdracht per stuk is dat een aantal stuks per dag. Bij een opdracht per uur een uurtarief. Bij een vast bedrag een maandbedrag.',
          'Het aandeel in de vaste lasten blijft daarbij staan op de huidige verdeling. Anders zou een ander tarief dat aandeel ook verschuiven, en wordt de uitkomst onnavolgbaar.',
        ],
      },
      {
        id: 'keten',
        titel: 'Het ketenoverzicht',
        kort: 'Alle entiteiten naast elkaar, met de onderlinge stromen',
        tekst: [
          'Hier staan de entiteiten naast elkaar. Per entiteit telt één begroting mee; standaard de vastgestelde, maar je kunt per entiteit een andere kiezen.',
          'Onderaan zie je wat er onderling geleverd wordt en hoe dat tegen elkaar wegvalt. Wat overblijft is de opbrengst naar buiten toe: wat de groep als geheel verdient aan derden.',
          'De holding staat apart onderaan, met de vaste lasten van de groep als eigen regel.',
        ],
        verwijzingen: [
          { label: 'Naar het ketenoverzicht', pad: '/keten' },
        ],
      },
      {
        id: 'vergelijken',
        titel: "Scenario's vergelijken",
        kort: 'Twee tot vier begrotingen naast elkaar',
        tekst: [
          'Dupliceer een begroting als scenario, verander wat je wilt onderzoeken, en zet ze hier naast elkaar.',
          'De tabel toont dezelfde regels als de resultatenstaat, met rechts het verschil tussen de eerst en de laatst gekozen begroting.',
          'De regel zonder subsidie staat er altijd bij. Een begroting die alleen met subsidie rondkomt is een andere begroting dan een die dat zonder doet.',
        ],
        verwijzingen: [
          { label: 'Naar vergelijken', pad: '/vergelijk' },
        ],
      },
      {
        id: 'export',
        titel: 'Exporteren',
        kort: 'CSV voor Excel, PDF om te delen',
        tekst: [
          'Bovenaan elke begroting en op het ketenoverzicht staan knoppen voor CSV en PDF.',
          'De CSV gebruikt puntkomma\'s en komma-decimalen, zodat Excel in het Nederlands hem meteen goed opent.',
          'Beide exports volgen de weergave-eenheid die je hebt gekozen. Staat die op jaar, dan staan er jaarbedragen in.',
        ],
      },
    ],
  },
  {
    id: 'beheer',
    titel: 'Beheer',
    emoji: '⚙️',
    onderwerpen: [
      {
        id: 'toegang',
        titel: 'Wie er toegang heeft',
        kort: 'Accounts aanmaken en toegang geven',
        tekst: [
          'Iedereen op de lijst onder Instellingen kan alles inzien en wijzigen. Er is geen onderscheid in rechten.',
          'Je kunt daar een account aanmaken: vul naam, e-mailadres en wachtwoord in. Het account krijgt meteen toegang en jij blijft zelf ingelogd.',
          'Heeft iemand zich al via de registratiepagina aangemeld, dan staat op zijn scherm een uid. Die plak je onder Instellingen bij "Bestaand account toevoegen".',
          'Jezelf van de lijst halen kan niet — dan zou je jezelf buitensluiten.',
        ],
        verwijzingen: [
          { label: 'Naar instellingen', pad: '/settings' },
        ],
      },
      {
        id: 'voorbeelddata',
        titel: 'Voorbeelddata laden',
        kort: 'Beginnen met echte cijfers in plaats van een leeg scherm',
        tekst: [
          'Onder Instellingen staat een knop die de drie entiteiten met hun begrotingen neerzet: FLG Holding met de vaste lasten, Buddy met de routes en de detachering, De Installatie, en een lege Smart Transport.',
          'Die cijfers komen uit de Excel-begroting waar deze app op gebouwd is. Alles is daarna aan te passen.',
          'Er wordt niets overschreven. Draai je het twee keer, dan staat alles dubbel in de lijst.',
        ],
        verwijzingen: [
          { label: 'Naar instellingen', pad: '/settings' },
        ],
      },
    ],
  },
];
