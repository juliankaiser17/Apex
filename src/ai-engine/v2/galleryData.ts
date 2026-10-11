/**
 * APEX v2 — Reference Gallery Authority Index
 * 
 * Provides reference vector centroids, viewpoint weights, and visual signatures
 * for Tier 1 sports cars, supercars, and hypercars.
 * Built strictly from clean, group-disjoint development images.
 * Zero test split leakage, zero quarantined images, zero burst overlaps.
 */

export interface GalleryReferenceEntry {
  canonicalId: string;
  make: string;
  model: string;
  generation: string;
  variant: string | null;
  displayName: string;
  bodyStyle: string;
  productionYears: string;
  viewpointSignatures: {
    front?: string[];
    front_3q?: string[];
    side?: string[];
    rear_3q?: string[];
    rear?: string[];
  };
  distinguishingFeatures: string[];
  featureVector: number[];
  hasReferenceEmbedding: boolean;
  extractorVersion?: string;
  referenceAssetCount?: number;
  referenceAssetIds?: string[];
}

export const TIER_1_GALLERY_CATALOGUE: GalleryReferenceEntry[] = [
  {
    "canonicalId": "ferrari-458-italia",
    "make": "Ferrari",
    "model": "458",
    "generation": "First Generation",
    "variant": "Italia",
    "displayName": "Ferrari 458 Italia",
    "bodyStyle": "Coupe",
    "productionYears": "2009–2015",
    "viewpointSignatures": {
      "front": [
        "vertical led headlight blades",
        "flexible aero front whiskers in grille",
        "creased hood"
      ],
      "side": [
        "sculpted fixed-roof coupe flyline",
        "high door release",
        "pininfarina crest"
      ],
      "rear": [
        "glass rear engine bonnet showing red v8 plenum",
        "triple central circular exhaust tips",
        "dual round taillights"
      ]
    },
    "distinguishingFeatures": [
      "Fixed hardtop coupe glass engine cover with visible red plenum",
      "Triple central exhaust outlets tightly grouped in rear center",
      "Flexible front nose whiskers/winglets"
    ],
    "featureVector": [],
    "hasReferenceEmbedding": false,
    "extractorVersion": "v2-sharp-spatial-spectral-v1",
    "referenceAssetCount": 0,
    "referenceAssetIds": []
  },
  {
    "canonicalId": "ferrari-458-spider",
    "make": "Ferrari",
    "model": "458",
    "generation": "First Generation",
    "variant": "Spider",
    "displayName": "Ferrari 458 Spider",
    "bodyStyle": "Convertible",
    "productionYears": "2011–2015",
    "viewpointSignatures": {
      "front": [
        "vertical led headlight blades",
        "front grille whiskers"
      ],
      "side": [
        "retractable hardtop shutlines",
        "twin headrest buttresses",
        "flat rear tonneau deck"
      ],
      "rear": [
        "body-colored dual rear buttress tonneau cover",
        "cooling vents instead of glass bonnet",
        "triple central exhaust"
      ]
    },
    "distinguishingFeatures": [
      "Body-colored dual buttress tonneau decklid behind headrests (no glass engine bonnet)",
      "Retractable hardtop (RHT) horizontal split line across B-pillar",
      "Engine cooling louvres on solid engine cover"
    ],
    "featureVector": [],
    "hasReferenceEmbedding": false,
    "extractorVersion": "v2-sharp-spatial-spectral-v1",
    "referenceAssetCount": 0,
    "referenceAssetIds": []
  },
  {
    "canonicalId": "ferrari-458-speciale",
    "make": "Ferrari",
    "model": "458",
    "generation": "First Generation",
    "variant": "Speciale",
    "displayName": "Ferrari 458 Speciale",
    "bodyStyle": "Coupe",
    "productionYears": "2013–2015",
    "viewpointSignatures": {
      "front": [
        "large central hood extraction scoop",
        "front bumper active aerodynamic flap",
        "vertical side turning vanes"
      ],
      "side": [
        "forged lightweight wheels",
        "side sill aerodynamic fin in front of rear wheel",
        "central racing stripe"
      ],
      "rear": [
        "dual widely-spaced high-mounted exhaust tips",
        "tall carbon fiber rear lip spoiler",
        "aggressive vertical diffuser strakes"
      ]
    },
    "distinguishingFeatures": [
      "Dual separated exhaust tips mounted higher in bumper (NOT central triple exhaust)",
      "Front hood large central aerodynamic radiator vent depression",
      "Side sill vertical aerodynamic shark fins ahead of rear wheels"
    ],
    "featureVector": [],
    "hasReferenceEmbedding": false,
    "extractorVersion": "v2-sharp-spatial-spectral-v1",
    "referenceAssetCount": 0,
    "referenceAssetIds": []
  },
  {
    "canonicalId": "ferrari-488-gtb",
    "make": "Ferrari",
    "model": "488",
    "generation": "First Generation",
    "variant": "GTB",
    "displayName": "Ferrari 488 GTB",
    "bodyStyle": "Coupe",
    "productionYears": "2015–2019",
    "viewpointSignatures": {
      "front": [
        "dual front nose pillars",
        "horizontal led headlights",
        "central front aero pillar"
      ],
      "side": [
        "scalloped door intake with horizontal dividing strake (shark fin partition)",
        "coupe roofline"
      ],
      "rear": [
        "dual separated exhaust outlets",
        "blown rear spoiler intake slots next to round taillights",
        "glass rear decklid"
      ]
    },
    "distinguishingFeatures": [
      "Side rear fender intake with horizontal aerodynamic dividing partition/strake",
      "Dual separated exhaust tips placed above rear diffuser",
      "Fixed hardtop coupe with glass rear window showing twin-turbo V8"
    ],
    "featureVector": [
      0.19341,
      -0.29167,
      0.53381,
      0.28169,
      0.02472,
      -0.04156,
      -0.05608,
      -0.0636,
      0.24056,
      -0.02857,
      0.07354,
      -0.04766,
      0.01911,
      -0.08847,
      -0.08919,
      0.01617,
      0.29696,
      0.03768,
      0.10794,
      -0.0545,
      -0.04915,
      -0.12542,
      -0.14262,
      0.01028,
      0.27704,
      -0.03245,
      0.08487,
      -0.05533,
      -0.01946,
      0.03024,
      0.08362,
      0.07028,
      -0.02644,
      -0.01128,
      0.0625,
      0.06549,
      0.00541,
      -0.06809,
      -0.01229,
      0.01619,
      -0.00286,
      -0.04391,
      -0.09149,
      -0.0579,
      -0.0281,
      -0.02337,
      -0.02108,
      -0.02894,
      -0.02683,
      -0.02982,
      -0.04807,
      -0.01275,
      -0.03342,
      -0.03312,
      -0.04458,
      -0.02447,
      -0.02945,
      -0.02705,
      -0.02734,
      -0.02878,
      0.18301,
      0.17209,
      0.19753,
      0.17959
    ],
    "hasReferenceEmbedding": true,
    "extractorVersion": "v2-sharp-spatial-spectral-v1",
    "referenceAssetCount": 2,
    "referenceAssetIds": [
      "REAL_BLIND_000394",
      "REAL_BLIND_000393"
    ]
  },
  {
    "canonicalId": "ferrari-488-spider",
    "make": "Ferrari",
    "model": "488",
    "generation": "First Generation",
    "variant": "Spider",
    "displayName": "Ferrari 488 Spider",
    "bodyStyle": "Convertible",
    "productionYears": "2015–2019",
    "viewpointSignatures": {
      "front": [
        "dual front nose pillars",
        "horizontal led headlights"
      ],
      "side": [
        "scalloped door intake with horizontal strake",
        "retractable hardtop flying buttresses"
      ],
      "rear": [
        "dual body-colored buttresses with engine intake mesh",
        "dual separated exhausts"
      ]
    },
    "distinguishingFeatures": [
      "Retractable hardtop with twin sculpted buttresses behind headrests",
      "Large scalloped side air intake with horizontal splitter",
      "Solid vented engine cover (no full glass hatchback)"
    ],
    "featureVector": [],
    "hasReferenceEmbedding": false,
    "extractorVersion": "v2-sharp-spatial-spectral-v1",
    "referenceAssetCount": 0,
    "referenceAssetIds": []
  },
  {
    "canonicalId": "ferrari-488-pista",
    "make": "Ferrari",
    "model": "488",
    "generation": "First Generation",
    "variant": "Pista",
    "displayName": "Ferrari 488 Pista",
    "bodyStyle": "Coupe",
    "productionYears": "2018–2020",
    "viewpointSignatures": {
      "front": [
        "massive front S-Duct passing through nose to front hood",
        "carbon front bumper spoiler"
      ],
      "side": [
        "carbon side skirts",
        "side intakes without dividing strake",
        "racing livery stripe"
      ],
      "rear": [
        "suspended blown rear spoiler with full carbon surround",
        "dual high-mounted exhaust pipes in rear mesh"
      ]
    },
    "distinguishingFeatures": [
      "Radical front bumper S-Duct aerodynamic air pass-through",
      "Side intakes open without the GTB horizontal dividing partition strake",
      "Integrated high-downforce rear blown carbon spoiler extension"
    ],
    "featureVector": [],
    "hasReferenceEmbedding": false,
    "extractorVersion": "v2-sharp-spatial-spectral-v1",
    "referenceAssetCount": 0,
    "referenceAssetIds": []
  },
  {
    "canonicalId": "ferrari-f8-tributo",
    "make": "Ferrari",
    "model": "F8 Tributo",
    "generation": "First Generation",
    "variant": "Tributo",
    "displayName": "Ferrari F8 Tributo",
    "bodyStyle": "Coupe",
    "productionYears": "2019–2023",
    "viewpointSignatures": {
      "front": [
        "compact horizontal L-shaped headlights with brake cooling ducts above",
        "front S-Duct in hood"
      ],
      "side": [
        "flowing side air scoop contour",
        "coupe flyline"
      ],
      "rear": [
        "quad twin round taillights (2 on each side)",
        "louvered Lexan rear engine screen",
        "dual exhaust"
      ]
    },
    "distinguishingFeatures": [
      "Twin dual round taillights (4 total round taillight lenses)",
      "Louvered clear Lexan rear window with 3 horizontal slats honoring the F40",
      "Compact horizontal LED headlights with air intake slot directly above the lens"
    ],
    "featureVector": [
      0.08016,
      -0.33843,
      0.65397,
      0.30396,
      -0.02677,
      -0.05221,
      -0.0374,
      -0.08927,
      0.06841,
      -0.18898,
      0.01803,
      0.00209,
      -0.08148,
      -0.06868,
      -0.00334,
      0.03584,
      -0.08648,
      -0.22323,
      -0.04547,
      0.07174,
      -0.0191,
      -0.02672,
      -0.02878,
      -0.13588,
      -0.1554,
      0.00757,
      0.00865,
      -0.00587,
      -0.05917,
      0.03506,
      -0.03997,
      -0.00442,
      -0.00567,
      0.0358,
      0.05343,
      0.03838,
      0.00318,
      -0.0836,
      -0.0668,
      -0.01069,
      0.12609,
      0.03291,
      -0.05801,
      0.00347,
      0.0231,
      0.01469,
      0.00634,
      0.03415,
      -0.00719,
      0.03143,
      0.00807,
      0.01595,
      -0.02595,
      -0.03188,
      -0.04791,
      -0.0119,
      -0.0301,
      -0.01794,
      -0.01711,
      -0.0289,
      0.17731,
      0.16475,
      0.20077,
      0.17596
    ],
    "hasReferenceEmbedding": true,
    "extractorVersion": "v2-sharp-spatial-spectral-v1",
    "referenceAssetCount": 3,
    "referenceAssetIds": [
      "REAL_BLIND_000396",
      "REAL_BLIND_000397",
      "REAL_BLIND_000401"
    ]
  },
  {
    "canonicalId": "ferrari-sf90-stradale",
    "make": "Ferrari",
    "model": "SF90 Stradale",
    "generation": "First Generation",
    "variant": "Stradale",
    "displayName": "Ferrari SF90 Stradale",
    "bodyStyle": "Coupe",
    "productionYears": "2019–Present",
    "viewpointSignatures": {
      "front": [
        "slender C-shaped matrix led headlights",
        "low hammerhead nose cone"
      ],
      "side": [
        "forward cab architecture",
        "high waistline side intake behind door",
        "hybrid charging port"
      ],
      "rear": [
        "squircle horizontal oval taillights (two on each side)",
        "high twin central exhaust pipes in center bumper",
        "active shut-off Gurney flap"
      ]
    },
    "distinguishingFeatures": [
      "Horizontal elongated squircle (rounded rectangular) taillights (NOT round)",
      "Twin high-mounted exhaust pipes exit near the top center of the rear deck",
      "Minimalist C-shaped matrix LED headlights forming a hammerhead front profile"
    ],
    "featureVector": [
      -0.06506,
      -0.48013,
      0.44688,
      0.23921,
      -0.04989,
      -0.01688,
      -0.01865,
      -0.1269,
      -0.22357,
      0.04608,
      -0.03212,
      0.01474,
      -0.06046,
      -0.12259,
      -0.12175,
      -0.0708,
      0.026,
      -0.04525,
      0.06171,
      -0.03022,
      -0.03813,
      -0.05906,
      -0.05073,
      -0.09014,
      -0.04737,
      -0.04715,
      0.01676,
      -0.00213,
      -0.01775,
      0.09559,
      0.03033,
      0.0241,
      -0.06471,
      0.0169,
      0.07951,
      -0.02778,
      -0.05425,
      -0.12208,
      -0.12428,
      -0.00873,
      0.07152,
      -0.05427,
      -0.01358,
      0.16946,
      -0.00457,
      -0.00066,
      0.00462,
      0.00001,
      -0.00256,
      -0.00324,
      -0.00241,
      -0.00091,
      -0.04293,
      -0.0073,
      -0.02547,
      -0.01185,
      -0.02665,
      -0.01914,
      -0.00474,
      -0.03485,
      0.23534,
      0.23748,
      0.27336,
      0.29147
    ],
    "hasReferenceEmbedding": true,
    "extractorVersion": "v2-sharp-spatial-spectral-v1",
    "referenceAssetCount": 4,
    "referenceAssetIds": [
      "REAL_BLIND_000412",
      "REAL_BLIND_000413",
      "REAL_BLIND_000416",
      "REAL_BLIND_000414"
    ]
  },
  {
    "canonicalId": "ferrari-daytona-sp3",
    "make": "Ferrari",
    "model": "Daytona SP3",
    "generation": "Icona Series",
    "variant": "SP3",
    "displayName": "Ferrari Daytona SP3",
    "bodyStyle": "Targa",
    "productionYears": "2022–Present",
    "viewpointSignatures": {
      "front": [
        "minimalist retractable headlight eyelids",
        "curved high front wheel arch crests",
        "wide horizontal front slats"
      ],
      "side": [
        "butterfly doors with intake ducts built into door thickness",
        "wrap-around fighter-jet windscreen",
        "targa roof"
      ],
      "rear": [
        "monolithic horizontal stacked strakes (louvered blades) spanning entire rear width",
        "dual rectangular high exhaust outlets"
      ]
    },
    "distinguishingFeatures": [
      "Full-width horizontal horizontal red blades/strakes stacked across entire rear fascia",
      "High sculptural front fender crests inspired by 1960s sports prototypes (330 P4)",
      "Targa removable roof with wraparound fighter-jet curved windshield"
    ],
    "featureVector": [
      0.03734,
      -0.44681,
      0.58311,
      0.24619,
      -0.12243,
      -0.10741,
      -0.06994,
      -0.01141,
      0.06415,
      -0.11356,
      -0.03375,
      0.04497,
      -0.10448,
      -0.09207,
      -0.10691,
      0.02823,
      0.07864,
      0.07754,
      -0.00498,
      -0.00863,
      -0.04546,
      -0.04361,
      -0.11559,
      -0.00285,
      0.2104,
      0.25283,
      0.03415,
      -0.07106,
      -0.03698,
      -0.02917,
      -0.00215,
      0.01181,
      -0.05619,
      0.03021,
      -0.02855,
      -0.04987,
      -0.0372,
      -0.04689,
      -0.01912,
      0.007,
      0.06722,
      -0.00837,
      0.05788,
      0.14036,
      -0.00751,
      -0.00981,
      0.0022,
      -0.02681,
      -0.00269,
      -0.00362,
      -0.00413,
      -0.00111,
      -0.01538,
      0.0048,
      -0.01298,
      0.00354,
      -0.01062,
      0.00319,
      0.01981,
      -0.03103,
      0.17357,
      0.1758,
      0.18237,
      0.18019
    ],
    "hasReferenceEmbedding": true,
    "extractorVersion": "v2-sharp-spatial-spectral-v1",
    "referenceAssetCount": 2,
    "referenceAssetIds": [
      "REAL_BLIND_000422",
      "REAL_BLIND_000421"
    ]
  },
  {
    "canonicalId": "ferrari-296-gtb",
    "make": "Ferrari",
    "model": "296 GTB",
    "generation": "First Generation",
    "variant": "GTB",
    "displayName": "Ferrari 296 GTB",
    "bodyStyle": "Coupe",
    "productionYears": "2021–Present",
    "viewpointSignatures": {
      "front": [
        "teardrop headlights with brake air scoops",
        "clean central mouth intake"
      ],
      "side": [
        "sculpted 250 LM-inspired muscular rear haunches",
        "flying bridge roofline",
        "vertical rear screen"
      ],
      "rear": [
        "single central rectangular exhaust trumpet outlet",
        "horizontal slim lightbar taillights across bridge"
      ]
    },
    "distinguishingFeatures": [
      "Single large central rectangular exhaust tip exiting high in center of bumper",
      "Muscular curved rear haunches echoing the classic 1963 Ferrari 250 LM",
      "Slim single-strip horizontal LED taillight bar"
    ],
    "featureVector": [
      0.01701,
      -0.4088,
      0.52076,
      0.21428,
      0.00298,
      0.01273,
      0.02195,
      -0.15832,
      -0.30295,
      -0.20993,
      -0.01436,
      0.0141,
      -0.02926,
      -0.02654,
      -0.01948,
      -0.17334,
      -0.13005,
      -0.17441,
      -0.00625,
      0.00842,
      -0.08882,
      -0.09621,
      -0.10193,
      -0.15519,
      0.18715,
      0.00685,
      0.01025,
      -0.00941,
      -0.02324,
      0.15474,
      0.0833,
      0.05341,
      -0.03415,
      -0.00287,
      0.06487,
      0.03684,
      -0.03731,
      -0.02877,
      -0.01598,
      -0.05018,
      -0.02027,
      -0.11026,
      -0.10898,
      0.03885,
      0.00958,
      0.01311,
      0.00755,
      0.017,
      -0.01224,
      0.0017,
      -0.00082,
      0.00029,
      -0.03139,
      0.02655,
      -0.0096,
      0.01467,
      -0.00691,
      -0.00912,
      0.00769,
      -0.01789,
      0.1304,
      0.15398,
      0.16079,
      0.21307
    ],
    "hasReferenceEmbedding": true,
    "extractorVersion": "v2-sharp-spatial-spectral-v1",
    "referenceAssetCount": 2,
    "referenceAssetIds": [
      "REAL_BLIND_000405",
      "REAL_BLIND_000406"
    ]
  },
  {
    "canonicalId": "lamborghini-huracan-lp610-4",
    "make": "Lamborghini",
    "model": "Huracán",
    "generation": "First Generation",
    "variant": "LP610-4",
    "displayName": "Lamborghini Huracán LP610-4",
    "bodyStyle": "Coupe",
    "productionYears": "2014–2019",
    "viewpointSignatures": {
      "front": [
        "dual Y-shaped led headlights",
        "clean hexagonal front intake air baffles"
      ],
      "side": [
        "unbroken wedge silhouette from nose to tail",
        "clean side rocker panels without fins"
      ],
      "rear": [
        "quad circular exhaust tips grouped in pairs of two",
        "slanted hexagonal rear mesh",
        "Y-shaped taillights"
      ]
    },
    "distinguishingFeatures": [
      "Quad round exhaust pipes (two on left, two on right) exiting low near diffuser",
      "Smooth unbroken wedge roofline without rear wing or scoop",
      "Hexagonal clean front bumper side intakes"
    ],
    "featureVector": [
      -0.08733,
      -0.48591,
      0.60286,
      0.20872,
      0.03584,
      0.02108,
      -0.00632,
      -0.08826,
      -0.07296,
      0.08918,
      0.02846,
      -0.03478,
      0.0757,
      -0.00322,
      -0.02863,
      -0.04218,
      0.10637,
      0.06311,
      0.09163,
      -0.06487,
      -0.08322,
      -0.09488,
      -0.13011,
      -0.04949,
      0.10602,
      0.15055,
      0.02928,
      -0.04106,
      0.00665,
      0.06838,
      0.07924,
      0.00112,
      0.01378,
      0.10395,
      0.07465,
      -0.01255,
      -0.05159,
      0.0582,
      0.01576,
      -0.02366,
      -0.06168,
      -0.12698,
      -0.10437,
      -0.04091,
      -0.01394,
      -0.00173,
      -0.00563,
      -0.01443,
      -0.01624,
      -0.00646,
      -0.01197,
      -0.00965,
      -0.01494,
      0.01,
      -0.02353,
      0.01727,
      -0.02967,
      -0.00284,
      -0.00098,
      -0.02554,
      0.20246,
      0.19724,
      0.15494,
      0.20434
    ],
    "hasReferenceEmbedding": true,
    "extractorVersion": "v2-sharp-spatial-spectral-v1",
    "referenceAssetCount": 4,
    "referenceAssetIds": [
      "REAL_BLIND_000439",
      "REAL_BLIND_000438",
      "REAL_BLIND_000442",
      "REAL_BLIND_000441"
    ]
  },
  {
    "canonicalId": "lamborghini-huracan-evo",
    "make": "Lamborghini",
    "model": "Huracán",
    "generation": "First Generation",
    "variant": "EVO",
    "displayName": "Lamborghini Huracán EVO",
    "bodyStyle": "Coupe",
    "productionYears": "2019–2024",
    "viewpointSignatures": {
      "front": [
        "front bumper with Y-shaped aerodynamic intake blades",
        "integrated front splitter"
      ],
      "side": [
        "new 5-spoke Aesir wheels",
        "side air intake with updated aero vanes"
      ],
      "rear": [
        "dual high-mounted circular exhaust pipes flanking license plate (like Performante)",
        "integrated slotted ducktail spoiler"
      ]
    },
    "distinguishingFeatures": [
      "Front bumper features prominent Y-shaped body-color intake aerodynamic dividers",
      "Twin high-mounted central exhaust tips flanking the rear license plate recess",
      "Integrated rear ducktail slotted spoiler lip (no large tall rear wing)"
    ],
    "featureVector": [],
    "hasReferenceEmbedding": false,
    "extractorVersion": "v2-sharp-spatial-spectral-v1",
    "referenceAssetCount": 0,
    "referenceAssetIds": []
  },
  {
    "canonicalId": "lamborghini-huracan-sto",
    "make": "Lamborghini",
    "model": "Huracán",
    "generation": "First Generation",
    "variant": "STO",
    "displayName": "Lamborghini Huracán STO",
    "bodyStyle": "Coupe",
    "productionYears": "2021–2024",
    "viewpointSignatures": {
      "front": [
        "Cofango one-piece clamshell hood with dual air ducts and louvers",
        "extreme track front splitter"
      ],
      "side": [
        "roof air snorkel intake scoop",
        "shark fin extending along engine cover",
        "magnesium wheels"
      ],
      "rear": [
        "massive 3-position adjustable high carbon rear wing with swan-neck mounts",
        "dual high-exit exhaust"
      ]
    },
    "distinguishingFeatures": [
      "Roof-mounted high air scoop snorkel connecting to rear aerodynamic shark fin",
      "Massive swan-neck mounted adjustable carbon fiber rear wing",
      "One-piece Cofango front hood with large aerodynamic air channels and louvers"
    ],
    "featureVector": [],
    "hasReferenceEmbedding": false,
    "extractorVersion": "v2-sharp-spatial-spectral-v1",
    "referenceAssetCount": 0,
    "referenceAssetIds": []
  },
  {
    "canonicalId": "porsche-911-carrera-992",
    "make": "Porsche",
    "model": "911 Carrera",
    "generation": "992",
    "variant": "Carrera",
    "displayName": "Porsche 911 Carrera (992)",
    "bodyStyle": "Coupe",
    "productionYears": "2019–Present",
    "viewpointSignatures": {
      "front": [
        "classic round 911 oval headlights with 4-point led dots",
        "squared-off front hood line"
      ],
      "side": [
        "unbroken sloping 911 flyline",
        "flush electronic door handles",
        "curved rear haunches"
      ],
      "rear": [
        "full-width continuous red led lightbar",
        "vertical engine slats with integrated high-level brake light",
        "dual oval or quad exhaust"
      ]
    },
    "distinguishingFeatures": [
      "Clean rear bumper with twin rectangular or quad exhausts without large rear wing",
      "Full-width uninterrupted horizontal red LED lightbar below rear spoiler",
      "Classic rounded 911 tear-drop silhouette and flush retractable door handles"
    ],
    "featureVector": [],
    "hasReferenceEmbedding": false,
    "extractorVersion": "v2-sharp-spatial-spectral-v1",
    "referenceAssetCount": 0,
    "referenceAssetIds": []
  },
  {
    "canonicalId": "porsche-911-gt3-992",
    "make": "Porsche",
    "model": "911",
    "generation": "992",
    "variant": "GT3",
    "displayName": "Porsche 911 GT3 (992)",
    "bodyStyle": "Coupe",
    "productionYears": "2021–Present",
    "viewpointSignatures": {
      "front": [
        "dual nostrils (air vents) integrated into front carbon hood",
        "wide front bumper intake with black apron"
      ],
      "side": [
        "center-lock lightweight forged wheels",
        "low race ride height",
        "GT3 side script"
      ],
      "rear": [
        "swan-neck mounted top-hung rear wing",
        "dual central circular exhaust pipes in rear diffuser"
      ]
    },
    "distinguishingFeatures": [
      "Swan-neck top-hung aluminum rear wing mounts (hanging from above wing blade)",
      "Front hood features two distinct nostril radiator air extraction vents",
      "Dual central circular stainless steel exhaust tips closely grouped in center diffuser"
    ],
    "featureVector": [],
    "hasReferenceEmbedding": false,
    "extractorVersion": "v2-sharp-spatial-spectral-v1",
    "referenceAssetCount": 0,
    "referenceAssetIds": []
  },
  {
    "canonicalId": "porsche-911-gt3-rs-992",
    "make": "Porsche",
    "model": "911",
    "generation": "992",
    "variant": "GT3 RS",
    "displayName": "Porsche 911 GT3 RS (992)",
    "bodyStyle": "Coupe",
    "productionYears": "2022–Present",
    "viewpointSignatures": {
      "front": [
        "massive front hood nostrils with active aero flaps",
        "front fender louvers over front wheels with side blade cutouts"
      ],
      "side": [
        "deep aerodynamic door cutaways with side turning vanes",
        "roof aero fins",
        "massive carbon wing"
      ],
      "rear": [
        "enormous two-tier swan-neck rear wing taller than roofline with hydraulic DRS actuator",
        "central exhausts"
      ]
    },
    "distinguishingFeatures": [
      "Gigantic two-tier swan-neck rear wing with top blade sitting taller than the roofline",
      "Front wheel arch louvered cutaways and deep aerodynamic door-channel carve-outs",
      "Twin aerodynamic stabilizing fins running longitudinally along the carbon roof"
    ],
    "featureVector": [],
    "hasReferenceEmbedding": false,
    "extractorVersion": "v2-sharp-spatial-spectral-v1",
    "referenceAssetCount": 0,
    "referenceAssetIds": []
  },
  {
    "canonicalId": "porsche-911-turbo-s-992",
    "make": "Porsche",
    "model": "911",
    "generation": "992",
    "variant": "Turbo S",
    "displayName": "Porsche 911 Turbo S (992)",
    "bodyStyle": "Coupe",
    "productionYears": "2020–Present",
    "viewpointSignatures": {
      "front": [
        "wide track front bumper with active pneumatic front spoiler",
        "double front led light bars"
      ],
      "side": [
        "prominent rear fender oval intercooler air intakes",
        "extra-wide rear bodywork (1900mm)"
      ],
      "rear": [
        "quad rectangular exhaust outlets with high-gloss finish",
        "active deployable rear wing spoiler"
      ]
    },
    "distinguishingFeatures": [
      "Prominent oval air intake scoops carved into the rear quarter-panel haunches",
      "Quad rectangular black chrome tailpipes integrated into the rear apron",
      "Wide-body muscular rear track with active extendable rear wing"
    ],
    "featureVector": [],
    "hasReferenceEmbedding": false,
    "extractorVersion": "v2-sharp-spatial-spectral-v1",
    "referenceAssetCount": 0,
    "referenceAssetIds": []
  },
  {
    "canonicalId": "mclaren-720s",
    "make": "McLaren",
    "model": "720S",
    "generation": "Super Series",
    "variant": "720S",
    "displayName": "McLaren 720S",
    "bodyStyle": "Coupe",
    "productionYears": "2017–2023",
    "viewpointSignatures": {
      "front": [
        "deep eye-socket headlight aero air ducts",
        "slim led daytime running light strips inside sockets"
      ],
      "side": [
        "double-skin dihedral doors guiding air to radiators without visible side scoops",
        "teardrop glass canopy"
      ],
      "rear": [
        "dual central high-exit round exhausts between thin led taillight strips",
        "full-width active rear airbrake wing"
      ]
    },
    "distinguishingFeatures": [
      "Deep eye-socket headlamp cavities with internal air intake channels",
      "Clean side bodywork with hidden door-channel air feeds (no traditional side scoop)",
      "Dual high-exit central circular exhaust pipes centered between ultra-thin taillight blades"
    ],
    "featureVector": [
      0.03884,
      -0.39698,
      0.53382,
      0.22751,
      -0.03105,
      -0.03505,
      -0.04375,
      -0.13643,
      0.15564,
      0.04131,
      0.00835,
      -0.01069,
      -0.04493,
      -0.05139,
      -0.05649,
      -0.13734,
      0.1897,
      -0.05105,
      0.009,
      -0.00833,
      -0.13197,
      -0.14091,
      -0.14533,
      -0.12392,
      0.39573,
      0.04917,
      0.01115,
      -0.00889,
      0.06041,
      0.00625,
      0.01257,
      0.07387,
      0.01788,
      0.05532,
      0.03433,
      0.06044,
      -0.00956,
      -0.04269,
      -0.01569,
      0.02392,
      -0.03621,
      -0.07468,
      -0.10228,
      -0.06387,
      -0.00911,
      0.00479,
      0.00596,
      -0.01014,
      -0.00645,
      0.00718,
      -0.01027,
      0.00922,
      -0.01471,
      -0.01254,
      -0.0281,
      -0.00489,
      -0.00765,
      -0.00147,
      0.00709,
      -0.0176,
      0.18544,
      0.15435,
      0.12558,
      0.19777
    ],
    "hasReferenceEmbedding": true,
    "extractorVersion": "v2-sharp-spatial-spectral-v1",
    "referenceAssetCount": 4,
    "referenceAssetIds": [
      "REAL_BLIND_000449",
      "REAL_BLIND_000450",
      "REAL_BLIND_000451",
      "REAL_BLIND_000455"
    ]
  },
  {
    "canonicalId": "mclaren-675lt",
    "make": "McLaren",
    "model": "675LT",
    "generation": "Super Series (P11)",
    "variant": "675LT",
    "displayName": "McLaren 675LT",
    "bodyStyle": "Coupe",
    "productionYears": "2015–2017",
    "viewpointSignatures": {
      "front": [
        "P1-style boomerang headlight lenses",
        "extended carbon fiber front splitter with endplates"
      ],
      "side": [
        "extended carbon side skirts with aerodynamic winglets",
        "ultra-lightweight forged wheels"
      ],
      "rear": [
        "50% larger active carbon Longtail airbrake wing",
        "dual circular titanium high-exit exhaust pipes"
      ]
    },
    "distinguishingFeatures": [
      "Dual round circular titanium exhaust tips exiting high through open rear mesh",
      "Extended carbon fiber front splitter with upturned endplate winglets",
      "Active Longtail carbon airbrake that is significantly larger and wider than 650S"
    ],
    "featureVector": [],
    "hasReferenceEmbedding": false,
    "extractorVersion": "v2-sharp-spatial-spectral-v1",
    "referenceAssetCount": 0,
    "referenceAssetIds": []
  },
  {
    "canonicalId": "mclaren-650s",
    "make": "McLaren",
    "model": "650S",
    "generation": "Super Series (P11)",
    "variant": "650S",
    "displayName": "McLaren 650S",
    "bodyStyle": "Coupe",
    "productionYears": "2014–2016",
    "viewpointSignatures": {
      "front": [
        "P1-inspired boomerang LED headlights",
        "integrated carbon front bumper"
      ],
      "side": [
        "large carbon side radiator intake turning vane scoops",
        "dihedral doors"
      ],
      "rear": [
        "single central rectangular/trapezoidal exhaust exit flanked by diffuser",
        "standard P11 rear airbrake"
      ]
    },
    "distinguishingFeatures": [
      "Standard 12C-style rear bumper with central trapezoidal exhaust housing (NOT dual round titanium pipes)",
      "Front bumper features P1 boomerang headlights without the aggressive 675LT extended splitter endplates",
      "Standard-length rear decklid without Longtail overhang"
    ],
    "featureVector": [],
    "hasReferenceEmbedding": false,
    "extractorVersion": "v2-sharp-spatial-spectral-v1",
    "referenceAssetCount": 0,
    "referenceAssetIds": []
  },
  {
    "canonicalId": "chevrolet-corvette-c8-stingray",
    "make": "Chevrolet",
    "model": "Corvette",
    "generation": "C8",
    "variant": "Stingray",
    "displayName": "Chevrolet Corvette C8 Stingray",
    "bodyStyle": "Coupe",
    "productionYears": "2020–Present",
    "viewpointSignatures": {
      "front": [
        "angular pointed front nose with led headlights",
        "dual side radiator intake openings"
      ],
      "side": [
        "large wishbone / boomerang-shaped side air intake spear",
        "mid-engine cab-forward stance"
      ],
      "rear": [
        "quad square-exhaust tips grouped in pairs at the outer rear corners",
        "dual double-chevron taillights"
      ]
    },
    "distinguishingFeatures": [
      "Quad squared exhaust outlets located at outer bumper edges (two on far left, two on far right)",
      "Boomerang-shaped side air scoop spear on door/rear fender",
      "Standard front fascia without widebody flared fenders"
    ],
    "featureVector": [],
    "hasReferenceEmbedding": false,
    "extractorVersion": "v2-sharp-spatial-spectral-v1",
    "referenceAssetCount": 0,
    "referenceAssetIds": []
  },
  {
    "canonicalId": "chevrolet-corvette-c8-z06",
    "make": "Chevrolet",
    "model": "Corvette",
    "generation": "C8",
    "variant": "Z06",
    "displayName": "Chevrolet Corvette C8 Z06",
    "bodyStyle": "Coupe",
    "productionYears": "2023–Present",
    "viewpointSignatures": {
      "front": [
        "wider front fascia with aggressive lower canards and splitter",
        "chin spoiler"
      ],
      "side": [
        "3.6-inch wider track with wider rear haunches",
        "wishbone side scoop trimmed with wishbone strake"
      ],
      "rear": [
        "quad circular exhaust tips tightly clustered together in the dead center of the bumper",
        "optional high wing"
      ]
    },
    "distinguishingFeatures": [
      "Quad round exhaust outlets grouped together in the center of the rear bumper (NOT at the corners)",
      "Substantially wider track (3.6 inches wider than Stingray) with flared rear fender flares",
      "Front fascia has distinctive wishbone styling cues and enlarged cooling radiators"
    ],
    "featureVector": [],
    "hasReferenceEmbedding": false,
    "extractorVersion": "v2-sharp-spatial-spectral-v1",
    "referenceAssetCount": 0,
    "referenceAssetIds": []
  },
  {
    "canonicalId": "toyota-camry-xv70",
    "make": "Toyota",
    "model": "Camry",
    "generation": "XV70",
    "variant": null,
    "displayName": "Toyota Camry (XV70)",
    "bodyStyle": "Sedan",
    "productionYears": "2017–2024",
    "viewpointSignatures": {
      "front": [
        "angular spindle-style lower front intake",
        "slim horizontal headlights",
        "central toyota emblem bar"
      ],
      "side": [
        "three-box modern sedan profile",
        "sloping c-pillar glass"
      ],
      "rear": [
        "horizontal wrap-around taillights",
        "dual chrome exhaust outlet"
      ]
    },
    "distinguishingFeatures": [
      "Wide multi-slat lower front trapezoidal grille spanning bumper",
      "Contemporary midsize family sedan architecture"
    ],
    "featureVector": [
      0.02067,
      -0.44499,
      0.58108,
      0.23982,
      -0.05748,
      -0.0532,
      -0.04182,
      -0.09751,
      -0.04353,
      -0.11744,
      -0.00997,
      0.01352,
      0.03437,
      0.02903,
      0.03007,
      -0.17133,
      0.17736,
      -0.0984,
      0.00482,
      -0.00163,
      -0.07734,
      -0.0869,
      -0.08777,
      -0.14007,
      0.25272,
      -0.04535,
      0.01,
      -0.00565,
      -0.05206,
      -0.02359,
      0.03874,
      -0.04384,
      0.02161,
      0.05693,
      0.12736,
      0.06207,
      -0.00543,
      -0.02882,
      -0.0065,
      0.05266,
      -0.0338,
      -0.09527,
      -0.08624,
      0.01615,
      -0.01389,
      0.00827,
      0.00153,
      0.00035,
      -0.02537,
      0.00529,
      -0.01076,
      -0.00366,
      -0.00984,
      0.00592,
      -0.00309,
      0.01323,
      -0.009,
      0.03492,
      0.02541,
      0.01132,
      0.17995,
      0.1679,
      0.18196,
      0.20846
    ],
    "hasReferenceEmbedding": true,
    "extractorVersion": "v2-sharp-spatial-spectral-v1",
    "referenceAssetCount": 4,
    "referenceAssetIds": [
      "REAL_BLIND_000001",
      "REAL_BLIND_000006",
      "REAL_BLIND_000007",
      "REAL_BLIND_000003"
    ]
  },
  {
    "canonicalId": "toyota-gr-supra-a90",
    "make": "Toyota",
    "model": "Supra",
    "generation": "5th Generation (A90)",
    "variant": "GR Supra",
    "displayName": "Toyota GR Supra (A90)",
    "bodyStyle": "Coupe",
    "productionYears": "2019–Present",
    "viewpointSignatures": {
      "front": [
        "tripartite lower front intake",
        "central F1-style nose cone",
        "6-lens led headlights"
      ],
      "side": [
        "double-bubble aerodynamic roof",
        "muscular rear quarter fender bulge",
        "long hood short deck"
      ],
      "rear": [
        "integrated ducktail arch spoiler",
        "central formula-1 style reverse light",
        "large dual round exhausts"
      ]
    },
    "distinguishingFeatures": [
      "Prominent aerodynamic double-bubble roofline",
      "Integrated high-kick ducktail trunk spoiler",
      "Central nose divider splitting lower front grilles"
    ],
    "featureVector": [],
    "hasReferenceEmbedding": false,
    "extractorVersion": "v2-sharp-spatial-spectral-v1",
    "referenceAssetCount": 0,
    "referenceAssetIds": []
  },
  {
    "canonicalId": "nissan-gt-r-r35",
    "make": "Nissan",
    "model": "GT-R",
    "generation": "R35",
    "variant": null,
    "displayName": "Nissan GT-R (R35)",
    "bodyStyle": "Coupe",
    "productionYears": "2007–Present",
    "viewpointSignatures": {
      "front": [
        "V-motion chrome or carbon front grille divider",
        "vertical lightning bolt led headlights"
      ],
      "side": [
        "sword-blade front fender air vents with GT-R badge",
        "angular greenhouse canopy"
      ],
      "rear": [
        "iconic quad circular round taillights",
        "massive quad titanium exhaust tips",
        "rear decklid spoiler"
      ]
    },
    "distinguishingFeatures": [
      "Quad iconic equal-sized circular rear taillights",
      "Massive quad circular exhaust tips integrated into rear diffuser",
      "Front fender air vent slit bearing red and silver GT-R emblem"
    ],
    "featureVector": [],
    "hasReferenceEmbedding": false,
    "extractorVersion": "v2-sharp-spatial-spectral-v1",
    "referenceAssetCount": 0,
    "referenceAssetIds": []
  },
  {
    "canonicalId": "nissan-skyline-gtr-r34",
    "make": "Nissan",
    "model": "Skyline GT-R",
    "generation": "R34",
    "variant": "V-Spec",
    "displayName": "Nissan Skyline GT-R (R34)",
    "bodyStyle": "Coupe",
    "productionYears": "1999–2002",
    "viewpointSignatures": {
      "front": [
        "rectangular dual-tier grille",
        "horizontal xenons",
        "front lip spoiler"
      ],
      "side": [
        "chiseled 90s Japanese coupe boxy lines",
        "6-spoke forged alloys"
      ],
      "rear": [
        "unequal-sized twin circular taillights (outer larger than inner)",
        "high adjustable rear wing",
        "single large cannon exhaust"
      ]
    },
    "distinguishingFeatures": [
      "Twin circular taillights where outer round lamp is noticeably larger than inner round lamp",
      "Boxy muscular late-90s Japanese sports coupe proportions"
    ],
    "featureVector": [],
    "hasReferenceEmbedding": false,
    "extractorVersion": "v2-sharp-spatial-spectral-v1",
    "referenceAssetCount": 0,
    "referenceAssetIds": []
  },
  {
    "canonicalId": "bentley-continental-gt",
    "make": "Bentley",
    "model": "Continental GT",
    "generation": "3rd Generation",
    "variant": null,
    "displayName": "Bentley Continental GT",
    "bodyStyle": "Coupe",
    "productionYears": "2018–Present",
    "viewpointSignatures": {
      "front": [
        "large rectangular matrix mesh grille",
        "cut-crystal dual round led matrix headlights"
      ],
      "side": [
        "muscular rear haunches power line",
        "long dash-to-axle prestige grand tourer proportions"
      ],
      "rear": [
        "elliptical oval taillights reflecting oval exhaust pipes",
        "deployable active rear spoiler"
      ]
    },
    "distinguishingFeatures": [
      "Cut-crystal effect twin round jewel-like headlights",
      "Massive chrome rectangular matrix wire grille",
      "Elliptical oval taillights matching the oval dual exhaust tailpipes"
    ],
    "featureVector": [
      -0.17085,
      -0.48556,
      0.52084,
      0.14785,
      -0.10042,
      -0.09321,
      -0.13051,
      -0.02037,
      0.0138,
      0.30044,
      0.01144,
      -0.0337,
      -0.01087,
      -0.03236,
      -0.0311,
      -0.10382,
      0.00526,
      -0.08487,
      0.02086,
      -0.00949,
      0.02049,
      0.00615,
      0.00451,
      -0.15417,
      0.30762,
      -0.01841,
      0.01516,
      -0.0088,
      -0.04967,
      -0.06977,
      -0.08484,
      -0.09314,
      -0.01016,
      0.07215,
      0.06618,
      -0.02757,
      -0.00978,
      -0.01657,
      -0.04586,
      -0.00075,
      0.07436,
      0.05532,
      0.07174,
      0.06836,
      -0.01512,
      0.01151,
      0.00761,
      -0.00355,
      -0.00989,
      0.01618,
      0.00324,
      0.00543,
      -0.02645,
      0.00274,
      -0.00953,
      -0.0049,
      -0.02203,
      -0.00958,
      -0.00603,
      -0.02261,
      0.17789,
      0.13094,
      0.15532,
      0.20868
    ],
    "hasReferenceEmbedding": true,
    "extractorVersion": "v2-sharp-spatial-spectral-v1",
    "referenceAssetCount": 4,
    "referenceAssetIds": [
      "REAL_BLIND_000241",
      "REAL_BLIND_000240",
      "REAL_BLIND_000244",
      "REAL_BLIND_000238"
    ]
  },
  {
    "canonicalId": "rolls-royce-phantom-viii",
    "make": "Rolls-Royce",
    "model": "Phantom",
    "generation": "Phantom VIII",
    "variant": null,
    "displayName": "Rolls-Royce Phantom VIII",
    "bodyStyle": "Sedan",
    "productionYears": "2017–Present",
    "viewpointSignatures": {
      "front": [
        "monolithic upright pantheon grille with spirit of ecstasy mascot",
        "laser headlights with frosted daytime running rings"
      ],
      "side": [
        "rear coach doors (suicide doors)",
        "formal upright monolithic glasshouse",
        "floating rr wheel center caps"
      ],
      "rear": [
        "tapered formal bootlid with jewel-like vertical taillights",
        "dual concealed stainless exhausts"
      ]
    },
    "distinguishingFeatures": [
      "Iconic hand-polished stainless steel Pantheon temple grille topped with Spirit of Ecstasy",
      "Rear-hinged coach doors (suicide doors) with integrated umbrellas",
      "Monolithic formal upright architecture with 2:1 wheel-to-body proportion"
    ],
    "featureVector": [],
    "hasReferenceEmbedding": false,
    "extractorVersion": "v2-sharp-spatial-spectral-v1",
    "referenceAssetCount": 0,
    "referenceAssetIds": []
  },
  {
    "canonicalId": "bmw-m3-g80",
    "make": "BMW",
    "model": "M3",
    "generation": "G80",
    "variant": "M3",
    "displayName": "BMW M3 (G80)",
    "bodyStyle": "Sedan",
    "productionYears": "2020–Present",
    "viewpointSignatures": {
      "front": [
        "vertical frameless twin kidney grilles extending to bottom of bumper",
        "sculpted hood channels aligning with grilles"
      ],
      "side": [
        "flared front and rear fender arches",
        "carbon fiber roof",
        "four doors with M aerodynamically sculpted mirrors"
      ],
      "rear": [
        "quad circular exhaust outlets in glossy black diffuser",
        "subtle decklid gurney flap lip spoiler"
      ]
    },
    "distinguishingFeatures": [
      "Massive vertical frameless twin kidney grille spanning the full front height",
      "Four-door performance sedan body with blistered widebody fenders",
      "Quad circular M sports exhaust tips"
    ],
    "featureVector": [],
    "hasReferenceEmbedding": false,
    "extractorVersion": "v2-sharp-spatial-spectral-v1",
    "referenceAssetCount": 0,
    "referenceAssetIds": []
  },
  {
    "canonicalId": "bmw-m4-g82",
    "make": "BMW",
    "model": "M4",
    "generation": "G82",
    "variant": "M4",
    "displayName": "BMW M4 (G82)",
    "bodyStyle": "Coupe",
    "productionYears": "2020–Present",
    "viewpointSignatures": {
      "front": [
        "vertical frameless twin kidney grilles",
        "hood indentation channels"
      ],
      "side": [
        "two-door sports coupe roofline",
        "carbon roof with central aerodynamic indentation channel"
      ],
      "rear": [
        "quad circular exhaust pipes",
        "slender L-shaped led taillights"
      ]
    },
    "distinguishingFeatures": [
      "Two-door coupe silhouette with full-height vertical twin kidney grilles",
      "Sculpted carbon roof with central longitudinal aero valley",
      "Quad round sports exhaust outlets"
    ],
    "featureVector": [],
    "hasReferenceEmbedding": false,
    "extractorVersion": "v2-sharp-spatial-spectral-v1",
    "referenceAssetCount": 0,
    "referenceAssetIds": []
  },
  {
    "canonicalId": "lamborghini-aventador-lp700-4",
    "make": "Lamborghini",
    "model": "Aventador",
    "generation": "First Generation",
    "variant": "LP700-4",
    "displayName": "Lamborghini Aventador LP700-4",
    "bodyStyle": "Coupe",
    "productionYears": "2011–2016",
    "viewpointSignatures": {
      "front": [
        "angular stealth-fighter sharp nose with Y-shaped led headlights",
        "slanted geometric front air scoops"
      ],
      "side": [
        "scissor doors opening vertically upward",
        "massive lower side radiator air scoops and electronically deployable upper shoulder intakes"
      ],
      "rear": [
        "single massive central hexagonal exhaust outlet housing 4 internal pipes",
        "arrowhead Y-shaped taillights",
        "hexagonal engine cover louvres"
      ]
    },
    "distinguishingFeatures": [
      "Iconic upward-opening scissor doors",
      "Single large central hexagonal exhaust exit in the middle of the rear bumper",
      "Wide low extreme wedge stance (V12 flagship proportions)"
    ],
    "featureVector": [
      -0.01624,
      -0.42259,
      0.55112,
      0.21764,
      -0.13479,
      -0.1528,
      -0.1511,
      0.00732,
      0.06761,
      -0.2313,
      0.01716,
      -0.0073,
      0.04182,
      0.01306,
      -0.0059,
      -0.07954,
      0.1191,
      -0.11554,
      0.03824,
      -0.03333,
      0.02076,
      0.00377,
      0.00904,
      -0.08101,
      -0.00032,
      -0.29644,
      0.01436,
      -0.00323,
      -0.09452,
      -0.11708,
      -0.10731,
      -0.09315,
      0.06616,
      0.01733,
      -0.04148,
      -0.01906,
      0.13081,
      0.03319,
      -0.05573,
      0.05909,
      0.13773,
      0.01426,
      -0.00208,
      0.07184,
      -0.01373,
      0.0171,
      -0.00236,
      0.01307,
      -0.00456,
      0.04177,
      0.02438,
      0.02045,
      0.02658,
      -0.00049,
      0.00087,
      0.03208,
      0.02006,
      0.06262,
      0.06924,
      0.01622,
      0.19758,
      0.13727,
      0.13128,
      0.15888
    ],
    "hasReferenceEmbedding": true,
    "extractorVersion": "v2-sharp-spatial-spectral-v1",
    "referenceAssetCount": 6,
    "referenceAssetIds": [
      "REAL_BLIND_000429",
      "REAL_BLIND_000430",
      "REAL_BLIND_000431",
      "REAL_BLIND_000434",
      "REAL_BLIND_000435",
      "REAL_BLIND_000433"
    ]
  },
  {
    "canonicalId": "bugatti-chiron",
    "make": "Bugatti",
    "model": "Chiron",
    "generation": "First Generation",
    "variant": null,
    "displayName": "Bugatti Chiron",
    "bodyStyle": "Coupe",
    "productionYears": "2016–2024",
    "viewpointSignatures": {
      "front": [
        "horseshoe front grille",
        "quad-led rectangular projector headlights on each side"
      ],
      "side": [
        "sweeping aluminum C-line (Bugatti line) encircling cabin and side air intake",
        "two-tone paint split"
      ],
      "rear": [
        "single continuous 1.6m full-width red led taillight bar",
        "massive titanium quad exhaust outlets in carbon diffuser"
      ]
    },
    "distinguishingFeatures": [
      "Iconic C-shaped Bugatti curve framing the cabin profile and feeding intercoolers",
      "Continuous 1.6-meter uninterrupted horizontal red LED light strip across the rear",
      "Horseshoe front grille flanked by 8 distinct rectangular LED headlight lenses"
    ],
    "featureVector": [
      0.28823,
      -0.25352,
      0.62725,
      0.35635,
      -0.07828,
      -0.07558,
      -0.06303,
      -0.11211,
      -0.07551,
      -0.12923,
      -0.00897,
      0.0139,
      -0.13131,
      -0.10919,
      -0.08706,
      -0.07604,
      -0.09168,
      -0.14749,
      -0.03319,
      0.03319,
      -0.03519,
      -0.04469,
      -0.0567,
      -0.11996,
      0.16623,
      0.01153,
      0.0155,
      -0.01676,
      0.09054,
      -0.00527,
      -0.03452,
      -0.06642,
      0.02476,
      0.01958,
      0.00198,
      -0.05128,
      -0.00935,
      -0.03789,
      -0.08866,
      -0.03974,
      0.08231,
      0.01531,
      -0.02722,
      0.12586,
      -0.0027,
      0.02169,
      0.02082,
      0.00342,
      -0.01508,
      -0.00988,
      -0.01636,
      -0.00964,
      -0.02596,
      -0.00919,
      -0.02452,
      -0.00266,
      -0.00185,
      -0.00994,
      0.00588,
      -0.02304,
      0.15627,
      0.13203,
      0.1851,
      0.15929
    ],
    "hasReferenceEmbedding": true,
    "extractorVersion": "v2-sharp-spatial-spectral-v1",
    "referenceAssetCount": 3,
    "referenceAssetIds": [
      "REAL_BLIND_000466",
      "REAL_BLIND_000467",
      "REAL_BLIND_000463"
    ]
  },
  {
    "canonicalId": "pagani-huayra",
    "make": "Pagani",
    "model": "Huayra",
    "generation": "First Generation",
    "variant": null,
    "displayName": "Pagani Huayra",
    "bodyStyle": "Coupe",
    "productionYears": "2011–2018",
    "viewpointSignatures": {
      "front": [
        "leaf-shaped bi-xenon headlight pods with carbon stalks",
        "twin active aerodynamic front hood flaps"
      ],
      "side": [
        "gullwing doors opening upward",
        "curvaceous carbon-titanium bodywork",
        "leaf-shaped side mirrors on delicate stalks"
      ],
      "rear": [
        "iconic quad circular titanium exhaust tips clustered in a central circle",
        "twin active rear aerodynamic flaps"
      ]
    },
    "distinguishingFeatures": [
      "Quad exhaust tips grouped together in Pagani signature circular central titanium cluster",
      "Four active independent aerodynamic flaps (two on front hood, two on rear deck)",
      "Side mirrors mounted on sculptural organic carbon-fiber leaf stalks"
    ],
    "featureVector": [
      -0.08559,
      -0.39461,
      0.43611,
      0.14554,
      -0.16586,
      -0.18068,
      -0.17825,
      -0.00121,
      0.30559,
      -0.12713,
      0.0136,
      -0.00498,
      -0.02357,
      -0.03147,
      -0.0149,
      -0.05611,
      0.05607,
      -0.16051,
      -0.00038,
      0.01262,
      0.05641,
      0.0546,
      0.05693,
      -0.13797,
      0.20647,
      -0.05653,
      0.00065,
      0.00142,
      -0.1351,
      -0.12593,
      -0.11912,
      -0.11753,
      -0.05909,
      -0.06685,
      -0.07902,
      -0.0577,
      0.15974,
      -0.03062,
      0.01392,
      0.16371,
      0.15312,
      0.03247,
      0.04372,
      0.22428,
      -0.02864,
      -0.01822,
      -0.02419,
      -0.02301,
      -0.01778,
      -0.01787,
      -0.01455,
      -0.01875,
      -0.00072,
      0.00702,
      -0.00191,
      0.0083,
      0.00116,
      0.00106,
      0.01902,
      -0.01427,
      0.17702,
      0.15912,
      0.14729,
      0.15273
    ],
    "hasReferenceEmbedding": true,
    "extractorVersion": "v2-sharp-spatial-spectral-v1",
    "referenceAssetCount": 1,
    "referenceAssetIds": [
      "REAL_BLIND_000481"
    ]
  },
  {
    "canonicalId": "koenigsegg-jesko",
    "make": "Koenigsegg",
    "model": "Jesko",
    "generation": "First Generation",
    "variant": "Attack",
    "displayName": "Koenigsegg Jesko",
    "bodyStyle": "Coupe",
    "productionYears": "2021–Present",
    "viewpointSignatures": {
      "front": [
        "deep front splitter with active underbody flaps",
        "swept-back fighter-canopy windshield"
      ],
      "side": [
        "dihedral synchro-helix actuation doors (Koenigsegg doors)",
        "sculptured hollow carbon wheels"
      ],
      "rear": [
        "colossal top-mounted active boomerang rear wing",
        "central high-flow exhaust",
        "open rear mesh architecture"
      ]
    },
    "distinguishingFeatures": [
      "Gigantic top-mounted curved boomerang active rear wing hanging from central spine",
      "Wraparound fighter-jet curved windshield and teardrop greenhouse canopy",
      "Dihedral synchro-helix doors rotating 90 degrees outward and upward"
    ],
    "featureVector": [
      0.01019,
      -0.41151,
      0.54642,
      0.2236,
      -0.1142,
      -0.1375,
      -0.14009,
      -0.10893,
      0.32948,
      -0.122,
      0.02459,
      -0.01424,
      -0.02863,
      -0.03891,
      -0.04067,
      -0.14484,
      0.08056,
      -0.17076,
      0.01116,
      -0.0069,
      -0.027,
      -0.03606,
      -0.03857,
      -0.16715,
      0.25142,
      -0.09077,
      0.01031,
      -0.00704,
      -0.04079,
      -0.03789,
      -0.07541,
      -0.09474,
      -0.00556,
      0.00704,
      0.00324,
      -0.03448,
      0.05125,
      -0.02837,
      0.07225,
      0.01928,
      0.06224,
      0.07644,
      0.01157,
      0.01392,
      0.00649,
      0.00981,
      -0.00038,
      0.01662,
      -0.00985,
      -0.00213,
      -0.01521,
      0.00353,
      -0.01215,
      -0.01321,
      -0.03571,
      0.00196,
      0.00471,
      0.02677,
      0.02145,
      0.00886,
      0.16481,
      0.14646,
      0.1109,
      0.1667
    ],
    "hasReferenceEmbedding": true,
    "extractorVersion": "v2-sharp-spatial-spectral-v1",
    "referenceAssetCount": 3,
    "referenceAssetIds": [
      "REAL_BLIND_000485",
      "REAL_BLIND_000486",
      "REAL_BLIND_000487"
    ]
  },
  {
    "canonicalId": "ferrari-laferrari",
    "make": "Ferrari",
    "model": "LaFerrari",
    "generation": "First Generation",
    "variant": null,
    "displayName": "Ferrari LaFerrari",
    "bodyStyle": "Coupe",
    "productionYears": "2013–2016",
    "viewpointSignatures": {
      "front": [
        "F1-style pointed front nose cone with central carbon pillar",
        "slender L-shaped headlights"
      ],
      "side": [
        "butterfly doors pivoting forward and upward",
        "deep side sculptural carve-out leading to rear intake"
      ],
      "rear": [
        "single classic round taillight on each side",
        "quad black exhaust tips",
        "active rear diffuser with deployable flaps"
      ]
    },
    "distinguishingFeatures": [
      "Formula 1-inspired pointed central nose cone with front aero bridge",
      "Classic single circular round taillights (one per side) set into open carbon mesh",
      "Butterfly doors opening forward and upward with roof cutouts"
    ],
    "featureVector": [],
    "hasReferenceEmbedding": false,
    "extractorVersion": "v2-sharp-spatial-spectral-v1",
    "referenceAssetCount": 0,
    "referenceAssetIds": []
  },
  {
    "canonicalId": "lamborghini-revuelto",
    "make": "Lamborghini",
    "model": "Revuelto",
    "generation": "First Generation",
    "variant": null,
    "displayName": "Lamborghini Revuelto",
    "bodyStyle": "Coupe",
    "productionYears": "2023–Present",
    "viewpointSignatures": {
      "front": [
        "prominent Y-shaped led daytime running lights recessed into front bumper cavities",
        "aerodynamic nostrils"
      ],
      "side": [
        "scissor doors opening vertically",
        "floating blade aero side profile leading to radiator intakes"
      ],
      "rear": [
        "completely exposed rear V12 engine bay without glass cover",
        "high-mounted dual hexagonal exhaust outlets flanked by Y-shaped taillights"
      ]
    },
    "distinguishingFeatures": [
      "Exposed naturally-aspirated V12 engine open to the elements (no glass rear engine cover)",
      "High-exit twin hexagonal exhaust pipes placed between the rear taillights",
      "Y-shaped LED daytime running lights spanning the front nose"
    ],
    "featureVector": [
      -0.09981,
      -0.46776,
      0.51751,
      0.17331,
      -0.02341,
      -0.02488,
      -0.02816,
      -0.14901,
      0.06144,
      0.07843,
      0.00311,
      -0.00402,
      -0.02198,
      -0.01609,
      -0.00588,
      -0.16126,
      -0.27461,
      -0.26507,
      -0.011,
      0.01315,
      -0.10469,
      -0.10847,
      -0.10932,
      -0.16417,
      0.23889,
      -0.00263,
      0.0042,
      -0.00274,
      -0.10504,
      -0.08225,
      0.10583,
      0.10817,
      -0.03134,
      0.04026,
      0.05971,
      0.12369,
      0.04008,
      0.0293,
      -0.03918,
      -0.08502,
      -0.06145,
      -0.06598,
      -0.03731,
      0.00053,
      -0.00764,
      0.00012,
      0.01772,
      -0.0209,
      -0.01998,
      -0.01388,
      -0.00869,
      -0.02148,
      -0.00408,
      0.02447,
      0.02502,
      -0.00073,
      -0.01735,
      -0.00513,
      -0.0032,
      -0.01597,
      0.05765,
      0.08746,
      0.11332,
      0.19308
    ],
    "hasReferenceEmbedding": true,
    "extractorVersion": "v2-sharp-spatial-spectral-v1",
    "referenceAssetCount": 1,
    "referenceAssetIds": [
      "REAL_BLIND_000446"
    ]
  },
  {
    "canonicalId": "mclaren-p1",
    "make": "McLaren",
    "model": "P1",
    "generation": "Ultimate Series",
    "variant": null,
    "displayName": "McLaren P1",
    "bodyStyle": "Coupe",
    "productionYears": "2013–2015",
    "viewpointSignatures": {
      "front": [
        "McLaren speedmark logo-shaped led headlights",
        "sculpted aerodynamic hood scoops"
      ],
      "side": [
        "roof air snorkel intake leading to engine",
        "shrink-wrapped carbon bodywork with dihedral doors"
      ],
      "rear": [
        "giant hydraulic extendable rear active wing",
        "ultra-thin continuous led taillight strip tracing body contours",
        "massive single central trapezoidal exhaust"
      ]
    },
    "distinguishingFeatures": [
      "Prominent roof-mounted ram-air intake scoop",
      "Ultra-thin ribbon LED taillight strip following the extreme curves of the rear bodywork",
      "Single colossal central trapezoidal exhaust outlet exit in rear mesh"
    ],
    "featureVector": [
      -0.01719,
      -0.42999,
      0.50778,
      0.19736,
      -0.04925,
      -0.06188,
      -0.07347,
      -0.04408,
      0.0716,
      0.08443,
      0.01843,
      -0.0179,
      0.029,
      -0.07546,
      -0.1824,
      0.1464,
      0.30069,
      0.15634,
      0.15793,
      -0.15917,
      -0.10605,
      -0.11796,
      -0.18181,
      0.03311,
      0.08927,
      0.21971,
      0.04384,
      -0.06981,
      -0.03892,
      0.0357,
      0.01754,
      0.10588,
      -0.01741,
      -0.00137,
      0.00171,
      0.06475,
      0.03011,
      0.03885,
      0.00682,
      -0.04012,
      0.0085,
      -0.072,
      -0.09526,
      -0.04479,
      -0.01045,
      -0.00371,
      -0.00597,
      -0.00625,
      -0.00608,
      0.01053,
      -0.00351,
      0.01385,
      -0.02621,
      -0.0178,
      -0.0394,
      -0.00719,
      -0.00987,
      -0.01065,
      0.00341,
      -0.02504,
      0.11153,
      0.1735,
      0.15601,
      0.18081
    ],
    "hasReferenceEmbedding": true,
    "extractorVersion": "v2-sharp-spatial-spectral-v1",
    "referenceAssetCount": 2,
    "referenceAssetIds": [
      "REAL_BLIND_000459",
      "REAL_BLIND_000458"
    ]
  },
  {
    "canonicalId": "porsche-carrera-gt",
    "make": "Porsche",
    "model": "Carrera GT",
    "generation": "Type 980",
    "variant": null,
    "displayName": "Porsche Carrera GT",
    "bodyStyle": "Targa",
    "productionYears": "2004–2007",
    "viewpointSignatures": {
      "front": [
        "low elongated oval headlights reminiscent of 718 RSK racers",
        "smooth bumper with three air intakes"
      ],
      "side": [
        "targa open-top architecture with twin aerodynamically faired roll hoops",
        "large side radiator air intake behind doors"
      ],
      "rear": [
        "perforated stainless-steel engine cover mesh",
        "dual round stainless-steel high-exit exhausts",
        "deployable rear wing"
      ]
    },
    "distinguishingFeatures": [
      "Twin streamlined aerodynamic roll hoop headrest fairings behind open cabin",
      "Dual round exhaust pipes exiting high in the center of the rear fascia",
      "Perforated twin stainless-steel engine cover screens revealing 5.7L V10"
    ],
    "featureVector": [
      -0.21326,
      -0.50931,
      0.53888,
      0.13865,
      -0.07203,
      -0.0753,
      -0.07654,
      -0.12478,
      -0.04357,
      -0.03779,
      0.00389,
      -0.00287,
      -0.04604,
      -0.05022,
      -0.04887,
      -0.14802,
      0.06357,
      -0.1656,
      0.00351,
      -0.00074,
      -0.09922,
      -0.10783,
      -0.1053,
      -0.13408,
      0.27471,
      -0.10632,
      0.00735,
      -0.00177,
      0.02039,
      0.01789,
      -0.01321,
      -0.01137,
      -0.01543,
      0.04041,
      0.05325,
      0.01101,
      0.01765,
      -0.0155,
      0.00288,
      -0.01268,
      0.06611,
      -0.06712,
      -0.0732,
      -0.02106,
      -0.00429,
      0.01424,
      0.01976,
      -0.01313,
      -0.02638,
      0.00245,
      -0.01466,
      -0.00234,
      -0.02453,
      -0.01794,
      -0.03161,
      -0.00773,
      -0.02156,
      -0.00894,
      -0.01285,
      -0.01387,
      0.14369,
      0.16755,
      0.18982,
      0.20369
    ],
    "hasReferenceEmbedding": true,
    "extractorVersion": "v2-sharp-spatial-spectral-v1",
    "referenceAssetCount": 3,
    "referenceAssetIds": [
      "REAL_BLIND_000951",
      "REAL_BLIND_000953",
      "REAL_BLIND_000955"
    ]
  },
  {
    "canonicalId": "porsche-718-cayman",
    "make": "Porsche",
    "model": "718 Cayman",
    "generation": "982",
    "variant": "Cayman",
    "displayName": "Porsche 718 Cayman",
    "bodyStyle": "Coupe",
    "productionYears": "2016–Present",
    "viewpointSignatures": {
      "front": [
        "horizontal bi-xenon headlights with 4-point led daytime running lights",
        "horizontal cooling slat front intakes"
      ],
      "side": [
        "compact mid-engine proportions",
        "side air intake scoop with two horizontal fins"
      ],
      "rear": [
        "high-gloss black horizontal accent strip connecting taillights with PORSCHE badge",
        "single central trapezoidal or twin exhaust"
      ]
    },
    "distinguishingFeatures": [
      "Distinctive high-gloss black accent strip connecting the slim rear taillights",
      "Compact sports coupe proportions with pronounced side intake air scoops",
      "Center-exit sports exhaust in rear apron"
    ],
    "featureVector": [
      0.12675,
      -0.35054,
      0.51726,
      0.25003,
      -0.06566,
      -0.05395,
      -0.03278,
      -0.0797,
      -0.25898,
      -0.24465,
      -0.0223,
      0.02702,
      -0.07697,
      -0.07434,
      -0.05954,
      -0.10545,
      -0.10308,
      -0.18615,
      -0.01003,
      0.01611,
      -0.11029,
      -0.11577,
      -0.11385,
      -0.13897,
      0.14646,
      -0.11893,
      0.00452,
      -0.00081,
      -0.03553,
      0.04736,
      0.0793,
      0.00994,
      0.00304,
      0.02739,
      0.05433,
      0.00408,
      0.01904,
      -0.01171,
      -0.01857,
      0.03764,
      -0.02207,
      -0.10298,
      -0.09367,
      0.00242,
      -0.01306,
      -0.00615,
      -0.01079,
      0.00056,
      -0.02348,
      -0.00593,
      -0.01277,
      -0.00602,
      -0.02141,
      -0.01791,
      -0.01396,
      -0.00921,
      -0.01975,
      -0.02092,
      -0.01426,
      -0.01374,
      0.18764,
      0.22166,
      0.21729,
      0.22863
    ],
    "hasReferenceEmbedding": true,
    "extractorVersion": "v2-sharp-spatial-spectral-v1",
    "referenceAssetCount": 1,
    "referenceAssetIds": [
      "REAL_BLIND_000294"
    ]
  },
  {
    "canonicalId": "ferrari-250-gto",
    "make": "Ferrari",
    "model": "250 GTO",
    "generation": "Classic",
    "variant": null,
    "displayName": "Ferrari 250 GTO",
    "bodyStyle": "Coupe",
    "productionYears": "1962–1964",
    "viewpointSignatures": {
      "front": [
        "classic round enclosed headlights",
        "three D-shaped cooling slots in upper nose cone",
        "oval radiator grille"
      ],
      "side": [
        "classic 1960s voluptuous long-hood short-deck GT silhouette",
        "Borrani wire-spoke knock-off wheels"
      ],
      "rear": [
        "integrated ducktail Kamm tail spoiler",
        "quad round exhaust pipes exiting low on either side"
      ]
    },
    "distinguishingFeatures": [
      "Three iconic removable D-shaped radiator air intake slots across the front nose",
      "Integrated Kamm-tail aerodynamic rear ducktail spoiler",
      "Twin circular taillights and classic front-engine Berlinetta proportions"
    ],
    "featureVector": [
      -0.12202,
      -0.41929,
      0.4561,
      0.13977,
      0.16206,
      0.15564,
      0.15586,
      -0.16722,
      0.08915,
      -0.05245,
      0.00631,
      -0.003,
      0.08671,
      0.00121,
      0.00019,
      -0.057,
      0.31908,
      0.03697,
      0.08601,
      -0.04377,
      0.08308,
      0.05773,
      0.05076,
      -0.13437,
      0.35093,
      0.10307,
      0.02884,
      -0.01965,
      0.06015,
      0.1014,
      0.10043,
      0.08937,
      -0.00102,
      -0.01622,
      -0.05261,
      0.01055,
      -0.0592,
      -0.08943,
      -0.07613,
      -0.02549,
      -0.00918,
      -0.01864,
      -0.03327,
      0.01928,
      -0.03579,
      -0.03035,
      -0.02895,
      -0.03679,
      -0.03055,
      -0.02269,
      -0.02991,
      -0.02135,
      -0.02432,
      -0.02539,
      -0.02818,
      -0.02069,
      -0.02045,
      -0.01681,
      -0.01636,
      -0.01849,
      0.1905,
      0.13831,
      0.16355,
      0.17614
    ],
    "hasReferenceEmbedding": true,
    "extractorVersion": "v2-sharp-spatial-spectral-v1",
    "referenceAssetCount": 4,
    "referenceAssetIds": [
      "REAL_BLIND_000633",
      "REAL_BLIND_000634",
      "REAL_BLIND_000635",
      "REAL_BLIND_000637"
    ]
  },
  {
    "canonicalId": "ferrari-328-gts",
    "make": "Ferrari",
    "model": "328",
    "generation": "Classic",
    "variant": "GTS",
    "displayName": "Ferrari 328 GTS",
    "bodyStyle": "Targa",
    "productionYears": "1985–1989",
    "viewpointSignatures": {
      "front": [
        "retractable pop-up headlights",
        "molded body-color front bumper with integrated rectangular driving lamps and turn signals"
      ],
      "side": [
        "removable black targa roof panel",
        "large scalloped NACA side intakes on doors"
      ],
      "rear": [
        "dual round taillights on each side",
        "quad exhaust pipes exiting beneath rear valance",
        "slotted rear engine lid"
      ]
    },
    "distinguishingFeatures": [
      "Retractable pop-up headlights and body-colored integrated front bumper",
      "Removable black targa roof panel storable behind seats",
      "Iconic scalloped side door air intakes leading to mid-mounted 3.2L V8"
    ],
    "featureVector": [
      -0.22234,
      -0.43929,
      0.45568,
      0.10126,
      -0.08003,
      -0.09202,
      -0.09566,
      -0.02882,
      -0.02117,
      -0.13268,
      0.0138,
      -0.00963,
      0.0827,
      -0.14144,
      -0.14797,
      0.16157,
      0.3867,
      0.0279,
      0.2274,
      -0.1186,
      -0.05475,
      -0.11392,
      -0.11983,
      -0.0065,
      0.22563,
      -0.01121,
      0.06212,
      -0.03549,
      -0.04693,
      -0.03529,
      0.01969,
      0.00628,
      0.01452,
      -0.02197,
      0.03901,
      0.09219,
      0.06149,
      -0.0116,
      -0.05096,
      -0.03292,
      0.09511,
      -0.00994,
      -0.08028,
      -0.0384,
      -0.02797,
      -0.01314,
      -0.01622,
      -0.02065,
      -0.01057,
      0.00182,
      0.00224,
      -0.00922,
      -0.01434,
      -0.02166,
      -0.02677,
      -0.01308,
      -0.03561,
      -0.00938,
      -0.01355,
      -0.02569,
      0.14733,
      0.14226,
      0.14038,
      0.11191
    ],
    "hasReferenceEmbedding": true,
    "extractorVersion": "v2-sharp-spatial-spectral-v1",
    "referenceAssetCount": 1,
    "referenceAssetIds": [
      "REAL_BLIND_000643"
    ]
  },
  {
    "canonicalId": "lamborghini-gallardo-lp560-4",
    "make": "Lamborghini",
    "model": "Gallardo",
    "generation": "First Generation",
    "variant": "LP560-4",
    "displayName": "Lamborghini Gallardo LP560-4",
    "bodyStyle": "Coupe",
    "productionYears": "2008–2013",
    "viewpointSignatures": {
      "front": [
        "enlarged triangular and trapezoidal front air intakes",
        "compact vertical bi-xenon headlights with Y-shaped led accents"
      ],
      "side": [
        "clean taut mid-engine wedge profile with standard forward-hinged doors (NOT scissor doors)"
      ],
      "rear": [
        "horizontal taillights with triple Y-shaped led elements",
        "quad round exhaust tips exiting low"
      ]
    },
    "distinguishingFeatures": [
      "Standard front-hinged doors (conventional doors, NOT upward-opening scissor doors)",
      "Quad circular exhaust tips flanking rear diffuser",
      "Clean angular wedge silhouette without massive rear wing"
    ],
    "featureVector": [],
    "hasReferenceEmbedding": false,
    "extractorVersion": "v2-sharp-spatial-spectral-v1",
    "referenceAssetCount": 0,
    "referenceAssetIds": []
  },
  {
    "canonicalId": "lamborghini-miura-p400",
    "make": "Lamborghini",
    "model": "Miura",
    "generation": "Classic",
    "variant": "P400",
    "displayName": "Lamborghini Miura P400",
    "bodyStyle": "Coupe",
    "productionYears": "1966–1973",
    "viewpointSignatures": {
      "front": [
        "pop-up round headlights with iconic black eyelash strakes",
        "low flowing nose with twin radiator exit grilles"
      ],
      "side": [
        "voluptuous Bertone supercar silhouette",
        "clamshell front and rear body sections"
      ],
      "rear": [
        "black horizontal louvers over transverse V12 rear window",
        "quad exhaust pipes exiting through lower mesh"
      ]
    },
    "distinguishingFeatures": [
      "Iconic headlight eyelash black slatted surrounds",
      "Black horizontal Venetian blind-style louvers over rear engine window",
      "Full front and rear clamshell cowls opening forward and backward"
    ],
    "featureVector": [],
    "hasReferenceEmbedding": false,
    "extractorVersion": "v2-sharp-spatial-spectral-v1",
    "referenceAssetCount": 0,
    "referenceAssetIds": []
  },
  {
    "canonicalId": "mclaren-570s",
    "make": "McLaren",
    "model": "570S",
    "generation": "Sports Series",
    "variant": null,
    "displayName": "McLaren 570S",
    "bodyStyle": "Coupe",
    "productionYears": "2015–2021",
    "viewpointSignatures": {
      "front": [
        "teardrop curved led headlights with black lower intake accent",
        "three-tier front bumper"
      ],
      "side": [
        "dihedral doors with floating aerodynamic door tendons directing air to rear intakes",
        "flying buttress C-pillars"
      ],
      "rear": [
        "dual round sports exhaust exits set in lower bumper",
        "slim curved led taillight blades",
        "mesh rear valance"
      ]
    },
    "distinguishingFeatures": [
      "Floating aerodynamic door tendons that carve air into side radiator scoops",
      "Flying buttress rear pillars creating an open aerodynamic air channel",
      "Dual round exhaust pipes exiting at the bottom of the rear bumper (NOT high-mounted)"
    ],
    "featureVector": [
      0.0469,
      -0.45375,
      0.57288,
      0.24482,
      -0.02192,
      -0.00879,
      -0.01759,
      -0.10944,
      -0.11835,
      0.10193,
      -0.00873,
      -0.00224,
      -0.10776,
      -0.0993,
      -0.07827,
      -0.11555,
      -0.19117,
      -0.1502,
      -0.01898,
      0.02526,
      -0.00142,
      -0.00078,
      -0.00116,
      -0.19971,
      0.14642,
      0.13855,
      -0.00045,
      -0.00007,
      -0.00046,
      0.05857,
      0.04393,
      0.05022,
      0.02987,
      -0.02192,
      -0.1089,
      -0.07666,
      -0.08679,
      -0.09556,
      -0.06189,
      -0.00122,
      0.00307,
      -0.01008,
      0.17637,
      0.10145,
      -0.02131,
      0.00562,
      0.00297,
      -0.02037,
      -0.01367,
      0.00753,
      0.00706,
      -0.00654,
      -0.016,
      0.00915,
      0.00297,
      -0.00426,
      -0.0024,
      -0.00703,
      0.00893,
      -0.01658,
      0.1485,
      0.17401,
      0.14787,
      0.14024
    ],
    "hasReferenceEmbedding": true,
    "extractorVersion": "v2-sharp-spatial-spectral-v1",
    "referenceAssetCount": 1,
    "referenceAssetIds": [
      "REAL_BLIND_000935"
    ]
  }
];
