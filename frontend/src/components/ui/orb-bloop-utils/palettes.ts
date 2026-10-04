export enum BloopPaletteName {
  blue = "blue",
  teal = "teal",
  rose = "rose",
  emerald = "emerald",
  amber = "amber",
  violet = "violet",
}

export interface BloopPalette {
  main: [number, number, number];
  low: [number, number, number];
  mid: [number, number, number];
  high: [number, number, number];
}

export const BLOOP_PALETTES: Record<BloopPaletteName, BloopPalette> = {
  [BloopPaletteName.blue]: {
    main: [0.1, 0.5, 1.0],
    low: [0.1, 0.2, 0.8],
    mid: [0.2, 0.4, 0.9],
    high: [0.5, 0.8, 1.0],
  },
  [BloopPaletteName.teal]: {
    main: [0.06, 0.46, 0.43], // Sahayak calm deep teal
    low: [0.04, 0.25, 0.24],
    mid: [0.08, 0.65, 0.60],
    high: [0.60, 0.96, 0.89],
  },
  [BloopPaletteName.rose]: {
    main: [0.88, 0.24, 0.44],
    low: [0.55, 0.12, 0.25],
    mid: [0.95, 0.35, 0.55],
    high: [1.0, 0.75, 0.85],
  },
  [BloopPaletteName.emerald]: {
    main: [0.05, 0.60, 0.38],
    low: [0.02, 0.30, 0.18],
    mid: [0.10, 0.75, 0.48],
    high: [0.55, 0.95, 0.75],
  },
  [BloopPaletteName.amber]: {
    main: [0.85, 0.55, 0.05],
    low: [0.50, 0.25, 0.02],
    mid: [0.95, 0.68, 0.15],
    high: [1.0, 0.88, 0.50],
  },
  [BloopPaletteName.violet]: {
    main: [0.50, 0.25, 0.90],
    low: [0.28, 0.12, 0.60],
    mid: [0.65, 0.38, 0.95],
    high: [0.85, 0.70, 1.0],
  },
};
