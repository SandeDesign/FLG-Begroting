# CLAUDE.md — FLG-Administratie

Dit bestand is de primaire en uitputtende context voor Claude Code in dit project.
Het beschrijft de complete codebase: elk bestand, elke service, elke pagina, elke
component, elke route, elke navigatie-item, elk type, elke util, elke external
integratie, elke env var en elke styling-keuze.

> Laatst gegenereerd: 2026-05-13 (sync met repo branch `claude/update-claude-docs-IoWFY`).

---

## 1. Project Overview

| Veld | Waarde |
|---|---|
| **Naam** | FLG-Administratie |
| **Onderdeel van** | SandeDesign ecosysteem |
| **Doel** | Complete loonadministratie- en bedrijfsbeheersoftware voor **FLGroep (Festina Lente Groep)** haar bedrijven — beheer van werknemers, uren, verlof, verzuim, facturatie, budgettering, loonberekeningen, BTW, grootboek en bankreconciliatie. |
| **Status** | In actieve ontwikkeling |
| **Repo** | https://github.com/SandeDesign/FLG-Administratie |
| **Productie URL** | https://app.fl-group.org |
| **Hosting frontend** | Netlify |
| **Firebase project** | `alloon` |
| **Taal UI** | Nederlands |

Het systeem ondersteunt 5 rollen (admin, co-admin, manager, boekhouder, employee)
en is multi-tenant: één primary admin "bezit" data, andere gebruikers krijgen
toegang via `primaryAdminUserId` (co-admin) of via `assignedAdmins[]` (boekhouder).

---

## 2. Tech Stack

### Frontend

| Onderdeel | Versie / Detail |
|---|---|
| Framework | React **18.3.1** met React Router DOM **6.25.1** (SPA, géén Next.js) |
| Taal | TypeScript **5.5.3** (strict, ES2020 target, géén path aliases) |
| Build tool | Vite **5.4.2** (`@vitejs/plugin-react`, manual chunk `react-vendor`) |
| Styling | Tailwind CSS **3.4.1** (class-based dark mode, bronze/brown primary palette) |
| UI Icons | `lucide-react` **0.344** |
| Formulieren | `react-hook-form` **7.63** + `yup` **1.7** via `@hookform/resolvers` **5.2** |
| Datum/tijd | `date-fns` **4.1** |
| Grafieken | `recharts` **3.2** |
| PDF generatie | `@react-pdf/renderer` **4.3**, `jspdf` **3.0**, `pdf-lib` **1.17**, `pdfjs-dist` **5.4** |
| Excel/CSV | `xlsx` **0.18** |
| DOM-naar-canvas | `html2canvas` **1.4** (PDF-snapshots) |
| OCR | `tesseract.js` **6.0** (client-side fallback) + Claude Vision API (server-side via Netlify Function en PHP proxy) |
| Kalender | FullCalendar **6.1** (`@fullcalendar/react`, `daygrid`, `timegrid`, `interaction`, `core`) |
| Microsoft | `@azure/msal-browser` **5.4** (Graph API: `Calendars.Read`, `User.Read`) |

### Backend / Serverless

| Onderdeel | Detail |
|---|---|
| **Firebase** | Firestore + Auth + Realtime Database + Cloud Messaging (FCM). Firebase project: `alloon`. **Firebase Storage is NIET in gebruik** — alle bestandsuploads gaan via internedata.nl. |
| **firebase-admin** | **12.7** (gebruikt in Netlify Functions) |
| **googleapis** | **140.0** (server-side Google API client; aanwezig als dep) |
| **Netlify Functions** | Node 18, esbuild bundler — Claude OCR, Claude Vision OCR, push notificaties, scheduled task reminders, invoice delivery callback |
| **PHP proxy** | Eigen host op https://internedata.nl (proxy2.php, proxy3.php, claude-vision-ocr.php, fcm-send.php) |
| **Make.com webhooks** | 6 hooks (zie sectie 19) |

### Auth & Rollen

Firebase Auth (email/password) met role-based access — rollen:
`admin`, `co-admin`, `manager`, `boekhouder`, `employee`.
Standaard wachtwoord bij admin-creatie van employees: `DeInstallatie1234!!` (zie `utils/firebaseAuth.ts`).

### Hosting

- **Frontend**: Netlify (build = `npx vite build`, publish = `dist`, functions = `netlify/functions`).
- **PHP proxy + bestandsopslag**: internedata.nl (eigen host).

---

## 3. Project structuur

```
FLG-Administratie/
├── src/
│   ├── App.tsx                       # Router + protected routes per rol
│   ├── main.tsx                      # React entry
│   ├── index.css                     # Tailwind base, scrollbars, material-* classes, FullCalendar dark mode
│   ├── vite-env.d.ts
│   │
│   ├── components/
│   │   ├── AppUpdateModal.tsx        # Service worker update prompt
│   │   ├── ProtectedRoute.tsx        # Auth gate
│   │   ├── sedy6Ka59                 # ⚠️ Leeg/ongeldig bestand (zie sectie 28)
│   │   ├── absence/                  # AbsenceStatsCard, SickLeaveModal, RecoveryModal
│   │   ├── banking/                  # BankPartiesOverviewCards
│   │   ├── company/                  # CompanyModal, BranchModal
│   │   ├── employee/                 # EmployeeModal
│   │   ├── expense/                  # ExpenseModal
│   │   ├── invoices/                 # CreateInvoiceModal, FactuurWerkbonnenImport
│   │   ├── layout/                   # Layout, Sidebar, EmployeeLayout, MobileBottomNav, MobileFullScreenMenu, BoekhouderAdminSelector
│   │   ├── leave/                    # LeaveBalanceCard, LeaveRequestModal
│   │   ├── notifications/            # NotificationCenter, PushPromptBanner, PushDiagnostics, ChatUnreadBanner
│   │   ├── payslip/                  # PayslipPDFTemplate
│   │   ├── settings/                 # BottomNavSettings, CompaniesVisibilitySettings
│   │   ├── tasks/                    # WeeklyTasksReminder, TaskScheduleSidebar, ScheduledTaskPopover
│   │   ├── timesheet/                # IncompleteWeekBanner
│   │   ├── ui/                       # Button, Card, Input, Modal, Toast, ActionMenu, CompanySelector, SmartCompanySelector, PeriodSelector, EmptyState, LoadingSpinner, PageHeader, StatTile
│   │   └── upload/                   # InkomendeFacturenTab, InkomendePostTab, UitgaandeFacturenTab
│   │
│   ├── contexts/                     # AuthContext, AppContext, DarkModeContext, PageTitleContext
│   ├── hooks/                        # useToast, useChatUnreadCount
│   ├── lib/                          # firebase, msalConfig, messaging, generateBtwPDF, generateGrootboekPDF, generateInvestmentPDF
│   ├── pages/                        # Top-level pagina's (admin/manager/employee gedeeld)
│   │   └── boekhouder/               # Boekhouder-specifieke pagina's (eigen /boekhouder/* prefix)
│   ├── services/                     # Firebase CRUD, OCR, facturatie, audit, payroll, etc.
│   ├── types/                        # TypeScript interfaces
│   └── utils/                        # menuConfig, themeColors, validation, leaveCalculations, timesheetCompliance, poortwachterTracking, taskConfig, dateFilters, companyHelpers, firebaseAuth, firebase-storage-helper, grootboekTemplate, taxReturnGenerator
│
├── netlify/
│   └── functions/                    # Serverless functions
│       ├── _lib/                     # firebaseAdmin.ts, push.ts (gedeeld)
│       ├── claude-ocr.ts             # Text-OCR via Claude API
│       ├── claude-vision-ocr.ts      # Vision OCR voor PDF/image
│       ├── send-push.ts              # FCM push notificatie endpoint
│       ├── scheduled-task-reminders.ts # Cron (*/15 min) push reminders
│       └── invoice-delivery-callback.ts # Make.com → Firestore delivery status
│
├── public/                           # Logo's, manifest, service-worker, PHP proxies
│   ├── Logo.png / Logo-groot.png / Logo_1.png
│   ├── Logo-192.png / Logo-512.png / Logo-192-maskable.png / Logo-512-maskable.png
│   ├── manifest.json
│   ├── service-worker.js
│   ├── claude-vision-ocr.php         # OCR proxy met embedded API key (host = internedata.nl)
│   ├── fcm-send.php                  # FCM push sender met embedded service account
│   └── proxy3.php                    # Legacy upload proxy (Post/inkomend)
│   #  Let op: proxy2.php draait op de host zelf en zit NIET in deze map
│
├── docs/
│   └── AUDIT-TOEGANG.md              # Audit-log toegangsdocumentatie
│
├── .bolt/                            # Bolt configuratie (config.json, prompt)
├── CLAUDE.md                         # Dit bestand
├── FIRESTORE_DATABASE_SCHEMA.md      # Firestore schema referentie
├── FIRESTORE_RULES.md                # Security rules referentie
├── FIRESTORE_IMPROVEMENTS.md         # Geplande verbeteringen
├── FIREBASE_REALTIME_DATABASE_RULES.md
├── INTERNAL_FLOWS_ANALYSIS.md
├── PUSH_SETUP.md                     # FCM setup-handleiding
├── WERKENDE_DATA_STRUCTUREN.md
├── design-preview.html               # Statische design preview
├── README.md
├── index.html                        # Vite entry (PWA meta tags, SW registratie)
├── tailwind.config.js
├── postcss.config.js
├── vite.config.ts
├── eslint.config.js
├── tsconfig.json / tsconfig.app.json / tsconfig.node.json
├── netlify.toml
├── package.json
└── package-lock.json
```

---

## 4. Gebruikersrollen & Routing

### 4.1 Rollen

| Rol | Beschrijving | Route prefix | Layout |
|---|---|---|---|
| **admin** | Volledig beheer van alle eigen bedrijven, personeel, facturatie, instellingen, audit | `/` | `Layout` |
| **co-admin** | Identieke rechten als admin, werkt onder een primary admin (via `primaryAdminUserId` in `userSettings`) | `/` | `Layout` |
| **manager** | Beheer van toegewezen bedrijven, uren, verlof, verzuim; geen upload, geen inkoop, geen admin users/roles, geen audit-log | `/` | `Layout` |
| **boekhouder** | Eigen boekhoud-interface met multi-admin selector: facturen, BTW, grootboek, bank, chat met admin | `/boekhouder/*` | `Layout` |
| **employee** | Self-service portaal: verlof, verzuim, declaraties, uren, agenda, taken, loonstroken | `/employee-dashboard/*` | `EmployeeLayout` |

### 4.2 Publieke routes (geen auth)

- `/login` — `Login.tsx`
- `/register` — `Register.tsx`
- `/reset-password` — `ResetPassword.tsx`

### 4.3 Admin & Co-admin routes (`/`)

Alle routes binnen `<Layout>`:

| Path | Component | Sectie |
|---|---|---|
| `/` (index) | `Dashboard` | — |
| `/companies` | `Companies` | Bedrijven |
| `/employees` | `EmployeesNew` | HR |
| `/project-production` | `ProjectProduction` | Project |
| `/project-statistics` | `ProjectStatistics` | Project |
| `/statistics/employer` | `EmployerStatistics` | Statistieken |
| `/statistics/project` | `ProjectStatistics` | Statistieken |
| `/statistics/holding` | `HoldingStatistics` | Statistieken |
| `/admin/dashboard` | `AdminDashboard` | Admin |
| `/admin/users` | `AdminUsers` | Admin |
| `/admin/roles` | `AdminRoles` | Admin |
| `/timesheets` | `Timesheets` | Tijd |
| `/timesheet-approvals` | `TimesheetApprovals` | Tijd |
| `/timesheet-export` | `TimesheetExport` | Tijd |
| `/internal-projects` | `InternalProjects` | Tijd |
| `/admin-expenses` | `AdminExpenses` | Financieel |
| `/admin/leave-approvals` | `AdminLeaveApprovals` | Verlof |
| `/admin/absence-management` | `AdminAbsenceManagement` | Verzuim |
| `/invoice-relations` | `InvoiceRelations` | Financieel |
| `/budgeting` | `Budgeting` | Financieel |
| `/outgoing-invoices` | `OutgoingInvoices` | Financieel |
| `/upload` | `Upload` | Financieel (3 tabs) |
| `/incoming-invoices` | → redirect `/upload?tab=facturen` | (legacy) |
| `/incoming-post` | → redirect `/upload?tab=post` | (legacy) |
| `/incoming-invoices-stats` | `IncomingInvoicesStats` | Financieel |
| `/bank-statement-import` | `BankStatementImport` | Financieel |
| `/grootboekrekeningen` | `Grootboekrekeningen` | Financieel |
| `/btw-overzicht` | `BtwOverzicht` | Financieel |
| `/tasks` | `Tasks` | Systeem |
| `/payslips` | `Payslips` | HR |
| `/audit-log` | `AuditLog` | Systeem |
| `/chat` | `Chat` | Systeem |
| `/settings` | `Settings` | Systeem |
| `/investment-pitch` | `InvestmentPitch` (frame-mode supported via `?mode=frame`) | Systeem |
| `*` | `NotFound` | — |

