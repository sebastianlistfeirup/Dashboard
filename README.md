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

## Sådan tændes den offentlige URL

Pages er ikke slået til endnu, så deploy-trinnet springes over. Ét klik retter
det:

**Settings → Pages → Build and deployment → Source: GitHub Actions**

Næste kørsel deployer automatisk, og URL'en står i kørslens opsummering.

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
