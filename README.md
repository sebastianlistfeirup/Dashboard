# Udsendelsesdashboard — Dansk Psykolog Forening

Overblik over alt, DP sender fra Ungapped: e-mail, sms og spørgeskemaer. Data
hentes direkte fra Ungapped-API'et hver time, aggregeres, og vises i ét
dashboard, der følger DP's designmanual.

**To udgaver af samme dashboard:**

| | Offentlig | Privat |
|---|---|---|
| Hvor | GitHub Pages | Én HTML-fil |
| Opdatering | Automatisk hver time | Fast øjebliksbillede |
| Data | Kun aggregerede tal | Samme aggregerede tal |
| Deling | Send linket | Send filen, læg den på intranettet |

Den private fil ligger som **artifact** på hver kørsel af `Sync Ungapped data`
under fanen Actions. Den er selvstændig: ingen server, ingen netværk, virker
offline.

Offentlig URL: **https://sebastianlistfeirup.github.io/Dashboard/**

## To sider

**Dashboardet** (forsiden) er det modulære arbejdsredskab: filtre, alle
udsendelser, alle opdelinger.

**Ledelsessiden** (`#/ledelse`) er én side til ledergruppen. Den viser kun de
moduler, I selv har valgt. Hvert modul i dashboardet har en knap — *Til
ledelsen* — der lægger det på siden; på ledelsessiden kan rækkefølgen ændres og
overskriften rettes. Siden er sat op til at blive printet: A4, ingen knapper på
papiret, og ingen moduler der brækkes over en sideskift. Dens grafer tegnes ved
indlæsning i stedet for ved scroll, så en udskrift ikke kan ende med en tom
graf.

Valgene gemmes i din browser med det samme. Vil de gælde for alle, hentes de
som JSON under *Tilpas siden* og lægges ind i `config/dashboard.json`.

## Hvad man kan

| | Hvad det svarer på |
|---|---|
| **Månedens tekst** | Måneden skrevet ud i prosa, ud fra de samme tal som graferne |
| **Mål og status** | Hvor langt vi er fra det, vi har sat os for. Målene sættes i browseren eller i `config/dashboard.json` |
| **Sammenlignet med andre** | DP mod foreningsbenchmark, med kilde og år på kortet |
| **Alarmer** | Udsendelser der falder markant udenfor. Tærskler i konfigurationen |
| **Årshjul** | Hele året i én figur — vinkel er datoen, afstand fra midten er åbningsraten, størrelse er modtagere. To år kan lægges oven på hinanden |
| **Sammenlign** | To perioder, eller to udsendelser side om side ned til emnelinje, længde og afsendetidspunkt |
| **Emnelinje-tester** | Skriv en emnelinje og se, hvad DP's egne tal siger. Kun mønstre der har nok udsendelser bag sig tæller med |
| **Krydstabel** | Engagement på to medlemsdimensioner samtidig |
| **Onboarding over tid** | Om nye årgange engagerer sig som de tidligere, målt fra indmeldelsen |
| **Genaktivering** | De sovende medlemmer, hvad de koster, og fem konkrete træk |
| **Afsendernavne** | Om det betyder noget, hvem mailen kommer fra |
| **Noter på tidslinjen** | Skriv hvad der skete den måned, så en kurve har sin forklaring ved siden af sig |

### Ugebrevet sender ikke selv

Under *Ugebrev* på ledelsessiden skrives et brev til ledergruppen — og et
alarmvarsel, hvis der er noget at varsle — ud fra de nyeste tal. **Siden sender
ingenting.** Et statisk site har ingen mailserver, og en mail til ledergruppen
skal ikke kunne udløses af, at nogen åbner et dashboard. Teksten vises, kopieres
og sendes af et menneske. Skal den sendes automatisk en dag, ligger den færdig
i `src/lib/report.ts` og kan lægges ind i timekørslen.

## Kom i gang lokalt

```bash
npm install
npm run dev        # udviklingsserver
npm run build      # produktion → dist/
UNGAPPED_API_KEY=… npm run sync   # hent friske data selv
```

## Sådan hænger det sammen

```
Ungapped API ──► scripts/ungapped-sync.mjs ──► public/data/dashboard.json ──► React-app
   (hver time, på en GitHub-runner)              (aggregeret, uden persondata)
```

- `scripts/ungapped-sync.mjs` — henter og aggregerer. Kun GET-kald; den kan
  ikke ændre noget i Ungapped.