### 4.4 Manager routes (`/`)

Manager heeft een eigen `ManagerDashboard` op `/` en mag een **subset** van admin-routes
bezoeken — uitgesloten zijn `companies`, `audit-log`, `admin/users`, `admin/roles`, `upload`,
`incoming-invoices`, `incoming-invoices-stats`, `bank-statement-import`, `grootboekrekeningen`,
`btw-overzicht`, `admin-expenses`, `investment-pitch`.

Toegestane manager-paden:

- `/` (`ManagerDashboard`), `/employees` ("Mijn Team"), `/project-production`
- `/internal-projects` (read-only), `/statistics/employer`, `/statistics/project`, `/statistics/holding`
- `/timesheets`, `/timesheet-approvals`, `/timesheet-export`
- `/admin/leave-approvals` ("Verlof Goedkeuren"), `/admin/absence-management`
- Self-service: `/leave`, `/absence`, `/expenses`, `/payslips`
- Beperkt financieel: `/invoice-relations`, `/budgeting`, `/outgoing-invoices`
- `/tasks`, `/settings`
- `upload`, `incoming-invoices`, `incoming-invoices-stats` → redirect naar `/`

### 4.5 Boekhouder routes (`/boekhouder/*`)

- `/` → redirect naar `/boekhouder`
- `/boekhouder` — `BoekhouderDashboard`
- `/boekhouder/invoice-relations` — `BoekhouderInvoiceRelations`
- `/boekhouder/outgoing-invoices` — `BoekhouderOutgoingInvoices`
- `/boekhouder/incoming-invoices-stats` — `BoekhouderIncomingInvoicesStats`
- `/boekhouder/bank-statement-import` — `BoekhouderBankStatementImport`
- `/boekhouder/grootboekrekeningen` — `BoekhouderGrootboekrekeningen`
- `/boekhouder/btw-overzicht` — `BoekhouderBtwOverzicht`
- `/boekhouder/admin-expenses` — `BoekhouderExpenses`
- `/boekhouder/upload` — `BoekhouderUpload`
- `/boekhouder/settings` — `BoekhouderSettings`
- `/boekhouder/chat` — `BoekhouderChat`
- `/boekhouder/payslip-upload` — `BoekhouderPayslipUpload` (loonstroken uploaden)
- `/boekhouder/tasks` — gedeelde `Tasks`-pagina
- `/boekhouder/incoming-invoices` → redirect `/boekhouder/upload?tab=facturen`
- `/boekhouder/incoming-post` → redirect `/boekhouder/upload?tab=post`
- Backwards-compat redirects: alle niet-prefixed financiële paden redirecten naar `/boekhouder/*`

### 4.6 Employee routes (`/employee-dashboard/*`)

- `/` → redirect naar `/employee-dashboard`
- `/employee-dashboard` (index) — `EmployeeDashboard`
- `/employee-dashboard/leave` — `Leave`
- `/employee-dashboard/absence` — `Absence`
- `/employee-dashboard/expenses` — `Expenses`
- `/employee-dashboard/timesheets` — `Timesheets`
- `/employee-dashboard/agenda` — `EmployeeAgenda` (FullCalendar)
- `/employee-dashboard/tasks` — `EmployeeTasks`
- `/employee-dashboard/payslips` — `Payslips`

### 4.7 Loginflow

1. Gebruiker logt in via `/login` (Firebase Auth).
2. `AuthContext` bepaalt rol via `users/{uid}.role` + `userSettings/{uid}.primaryAdminUserId` (co-admin detectie).
3. `App.tsx` rendert het juiste route-blok op basis van `userRole`.
4. Admin/manager/boekhouder selecteert bedrijf via `CompanySelector` (boekhouder: `BoekhouderAdminSelector`).
5. Data wordt opgeslagen in Firestore onder de admin's `userId`-namespace (zie sectie 22).

---

## 5. Functionele Modules

### 5.1 Bedrijvenbeheer (`/companies`)

- 5 bedrijfstypes: `employer` (werkmaatschappij), `project` (project-BV), `holding`, `shareholder`, `investor` (laatste is disabled in modal).
- Vestigingen (branches) per bedrijf met CAO + opslagen (`overtimeRate`, `irregularRate`, `shiftRate`).
- Bedrijfsgegevens: naam, adres, KvK, BTW, contactinfo, IBAN, `invoicePrefix`, logo (base64), `themeColor`, `defaultCAO`, `travelAllowancePerKm`, `standardWorkWeek`, `holidayAllowancePercentage`, `pensionContributionPercentage`, project-specifiek `hourlyRate`.
- Project en holding kunnen een `payrollCompanyId` koppelen naar een werkmaatschappij.
- `shareholdings[]` en `allowedUsers[]` voor multi-tenant toegang.

### 5.2 Personeelsbeheer (`/employees`, `/admin/users`, `/admin/roles`)

- Medewerkers aanmaken via `EmployeeModal` met:
  - Primary employer (`companyId`) + `branchId` + `projectCompanies[]` (multi-select)
  - Contractinfo: `contractType` (8 opties), `startDate`, `endDate`, `hoursPerWeek`, `position`
  - Salarisinfo: `paymentType` (hourly|monthly|annual), `hourlyRate`/`monthlySalary`
  - Toeslagen: overtime, irregular, shift, evening, night, weekend
  - `taxTable` (white|green|special)
  - Auto-calculated vakantie-uren: `hoursPerWeek * 4`
- Admin user management: `AdminUsers` (rollen toewijzen), `AdminRoles` (permissies per rol).

### 5.3 Urenregistratie (`/timesheets`)

- Wekelijkse timesheets per dag — **gaploos verplicht**: elke werkdag (ma-vr) moet een `dayStatus` hebben.
- **DayStatus** (`types/timesheet.ts`):
  - `worked` — Gewerkt
  - `holiday` — Verlof (auto via verlof-koppeling)
  - `sick` — Ziek (auto via ziekteverzuim)
  - `unpaid` — Onbetaald afwezig
  - `meeting` — Overleg / training
  - `holiday_public` — Feestdag
  - `partial_work` — Geen of half werk uitgevoerd
  - `weekend` — Weekend
- **Compliance** (`utils/timesheetCompliance.ts`):
  - `WEEK_DEADLINE_DAY = 5` (vrijdag), `WEEK_DEADLINE_HOUR = 17` → deadline vrijdag 17:00 NL tijd.
  - Werkweek moet minimaal 40u zijn anders verplichte **low-hours review** (3 vragen via `lowHoursReview`).
  - `partial_work` triggert óók de low-hours review, ongeacht weektotaal.
  - < 8u op gewerkte dag → verplichte `effortNote` ("Wat heb je toch bijgedragen?").
  - `IncompleteWeekBanner` waarschuwt bij ontbrekende dag-statussen.
  - "Riset"-marker is gereserveerd voor ITKnecht-import; manuele invoer met die term wordt geblokkeerd.
  - `containsOpdrachtgeverBlame(text)` detecteert klant/planning-excuses (keywords: riset, opdrachtgever, klant, planning te laag, lage planning, te weinig werk, geen werk, tekort werk, niks/niets te doen, weinig planning) en triggert vervolgvraag.
- Status-flow: `draft → submitted → approved → rejected → processed → exported`.
- Goedkeuringen: `/timesheet-approvals`.
- Export: `/timesheet-export` (Excel/CSV/PDF, filter op employee/company/datumbereik).
- Import vanuit ITKnecht via Make.com webhook (zie sectie 19).

### 5.4 Verlofbeheer (`/leave`, `/admin/leave-approvals`)

- 8 Verloftypen (`utils/leaveCalculations.ts`):
  `holiday`, `sick`, `special`, `unpaid`, `parental`, `care`, `short_leave`, `adv`.
- Aanvraag/goedkeuring workflow met statussen `pending` (amber), `approved` (green), `rejected` (red).
- Saldoregistratie per medewerker per jaar:
  - `statutoryDays`, `extraStatutoryDays`, `carriedDays`, `accumulatedDays`
  - `takenDays`, `pendingDays`, `remainingDays`
  - `seniorDays` (extra dagen ≥55 jaar), `snipperDays` (flexibel)
  - Vervaldatum-waarschuwing (`shouldWarnAboutExpiry` < 90 dagen, rood < 30 dagen)
- Verlof-accrual: `4 × hoursPerWeek / 12` per maand.
- Werkdagen berekening sluit weekenden + NL-feestdagen uit (zie 5.5).
- ATV/ADV-dagen: BOUW CAO krijgt 13 extra dagen.

### 5.5 NL feestdagen (`utils/leaveCalculations.ts`)

Automatisch herkende publieke feestdagen:
- 1 januari (Nieuwjaarsdag), 27 april (Koningsdag), 25/26 december (Kerst)
- Goede Vrijdag, Pasen + 2e Paasdag, Hemelvaart, Pinksteren + 2e Pinksterdag (allen via Computus / Easter algoritme)
- 5 mei (Bevrijdingsdag) — **alleen in jaren deelbaar door 5**

### 5.6 Verzuimbeheer (`/absence`, `/admin/absence-management`)

- Ziekmelding (`SickLeaveModal`): `startDate`, `workCapacityPercentage` (0-100), notes.
- Herstelmelding/betermelding (`RecoveryModal`): `endDate`, status `recovered` | `partially_recovered`, slider.
- **Wet Poortwachter tracking** (`utils/poortwachterTracking.ts`) — 9 verplichte milestones:
  1. **Week 6** — Probleemanalyse
  2. **Week 8** — Plan van aanpak
  3. **Week 13** — Evaluatie 1
  4. **Week 26** — Evaluatie 2
  5. **Week 42** — Arbo-arts inschakelen
  6. **Week 52** — Evaluatie 3 (jaarevaluatie)
  7. **Week 78** — Evaluatie 4 (voorbereiding WIA)
  8. **Week 91** — WIA voorbereiding (3 maanden voor 2 jaar)
  9. **Week 104** — WIA aanvraag indienen bij UWV
- Statistieken via `AbsenceStatsCard` (percentage, dagen, frequentie, gemiddelde duur, trends, long-term/chronic flags).

### 5.7 Facturatie — Uitgaand (`/outgoing-invoices`, `/boekhouder/outgoing-invoices`)

- `CreateInvoiceModal` voor opmaak met factuurregels, BTW (21%/9%/0%/verlegd), PDF.
- Factuurnummers per bedrijf met `invoicePrefix` + counter in `outgoingInvoiceCounters`.
- Statusflow: `draft → sent → paid/partial/overdue/cancelled`.
- Partial payment tracking via `paidAmount`, `addPartialPayment()`, `subtractPartialPayment()`.
- Export naar Make.com webhook (`ttdixmxlu9n7rvbnxgfomilht2ihllc2`).
- Delivery callback van Make.com → Netlify Function `invoice-delivery-callback` zet `deliveryStatus`/`deliveredAt`/`deliveryError`.

### 5.8 Facturatie — Inkomend (`/incoming-invoices-stats`, `/upload`)

