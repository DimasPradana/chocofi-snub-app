const PALETTE = ['#8b95a5', '#5aa9ff', '#b18cff', '#ff9f5a', '#5dd39e', '#ff79c6', '#3fd0c9', '#e3d26f', '#ff6b6b', '#9fb3c8'];
export const layerColor = (i: number) => PALETTE[i % PALETTE.length];
