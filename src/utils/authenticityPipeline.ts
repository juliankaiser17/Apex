export interface ExifPayload {
  dateTimeOriginal: string; // ISO string
  gps: {
    lat: number;
    lng: number;
    accuracy?: number;
  } | null;
  software?: string; // e.g. "iOS 17.4 Camera", "Photoshop", "Screenshot"
  width: number;
  height: number;
  deviceModel?: string;
}

export interface AuthenticityResult {
  passed: boolean;
  isRealPhoto: boolean;
  isScreenshot: boolean;
  isDigitallyEdited: boolean;
  isFromInternet: boolean;
  confidence: number;
  rejectionReason: string | null;
  exifValid: boolean;
  exifFailureDetails?: string;
}

// Stage 1: EXIF Validation (Server-side simulation)
export function validateExifData(exif: ExifPayload): { valid: boolean; reason?: string } {
  const now = Date.now();
  const photoTime = new Date(exif.dateTimeOriginal).getTime();
  const timeDifferenceSec = Math.abs((now - photoTime) / 1000);

  // 1. Check DateTimeOriginal within 180 seconds
  if (isNaN(photoTime) || timeDifferenceSec > 180) {
    return {
      valid: false,
      reason: "We couldn't verify this photo was taken right now (timestamp outdated)."
    };
  }

  // 2. Check Software field for screenshots or image editors
  const softwareLower = (exif.software || '').toLowerCase();
  const illegalSoftwareKeywords = ['photoshop', 'canva', 'lightroom', 'screenshot', 'gimp', 'snapseed', 'picsart'];
  if (illegalSoftwareKeywords.some(kw => softwareLower.includes(kw))) {
    return {
      valid: false,
      reason: "This image appears to have been edited or captured via screenshot."
    };
  }

  // 3. Check Image Dimensions (minimum hardware camera resolution check)
  if (exif.width < 1000 || exif.height < 700) {
    return {
      valid: false,
      reason: "Low-resolution or web-scraped image detected. Please use device camera."
    };
  }

  return { valid: true };
}

// Stage 2: AI Visual Authenticity Pipeline (Claude claude-sonnet-4-6 Vision analysis engine)
export async function runAiAuthenticityCheck(
  _photoDataUrl: string,
  exif: ExifPayload
): Promise<AuthenticityResult> {
  // First run Stage 1: EXIF Check
  const exifResult = validateExifData(exif);
  if (!exifResult.valid) {
    return {
      passed: false,
      isRealPhoto: false,
      isScreenshot: true,
      isDigitallyEdited: false,
      isFromInternet: false,
      confidence: 0.95,
      rejectionReason: exifResult.reason || 'EXIF verification failed',
      exifValid: false,
      exifFailureDetails: exifResult.reason
    };
  }

  // Simulate Stage 2: Claude claude-sonnet-4-6 Vision Analysis
  // System Prompt checks compression artifacts, lighting consistency, perspective, digital signatures
  const isLikelyScreenshot = Math.random() < 0.05; // 5% chance mock test for edge cases
  const isLikelyEdited = Math.random() < 0.03;

  if (isLikelyScreenshot) {
    return {
      passed: false,
      isRealPhoto: false,
      isScreenshot: true,
      isDigitallyEdited: false,
      isFromInternet: false,
      confidence: 0.92,
      rejectionReason: 'This looks like a screenshot, not a real photo.',
      exifValid: true
    };
  }

  if (isLikelyEdited) {
    return {
      passed: false,
      isRealPhoto: false,
      isScreenshot: false,
      isDigitallyEdited: true,
      isFromInternet: false,
      confidence: 0.88,
      rejectionReason: 'This image appears to have been edited.',
      exifValid: true
    };
  }

  // Authenticity Passed Cleanly!
  return {
    passed: true,
    isRealPhoto: true,
    isScreenshot: false,
    isDigitallyEdited: false,
    isFromInternet: false,
    confidence: 0.98,
    rejectionReason: null,
    exifValid: true
  };
}
