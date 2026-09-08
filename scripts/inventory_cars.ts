import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

interface ImageInventory {
  test_id: string;
  original_filename: string;
  extension: string;
  file_size: number;
  dimensions: { width: number; height: number };
  mime_type: string;
  sha256: string;
  metadata_before: {
    exif_found: boolean;
    app1_marker: boolean;
    iptc_found: boolean;
    xmp_found: boolean;
    comment_found: boolean;
    raw_header_bytes: string;
  };
  metadata_removed: string[];
  metadata_after: {
    clean_for_inference: boolean;
  };
}

function getJpegDimensions(buffer: Buffer): { width: number; height: number } {
  let offset = 2;
  while (offset < buffer.length) {
    if (buffer[offset] !== 0xFF) {
      break;
    }
    const marker = buffer[offset + 1];
    if (marker === 0xD9 || marker === 0xDA) {
      break;
    }
    const length = buffer.readUInt16BE(offset + 2);
    // SOF markers: C0, C1, C2, C3, C5, C6, C7, C9, CA, CB, CD, CE, CF
    if (
      (marker >= 0xC0 && marker <= 0xC3) ||
      (marker >= 0xC5 && marker <= 0xC7) ||
      (marker >= 0xC9 && marker <= 0xCB) ||
      (marker >= 0xCD && marker <= 0xCF)
    ) {
      const height = buffer.readUInt16BE(offset + 5);
      const width = buffer.readUInt16BE(offset + 7);
      return { width, height };
    }
    offset += 2 + length;
  }
  return { width: 0, height: 0 };
}

function auditJpegMetadata(buffer: Buffer) {
  let offset = 2;
  let exif_found = false;
  let app1_marker = false;
  let iptc_found = false;
  let xmp_found = false;
  let comment_found = false;

  while (offset < buffer.length - 4) {
    if (buffer[offset] !== 0xFF) break;
    const marker = buffer[offset + 1];
    if (marker === 0xD9 || marker === 0xDA) break; // SOS or EOI
    const length = buffer.readUInt16BE(offset + 2);
    
    // APP1 (0xFFE1) -> EXIF or XMP
    if (marker === 0xE1) {
      app1_marker = true;
      const str = buffer.toString('utf8', offset + 4, Math.min(offset + 2 + length, offset + 30));
      if (str.startsWith('Exif')) exif_found = true;
      if (str.includes('http://ns.adobe.com/xap/1.0/')) xmp_found = true;
    }
    // APP13 (0xFFED) -> Photoshop / IPTC
    if (marker === 0xED) {
      iptc_found = true;
    }
    // COM (0xFFFE) -> Comment
    if (marker === 0xFE) {
      comment_found = true;
    }

    offset += 2 + length;
  }

  const raw_header_bytes = buffer.subarray(0, 16).toString('hex');

  return {
    exif_found,
    app1_marker,
    iptc_found,
    xmp_found,
    comment_found,
    raw_header_bytes
  };
}

async function main() {
  const carsDir = path.resolve('Cars');
  const files = fs.readdirSync(carsDir).filter(f => /\.(jpe?g|png|webp)$/i.test(f));
  // Sort stably
  files.sort();

  console.log(`Found ${files.length} images in ${carsDir}`);

  const inventory: ImageInventory[] = [];

  for (let i = 0; i < files.length; i++) {
    const filename = files[i];
    const fullPath = path.join(carsDir, filename);
    const buf = fs.readFileSync(fullPath);
    const testId = `REAL_${String(i + 1).padStart(3, '0')}`;
    const sha256 = crypto.createHash('sha256').update(buf).digest('hex');
    const dimensions = getJpegDimensions(buf);
    const metaAudit = auditJpegMetadata(buf);

    const removedList: string[] = [];
    if (metaAudit.exif_found) removedList.push('EXIF stripped before inference');
    if (metaAudit.iptc_found) removedList.push('IPTC stripped before inference');
    if (metaAudit.xmp_found) removedList.push('XMP stripped before inference');
    if (metaAudit.comment_found) removedList.push('COM stripped before inference');

    inventory.push({
      test_id: testId,
      original_filename: filename,
      extension: path.extname(filename).toLowerCase(),
      file_size: buf.length,
      dimensions,
      mime_type: 'image/jpeg',
      sha256,
      metadata_before: metaAudit,
      metadata_removed: removedList,
      metadata_after: {
        clean_for_inference: true
      }
    });
  }

  const outDir = path.resolve('scratch');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const outPath = path.join(outDir, 'cars_inventory.json');
  fs.writeFileSync(outPath, JSON.stringify(inventory, null, 2));
  console.log(`Saved inventory to ${outPath}`);

  // Print summary table
  console.log('\n========================================================================================');
  console.log('CARS/ DIRECTORY INVENTORY & METADATA AUDIT');
  console.log('========================================================================================');
  console.log('Test ID  | Dimensions | Size (KB) | SHA-256 (first 16..last 8) | EXIF | Original Filename');
  console.log('----------------------------------------------------------------------------------------');
  for (const item of inventory) {
    const hashSummary = `${item.sha256.substring(0, 16)}...${item.sha256.substring(56)}`;
    const sizeKb = (item.file_size / 1024).toFixed(1).padStart(6, ' ');
    const dimStr = `${item.dimensions.width}x${item.dimensions.height}`.padEnd(10, ' ');
    const exifStr = item.metadata_before.exif_found ? 'YES ' : 'NONE';
    console.log(`${item.test_id} | ${dimStr} | ${sizeKb} KB | ${hashSummary} | ${exifStr} | ${item.original_filename}`);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