- Upload via `InkomendeFacturenTab`.
- OCR via Claude Vision (PHP proxy `claude-vision-ocr.php` primair, Netlify Function `claude-vision-ocr.ts` secundair, Tesseract.js client-side fallback).
- Factuurnummers `INK-YYYY-####` via `generateIncomingInvoiceReference()` met transaction lock.
- Statusflow: `pending → approved → paid / partial / rejected`.
- Auto-archivering na 90+ dagen onbetaald (`invoiceArchives`).
- Statistieken-dashboard: top leveranciers, status-breakdown, maandtrend.
- "Markeer als betaald" triggert Make.com webhook (`8jntdat5emrvrcfgoq7giviwvtjx9nwt`).
- "Haal email-facturen op" triggert Make.com webhook (`sphpptl7j3x0aadqjidzb5r17uatkr5b`).

### 5.9 Upload centrum (`/upload`, `/boekhouder/upload`)

Drie tabbladen via URL param `?tab=...`:
- **`facturen`** — `InkomendeFacturenTab` (OCR verwerking)
- **`post`** — `InkomendePostTab` (digitale postverwerking)
- **`verkoop`** — `UitgaandeFacturenTab` (factuurupload)

### 5.10 Bankafschriften (`/bank-statement-import`)

- CSV en MT940 import (auto-format detectie).
- Auto-detect kolommen (datum, bedrag, debiteur, IBAN, omschrijving).
- AI confidence scoring voor matching (factuurnummer, bedrag, datum, begunstigde).
- `bankMatchRules` — leert IBAN/naam → grootboekrekening mappings.
- Matched payments worden gelogd in `matchedPayments` met `matchedAt`, `matchedBy`, `matchedByName` voor audit trail.

### 5.11 Boekhouden

- **Grootboekrekeningen** (`/grootboekrekeningen`) — rekeningschema beheer, PDF export, template import via `utils/grootboekTemplate.ts`. Categorieën: `vaste_activa`, `vlottende_activa`, `omzet`, `personeelskosten`, etc.
- **BTW Overzicht** (`/btw-overzicht`) — periodeoverzicht (kwartaal/maand), aangifte-voorbereiding, PDF export via `lib/generateBtwPDF.ts`. BTW-types: `hoog` (21%), `laag` (9%), `geen`, `verlegd`.
- **Declaraties** (`/admin-expenses`, `/expenses`, `/boekhouder/admin-expenses`) — `ExpenseModal` voor 9 types (travel, meal, accommodation, parking, phone, office, training, representation, other). Travel: km → bedrag via configurabele rate. 2-staps goedkeuring met receipt-images.
- **Dagboek-export** (`services/dagboekExportService.ts`) — converteert banktransacties naar dubbel-boekhouden journal lines. Formaten: Exact Online, Snelstart, Twinfield, generic CSV. Hardcoded journaal-accounts: `1100` (Bank), `3000` (Crediteuren), `1200` (Debiteuren).

### 5.12 Budgettering (`/budgeting`)

- Budget planning per bedrijf en periode.
- Werkelijke kosten vs. begroting met varianties.
- Forecasting.

### 5.13 Loonverwerking & Loonstroken (`/payslips`)

- **Payroll periods** (`services/payrollService.ts`): weekly, bi-weekly, monthly cycles. Status: `draft → calculated → approved → paid → finalized`.
- **Loonberekeningen**: gross, net, taxes, social security; YTD tracking (ytdGross, ytdNet, ytdTax).
- **Toeslagen**: regular, overtime, evening, night, weekend, holiday allowance, travel allowance.
- **Inhoudingen**: pensioen, ziektekosten, etc.
- **Loonstroken** (`services/payslipService.ts`):
  - Status `draft` (boekhouder, niet zichtbaar voor employee)
  - Status `approved` (admin, zichtbaar voor employee)
  - Status `paid` (admin, met `paymentDate`)
  - PDF generatie via `PayslipPDFTemplate` + `payslipPdfGenerator.tsx`
  - Boekhouder upload via `/boekhouder/payslip-upload`
  - Bestand opslag via internedata.nl proxy2.php naar `FLG-Administratie/{Company}/Loonstroken/{year}/`

### 5.14 BTW-aangifte XML (`services/taxReturnGenerator.ts`)

- BSN-validatie via 11-proef checksum.
- Tax brackets 2025: 37%, 49.5%, 49.5%.
- Sociale premies: AOW, WLZ, WW (rates 2025 hardcoded).
- XML export voor Belastingdienst (ISO 8859-1 encoded).
- Status: `draft → validated → submitted → accepted/rejected/corrected`.

### 5.15 Statistieken

| Pagina | Doel |
|---|---|
| `/statistics/employer` | Werkgever stats — personeel, kosten, uren per werkmaatschappij |
| `/statistics/project` | Project stats — productie, uren, kosten per project-BV |
| `/statistics/holding` | Holding stats — geconsolideerd overzicht holding |

`services/projectStatisticsService.ts` levert:
- `getWeeklyBreakdown()` — week-aggregaten (regular hours, overtime, evening, night, weekend)
- `getDailyBreakdown()` — productie-entries per dag
- Multi-tenant: employer-company bezit timesheets, project-company bezit production entries.

### 5.16 Productie (`/project-production`, `/production-pool`)

- Productiedata import vanuit Make.com webhook (`qmvow9qbpesofmm9p8srgvck550i7xr6`).
- Productiepool voor onbezet productiewerk.
- Project team toewijzingen (`/project-team`).

### 5.17 Interne Projecten (`/internal-projects`)

- Niet-billable tijdregistratie (R&D, training, infrastructuur).
- Kleur per project voor UI-badges.
- `isActive` flag, gekoppeld aan medewerkers en gerefereerd in timesheet entries.

### 5.18 Chat (`/chat`, `/boekhouder/chat`)

- Real-time admin ↔ boekhouder berichten per bedrijf via Firestore.
- `chats/{chatId}` met subcollection `chats/{chatId}/messages`.
- Chat-ID format: `buildChatId(companyId, boekhouderUid)`.
- Unread counters `adminUnread` en `boekhouderUnread` per thread.
- `useChatUnreadCount` hook + `ChatUnreadBanner` in layout.

### 5.19 Notificaties

Drie kanalen: `in_app`, `email`, `push`.

- **In-app**: `NotificationCenter` met bell-icon en filter (All / Unread). Prioriteiten met kleuren: urgent (rood), high (oranje), medium (primary), low (grijs).
- **Push (FCM)**: VAPID key `BNC4g-LWqqIwa-_yHnhM7y-aMZ0-uUYLeXPswZRQrohFFiSevJBpFJJj4uIGiuDEga0rJxPpwPgun-7mOyOdZQg` (public).
  - Service worker (`public/service-worker.js`) handelt background messages af.
  - Tokens opgeslagen in `users/{uid}/fcmTokens/{token}`.
  - `PushPromptBanner` vraagt toestemming, `PushDiagnostics` voor debug.
  - Verzonden via PHP proxy `fcm-send.php` (primair) of Netlify Function `send-push.ts` (secundair).
- **Categorieën**: `payroll_approval`, `payroll_completed`, `tax_deadline`, `task_assigned`, `task_deadline_reminder`, `task_schedule_reminder`, etc.
- **Quiet hours**: configureerbare `startTime`/`endTime` in `NotificationPreferences`.

### 5.20 Taken (`/tasks`, `/boekhouder/tasks`, `/employee-dashboard/tasks`)

- Wekelijkse terugkerende taken per bedrijf/medewerker (`businessTasks` collectie).
- 8 Categorieën (`utils/taskConfig.ts`): operational, compliance, financial, hr, sales, contracts, administration, other.
- 4 Prioriteiten: low, medium, high, urgent.
- 5 Statussen: pending ("Te doen"), in_progress ("Bezig"), completed ("Voltooid"), overdue ("Te laat"), cancelled ("Geannuleerd").
- 5 Frequenties: daily, weekly, monthly, quarterly, yearly — elk met Tailwind-kleur (rose, sky, violet, amber, emerald).
- **Deadline-enforcement** (`services/taskSchedulingService.ts`):
  - Volgende vrijdag-deadline op 19:00 NL tijd.
  - Reminder-levels: woensdag (light), donderdag (strong), vrijdag 19:00+ (overdue).
  - localStorage-keys voorkomen dubbele reminders per dag per level.
- **Scheduled function** (`scheduled-task-reminders.ts`, cron `*/15 * * * *`) stuurt push 1 uur voor `dueDate`, markeert `reminderSentAt`.
- `TaskScheduleSidebar`, `WeeklyTasksReminder` (popover, getoond bij logo-klik in Layout), `ScheduledTaskPopover` componenten.

### 5.21 Medewerker Agenda (`/employee-dashboard/agenda`)

- FullCalendar integratie met daygrid, timegrid, interaction views.
- Verlof, verzuim, taken en Microsoft 365 calendar events kleurgecodeerd.
- Microsoft Graph integratie via MSAL (`@azure/msal-browser`).
- CSS dark mode customisatie voor FullCalendar in `src/index.css`.

### 5.22 Audit Log (`/audit-log`)

- Alle Firestore writes worden gelogd via `services/auditService.ts` met checksum.
- Acties: `create`, `update`, `delete`, `view`, `export`, `submit`, `approve`, `reject`.
- Entity types: employee, company, branch, payroll, tax_return, leave_request, expense, invoice, etc.
- Filter op user/action/resource/datum.
- Compliance reports en data retention (default 7 jaar NL legal).

### 5.23 Instellingen (`/settings`, `/boekhouder/settings`)

- Profile (naam, email, avatar), password change.
- 15 themakleuren-presets (`utils/themeColors.ts` — zie sectie 16).
- `BottomNavSettings` — mobile bottom nav aanpassen per bedrijf (opgeslagen in `userSettings.bottomNavItems[companyId]`).
- `CompaniesVisibilitySettings` — bedrijven zichtbaarheid configureren.
- Dark mode toggle via `DarkModeContext`.
- Notificatie-voorkeuren via `notificationPreferences/{uid}`.

### 5.24 Investment Pitch (`/investment-pitch`)

- Investor-presentatie pagina.
- Frame mode via `?mode=frame` (geen Layout) voor embedden.
- PDF export via `lib/generateInvestmentPDF.ts`.

### 5.25 PWA (Progressive Web App)

- Service worker in `public/service-worker.js`.
  - Cache name: `flg-admin-v3.1.1.1.1.1.1.1.1.1.1.1.1.1`.
  - Cached: `/`, `/Logo.png`, `/manifest.json`, `/index.html`.
  - Cache-first strategy voor GET requests.
  - Events: install, activate, fetch, message (SKIP_WAITING), `onBackgroundMessage` (FCM), `notificationclick`.
- Manifest in `public/manifest.json` (zie sectie 17).
- Installeerbaar via browser PWA prompt.
- iOS PWA detectie via `isIos()` + `isStandalone()` in `lib/messaging.ts`.

---

## 6. Services Overzicht (`src/services/`)

### 6.1 Core CRUD & data

| Service | Hoofdfuncties | Belangrijkste collecties |
|---|---|---|
| `firebase.ts` | Centrale CRUD voor employees, companies, branches, leaves, tasks, roles, incoming post | employees, companies, branches, leaveRequests, sickLeave, businessTasks, weeklyTimesheets, expenses |
| `timesheetService.ts` | `getWeeklyTimesheets`, `createWeeklyTimesheet`, `updateTimesheetEntry`, gap-enforcement, approval flow | weeklyTimesheets, timeEntries |
| `internalProjectService.ts` | CRUD voor interne project-codes (`createInternalProject`, `updateInternalProject`, `deleteInternalProject`) | internalProjects |
| `payrollService.ts` | Loontijdvak beheer (`getPayrollPeriods`, `createPayrollPeriod`, `updatePayrollPeriod`) | payrollPeriods, payrollCalculations |
| `payslipService.ts` | Loonstrook CRUD, PDF-generatie (`generatePayslipPdfBlob`), status (draft/approved/paid), visibility-regels | payslips, payslipCounters |
| `payslipPdfGenerator.tsx` | React-PDF rendering helper voor loonstroken | — |
| `outgoingInvoiceService.ts` | Factuurnummers (`getNextInvoiceNumber`), status-flow, partial payments, PDF, Make.com export | outgoingInvoices, outgoingInvoiceCounters |
| `incomingInvoiceService.ts` | `generateIncomingInvoiceReference` (transaction lock), OCR call, status-flow, archief 90d | incomingInvoices, invoiceArchives |
| `supplierService.ts` | Leverancier upsert, grootboek CRUD met template-copy | suppliers, grootboekrekeningen, crediteuren, debiteuren |
| `bankImportService.ts` | CSV/MT940 parsing (`detectFormat`, `parseCSV`, `parseMT940`), AI-matching | bankTransactions, bankImports, bankMatchRules |
| `matchedPaymentsService.ts` | Link banktransacties aan facturen met audit-trail (`matchedAt`, `matchedBy`) | matchedPayments |
| `notificationService.ts` | In-app/email/push notificaties via FCM PHP proxy | notifications |
| `notificationTargeting.ts` | `resolveToUserUids` — employeeId/uid mix → uid list | — |
| `taskSchedulingService.ts` | Friday 19:00 deadline (`getNextFridayDeadline`), reminder-levels (`getReminderLevel`) | businessTasks |
| `chatService.ts` | `buildChatId`, `subscribeChatsForUser`, `subscribeMessages`, `sendMessage` | chats, chats/{id}/messages |
| `auditService.ts` | `logAction`, `getAuditLogs`, `generateComplianceReport`, `getDataRetentionStatus` | auditLogs, complianceReports, auditExports |

