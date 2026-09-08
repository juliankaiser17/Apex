/**
 * APEX — Hard Negative Confusion Registry
 * Tracks pairs of vehicles that are frequently confused by vision models
 * and provides explicit optical distinguishing rules.
 */

export interface HardNegativePair {
  id: string;
  vehicleAId: string;
  vehicleBId: string;
  vehicleAName: string;
  vehicleBName: string;
  confusionRate: number; // e.g., 0.18
  distinguishingFeatures: {
    featureName: string;
    vehicleAAttribute: string;
    vehicleBAttribute: string;
    opticalRegion: 'front_bumper' | 'hood' | 'fender_vents' | 'rear_wing' | 'exhaust_tips' | 'door_count';
  }[];
}

export const HARD_NEGATIVE_CONFUSION_PAIRS: HardNegativePair[] = [
  {
    id: 'hn-992-gt3rs-vs-gt3',
    vehicleAId: 'porsche-911-gt3-rs-992',
    vehicleBId: 'porsche-911-gt3-992',
    vehicleAName: 'Porsche 911 GT3 RS (992)',
    vehicleBName: 'Porsche 911 GT3 (992)',
    confusionRate: 0.22,
    distinguishingFeatures: [
      {
        featureName: 'Rear Wing Aerodynamics',
        vehicleAAttribute: 'Massive active swan-neck wing higher than roofline with DRS actuator',
        vehicleBAttribute: 'Standard swan-neck wing level with roofline (no active DRS hydraulic pod)',
        opticalRegion: 'rear_wing'
      },
      {
        featureName: 'Front Fender Louvers',
        vehicleAAttribute: 'Deep carbon louvers and aerodynamic door cutouts behind front wheels',
        vehicleBAttribute: 'Smooth clean front fenders without louvers',
        opticalRegion: 'fender_vents'
      },
      {
        featureName: 'Front Hood Vents',
        vehicleAAttribute: 'Two large central nostrils cooling the single angled center radiator',
        vehicleBAttribute: 'Two small dual extraction nostrils at leading edge of frunk',
        opticalRegion: 'hood'
      }
    ]
  },
  {
    id: 'hn-bmw-m3-g80-vs-m4-g82',
    vehicleAId: 'bmw-m3-competition-g80',
    vehicleBId: 'bmw-m4-competition-g82',
    vehicleAName: 'BMW M3 Competition (G80)',
    vehicleBName: 'BMW M4 Competition (G82)',
    confusionRate: 0.31,
    distinguishingFeatures: [
      {
        featureName: 'Door Count & Greenhouse',
        vehicleAAttribute: '4-door sports sedan silhouette with flared rear wheel arches',
        vehicleBAttribute: '2-door sports coupe silhouette with sweeping roofline',
        opticalRegion: 'door_count'
      }
    ]
  },
  {
    id: 'hn-nissan-r34-vs-r35',
    vehicleAId: 'nissan-skyline-gt-r-r34',
    vehicleBId: 'nissan-gt-r-nismo-r35',
    vehicleAName: 'Nissan Skyline GT-R (R34)',
    vehicleBName: 'Nissan GT-R NISMO (R35)',
    confusionRate: 0.08,
    distinguishingFeatures: [
      {
        featureName: 'Front Grille and Headlights',
        vehicleAAttribute: 'Rectangular 90s halogen/xenon horizontal housing with Skyline badge',
        vehicleBAttribute: 'Swept-back angular lightning-bolt LED headlights',
        opticalRegion: 'front_bumper'
      }
    ]
  }
];

export class HardNegativesEngine {
  public findConfusionPair(vehicleIdA: string, vehicleIdB: string): HardNegativePair | null {
    return HARD_NEGATIVE_CONFUSION_PAIRS.find(
      (p) =>
        (p.vehicleAId === vehicleIdA && p.vehicleBId === vehicleIdB) ||
        (p.vehicleAId === vehicleIdB && p.vehicleBId === vehicleIdA)
    ) || null;
  }

  public getDistinguishingPromptInstructions(candidateIds: string[]): string[] {
    const instructions: string[] = [];

    for (let i = 0; i < candidateIds.length; i++) {
      for (let j = i + 1; j < candidateIds.length; j++) {
        const pair = this.findConfusionPair(candidateIds[i], candidateIds[j]);
        if (pair) {
          instructions.push(
            `DIFFERENTIATION NOTE for ${pair.vehicleAName} vs ${pair.vehicleBName}:\n` +
            pair.distinguishingFeatures
              .map(
                (f) =>
                  ` - ${f.featureName}: ${pair.vehicleAName} has "${f.vehicleAAttribute}", while ${pair.vehicleBName} has "${f.vehicleBAttribute}".`
              )
              .join('\n')
          );
        }
      }
    }

    return instructions;
  }
}

export const hardNegativesEngine = new HardNegativesEngine();
