export type InspectionTemplateRoom = {
  name: string;
  code: string;
  checkpoints: Array<{ category: string; title: string; guidance?: string }>;
};

const surfaces = [
  "Riper, hakk eller skader",
  "Malingsfeil, sparkelskjøter eller sprekker",
  "Lister, skjøter og karmer",
  "Vindusglass og karmer uten riper"
];

const openings = ["Åpne og lukke uten subbing", "Skjevhet, låser, håndtak og pakninger"];
const floors = ["Knirk eller svikt", "Ujevnheter, skjøter, skader og planhet"];

const standardRoom = (name: string, code: string): InspectionTemplateRoom => ({
  name,
  code,
  checkpoints: [
    ...surfaces.map((title) => ({ category: "Overflater", title })),
    ...openings.map((title) => ({ category: "Dører og vinduer", title })),
    ...floors.map((title) => ({ category: "Gulv", title }))
  ]
});

export const ballerudInspectionTemplate: InspectionTemplateRoom[] = [
  {
    ...standardRoom("Gang", "GANG"),
    checkpoints: [
      ...standardRoom("Gang", "GANG").checkpoints,
      { category: "Elektro", title: "Downlights i gang 2. etasje og lysdemper" },
      { category: "Elektro", title: "Stikk, brytere og lampepunkter" }
    ]
  },
  {
    ...standardRoom("WC", "WC"),
    checkpoints: [
      { category: "Bad og WC", title: "Fall mot sluk og ingen vannansamling", guidance: "Spre litt vann pa gulvet. Vannet skal renne mot sluket uten a bli staende i pytter. Kontroller ogsa ved dor, vegg og i dusjsonen." },
      { category: "Bad og WC", title: "Fliser, fuging, silikon og sluk" },
      { category: "Bad og WC", title: "Vikingbad Ciba toalett og Riva 50 servant" },
      { category: "Bad og WC", title: "Tapwell VIC071 servantbatteri og DUO112 betjeningsplate" },
      { category: "Elektro", title: "Rundt speil med LED-belysning" }
    ]
  },
  {
    ...standardRoom("Kjøkken", "KJ"),
    checkpoints: [
      { category: "Kjøkken", title: "Fronter, spalter, skuffer og soft-close" },
      { category: "Kjøkken", title: "Benkeplate Silestone Et Calacatta Gold 20 mm og skjøter" },
      { category: "Kjøkken", title: "Blanco Andano 500-U vask og lekkasjer" },
      { category: "Kjøkken", title: "Kjokkenbatteri Arm887 Brushed Nickel med uttrekk", guidance: "Kontroller at riktig modell og overflate er levert. Test uttrekk, svingradius, kaldt/varmt vann og at det ikke lekker i skapet under vasken." },
      { category: "Kjøkken", title: "Integrerte hvitevarer og korrekt modell", guidance: "Sammenhold med bestilling. Kontroller fronter, spalter, innfesting, funksjon og at mikro har egen kurs som avtalt." },
      { category: "Kjøkken", title: "Røros Slide Sense 80 ventilator og betjening" },
      { category: "Kjøkken", title: "Kontroller at Evoline Backflip er levert i korrekt bestilt utførelse/modell" },
      { category: "Elektro", title: "Downlights, dimmere, stikk og egen kurs til mikro" },
      { category: "Flis", title: "Kit-Kat Milk kjøkkenvegg, fug og utførelse" }
    ]
  },
  {
    ...standardRoom("Stue", "STUE"),
    checkpoints: [
      ...standardRoom("Stue", "STUE").checkpoints,
      { category: "Elektro", title: "Downlights i stue og lysdempere" },
      { category: "Elektro", title: "Lampepunkt over spisebord" }
    ]
  },
  {
    ...standardRoom("Trapp og under trapp", "TRAPP"),
    checkpoints: [
      { category: "Trapp", title: "Knirk, skader, trinn, overflate og skjevheter" },
      { category: "Trapp", title: "Rekkverk, spiler og håndløper i eik" },
      { category: "Under trapp", title: "Registrer total bredde, maks/min høyde og dybde" },
      { category: "Under trapp", title: "Registrer trappevinkel, veggplassering og stikk" }
    ]
  },
  standardRoom("Soverom 1", "SOV1"),
  standardRoom("Soverom 2", "SOV2"),
  standardRoom("Soverom 3", "SOV3"),
  standardRoom("Soverom 4", "SOV4"),
  {
    ...standardRoom("Bod 2. etasje", "BOD2"),
    checkpoints: [
      { category: "Bod", title: "Gulv, vegger, tak og lister uten skader" },
      { category: "Bod", title: "Dor, karm og handtak fungerer uten subbing" },
      { category: "Bod", title: "Ventilasjon, fukt og eventuelle stikk" }
    ]
  },
  {
    ...standardRoom("Bad soverom 2", "BAD2"),
    checkpoints: [
      { category: "Bad", title: "Fall mot sluk og ingen vannansamling", guidance: "Spre litt vann pa gulvet. Vannet skal renne mot sluket uten a bli staende i pytter. Kontroller ogsa ved dor, vegg og i dusjsonen." },
      { category: "Bad", title: "Fliser, fuging, silikon, sluk og rorgjennomforinger" },
      { category: "Bad", title: "Dusj, servant, toalett, blandebatteri og lekkasjer", guidance: "Apne kaldt og varmt vann, la det renne noen minutter og kontroller koblinger, skap og gulv for fukt. Spyl toalettet flere ganger." },
      { category: "Bad", title: "Ventilasjon, termostat og gulvvarme" },
      { category: "Elektro", title: "Downlights, speilbelysning og IP-klassifiserte punkter" }
    ]
  },
  {
    ...standardRoom("Gang 2. etasje", "GANG2"),
    checkpoints: [
      ...standardRoom("Gang 2. etasje", "GANG2").checkpoints,
      { category: "Elektro", title: "Downlights, lysdemper, brytere og stikk" },
      { category: "Elektro", title: "Rokdetektor og lampepunkt" }
    ]
  },
  {
    ...standardRoom("Balkong ved soverom 3", "BALKONG"),
    checkpoints: [
      { category: "Utvendig", title: "Balkonggulv, fall og avrenning" },
      { category: "Utvendig", title: "Rekkverk, innfesting og overflater" },
      { category: "Dorer og vinduer", title: "Balkongdor, terskel, karm og tetting" },
      { category: "Elektro", title: "Utebelysning og stikk dersom levert" }
    ]
  },
  {
    ...standardRoom("Bad", "BAD"),
    checkpoints: [
      { category: "Bad", title: "Fall mot sluk, vannansamlinger og stjernekapp i dusjsone", guidance: "Spre litt vann pa gulvet. Vannet skal renne mot sluket uten a bli staende i pytter. Kontroller ogsa ved dor, vegg og i dusjsonen." },
      { category: "Bad", title: "Fliser, fuging, silikon, sluk og rørgjennomføringer" },
      { category: "Bad", title: "Dusj, servant, toalett, blandebatteri og lekkasjer", guidance: "Apne kaldt og varmt vann, la det renne noen minutter og kontroller koblinger, skap og gulv for fukt. Spyl toalettet flere ganger." },
      { category: "Bad", title: "Vannfordelingsskap og rorgjennomforinger", guidance: "Kontroller at skap og rorgjennomforinger er tette, tilgjengelige og uten synlig fukt. Ta bilde av eventuelle avvik." },
      { category: "Bad", title: "Ventilasjon, termostat og gulvvarme" }
    ]
  },
  {
    ...standardRoom("Terrasse", "TERR"),
    checkpoints: [
      { category: "Utvendig", title: "Terrassebord, fall og rekkverk" },
      { category: "Utvendig", title: "Utvendig dør, utebelysning og stikk" }
    ]
  },
  {
    ...standardRoom("Hage og uteområde", "HAGE"),
    checkpoints: [
      { category: "Utvendig", title: "Hage, plen, terrengfall og overvann" },
      { category: "Utvendig", title: "Kummer, port og gjerde" }
    ]
  },
  {
    ...standardRoom("Utvendig og fasade", "FASADE"),
    checkpoints: [
      { category: "Utvendig", title: "Fasade, vinduer, utvendige dører og karmer" },
      { category: "Utvendig", title: "Utekran, utelys og utvendige stikk" }
    ]
  },
  {
    ...standardRoom("Ekstern bod TB-111", "BOD"),
    checkpoints: [
      { category: "Bod", title: "Alle vegglengder, innvendig bredde, dørbredde og takhøyde" },
      { category: "Bod", title: "Strøm, stikk og ventilasjon" },
      { category: "Bod", title: "Fukt, skader, gulv og vegger" }
    ]
  },
  {
    ...standardRoom("Tekniske installasjoner", "TEKN"),
    checkpoints: [
      { category: "Elektro", title: "Sikringsskap, kursfortegnelse, nettverk og antall stikk" },
      { category: "Ventilasjon og varme", title: "Ventiler, luftstrøm, aggregat, filter og betjening", guidance: "Kontroller at aggregatet starter, at filter er montert og at dere far utlevert brukerveiledning og innstillingene." },
      { category: "Ventilasjon og varme", title: "Termostater og gulvvarme" }
    ]
  }
];