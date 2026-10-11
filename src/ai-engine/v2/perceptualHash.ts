import sharp from 'sharp';

/**
 * APEX Perceptual Hashing & Near-Duplicate Guard
 *
 * Implements 64-bit dHash (difference hash) and 64-bit pHash (2D-DCT perceptual hash)
 * using Sharp. Used to detect near-duplicates, burst captures, and cross-split leakage.
 */

const DCT_N = 32;
// Precompute 1D DCT transformation matrix (32x32)
const DCT_MATRIX: number[][] = [];
for (let i = 0; i < DCT_N; i++) {
  DCT_MATRIX[i] = [];
  for (let j = 0; j < DCT_N; j++) {
    const factor = i === 0 ? Math.sqrt(1 / DCT_N) : Math.sqrt(2 / DCT_N);
    DCT_MATRIX[i][j] = factor * Math.cos(((2 * j + 1) * i * Math.PI) / (2 * DCT_N));
  }
}

/**
 * Compute 64-bit dHash (Difference Hash)
 * Resizes to 9x8 grayscale, computes horizontal gradient differences.
 */
export async function computeDHash(imageSource: string | Buffer): Promise<string> {
  const { data } = await sharp(imageSource)
    .grayscale()
    .resize(9, 8, { fit: 'fill' })
    .raw()
    .toBuffer({ resolveWithObject: true });

  let hash = '';
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const left = data[row * 9 + col];
      const right = data[row * 9 + col + 1];
      hash += left < right ? '1' : '0';
    }
  }

  // Convert 64-bit binary string to 16-character hex
  return BigInt('0b' + hash).toString(16).padStart(16, '0');
}

/**
 * Compute 64-bit pHash (Perceptual Hash via 2D-DCT)
 * Resizes to 32x32 grayscale, performs 2D DCT, extracts top 8x8 low-frequency block,
 * and thresholds against the median.
 */
export async function computePHash(imageSource: string | Buffer): Promise<string> {
  const { data } = await sharp(imageSource)
    .grayscale()
    .resize(DCT_N, DCT_N, { fit: 'fill' })
    .raw()
    .toBuffer({ resolveWithObject: true });

  // 32x32 pixel matrix M
  const M: number[][] = [];
  for (let r = 0; r < DCT_N; r++) {
    M[r] = [];
    for (let c = 0; c < DCT_N; c++) {
      M[r][c] = data[r * DCT_N + c];
    }
  }

  // 2D DCT: DCT = (T * M) * T^T
  // Intermediate temp = T * M (only top 8 rows needed)
  const temp: number[][] = [];
  for (let i = 0; i < 8; i++) {
    temp[i] = [];
    for (let j = 0; j < DCT_N; j++) {
      let sum = 0;
      for (let k = 0; k < DCT_N; k++) {
        sum += DCT_MATRIX[i][k] * M[k][j];
      }
      temp[i][j] = sum;
    }
  }

  // Multiply by T^T for top-left 8x8
  const dctCoeffs: number[] = [];
  const acCoeffs: number[] = [];
  for (let i = 0; i < 8; i++) {
    for (let j = 0; j < 8; j++) {
      let sum = 0;
      for (let k = 0; k < DCT_N; k++) {
        sum += temp[i][k] * DCT_MATRIX[j][k];
      }
      dctCoeffs.push(sum);
      // Exclude DC component (0,0) from median calculation
      if (!(i === 0 && j === 0)) {
        acCoeffs.push(sum);
      }
    }
  }

  // Compute median of AC coefficients
  acCoeffs.sort((a, b) => a - b);
  const median = acCoeffs[Math.floor(acCoeffs.length / 2)];

  let hashBits = '';
  for (let i = 0; i < 64; i++) {
    hashBits += dctCoeffs[i] > median ? '1' : '0';
  }

  return BigInt('0b' + hashBits).toString(16).padStart(16, '0');
}

/**
 * Compute Hamming distance between two 16-character hex hashes (64-bit)
 */
export function hammingDistance(hexA: string, hexB: string): number {
  if (!hexA || !hexB) return 64;
  const a = BigInt('0x' + hexA);
  const b = BigInt('0x' + hexB);
  let xor = a ^ b;
  let count = 0;
  while (xor > 0n) {
    if (xor & 1n) count++;
    xor >>= 1n;
  }
  return count;
}
