# FLG-Begroting

Begrotingsapplicatie voor de entiteiten van de groep. Per entiteit wordt een
begroting doorgerekend: opbrengsten uit opdrachten, directe kosten, vaste lasten
en het resultaat. Daarnaast is er een ketenoverzicht dat de entiteiten naast
elkaar zet, inclusief de onderlinge leveringen tussen die entiteiten.

- React 18 · TypeScript · Vite · Tailwind CSS
- Firebase Auth en Firestore
- Deploy via Vercel

---

## Aan de slag

```bash
npm install
cp .env.example .env      # en vul de waarden in
npm run dev
```

Controleer voor elke push:

```bash
npm run lint
npm run typecheck
npm run build
```

---

## Environment variables

Alle configuratie komt uit environment variables. Er zijn **geen fallbacks** in
de code: ontbreekt er een waarde, dan start de app niet en zie je precies welke
variabele mist.

| Variabele | Waar je hem vindt |
|---|---|
| `VITE_FIREBASE_API_KEY` | Firebase console → Projectinstellingen → Algemeen → Jouw apps |
| `VITE_FIREBASE_AUTH_DOMAIN` | idem |
| `VITE_FIREBASE_PROJECT_ID` | idem |
| `VITE_FIREBASE_STORAGE_BUCKET` | idem |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | idem |
| `VITE_FIREBASE_APP_ID` | idem |

**Lokaal:** zet ze in `.env` (staat in `.gitignore`, dus die komt nooit in de repo).

**In Vercel:** Settings → Environment Variables. Voeg elke sleutel toe en vink
alle drie de omgevingen aan waarvoor hij moet gelden: **Production**, **Preview**
en **Development**. Na het toevoegen of wijzigen van een variabele moet je
opnieuw deployen — Vercel bakt ze tijdens de build in.

Een `VITE_*`-variabele belandt altijd in de clientbundle. Voor de Firebase
webconfig is dat normaal en veilig: de beveiliging zit in de Firestore rules,
niet in de config. Zet hier dus nooit een sleutel in die geheim moet blijven.

---

## Firebase inrichten

Dit project draait op een **eigen Firebase-project**, los van andere applicaties.

1. Maak een nieuw project aan in de [Firebase console](https://console.firebase.google.com).
2. Voeg een **web-app** toe en neem de zes configuratiewaarden over in `.env` en Vercel.
3. Zet **Authentication → Sign-in method → E-mailadres/wachtwoord** aan.
4. Maak onder **Authentication → Users** handmatig de twee accounts aan.
   Registreren via de app kan niet en is bewust niet ingebouwd.
5. Maak **Firestore Database** aan (productiemodus).

### Toegang: de whitelist

Maak in Firestore een collectie `settings` met daarin één document met de id
`access`:

```
settings/access
  allowedUids: ["<uid-account-1>", "<uid-account-2>"]
```

De uid's vind je in de Firebase console onder Authentication → Users.

Alleen deze twee uid's kunnen lezen en schrijven. Staat een ingelogd account er
niet in, dan toont de app een nette "Geen toegang"-melding met de uid erbij, zodat
je hem zo kunt overnemen. Het document zelf kan alleen via de console gewijzigd
worden — de app mag er niet in schrijven.

### Rules deployen

De rules staan in [`firestore.rules`](./firestore.rules) en moeten **handmatig**
gedeployd worden; Vercel doet dat niet voor je.

Via de CLI:

```bash
npm install -g firebase-tools
firebase login
firebase deploy --only firestore:rules --project <jouw-project-id>
```

Of plak de inhoud van `firestore.rules` in de Firebase console onder
**Firestore Database → Regels** en publiceer.

Doe dit opnieuw elke keer dat `firestore.rules` wijzigt.

---

## Deploy op Vercel

| Instelling | Waarde |
|---|---|
| Framework preset | Vite |
| Build command | `npm run build` |
| Output directory | `dist` |
| Install command | `npm install` |
| Node.js version | 20.x |

`vercel.json` bevat een SPA-rewrite zodat elke route naar `index.html` gaat —
zonder die regel geeft een directe link naar bijvoorbeeld `/begrotingen` een 404.

Vercel bouwt automatisch bij elke push naar `main`. Een gebroken build is dus
meteen een gebroken productie: draai altijd eerst lokaal `npm run build`.

---

## Datamodel

Twee top-level collecties in Firestore, zonder tenant-namespace — beide accounts
zien dezelfde data.

### `entities/{entityId}`

De BV's van de groep. Bevat naam, KvK, of de entiteit personeel heeft, een kleur
voor herkenning in het ketenoverzicht, en de vaste lasten als lijst.

### `budgets/{budgetId}`

Eén document per begroting, met alles erin genest: aannames, opdrachten,
middelen, inzet, subsidies en onderlinge leveringen. Dat maakt inlezen één read,
opslaan atomisch, en een scenario simpelweg een kopie.

Op elk budgetdocument staat een afgeleid veld `leveringNaarEntityIds`. Firestore
kan niet queryen op een veld binnen een array van objecten, en zonder dit veld
zou een ontvangende entiteit de leveringen naar haar toe nooit kunnen vinden. De
array `onderlingeLeveringen` blijft de bron van waarheid; het afgeleide veld
wordt bij elke opslag opnieuw geschreven.

Het volledige model staat in [`src/types/begroting.ts`](./src/types/begroting.ts).

---

## Rekenmotor

Het hart van de app is [`src/utils/begroting.calc.ts`](./src/utils/begroting.calc.ts):
pure functies, zonder Firestore en zonder React, zodat elke uitkomst met de hand
na te rekenen is.

Maand is de interne rekenbasis. Elk ingevoerd bedrag heeft een eigen eenheid
(uur, dag, week, maand of jaar) en wordt bij invoer naar maand omgerekend via
[`src/utils/periode.ts`](./src/utils/periode.ts). De weergave-eenheid bovenaan de
begroting rekent alleen de weergave terug — de opgeslagen data verandert niet.

`controleerBegroting` herberekent elk totaal langs een tweede, onafhankelijke weg
en geeft elk verschil terug. Bovenaan elke begrotingspagina staat daarom een balk
die groen is als alles klopt, en anders de afwijkingen toont.

Voorbeeldberekeningen om met de hand na te rekenen staan in
[`docs/REKENMOTOR.md`](./docs/REKENMOTOR.md).

---

## Voorbeelddata

Op **Instellingen** staat een knop om de voorbeelddata te laden: Buddy BV,
De Installatie BV en Smart Transport BV, met bijbehorende begrotingen. Handig om
mee te beginnen en om de controles te zien werken.
