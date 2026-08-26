/**
 * Zero-dependency pure JavaScript ZIP generator (PKZIP specification)
 * Handles binary files, images, PDFs, spreadsheets, and documents in browser.
 */

// CRC-32 table generator
const makeCrcTable = () => {
  let c;
  const crcTable = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) {
      c = ((c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1));
    }
    crcTable[n] = c;
  }
  return crcTable;
};

const crcTable = makeCrcTable();

const crc32 = (buf) => {
  let crc = 0 ^ (-1);
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ buf[i]) & 0xFF];
  }
  return (crc ^ (-1)) >>> 0;
};

export class SimpleZipBuilder {
  constructor() {
    this.files = [];
  }

  /**
   * Add a file to the ZIP archive
   * @param {string} filename
   * @param {Uint8Array|ArrayBuffer|string} content
   */
  addFile(filename, content) {
    let data;
    if (typeof content === 'string') {
      data = new TextEncoder().encode(content);
    } else if (content instanceof ArrayBuffer) {
      data = new Uint8Array(content);
    } else if (content instanceof Uint8Array) {
      data = content;
    } else {
      data = new Uint8Array(0);
    }

    const nameBytes = new TextEncoder().encode(filename);
    const checksum = crc32(data);

    this.files.push({
      name: filename,
      nameBytes,
      data,
      crc: checksum,
      size: data.length
    });
  }

  /**
   * Build complete ZIP file as a Blob
   * @returns {Blob}
   */
  build() {
    const parts = [];
    let offset = 0;
    const centralDirectoryEntries = [];

    // 1. Write Local File Headers + File Data
    for (const file of this.files) {
      const header = new Uint8Array(30 + file.nameBytes.length);
      const view = new DataView(header.buffer);

      // Local file header signature: 0x04034b50 ("PK\x03\x04")
      view.setUint32(0, 0x04034b50, true);
      // Version needed to extract: 20 (2.0)
      view.setUint16(4, 20, true);
      // General purpose bit flag
      view.setUint16(6, 0x0800, true); // UTF-8 filename flag
      // Compression method: 0 (Stored / uncompressed)
      view.setUint16(8, 0, true);
      // Last mod time / date
      view.setUint16(10, 0x5460, true);
      view.setUint16(12, 0x5500, true);
      // CRC-32
      view.setUint32(14, file.crc, true);
      // Compressed size
      view.setUint32(18, file.size, true);
      // Uncompressed size
      view.setUint32(22, file.size, true);
      // File name length
      view.setUint16(26, file.nameBytes.length, true);
      // Extra field length
      view.setUint16(28, 0, true);

      // Copy filename bytes
      header.set(file.nameBytes, 30);

      parts.push(header);
      parts.push(file.data);

      centralDirectoryEntries.push({
        file,
        offset
      });

      offset += header.length + file.data.length;
    }

    const centralDirectoryStart = offset;
    let centralDirectorySize = 0;

    // 2. Write Central Directory Entries
    for (const entry of centralDirectoryEntries) {
      const file = entry.file;
      const cdHeader = new Uint8Array(46 + file.nameBytes.length);
      const view = new DataView(cdHeader.buffer);

      // Central file header signature: 0x02014b50 ("PK\x01\x02")
      view.setUint32(0, 0x02014b50, true);
      // Version made by: 20
      view.setUint16(4, 20, true);
      // Version needed to extract: 20
      view.setUint16(6, 20, true);
      // General purpose bit flag (UTF-8)
      view.setUint16(8, 0x0800, true);
      // Compression method: 0
      view.setUint16(10, 0, true);
      // Last mod time / date
      view.setUint16(12, 0x5460, true);
      view.setUint16(14, 0x5500, true);
      // CRC-32
      view.setUint32(16, file.crc, true);
      // Compressed size
      view.setUint32(20, file.size, true);
      // Uncompressed size
      view.setUint32(24, file.size, true);
      // File name length
      view.setUint16(28, file.nameBytes.length, true);
      // Extra field length
      view.setUint16(30, 0, true);
      // File comment length
      view.setUint16(32, 0, true);
      // Disk number start
      view.setUint16(34, 0, true);
      // Internal file attributes
      view.setUint16(36, 0, true);
      // External file attributes
      view.setUint32(38, 0, true);
      // Relative offset of local header
      view.setUint32(42, entry.offset, true);

      // Copy filename bytes
      cdHeader.set(file.nameBytes, 46);

      parts.push(cdHeader);
      centralDirectorySize += cdHeader.length;
    }

    // 3. End of Central Directory Record (EOCD)
    const eocd = new Uint8Array(22);
    const eocdView = new DataView(eocd.buffer);

    // EOCD signature: 0x06054b50 ("PK\x05\x06")
    eocdView.setUint32(0, 0x06054b50, true);
    // Number of this disk: 0
    eocdView.setUint16(4, 0, true);
    // Disk where central directory starts: 0
    eocdView.setUint16(6, 0, true);
    // Number of central directory records on this disk
    eocdView.setUint16(8, this.files.length, true);
    // Total number of central directory records
    eocdView.setUint16(10, this.files.length, true);
    // Size of central directory
    eocdView.setUint32(12, centralDirectorySize, true);
    // Offset of start of central directory
    eocdView.setUint32(16, centralDirectoryStart, true);
    // Comment length: 0
    eocdView.setUint16(20, 0, true);

    parts.push(eocd);

    return new Blob(parts, { type: 'application/zip' });
  }
}

