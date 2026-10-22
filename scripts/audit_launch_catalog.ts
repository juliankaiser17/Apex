import { canonicalVehicleRegistry } from '../src/ai-engine/canonical/canonicalVehicleRegistry';
import { MORPHOLOGICAL_FINGERPRINTS } from '../src/ai-engine/validation/fineGrainedModelDiscriminator';

const priorityCatalog: Record<string, string[]> = {
  Ferrari: ['SF90 Stradale', 'SF90 Spider', 'Daytona SP3', '296 GTB', '296 GTS', 'F8 Tributo', 'F8 Spider', '488 GTB', '488 Spider', '488 Pista', '812 Superfast', '812 GTS', '812 Competizione', 'Roma', 'Roma Spider', 'Purosangue', 'LaFerrari'],
  Koenigsegg: ['Jesko Attack', 'Jesko Absolut', 'Gemera', 'Regera', 'Agera RS', 'CC850', 'One:1'],
  Bugatti: ['Chiron', 'Chiron Sport', 'Chiron Pur Sport', 'Chiron Super Sport', 'Veyron', 'Divo', 'Bolide', 'Tourbillon'],
  McLaren: ['570S', '600LT', '720S', '750S', '765LT', 'Artura', 'P1', 'Senna', 'Speedtail'],
  Maserati: ['MC20', 'MC20 Cielo', 'GranTurismo', 'MC12'],
  Porsche: ['911 Carrera', '911 Turbo', '911 GT3', '911 GT3 RS', '911 GT2 RS', '911 Dakar', '918 Spyder', 'Carrera GT', '718 Cayman GT4 RS', 'Taycan'],
  Lamborghini: ['Huracán', 'Aventador', 'Revuelto', 'Urus'],
  Toyota: ['Corolla', 'Camry', 'Prius', 'Yaris', 'Alphard', 'Vellfire', 'Crown Comfort'],
  Honda: ['Civic', 'Accord', 'Fit', 'Stepwgn', 'Odyssey'],
  Nissan: ['Note', 'Serena', 'X-Trail', 'NV200'],
  Mazda: ['Mazda2', 'Mazda3', 'CX-5'],
  Volkswagen: ['Golf', 'Tiguan'],
  Lexus: ['ES', 'RX', 'LM'],
  Tesla: ['Model 3', 'Model Y'],
  BYD: ['Atto 3', 'Seal']
};

console.log('=== AUDITING PRIORITY CATALOG IN CANONICAL REGISTRY & FINGERPRINTS ===\n');

for (const [make, models] of Object.entries(priorityCatalog)) {
  console.log(`\nMAKE: ${make}`);
  for (const m of models) {
    const regMatch = canonicalVehicleRegistry.lookupByTextOrAlias(m, make);
    const fpMatches = MORPHOLOGICAL_FINGERPRINTS.filter(f =>
      f.make?.toLowerCase() === make.toLowerCase() &&
      ((f.model?.toLowerCase() || '').includes(m.toLowerCase()) || (f.vehicleId?.toLowerCase() || '').includes(m.toLowerCase()))
    );
    const hasReg = Boolean(regMatch);
    const hasFp = fpMatches.length > 0;
    console.log(`  - ${m.padEnd(20)}: Registry=${hasReg ? 'YES (' + regMatch?.vehicleId + ')' : 'MISSING'}, Fingerprint=${hasFp ? 'YES (' + fpMatches[0].vehicleId + ')' : 'NO'}`);
  }
}