### 6.2 Imports, exports & integraties

| Service | Doel | Externe call |
|---|---|---|
| `fileUploadService.ts` | `uploadFileToInternedata` — POST naar `FLG-Administratie/{Company}/{Verkoop\|Inkoop\|Post\|Loonstroken}/{year}/` | `https://internedata.nl/proxy2.php` |
| `ocrService.ts` | `processInvoiceFile` — Claude Vision invoice extraction | `https://internedata.nl/claude-vision-ocr.php` |
| `itknechtService.ts` | `fetchHoursData(monteur, week, year, companyId)` — action `get_hours_data` | Make.com `wh18u8c7x989zoakqxqmomjoy2cpfd3b` |
| `itknechtFactuurService.ts` | `fetchFactuurData(week, year, companyId)` — action `get_factuur_data` | Make.com `223n5535ioeop4mjrooygys09al7c2ib` |
| `microsoftService.ts` | `loginMicrosoft`, `getMicrosoftCalendarEvents` | `https://graph.microsoft.com/v1.0/me/calendarview` |
| `exportService.ts` | Job-based exports (`createExportJob`), SEPA PAIN.001.001.03 XML, accounting double-entry | — |
| `dagboekExportService.ts` | `buildDagboekRegels`, `generateCSV` (Exact Online, Snelstart, Twinfield, generic) | — |
| `projectStatisticsService.ts` | `getWeeklyBreakdown`, `getDailyBreakdown` (multi-tenant) | — |
| `taxReturnGenerator.ts` | BSN-validatie (11-proef), tax brackets 2025, sociale premies, XML ISO 8859-1 | — |

---

## 7. Types Overzicht (`src/types/`)

| Bestand | Bevat |
|---|---|
| `index.ts` | Kernentiteiten: `Company`, `Branch`, `Employee` (met `projectCompanies[]`, `salaryInfo`, `contractInfo`, allowances, `taxTable`), `TimeEntry`, `LeaveRequest`, `Expense`, `BudgetItem`, `UserSettings`, `UserRole`, `BusinessTask`, `IncomingPost` |
| `timesheet.ts` | `WeeklyTimesheet`, `TimesheetEntry`, `WorkActivity`, `DayStatus` (8 values), `TimesheetApproval`, gap-enforcement constants |
| `leave.ts` | `LeaveRequest`, `LeaveBalance`, `LeaveType` (8), `LeaveStatus` (pending/approved/rejected), `seniorDays`, `snipperDays` |
| `expense.ts` | `Expense` types (9), `VehicleType`, status enums, `withinTaxFreeAllowance` |
| `payroll.ts` | `PayrollPeriod`, `PayrollEarning`, `PayrollDeduction`, `PayrollTaxes`, `HourlyRate`, `Allowance`, `Deduction`, YTD-velden |
| `payslip.ts` | `Payslip`, `PayslipData`, leave-balance velden, pension contributions |
| `audit.ts` | `AuditLog`, audit actietypes, `ComplianceReport`, `DataRetentionPolicy` |
| `notification.ts` | `Notification`, `NotificationPreferences`, `EmailTemplate`, `NotificationSchedule`, categorieën, prioriteiten |
| `bankImport.ts` | `BankTransaction` (debit\|credit), `BankImport`, `MatchedPayment`, `EditHistory[]` |
| `supplier.ts` | `Supplier`, `Grootboekrekening`, `Crediteur`, `Debiteur`, grootboek-categorieën, BTW-types (hoog/laag/geen/verlegd) |
| `microsoft.ts` | `MicrosoftCalendarEvent`, `MicrosoftConnection` (Outlook API mirror) |
| `taxReturn.ts` | `TaxReturn`, `EmployeeTaxData`, period (monthly/quarterly/annual), status flow, wage components |
| `export.ts` | `ExportJob`, `SEPAPayment`, `PensionExport`, export-types (timesheet_csv, payroll_excel, sepa_payment, tax_return_xml, etc.), 7-dagen expiry |
| `internalProject.ts` | `InternalProject` (name, description, color, isActive, timestamps) |
| `absence.ts` | `SickLeave`, `AbsenceStatistics`, Poortwachter-data, WIA tracking |
| `statistics.types` | ⚠️ **Mist `.ts` extensie** (zie sectie 28) |

---

## 8. Utils Overzicht (`src/utils/`)

| Bestand | Hoofdfuncties / inhoud |
|---|---|
| `menuConfig.ts` | 35 navigatie-items, 6 secties, bottom-nav defaults, helper `getFilteredNavigation`, `getNavigationSections`, `ICON_MAP` (16 Lucide icons) |
| `themeColors.ts` | 15 themakleuren-presets (zie sectie 16) + `applyThemeColor(preset)` |
| `taskConfig.ts` | 8 categorieën, 4 prioriteiten, 5 statussen, 5 frequenties — elk met Lucide icon + Tailwind kleur (light + dark) |
| `timesheetCompliance.ts` | `getWeekWorkdays`, `checkWeekComplete`, `isWeekDeadlinePassed`, `canRequestLeaveAsEmployee`, `containsOpdrachtgeverBlame`, day-status labels |
| `poortwachterTracking.ts` | `generatePoortwachterMilestones`, `updateMilestoneStatus`, `getOverdueMilestones`, `getUpcomingMilestones`, `shouldActivatePoortwachter` (≥6w), `shouldContactArbo` (≥42w), `shouldStartWIAPreparation` (≥91w), `getMilestoneCompletionPercentage` |
| `leaveCalculations.ts` | `calculateMonthlyHolidayAccrual`, `calculateYearlyHolidayEntitlement`, `calculateWorkingDays`, `calculateWorkingHours`, `isPublicHoliday`, `getEasterDate` (Computus), `getWhitsunDate`, `calculateADVDays` (BOUW=13), label-mappings, `getDaysUntilExpiry`, `shouldWarnAboutExpiry` |
| `validation.ts` | `validateBSN` (11-proef), `validateIBAN` (MOD-97, NL-format), `validatePostalCode` (1234 AB), `validatePhone` (+31/0031/0 + 9) |
| `dateFilters.ts` | `getQuarterDateRange`, `isInQuarter`, `isWeekInQuarter` |
| `companyHelpers.ts` | `shouldShowCompanySelector`, `getAvailableCompaniesForEmployee`, `getProjectCompaniesForEmployer` |
| `firebaseAuth.ts` | `createFirebaseUser` via REST → `https://identitytoolkit.googleapis.com/v1/accounts:signUp`. ⚠️ **Hardcoded default password: `DeInstallatie1234!!`** + hardcoded API key fallback |
| `firebase-storage-helper.ts` | Legacy Firebase Storage download met CORS fallback (Strategy 1: direct URL, Strategy 2: blob) — niet actief in gebruik |
| `grootboekTemplate.ts` | Default grootboekrekeningen template voor nieuwe bedrijven |
| `taxReturnGenerator.ts` | Helper voor BTW-aangifte generator (gedupliceerd in services/) |

---

## 9. Hooks (`src/hooks/`)

| Hook | Doel |
|---|---|
| `useToast()` | Toast notifications (success/error/warning/info), auto-dismiss 5s, returns `id` voor manual removal. Methodes: `toast.success/error/warning/info(message, options)` |
| `useChatUnreadCount(role)` | Real-time unread chat counter; queries onder primary admin UID voor co-admin/admin shared threads |

---

## 10. Contexts (`src/contexts/`)

| Context | State / methodes |
|---|---|
| `AuthContext` | `user` (Firebase User), `userRole`, `currentEmployeeId`, `adminUserId` (primary admin voor co-admin), `loading`. Methods: `signIn`, `signUp`, `signOut`, `resetPassword`. Co-admin detectie via `userSettings.primaryAdminUserId`. |
| `AppContext` | `selectedCompany`, `selectedYear`, `selectedQuarter`, `companies[]`, `employees[]`, `branches[]`, `assignedAdmins[]` (boekhouder), `dashboardStats` (activeEmployees, totalGrossThisMonth, pendingApprovals). Methods: `setSelectedCompany`, `refreshDashboardStats`. |
| `DarkModeContext` | `isDarkMode` boolean — persist naar `localStorage.darkMode` + `userSettings/{uid}.darkMode`. Class `dark` op `<html>`. |
| `PageTitleContext` | `usePageTitle(title)` zet titel on mount, clear on unmount. `usePageTitleValue()` leest huidige titel. |

---

## 11. Lib (`src/lib/`)

| Bestand | Doel |
|---|---|
| `firebase.ts` | Firebase init: `db` (Firestore), `auth` (Auth), `storage` (Storage), `database` (Realtime DB). Config via `VITE_FIREBASE_*` env vars met hardcoded fallbacks (zie sectie 27). |
| `messaging.ts` | FCM helpers: `isPushSupported`, `isIos`, `isStandalone`, `getCurrentDeviceToken`, `registerCurrentDeviceToken`, `unregisterCurrentDeviceToken`, `onForegroundMessage`. VAPID public key embedded. |
| `msalConfig.ts` | MSAL config voor Microsoft OAuth — `authority: https://login.microsoftonline.com/common`, scopes `Calendars.Read`, `User.Read`, cache in localStorage. Client ID via `VITE_MICROSOFT_CLIENT_ID`. |
| `generateBtwPDF.ts` | BTW-overzicht PDF export |
| `generateGrootboekPDF.ts` | Grootboek PDF export |
| `generateInvestmentPDF.ts` | Investment pitch PDF export |

---

## 12. Components — Detailcatalogus

### 12.1 Root (`src/components/`)

| Component | Doel |
|---|---|
| `ProtectedRoute.tsx` | Auth gate — redirect naar `/login` als niet ingelogd, toont LoadingSpinner tijdens check |
| `AppUpdateModal.tsx` | Service worker update prompt — toont rol-specifieke changelog, triggert refresh via `SKIP_WAITING` |
| `sedy6Ka59` | ⚠️ Leeg/ongeldig bestand (0 bytes), opruimen |

### 12.2 UI (`src/components/ui/`)