- `scripts/lib/analyse.mjs` — al beregning: typer, tendenser, tidspunkter,
  emnelinjer, indhold, modtagere, segmenter.
- `scripts/lib/findings.mjs` — de automatiske indsigter.
- `scripts/lib/insights.mjs` — mål, benchmark, kohorter, afsendere, alarmer,
  genaktivering og månedens tekst.
- `scripts/lib/crosstab.mjs` — krydstabellen. Kun celler med mindst 25 personer
  forlader funktionen.
- `config/dashboard.json` — **de fælles indstillinger**: mål, benchmark-kilder,
  alarmtærskler, noter og hvilke moduler ledelsessiden viser. Ret filen her, så
  gælder ændringen for alle.
- `scripts/lib/types.mjs` — hvilke Ungapped-tags der hører til hvilken
  udsendelsestype. **Her tilføjer du en ny type.**
- `src/design/tokens.ts` — designmanualen oversat til kode.

Kortlægningen af API'et ligger i `docs/api-map/` — 244 operationer, deres
parametre, og de svarformer statistikendpointsene faktisk returnerer (dem er
der ingen dokumentation for).

## Privatliv

Repoet er offentligt, så den publicerede fil må ikke indeholde en person.

- Kontakter **læses** — det er den eneste måde at kende medlemsprofilen på —
  men hver kontakt reduceres til ikke-identificerende træk med det samme.
  Navn, e-mail, adresse og kontakt-id forlader aldrig hentetrinnet.
- Grupper under **fem personer** lægges sammen i en "andre"-række, så en lille
  gruppe ikke kan udpeges.
- Fritekst, hvor en modtager kan have skrevet noget — sms-tekster og
  udmeldelsesgrunde — får maskeret alt, der ligner en e-mail eller et
  telefonnummer.
- Til sidst gennemgår kørslen sit eget output og **afbryder**, hvis der
  alligevel står noget personhenførbart. Det er sket to gange under
  udviklingen; begge gange var det rigtigt at stoppe.

DP's egen afsenderadresse og sms-afsendernummer er organisationsoplysninger og
er undtaget — de er navngivet felt for felt, ikke ved et generelt hul.

## Hvad tallene tåler

Et dashboard, der siger noget forkert med sikkerhed, er værre end ingenting.
To regler bærer analysen:

1. **En gruppe skal have volumen, før den må udtale sig** — mindst fire
   udsendelser og 20.000 leverede mails. Uden den regel "beviste" elleve
   personaliserede velkomstmails til 2.075 modtagere, at personalisering løfter
   åbningsraten 25 procentpoint. Det gør den ikke; små, målrettede mails åbnes
   bare altid mere.
2. **Flow-mails tælles ikke med i tidspunktsanalysen** — de udløses af, hvornår
   et medlem melder sig ind, så deres afsendelsestidspunkt er ikke en
   beslutning, nogen har truffet.

Grupper, der ikke består, vises stadig i graferne, men i en lys tone og med en
note om hvorfor. De indgår ikke i konklusionerne.

## Kendte begrænsninger

- **Klik måles pr. udsendelse, ikke pr. link.** Ungapped-API'et rapporterer
  ikke klik på det enkelte link, så "sider der trækker klik" viser
  destinationer, der optræder i udsendelser med høj klikrate — ikke at netop
  det link blev klikket.
- **Engagement pr. person hviler på en stikprøve** på 2.000 af de 17.441 aktive
  kontakter. Et opslag pr. person er ét API-kald, og hele bestanden ville tage
  timer. Stikprøven er den samme fra gang til gang (kontakterne sorteres efter
  en hashværdi af deres id), så bevægelse i tallene er adfærd og ikke støj.
- **20 % af udsendelserne har ingen type-tag** i Ungapped. De tælles med i
  totalerne, men falder ud af sammenligninger mellem typer. Sæt en tag ved
  oprettelsen, så bliver dashboardet skarpere af sig selv.
- **Kontingentgruppen har intet eget felt.** Den udledes af "Medlemskab", hvor
  status står blandet med sektion og geografi. Hvis DP rydder op i det felt,
  bliver den analyse mere præcis.
- **Åbningsrater er altid underdrivelser.** Apple Mail Privacy Protection og
  lignende blokerer sporingspixlen for en del modtagere. Tallene er
  sammenlignelige med hinanden, men ikke et facit for, hvor mange der læste.