/**
 * Fetch file data through proxy or direct URL
 */
const fetchFileBuffer = async (file) => {
  const targetUrl = file.previewUrl || file.downloadUrl || file.webUrl;
  if (!targetUrl || targetUrl === '#') {
    throw new Error(`No downloadable URL for file: ${file.name}`);
  }

  const res = await fetch(targetUrl);
  if (!res.ok) {
    throw new Error(`Failed to fetch file content: HTTP ${res.status}`);
  }
  return await res.arrayBuffer();
};

/**
 * High-level helper: Batch download multiple files as a single ZIP
 */
export const downloadFilesAsZip = async (files, zipName = 'TeamsHub-Files-Bundle.zip', onProgress = () => {}) => {
  if (!files || files.length === 0) return;

  const zip = new SimpleZipBuilder();
  const total = files.length;
  const nameCounts = {};

  for (let i = 0; i < total; i++) {
    const file = files[i];
    onProgress({ current: i + 1, total, currentFileName: file.name });

    let safeName = file.name || `file_${i + 1}`;
    // Deduplicate file names in zip if duplicate names exist
    if (nameCounts[safeName]) {
      nameCounts[safeName]++;
      const parts = safeName.split('.');
      if (parts.length > 1) {
        const ext = parts.pop();
        safeName = `${parts.join('.')}_${nameCounts[safeName]}.${ext}`;
      } else {
        safeName = `${safeName}_${nameCounts[safeName]}`;
      }
    } else {
      nameCounts[safeName] = 1;
    }

    try {
      const buffer = await fetchFileBuffer(file);
      zip.addFile(safeName, buffer);
    } catch (err) {
      console.warn(`[ZipBuilder] Skipping unreadable file ${file.name}:`, err.message);
      // Add a small error placeholder text file inside zip so user knows
      zip.addFile(`${safeName}.error.txt`, `Unable to download ${file.name} from Microsoft Graph: ${err.message}`);
    }
  }

  const zipBlob = zip.build();
  const downloadUrl = URL.createObjectURL(zipBlob);
  const a = document.createElement('a');
  a.href = downloadUrl;
  a.download = zipName.endsWith('.zip') ? zipName : `${zipName}.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  setTimeout(() => {
    URL.revokeObjectURL(downloadUrl);
  }, 10000);
};