| Component | Props / Varianten |
|---|---|
| `Button.tsx` | Variants: `primary` \| `secondary` \| `success` \| `warning` \| `danger` \| `ghost` \| `outline`. Sizes: `sm` \| `md` \| `lg`. Props: `loading`, `disabled` |
| `Card.tsx` | Props: `title`, `subtitle`, `accent` (`bronze` \| `success` \| `warning` \| `danger` \| `info` \| `accent`), `children`, `className` |
| `Input.tsx` | Forwardref input — `label`, `error`, `helperText`, HTML input attrs, dark mode support |
| `Modal.tsx` | Sizes: `sm` \| `md` \| `lg` \| `xl`. Props: `isOpen`, `onClose`, `title`, `children`. Backdrop click closes |
| `Toast.tsx` + `ToastContainer.tsx` | Types: success/error/warning/info, auto-dismiss 5s |
| `LoadingSpinner.tsx` | Dual-ring spinner, min-height 400px |
| `EmptyState.tsx` | Props: `icon`, `title`, `description`, `actionLabel`, `onAction` |
| `PageHeader.tsx` | Props: `title`, `subtitle`, `emoji`, `actions`, `className` |
| `StatTile.tsx` | KPI tile met accent stripe. Tones: `bronze`/`sky`/`emerald`/`amber`/`purple`/`red`/`teal`. Props: `label`, `value`, `sub`, `emoji`, `icon`, `tone`, `badgeCount`, `delta` (text + direction), `onClick` |
| `ActionMenu.tsx` | 3-dot dropdown. `actions[]` (label, icon, onClick, variant default/danger, disabled). Opens upward if <200px space below |
| `PeriodSelector.tsx` | Year + quarter buttons. Prop `showQuarter` (default true). All/Q1-Q4 pills |
| `CompanySelector.tsx` | Dropdown voor admin/manager. Logo's + Building2 fallback, type-badge (Loonmaatschappij/Werkmaatschappij) |
| `SmartCompanySelector.tsx` | Auto-select bij 1 bedrijf. Props: `employee`, `allCompanies`, `value`, `onChange`. Plus `useSmartCompanySelection` hook |

### 12.3 Layout (`src/components/layout/`)

| Component | Doel |
|---|---|
| `Layout.tsx` | Hoofd-wrapper. Desktop: sidebar + header + main. Mobile: fixed header + bottom nav + fullscreen menu. Bevat company/admin selector, period selector, weekly-tasks-reminder (logo-klik), `PushPromptBanner`, `ChatUnreadBanner`, `IncompleteWeekBanner`. Embed-mode via `?embed=true` |
| `Sidebar.tsx` | Desktop sidebar (`lg:hidden` mobile). Collapsible. Logo + bedrijf, Dashboard prominent, favorites (admin/co-admin), 6 collapsible secties, logout. localStorage state |
| `EmployeeLayout.tsx` | Employee-specifieke layout. Sidebar met avatar/profile, 7 nav items (Dashboard, Timesheets, Agenda, Tasks, Expenses, Leave, Absence), mobile bottom nav (Home, Hours, Agenda, Tasks, Settings) |
| `MobileBottomNav.tsx` | 5-6 vaste items. Dashboard altijd eerst, hamburger laatst. Chat-badge support. Customizable per bedrijf via `userSettings.bottomNavItems[companyId]` |
| `MobileFullScreenMenu.tsx` | Slide-out menu. Header met logo, company dropdown, period selector, Dashboard card, collapsible favorites + secties, logout |
| `BoekhouderAdminSelector.tsx` | Boekhouder-specifieke selector. Groepeert bedrijven per admin (userId). Variants: `mobile` / `desktop` |

### 12.4 Feature componenten

**Absence (`src/components/absence/`):**
- `AbsenceStatsCard.tsx` — Toont %, dagen, frequentie, gemiddelde duur. Trend arrows. Drempels: <3% groen, 3-5% oranje, >5% rood. Long-term/chronic flags.
- `SickLeaveModal.tsx` — Ziekmelding form (`startDate`, `workCapacityPercentage`, notes). Status `active`, `arboServiceContacted=false`.
- `RecoveryModal.tsx` — Herstelmelding form (`endDate`, status `recovered`/`partially_recovered`, slider, notes).

**Banking (`src/components/banking/`):**
- `BankPartiesOverviewCards.tsx` — 3 self-loading cards: Rekeningschema (categorie-breakdown, PDF, template-import), Crediteuren (top 4), Debiteuren (top 4). Props: `companyId`, `companyName`, `allowImportTemplate`, `onImportTemplate`, `importingTemplate`.

**Company (`src/components/company/`):**
- `CompanyModal.tsx` — Aanmaken/bewerken bedrijf. Type selector (employer/project/holding/shareholder/investor disabled), primary employer selector, theme color picker (5 presets), logo upload (base64), adres, contact, employer-specifieke settings, project-settings, `bankAccount`, `invoicePrefix`.
- `BranchModal.tsx` — Vestiging form. Fields: `name`, `location`, `costCenter`, `cao` (dropdown), opslag-percentages.

**Employee (`src/components/employee/`):**
- `EmployeeModal.tsx` — Werknemer form. Persoonlijk, primary employer + branch, **project companies (multi-select checkboxes)**, contract (8 types, hours/week), salaris (hourly/monthly/annual). Auto-vakantie-uren = hours × 4. Date-conversion voor Firestore Timestamp.

**Expense (`src/components/expense/`):**
- `ExpenseModal.tsx` — Declaratie form. Type (travel/meal/parking/accommodation/other), km → auto-bedrag, BTW optioneel. Status `draft`.

**Invoices (`src/components/invoices/`):**
- `CreateInvoiceModal.tsx` — Uitgaande factuur form (regels, BTW, klant).
- `FactuurWerkbonnenImport.tsx` — Import werkbonnen vanuit ITKnecht voor factuur-generatie.

**Leave (`src/components/leave/`):**
- `LeaveRequestModal.tsx` — Verlofaanvraag. Type (holiday/unpaid/special/parental/care), datumbereik → werkdagen, saldo-check, no-backdate voor employee (admin mag wel).
- `LeaveBalanceCard.tsx` — Saldo-overzicht met progress bar, ADV, senior days, snipper days, vervaldatum-waarschuwing (rood < 30d), totaal-remaining.

**Notifications (`src/components/notifications/`):**
- `NotificationCenter.tsx` — Bell icon + dropdown. Filter All/Unread, priority colors (rood/oranje/primary/grijs), mark as read/archive, "Markeer alle als gelezen". Timestamps "Nu / X min / X uur / datum".
- `PushPromptBanner.tsx` — Toestemming prompt (iOS PWA detectie).
- `PushDiagnostics.tsx` — Debug tool, health check naar `fcm-send.php`, test-push verzenden.
- `ChatUnreadBanner.tsx` — Banner met aantal ongelezen chats.

**Payslip (`src/components/payslip/`):**
- `PayslipPDFTemplate.tsx` — `@react-pdf/renderer` template voor loonstrook.

**Settings (`src/components/settings/`):**
- `BottomNavSettings.tsx` — Customizer voor mobile bottom nav (3 items kiezen).
- `CompaniesVisibilitySettings.tsx` — Toggle bedrijfs-zichtbaarheid per gebruiker.

**Tasks (`src/components/tasks/`):**
- `WeeklyTasksReminder.tsx` — Ref-forwarded popover met `openManually()`, getoond bij logo-klik in Layout.
- `TaskScheduleSidebar.tsx` — Sidebar met geplande taken.
- `ScheduledTaskPopover.tsx` — Popover met taakdetails.

**Timesheet (`src/components/timesheet/`):**
- `IncompleteWeekBanner.tsx` — Waarschuwing bij ontbrekende dag-statussen, deadline-info.

**Upload (`src/components/upload/`):**
- `InkomendeFacturenTab.tsx` — Drag-drop + OCR voor inkomende facturen.
- `InkomendePostTab.tsx` — Digitale post upload (bestanden categoriseren).
- `UitgaandeFacturenTab.tsx` — Upload van verstuurde facturen voor archief.

---

## 13. Pages — Detailcatalogus

### 13.1 Authentication

| Pagina | Route | Doel |
|---|---|---|
| `Login.tsx` | `/login` | Email/password login |
| `Register.tsx` | `/register` | Account creatie + user profiel |
| `ResetPassword.tsx` | `/reset-password` | Wachtwoord reset email |

### 13.2 Dashboards

| Pagina | Route | Rol | Inhoud |
|---|---|---|---|
| `Dashboard.tsx` | `/` | admin/co-admin | KPI tiles, company selector, period selector, quick actions |
| `ManagerDashboard.tsx` | `/` | manager | Team-overzicht, pending approvals, team tasks |
| `EmployeeDashboard.tsx` | `/employee-dashboard` | employee | Persoonlijke KPI's (uren deze week, verlof, taken), quick actions |
| `AdminDashboard.tsx` | `/admin/dashboard` | admin | Snelle admin-acties, recent audit, systeem-gezondheid |
| `boekhouder/Dashboard.tsx` | `/boekhouder` | boekhouder | BTW status, openstaande facturen, bank-reconciliatie |

### 13.3 HR & medewerkers

| Pagina | Route | Inhoud |
|---|---|---|
| `EmployeesNew.tsx` | `/employees` | Tabel (naam, positie, bedrijf, contract, uren, salaris) + `EmployeeModal` |
| `AdminUsers.tsx` | `/admin/users` | Admin/co-admin/manager beheer |
| `AdminRoles.tsx` | `/admin/roles` | Rol-permissies definiëren |
| `Timesheets.tsx` | `/timesheets`, `/employee-dashboard/timesheets` | Weekraster (ma-vr), day-statuses, "Clear week", IncompleteWeekBanner, ITKnecht import via Make-webhook |
| `TimesheetApprovals.tsx` | `/timesheet-approvals` | Pending timesheets, approve/reject met comment |
| `TimesheetExport.tsx` | `/timesheet-export` | Datumrange + filter + Excel/CSV/PDF export |
| `Leave.tsx` | `/leave`, `/employee-dashboard/leave` | Tabs: Mijn aanvragen / Approvals. `LeaveRequestModal`, `LeaveBalanceCard` |
| `AdminLeaveApprovals.tsx` | `/admin/leave-approvals` | Bulk approve/reject, company filter, audit trail |
| `Absence.tsx` | `/absence`, `/employee-dashboard/absence` | Ziekmelding + herstelmelding, `AbsenceStatsCard` |
| `AdminAbsenceManagement.tsx` | `/admin/absence-management` | Alle actieve absence, Poortwachter milestones, recovered-flag |
| `Expenses.tsx` | `/expenses`, `/employee-dashboard/expenses` | Declaratie-lijst, `ExpenseModal`, filter type/status/datum |
| `AdminExpenses.tsx` | `/admin-expenses`, `/boekhouder/admin-expenses` | Approve queue, receipt images, bulk acties |
| `Payslips.tsx` | `/payslips`, `/employee-dashboard/payslips` | Lijst loonstroken, PDF download, YTD-summary |
| `EmployerStatistics.tsx` | `/statistics/employer` | Payroll-kosten, breakdown per medewerker, forecast |

### 13.4 Project

| Pagina | Route | Inhoud |
|---|---|---|
| `ProjectProduction.tsx` | `/project-production` | Productie per project, Make.com import |
| `ProjectStatistics.tsx` | `/statistics/project`, `/project-statistics` | Project-analytics (revenue, profitability, utilization) |
| `ProjectTeam.tsx` | `/project-team` | Team-toewijzingen, allocatie % |
| `ProductionPool.tsx` | (interne pool pagina) | Onbezet productiewerk, capacity planning |
| `HoldingStatistics.tsx` | `/statistics/holding` | Geconsolideerd holding overzicht |
| `InternalProjects.tsx` | `/internal-projects` | Interne project codes (R&D, training) |
| `InvestmentPitch.tsx` | `/investment-pitch` | Investor pitch. Frame mode via `?mode=frame` (zonder Layout) |

### 13.5 Financieel

| Pagina | Route | Inhoud |
|---|---|---|
| `OutgoingInvoices.tsx` | `/outgoing-invoices`, `/boekhouder/outgoing-invoices` | Factuur-lijst, `CreateInvoiceModal`, status, Make.com export |
| `Upload.tsx` | `/upload`, `/boekhouder/upload` | 3 tabs (facturen/post/verkoop) via `?tab=...` |
| `IncomingInvoicesStats.tsx` | `/incoming-invoices-stats`, `/boekhouder/incoming-invoices-stats` | Top leveranciers, status-breakdown, maandtrend. "Markeer betaald" + "Haal email-facturen op" triggeren Make-webhooks |
| `InvoiceRelations.tsx` | `/invoice-relations`, `/boekhouder/invoice-relations` | Klanten + leveranciers + payment terms + credit limits |
| `Budgeting.tsx` | `/budgeting` | Begroting per bedrijf, maand vs. budget, varianties, forecast |
| `BankStatementImport.tsx` | `/bank-statement-import`, `/boekhouder/bank-statement-import` | CSV/MT940 upload, auto-match, reconciliatie UI |
| `Grootboekrekeningen.tsx` | `/grootboekrekeningen`, `/boekhouder/grootboekrekeningen` | `BankPartiesOverviewCards` + rekeningschema CRUD + PDF export |
| `BtwOverzicht.tsx` | `/btw-overzicht`, `/boekhouder/btw-overzicht` | BTW-aangifte periodes, breakdown, PDF, export naar tax-software |

### 13.6 Employee-specifiek

| Pagina | Route | Inhoud |
|---|---|---|
| `EmployeeAgenda.tsx` | `/employee-dashboard/agenda` | FullCalendar — verlof, verzuim, taken, Outlook events |
| `EmployeeTasks.tsx` | `/employee-dashboard/tasks` | Toegewezen taken, status, due dates, detail modal |

### 13.7 Systeem

| Pagina | Route | Inhoud |
|---|---|---|
| `Chat.tsx` | `/chat`, `/boekhouder/chat` | Admin ↔ boekhouder real-time chat per bedrijf |
| `Tasks.tsx` | `/tasks`, `/boekhouder/tasks` | Weekelijkse taken, categorie/prioriteit/status/frequentie filters |
| `Companies.tsx` | `/companies` | Bedrijfskaarten, `CompanyModal`, `BranchModal` |
| `AuditLog.tsx` | `/audit-log` | Filter op user/action/resource/datum, export |
| `Settings.tsx` | `/settings`, `/boekhouder/settings` | Profile, themakleur, bottom nav, companies visibility, dark mode, notificatie-prefs |
| `NotFound.tsx` | `*` | 404 met home link |
| `boekhouder/PayslipUpload.tsx` | `/boekhouder/payslip-upload` | Loonstroken uploaden voor admin/employee distributie |

---

## 14. Navigatie & Menu (`src/utils/menuConfig.ts`)

**35 navigatie-items** in `ALL_NAVIGATION_ITEMS`. Elk item heeft: `id`, `name`, optioneel `nameByRole`, `href`, optioneel `hrefByRole`, `icon` (ID uit `ICON_MAP`), `roles[]`, `companyTypes[]`, optioneel `emoji`.

### 14.1 Volledige lijst items

| # | ID | Naam | Emoji | href | Rollen | Company types |
|---|---|---|---|---|---|---|
| 1 | `dashboard` | Dashboard | 📊 | `/` (boekhouder: `/boekhouder`) | admin, co-admin, manager, employee, boekhouder | employer, project, holding, shareholder |
| 2 | `employees` | Werknemers (manager: "Mijn Team") | 👥 | `/employees` | admin, co-admin, manager | employer |
| 3 | `timesheet-approvals` | Uren Goedkeuren | ✅ | `/timesheet-approvals` | admin, co-admin, manager | employer |
| 4 | `internal-projects` | Interne Projecten | 🛠️ | `/internal-projects` | admin, co-admin | employer |
| 5 | `payroll-processing` | Loonverwerking | 💰 | `/payslips` | admin, co-admin, manager | employer |
| 6 | `leave-approvals` | Verlof Beheren (manager: "Verlof Goedkeuren") | 🌴 | `/admin/leave-approvals` | admin, co-admin, manager | employer |
| 7 | `absence-management` | Verzuim Beheren | 🏥 | `/admin/absence-management` | admin, co-admin, manager | employer |
| 8 | `invoice-relations` | Klanten & Leveranciers | 🤝 | `/invoice-relations` (boekhouder: `/boekhouder/...`) | admin, co-admin, boekhouder | employer, project, holding, shareholder |
| 9 | `budgeting` | Begroting | 💼 | `/budgeting` | admin, co-admin | employer, project, holding, shareholder |
| 10 | `admin-expenses` | Declaraties | 🧾 | `/admin-expenses` (boekhouder: `/boekhouder/...`) | admin, co-admin, boekhouder | employer |
| 11 | `outgoing-invoices` | Verkoop | 📤 | `/outgoing-invoices` (boekhouder: `/boekhouder/...`) | admin, co-admin, boekhouder | employer, project, holding, shareholder |
| 12 | `incoming-invoices-stats` | Inkoop | 📥 | `/incoming-invoices-stats` (boekhouder: `/boekhouder/...`) | admin, co-admin, boekhouder | employer, project, holding, shareholder |
| 13 | `bank-statement-import` | Bankafschrift Import | 🏦 | `/bank-statement-import` (boekhouder: `/boekhouder/...`) | admin, co-admin, boekhouder | employer, project, holding, shareholder |
| 14 | `grootboekrekeningen` | Rekeningschema | 📒 | `/grootboekrekeningen` (boekhouder: `/boekhouder/...`) | admin, co-admin, boekhouder | employer, project, holding, shareholder |
| 15 | `btw-overzicht` | BTW Overzicht | 🧮 | `/btw-overzicht` (boekhouder: `/boekhouder/...`) | admin, co-admin, boekhouder | employer, project, holding, shareholder |
| 16 | `project-production` | Productie | 🏭 | `/project-production` | admin, co-admin, manager | project |
| 17 | `project-statistics` | Project Overzicht | 📊 | `/project-statistics` | admin, co-admin | project |
| 18 | `project-team` | Project Team | 👷 | `/project-team` | admin, co-admin | project |
| 19 | `statistics-employer` | Werkgever Stats | 📈 | `/statistics/employer` | admin, co-admin, manager | employer |
| 20 | `statistics-project` | Project Stats | 📊 | `/statistics/project` | admin, co-admin, manager | project |
| 21 | `statistics-holding` | Holding Stats | 🏛️ | `/statistics/holding` | admin, co-admin, manager | holding, shareholder |
| 22 | `timesheets` | Urenregistratie (employee/manager: "Mijn Uren") | ⏱️ | `/timesheets` | employee, manager | employer, project |
| 23 | `leave` | Verlof (employee: "Mijn Verlof") | 🌴 | `/leave` | employee, manager | employer, project, holding, shareholder |
| 24 | `absence` | Ziekteverzuim | 🏥 | `/absence` | employee, manager | employer, project, holding, shareholder |
| 25 | `expenses-employee` | Declaraties Medewerkers (employee: "Mijn Declaraties") | 🧾 | `/expenses` | employee, manager | employer, project, holding, shareholder |
| 26 | `payslips` | Loonstroken (employee: "Mijn Loonstroken") | 💵 | `/payslips` | employee, manager | employer, project, holding, shareholder |
| 27 | `chat` | Berichten | 💬 | `/chat` (boekhouder: `/boekhouder/chat`) | admin, co-admin, boekhouder | employer, project, holding, shareholder |
| 28 | `payslip-upload` | Loonstroken uploaden | 📤 | `/boekhouder/payslip-upload` | boekhouder | employer |
| 29 | `upload` | Upload | 📎 | `/upload` (boekhouder: `/boekhouder/upload`) | admin, co-admin, boekhouder | employer, project, holding, shareholder |
| 30 | `tasks` | Taken | ☑️ | `/tasks` (boekhouder: `/boekhouder/tasks`) | admin, co-admin, manager, boekhouder | employer, project, holding, shareholder |
| 31 | `companies` | Bedrijven | 🏢 | `/companies` | admin, co-admin | employer, holding, shareholder |
| 32 | `audit-log` | Audit Log | 📜 | `/audit-log` | admin, co-admin | employer, holding, shareholder |
| 33 | `users` | Gebruikers Beheer | 👤 | `/admin/users` | admin | employer, holding, shareholder |
| 34 | `investment-pitch` | Investment Pitch | 🚀 | `/investment-pitch` | admin, co-admin | project, holding |
| 35 | `settings` | Instellingen | ⚙️ | `/settings` (boekhouder: `/boekhouder/settings`) | admin, co-admin, employee, manager, boekhouder | employer, project, holding, shareholder |

### 14.2 Secties (6, collapsible)

| Sectie | Icon | Kleur | Items | Default open |
|---|---|---|---|---|
| **Statistieken** | TrendingUp | bg-indigo-500 | statistics-employer, statistics-project, statistics-holding | false |
| **HR** | Users | bg-blue-500 | employees, timesheet-approvals, internal-projects, payroll-processing, leave-approvals, absence-management | false |
| **Financieel** | Wallet | bg-emerald-500 | invoice-relations, budgeting, admin-expenses, outgoing-invoices, incoming-invoices-stats, bank-statement-import, grootboekrekeningen, btw-overzicht | false |
| **Project** | Factory | bg-orange-500 | project-production, project-statistics, project-team | false |
| **Mijn Zaken** | User | bg-cyan-500 | timesheets, leave, absence, expenses-employee, payslips | false |
| **Systeem** | Settings | bg-gray-500 | chat, payslip-upload, upload, tasks, companies, audit-log, users, investment-pitch, settings | false |

Dashboard staat los buiten de secties — totaal = 35 items.

### 14.3 ICON_MAP

16 Lucide React icons gebruikt: `Home`, `Clock`, `Settings`, `Users`, `Zap`, `CheckCircle2`, `Cpu`, `Package`, `Send`, `Download`, `Upload`, `Wallet`, `TrendingUp`, `ListTodo`, `PieChart`, `BookOpen`, `FileInput`, `Handshake`, `Receipt`, `MessageSquare`.

### 14.4 Bottom Nav Defaults

| Context | Item 1 | Item 2 | Item 3 |
|---|---|---|---|
| Holding | Stats (`/statistics/holding`) | Verkoop (`/outgoing-invoices`) | Begroting (`/budgeting`) |
| Shareholder | Stats (`/statistics/holding`) | Facturen (`/outgoing-invoices`) | Inkoop (`/incoming-invoices`) |
| Project | Stats (`/statistics/project`) | Productie (`/project-production`) | Facturen (`/outgoing-invoices`) |
| Employer — admin/co-admin | Verkoop | Uren (`/timesheet-approvals`) | Upload |
| Employer — manager | Stats (`/statistics/employer`) | Team (`/employees`) | Beheren (`/timesheet-approvals`) |
| Employer — boekhouder | Upload (`/boekhouder/upload`) | BTW (`/boekhouder/btw-overzicht`) | Grootboek (`/boekhouder/grootboekrekeningen`) |
| Employee | Uren (`/timesheets`) | Loonstrook (`/payslips`) | Profiel (`/settings`) |

### 14.5 Items zonder bedrijfsselectie

`dashboard`, `companies`, `settings` zijn toegestaan zonder gekozen bedrijf. Alle andere items zijn disabled met tooltip "Selecteer eerst een bedrijf".

---

## 15. Visueel Design

### 15.1 Lettertype

- **Inter** (system-ui, sans-serif fallback) — geconfigureerd in `tailwind.config.js` als `fontFamily.sans`.
- Font-feature-settings in `index.css`: `'cv02', 'cv03', 'cv04', 'cv11'` (Inter character variants).
- Font-smoothing: `-webkit-font-smoothing: antialiased`, `-moz-osx-font-smoothing: grayscale`.
- Text rendering: `optimizeLegibility`.
- Gewichten gebruikt: 400, 500, 600, 700.

> NB: Inter wordt NIET via `<link>` ingeladen in `index.html` — alleen via Tailwind font-family. Browser valt terug op system-ui als Inter niet aanwezig is.

### 15.2 Kleurenschema (Tailwind extended)

**Primary (Festina Lente Bronze/Brown):**
```
50:  #fdf8f3
100: #f9ede0
200: #f2d9bd
300: #e8bf8f
400: #dca05e
500: #cd853f  ← main bronze (theme color)
600: #b8703a
700: #995a32
800: #7d4a2e
900: #673d28
```

**Bronze** (duplicate van primary, voor expliciete `bronze-*` classes).

**Refined warm gray** (overschrijft Tailwind default gray):
```
50:  #faf9f7
100: #f0ede8
200: #ddd8cf
300: #c8c1b5
400: #a89d8f
500: #887c6e
600: #6b5f53
700: #524840
800: #3a332c
900: #231f1a
```

### 15.3 Border radius

- `xl`: 12px
- `2xl`: 16px

### 15.4 Letter spacing

- `tightest`: -0.04em

### 15.5 Shadows (warm-tinted)

| Class | Waarde |
|---|---|
| `xs` | `0 1px 2px 0 rgba(35,31,26,0.06)` |
| `sm` | `0 1px 3px 0 rgba(35,31,26,0.10), 0 1px 2px -1px rgba(35,31,26,0.06)` |
| `md` | `0 4px 8px -2px rgba(35,31,26,0.10), 0 2px 4px -2px rgba(35,31,26,0.06)` |
| `lg` | `0 10px 20px -4px rgba(35,31,26,0.10), 0 4px 8px -4px rgba(35,31,26,0.06)` |
| `xl` | `0 20px 40px -8px rgba(35,31,26,0.14), 0 8px 16px -8px rgba(35,31,26,0.08)` |
| `2xl` | `0 25px 50px -12px rgba(35,31,26,0.25)` |
| `glow-primary` | `0 2px 6px rgba(205,133,63,0.35)` |
| `glow-primary-lg` | `0 4px 12px rgba(205,133,63,0.40)` |

### 15.6 Dark mode

- Strategy: `class` (Tailwind `darkMode: 'class'`).
- Toggle via `DarkModeContext`, persisted naar localStorage + Firestore.
- Body: `bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-colors duration-200`.
- Globale border-color: `border-gray-200 dark:border-gray-700`.

### 15.7 Custom scrollbars

Webkit only — 8px breed/hoog.
- Track: transparant
- Thumb light: `rgba(168, 157, 143, 0.35)`, hover `0.55`
- Thumb dark: `rgba(255, 255, 255, 0.10)`, hover `0.18`
- Border-radius: 10px

### 15.8 Custom CSS classes (`@layer components` in `index.css`)

```css
.material-card        → bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md transition-all duration-200
.material-button-primary → bg-primary-600 hover:bg-primary-700 dark:bg-primary-600 dark:hover:bg-primary-500 text-white font-semibold px-6 py-3 rounded-lg shadow-glow-primary hover:shadow-glow-primary-lg focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-all duration-200
.material-input       → w-full px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400 transition-all duration-150
```

### 15.9 FullCalendar dark mode styling

Custom CSS variables in `.employee-agenda-calendar .fc` voor light/dark mode (border-color, today-bg, now-indicator, page-bg, neutral-bg, list-event-hover). Buttons en titel kleurcorrecties in dark mode. Event-styling: `border-radius: 0.375rem`, padding `1px 4px`, font-size 0.75rem.

---

## 16. Theme Color Presets (`src/utils/themeColors.ts`)

15 presets via `applyThemeColor(preset)`:

| Preset | Primary | Dark | Light |
|---|---|---|---|
| blue | `#3B82F6` | `#1E40AF` | `#DBEAFE` |
| indigo | `#6366F1` | `#4338CA` | `#E0E7FF` |
| purple | `#A855F7` | `#7E22CE` | `#F3E8FF` |
| pink | `#EC4899` | `#BE185D` | `#FCE7F3` |
| rose | `#F43F5E` | `#BE123C` | `#FFE4E6` |
| red | `#EF4444` | `#B91C1C` | `#FEE2E2` |
| orange | `#F97316` | `#C2410C` | `#FFEDD5` |
| amber | `#F59E0B` | `#B45309` | `#FEF3C7` |
| yellow | `#EAB308` | `#A16207` | `#FEF9C3` |
| lime | `#84CC16` | `#4D7C0F` | `#ECFCCB` |
| green | `#22C55E` | `#15803D` | `#DCFCE7` |
| emerald | `#10B981` | `#047857` | `#D1FAE5` |
| teal | `#14B8A6` | `#0F766E` | `#CCFBF1` |
| cyan | `#06B6D4` | `#0E7490` | `#CFFAFE` |
| sky | `#0EA5E9` | `#0369A1` | `#E0F2FE` |

Default: blue. `applyThemeColor()` injecteert CSS overrides voor alle `primary-*` Tailwind classes (bg, text, border, ring, gradient).

---

## 17. PWA Manifest (`public/manifest.json`)

```json
{
  "name": "FLG-Administratie",
  "short_name": "FLG",
  "description": "Complete HR & Administratie Management System",
  "start_url": "/login",
  "display": "standalone",
  "background_color": "#fdf8f3",
  "theme_color": "#cd853f",
  "orientation": "portrait-primary",
  "icons": [
    { "src": "/Logo-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
    { "src": "/Logo-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
    { "src": "/Logo-192-maskable.png", "sizes": "192x192", "type": "image/png", "purpose": "maskable" },
    { "src": "/Logo-512-maskable.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ],
  "categories": ["business", "productivity"],
  "lang": "nl",
  "dir": "ltr",
  "scope": "/",
  "prefer_related_applications": false
}
```

---

## 18. index.html

- Title: **FLG-Administratie - Administratiesoftware**
- Lang: `nl`
- Theme color: `#cd853f` (bronze)
- Favicon + apple-touch-icon: `/Logo.png`
- PWA meta:
  - `mobile-web-app-capable: yes`
  - `apple-mobile-web-app-capable: yes`
  - `apple-mobile-web-app-status-bar-style: black-translucent`
  - `apple-mobile-web-app-title: FLG-Administratie`
- Service worker registration inline script:
  - Registreert `/service-worker.js`
  - Bij `updatefound` + nieuwe SW `installed` met active controller → dispatch `swUpdateAvailable` custom event → React `AppUpdateModal` toont prompt
- Geen Google Fonts `<link>` — Inter via Tailwind font-family fallback

---

## 19. Make.com Integraties

| Scenario | Webhook URL | Trigger | Doel | Bestand |
|---|---|---|---|---|
| **ITKnecht Uren Import** | `https://hook.eu2.make.com/wh18u8c7x989zoakqxqmomjoy2cpfd3b` | HTTP POST | Uren ophalen uit ITKnecht per monteur/week | `services/itknechtService.ts`, `pages/Timesheets.tsx` |
| **ITKnecht Factuur Data** | `https://hook.eu2.make.com/223n5535ioeop4mjrooygys09al7c2ib` | HTTP POST | Factuurdata ophalen per week | `services/itknechtFactuurService.ts` |
| **Uitgaande Facturen** | `https://hook.eu2.make.com/ttdixmxlu9n7rvbnxgfomilht2ihllc2` | HTTP POST | Factuurgegevens versturen voor verwerking | `pages/OutgoingInvoices.tsx` |
| **Productie Import** | `https://hook.eu2.make.com/qmvow9qbpesofmm9p8srgvck550i7xr6` | HTTP POST | Productiedata importeren (monteur, uren, locaties, klant) | `pages/ProjectProduction.tsx` |
| **Inkomende Factuur — Betaal-trigger** | `https://hook.eu2.make.com/8jntdat5emrvrcfgoq7giviwvtjx9nwt` | HTTP POST | "Markeer als betaald" workflow | `pages/IncomingInvoicesStats.tsx` |
| **Inkomende Factuur — Email Fetch** | `https://hook.eu2.make.com/sphpptl7j3x0aadqjidzb5r17uatkr5b` | HTTP POST | Facturen ophalen uit email-postvak | `pages/IncomingInvoicesStats.tsx` |

**Payload-patronen:**

```jsonc
// ITKnecht Uren
{ "action": "get_hours_data", "monteur": "Naam", "week": 10, "year": 2026, "companyId": "..." }

// ITKnecht Factuur
{ "action": "get_factuur_data", "week": 10, "year": 2026, "companyId": "..." }

// Productie
{ "action": "get_production_data", "week": 10, "year": 2026, "companyId": "...", "employee": { ... } }

// Inkomende factuur paid
{ "action": "invoice_paid", "timestamp": "...", "invoice": { ... }, "company": { ... }, "user": { ... } }

// Email fetch
{ "action": "fetch_invoices_from_email", "timestamp": "...", "company": { ... }, "user": { ... } }
```

**Callback (Make → app):**
Make.com kan POST naar Netlify Function `/.netlify/functions/invoice-delivery-callback` (of `/api/invoice-delivery-callback`) met body `{ invoiceId, status: 'delivered'|'failed', secret?, error? }` → update `outgoingInvoices/{invoiceId}.deliveryStatus`. Optionele `DELIVERY_CALLBACK_SECRET` env-var validatie.

---

## 20. PHP Proxy / Eigen Host (internedata.nl)

Host: **https://internedata.nl** — vervangt Firebase Storage en omzeilt CORS, verbergt Anthropic API keys.

| Endpoint | Methode | Gebruikt door | Doel |
|---|---|---|---|
| `/proxy2.php` | POST | `services/fileUploadService.ts` | **Hoofd** file upload. Recursieve folder-aanmaak voor `FLG-Administratie/{CompanyName}/{Verkoop\|Inkoop\|Post\|Loonstroken}/{year}/`. Returns `{ fileUrl, storagePath }`. NIET in `public/` — draait op de host. |
| `/proxy3.php` | POST | (legacy) | Upload naar `uploads/FLG-Administratie/{companyFolder}/Post/inkomend/`. Returns `{ success, url, path }`. Aanwezig in `public/` voor referentie. |
| `/claude-vision-ocr.php` | POST | `services/ocrService.ts` | OCR via Claude Vision. Accepteert `fileBase64` + `fileMediaType` of `fileUrl`. Memory 256M, max-exec 120s. API key embedded (productie). |
| `/fcm-send.php` | GET / POST | `services/notificationService.ts`, `components/notifications/PushDiagnostics.tsx` | **GET** = health check (oauthOk, firestoreOk, projectId). **POST** = multicast FCM push. Self-contained: leest tokens uit `users/{uid}/fcmTokens` (3 fallback strategies), gebruikt FCM HTTP v1, ruimt dode tokens op. Allowed origins: `https://app.fl-group.org`, `localhost:5173/3000`. Service account embedded via NOWDOC. Project ID: `alloon`. |

---

## 21. Netlify Functions (`netlify/functions/`)

| Function | Type | Endpoint | Doel | Env vars |
|---|---|---|---|---|
| `_lib/firebaseAdmin.ts` | helper | — | Firebase Admin SDK singleton. Exports: `getAdmin()`, `getDb()`, `getMessaging()`, `getAuthAdmin()` | `FIREBASE_SERVICE_ACCOUNT_JSON` |
| `_lib/push.ts` | helper | — | `sendPushToUsers(uids, payload)` — leest `users/{uid}/fcmTokens`, FCM multicast (chunks van 500), opruimt dode tokens. Returns `{ sent, failed, deletedTokens }` | — |
| `claude-ocr.ts` | HTTP | `/.netlify/functions/claude-ocr` (POST) | Tekst-OCR via Claude API. Body: `{ ocrText }`. Returns invoice JSON | `ANTHROPIC_API_KEY` |
| `claude-vision-ocr.ts` | HTTP | `/.netlify/functions/claude-vision-ocr` (POST) | Vision OCR voor PDF/JPEG/PNG/WebP/GIF. Body: `{ fileUrl? \| fileBase64?, fileMediaType }`. Returns invoice JSON | `ANTHROPIC_API_KEY` |
| `send-push.ts` | HTTP | `/.netlify/functions/send-push` (POST) | Bearer-authed FCM push. Body: `{ userIds, title, body, url?, taskId?, category? }`. Returns `{ ok, sent, failed, deletedTokens }` | `FIREBASE_SERVICE_ACCOUNT_JSON` |
| `scheduled-task-reminders.ts` | Scheduled | Cron `*/15 * * * *` | Stuurt push 1u voor `dueDate` van pending/in_progress tasks. Markeert `reminderSentAt` om duplicates te voorkomen | `FIREBASE_SERVICE_ACCOUNT_JSON` |
| `invoice-delivery-callback.ts` | HTTP | `/.netlify/functions/invoice-delivery-callback` (POST) | Webhook voor Make.com → zet `outgoingInvoices/{invoiceId}.deliveryStatus` | `FIREBASE_SERVICE_ACCOUNT_JSON`, `DELIVERY_CALLBACK_SECRET` (optional) |

### netlify.toml

```toml
[build]
command = "npx vite build"
publish = "dist"
functions = "netlify/functions"

[build.environment]
NODE_VERSION = "18"
SECRETS_SCAN_SMART_DETECTION_ENABLED = "false"

[functions]
node_bundler = "esbuild"

[[redirects]]
from = "/api/*"
to = "/.netlify/functions/:splat"
status = 200

[[redirects]]
from = "/*"
to = "/index.html"
status = 200
```

`/api/*` → functions proxy. `/*` → SPA fallback naar `index.html`.

---

## 22. Firestore Collecties

**Top-level collecties:**

| Collectie | Doel |
|---|---|
| `users` | User profielen + role |
| `userSettings` | Dark mode, themeColor, primaryAdminUserId (co-admin), bottomNavItems[companyId] |
| `users/{uid}/fcmTokens` | FCM device tokens (subcollectie) |
| `companies` | Bedrijven (employer/project/holding/shareholder/investor) |
| `branches` | Vestigingen per bedrijf |
| `employees` | Werknemers (multi-company via `projectCompanies[]`) |
| `weeklyTimesheets` | Wekelijkse urenstaten (gap-enforced) |
| `timeEntries` | Individuele dag-entries |
| `internalProjects` | Niet-billable project codes |
| `leaveRequests` | Verlofaanvragen |
| `leaveBalances` | Saldi per medewerker per jaar |
| `sickLeave` | Ziekmeldingen + Poortwachter milestones |
| `absenceStatistics` | Geaggregeerde verzuim-stats |
| `expenses` | Declaraties |
| `payrollPeriods` | Loontijdvakken |
| `payrollCalculations` | Loonberekeningen per werknemer per periode |
| `payslips` | Loonstroken (draft/approved/paid) |
| `hourlyRates`, `allowances`, `deductions` | Loon-componenten config |
| `outgoingInvoices` | Uitgaande facturen |
| `outgoingInvoiceCounters` | Counter docs voor factuurnummering |
| `incomingInvoices` | Inkomende facturen (OCR) |
| `invoiceArchives` | 90+ dagen onbetaalde facturen archief |
| `companies/{id}/counters/incomingInvoices` | Counter doc voor `INK-YYYY-####` |
| `incomingPost` | Digitale postverwerking |
| `invoiceRelations` | Klant/leverancier-relaties |
| `suppliers` | Leverancier master + cumulatieve bedragen |
| `crediteuren`, `debiteuren` | Ouderdomsoverzicht aged accounts |
| `bankImports` | Batch-uploads bankafschriften |
| `bankTransactions` | Geparste transacties |
| `bankMatchRules` | Geleerde IBAN/naam → grootboekrekening mappings |
| `matchedPayments` | Bevestigde transactie ↔ factuur koppelingen |
| `budgetItems` | Begrotingsposten |
| `productionWeeks` | Productiedata per week |
| `businessTasks` | Weekelijkse taken |
| `notifications` | In-app notificaties |
| `notificationPreferences` | Per-user notificatie-instellingen + quiet hours |
| `chats` | Admin ↔ boekhouder chats |
| `chats/{id}/messages` | Chat-berichten (subcollectie) |
| `microsoftConnections` | Outlook OAuth-koppelingen |
| `auditLogs` | Audit trail met checksum |
| `complianceReports` | Compliance reports |
| `auditExports` | Audit log exports |
| `exportJobs` | Async export jobs (CSV/XML/PDF) |
| `roles` | Custom role definities |
| `temporaryCredentials` | Tijdelijke credentials |
| `investmentPitches` | Investment pitch content |
| `grootboekrekeningen` | Rekeningschema per bedrijf |

**Namespace:** Alle entiteit-data wordt geschreven onder de admin's `userId` (multi-tenant). Co-admin queries gebruiken `primaryAdminUserId` om dezelfde data te zien.

---

## 23. Service Worker (`public/service-worker.js`)

- **Cache name**: `flg-admin-v3.1.1.1.1.1.1.1.1.1.1.1.1.1` (zeer specifieke versioning)
- **Pre-cached URLs**: `/`, `/Logo.png`, `/manifest.json`, `/index.html`
- **Strategy**: Cache-first voor GET-requests, fallback naar netwerk

**Events:**

1. **install** — Open cache, add pre-cached URLs
2. **activate** — Cleanup oude caches, `clients.claim()`
3. **fetch** — Cache-first
4. **message (`SKIP_WAITING`)** — Triggert nieuwe SW activatie (gebruikt door `AppUpdateModal`)
5. **FCM `onBackgroundMessage`** — Toont notification via `self.registration.showNotification(title, { body, icon, badge, tag, data: { url, taskId, category } })`
6. **notificationclick** — Extract `notification.data.url`, focus bestaande window of `openWindow()`, sluit notificatie

**Firebase compat SDK** (geladen via CDN):
- `https://www.gstatic.com/firebasejs/12.3.0/firebase-app-compat.js`
- `https://www.gstatic.com/firebasejs/12.3.0/firebase-messaging-compat.js`

---

## 24. Coding Regels voor dit Project

Claude Code houdt zich ALTIJD aan deze regels.

### Verplicht

- Gebruik altijd `fetch`, **nooit `axios`**.
- Componenten zijn altijd **functional components met hooks**.
- **TypeScript** — vermijd `any` waar mogelijk.
- CSS via **Tailwind utility classes** — geen inline styles, geen aparte CSS-bestanden behalve `index.css`.
- Formulieren via **React Hook Form + Yup validatie**.
- Database: **uitsluitend Firebase Firestore** — NOOIT Supabase of andere DB's.
- Alle data opgeslagen onder `users/{adminUserId}/`-namespace in Firestore (multi-tenant).
- Iconen: **Lucide React**.
- **Dark mode support** in alle componenten (`dark:` prefix).
- **Nederlandse UI teksten** (labels, meldingen, buttons).
- **Audit logging** via `auditService` bij elke Firestore write.
- **Bestandsuploads** uitsluitend via internedata.nl proxy2.php — NIET via Firebase Storage.
- **Push** via `fcm-send.php` (primair) of Netlify Function (fallback).

### Verboden

- Geen Next.js — dit is een Vite SPA.
- Geen Supabase — uitsluitend Firebase/Firestore.
- Geen nieuwe npm packages zonder overleg.
- Geen `console.log` in productie code (alleen `console.error` voor errors).
- Geen directe Firestore writes zonder audit logging.
- Geen hardcoded API keys in frontend code (gebruik env vars of PHP proxy).
- Geen Firebase Storage — vervangen door internedata.nl proxy2.php.

### Naamgeving

- Componenten: PascalCase (`EmployeeModal.tsx`)
- Functies/variabelen: camelCase
- Services/utils: camelCase bestandsnamen (`firebase.ts`, `outgoingInvoiceService.ts`)
- Pages: PascalCase bestandsnamen (`Dashboard.tsx`)
- Types/Interfaces: PascalCase (`Company`, `Employee`)
- CSS classes: Tailwind utility classes (geen BEM, geen modules)

---

## 25. Build & Dev

### Scripts (`package.json`)

```bash
npm run dev        # Vite dev server (port 5173)
npm run build      # Productie build (output: dist/)
npm run lint       # ESLint
npm run preview    # Preview productie build
npm run typecheck  # tsc --noEmit -p tsconfig.app.json
```

### Vite (`vite.config.ts`)

- Plugin: `@vitejs/plugin-react`
- `optimizeDeps.exclude: ['lucide-react']` (bundling issue)
- Public dir: `public`
- Build:
  - `outDir: 'dist'`, `assetsDir: 'assets'`, `copyPublicDir: true`
  - Manual chunks: `react-vendor` = `react`, `react-dom`, `react-router-dom`
- Dev server: `Cache-Control: no-cache` headers

### TypeScript (`tsconfig.app.json`)

- Target: ES2020
- Strict mode aan
- Géén path aliases (alle imports relatief)

---

## 26. Environment Variables

### Frontend (`.env`, Vite `VITE_*` prefix)

```bash
VITE_FIREBASE_API_KEY=...                    # Default fallback: AIzaSyBAC-tl3pCXeUwGlw13tW2-vpwgsG9_jiI
VITE_FIREBASE_AUTH_DOMAIN=...                # Default: alloon.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=...                 # Default: alloon
VITE_FIREBASE_STORAGE_BUCKET=...             # Default: alloon.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=...        # Default: 896567545879
VITE_FIREBASE_APP_ID=...                     # Default: 1:896567545879:web:1ebbf02a7a8ac1c7d50c52
VITE_FIREBASE_MEASUREMENT_ID=...             # Default: G-Y1R80QE0XN
VITE_FIREBASE_VAPID_KEY=...                  # FCM public VAPID key (zie sectie 5.19)
VITE_MICROSOFT_CLIENT_ID=...                 # Azure AD app ID (MSAL Microsoft Graph)
```

### Backend / Netlify Functions

```bash
ANTHROPIC_API_KEY=...                        # Claude API (claude-ocr.ts, claude-vision-ocr.ts)
FIREBASE_SERVICE_ACCOUNT_JSON=...            # Volledige service account JSON als 1 string
DELIVERY_CALLBACK_SECRET=...                 # Optional shared secret voor Make.com callback
```

### Nooit committen

- Echte API keys, secrets, service account JSON
- `.env`, `.env.local`, `.env.production`
- Firebase service account key files

---

## 27. Hardcoded fallback waarden — let op!

Voor lokale ontwikkeling zonder env vars heeft de codebase enkele hardcoded fallbacks:

- `src/lib/firebase.ts` — alle Firebase config velden hebben een hardcoded fallback (zie sectie 26).
- `src/utils/firebaseAuth.ts`:
  - Hardcoded API key fallback: `AIzaSyBAC-tl3pCXeUwGlw13tW2-vpwgsG9_jiI`
  - Hardcoded default password voor employee-creation: **`DeInstallatie1234!!`**
- `src/lib/messaging.ts` — VAPID public key embedded.
- `public/fcm-send.php` — Firebase service account JSON embedded via NOWDOC.
- `public/claude-vision-ocr.php` — placeholder `API_KEY = 'JOUW-ANTHROPIC-API-KEY-HIER'` (productie-key gezet op host).
- Make.com webhook URLs hardcoded in services en pages (zie sectie 19) — moeten naar env vars.

---

## 28. Bekende Issues / TODO

- [ ] Firebase config bevat hardcoded fallback waarden in `src/lib/firebase.ts` — zou volledig op env vars moeten draaien
- [ ] `src/components/sedy6Ka59` — leeg/ongeldig bestand (0 bytes), opruimen
- [ ] `src/types/statistics.types` — mist `.ts` extensie (zou `statistics.types.ts` moeten zijn)
- [ ] TypeScript `any` wordt nog op meerdere plekken gebruikt
- [ ] Make.com webhook URLs staan hardcoded in services/pages — beter via env vars
- [ ] `package.json` heet nog `vite-react-typescript-starter` v0.0.0 — zou hernoemd moeten worden naar `flg-administratie`
- [ ] Hardcoded default password `DeInstallatie1234!!` in `utils/firebaseAuth.ts` — onveilig, moet random gegenereerd worden bij user-creation
- [ ] `utils/firebase-storage-helper.ts` is dead code (Firebase Storage is uitgefaseerd)
- [ ] Twee `taxReturnGenerator` bestanden (`services/` + `utils/`) — consolideren
- [ ] `claude-vision-ocr.php` bevat placeholder API key in source — wisselen naar `getenv()`

---

## 29. SandeDesign Ecosysteem Context

| Project | Doel | Relatie tot FLG |
|---|---|---|
| **Facto** | Facturatie voor freelancers | Los project, geen directe koppeling |
| **Bindra** | Contract signing | Los project |
| **Uitgaaf** | Budgettering | Los project |
| **Agendi** | Planning/agenda | Los project |
| **Vlottr** | Auto verhuur Limburg | Los project |

**Gedeelde patronen binnen SandeDesign:**

- Make.com als automation laag (webhook integraties)
- PHP proxy op `internedata.nl` voor server-side calls + bestandsopslag
- React + TypeScript + Vite als frontend standaard
- Firebase (Firestore, Auth, FCM) als backend standaard
- Tailwind CSS als styling
- Netlify als hosting (frontend + functions)
- Zelfde GitHub organisatie: **SandeDesign**

---

*Gegenereerd via grondige codebase-analyse — SandeDesign*
*Branch: `claude/update-claude-docs-IoWFY`*
