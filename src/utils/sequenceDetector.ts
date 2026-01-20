import { FileItem } from '../types';

export interface SequenceGroup {
  id: string;
  baseName: string;        // e.g., "frame_" or "image_"
  extension: string;       // e.g., "png", "jpg"
  startFrame: number;
  endFrame: number;
  frameCount: number;
  padding: number;         // Number of digits, e.g., 4 for "0001"
  files: FileItem[];       // Sorted by frame number
  thumbnailFile: FileItem; // First frame for thumbnail
}

/**
 * Detect sequence frame patterns in file names
 * Supports patterns like:
 * - name_0001.png, name_0002.png...
 * - name.0001.png, name.0002.png...
 * - name0001.png, name0002.png...
 * - 0001.png, 0002.png...
 */
export function detectSequences(files: FileItem[]): {
  sequences: SequenceGroup[];
  nonSequenceFiles: FileItem[];
} {
  // Only process image files
  const imageFiles = files.filter(f => f.mimeType.startsWith('image/'));
  const nonImageFiles = files.filter(f => !f.mimeType.startsWith('image/'));
  
  // Pattern to match sequence naming: captures prefix, number, and extension
  // Examples: "frame_0001.png" -> ["frame_", "0001", "png"]
  const sequencePattern = /^(.+?[_.\-]?)(\d{2,})\.([a-zA-Z0-9]+)$/;
  const pureNumberPattern = /^(\d{2,})\.([a-zA-Z0-9]+)$/;
  
  // Group files by their sequence pattern
  const sequenceMap = new Map<string, { files: FileItem[]; numbers: number[]; padding: number }>();
  const standaloneFiles: FileItem[] = [];
  
  for (const file of imageFiles) {
    const fileName = file.originalName;
    
    // Try pure number pattern first (like "0001.png")
    let match = fileName.match(pureNumberPattern);
    let prefix = '';
    let numberStr = '';
    let extension = '';
    
    if (match) {
      prefix = '';
      numberStr = match[1];
      extension = match[2].toLowerCase();
    } else {
      // Try pattern with prefix
      match = fileName.match(sequencePattern);
      if (match) {
        prefix = match[1];
        numberStr = match[2];
        extension = match[3].toLowerCase();
      }
    }
    
    if (match && numberStr.length >= 2) {
      const frameNumber = parseInt(numberStr, 10);
      const padding = numberStr.length;
      const key = `${prefix}|${extension}|${padding}|${file.folderId || 'root'}`;
      
      if (!sequenceMap.has(key)) {
        sequenceMap.set(key, { files: [], numbers: [], padding });
      }
      
      const group = sequenceMap.get(key)!;
      group.files.push(file);
      group.numbers.push(frameNumber);
    } else {
      standaloneFiles.push(file);
    }
  }
  
  // Convert map to sequence groups (only if there are multiple files)
  const sequences: SequenceGroup[] = [];
  
  for (const [key, { files: seqFiles, numbers, padding }] of sequenceMap.entries()) {
    if (seqFiles.length >= 3) { // At least 3 frames to be considered a sequence
      const [prefix, extension] = key.split('|');
      
      // Sort files by frame number
      const sortedIndices = numbers
        .map((n, i) => ({ n, i }))
        .sort((a, b) => a.n - b.n);
      
      const sortedFiles = sortedIndices.map(({ i }) => seqFiles[i]);
      const sortedNumbers = sortedIndices.map(({ n }) => n);
      
      // Check if numbers are roughly sequential (allow some gaps)
      const minFrame = sortedNumbers[0];
      const maxFrame = sortedNumbers[sortedNumbers.length - 1];
      const expectedCount = maxFrame - minFrame + 1;
      const actualCount = sortedNumbers.length;
      
      // If we have at least 50% of expected frames, consider it a sequence
      if (actualCount >= expectedCount * 0.5 || actualCount >= 10) {
        sequences.push({
          id: `seq_${prefix}_${extension}_${minFrame}_${maxFrame}`,
          baseName: prefix,
          extension,
          startFrame: minFrame,
          endFrame: maxFrame,
          frameCount: actualCount,
          padding,
          files: sortedFiles,
          thumbnailFile: sortedFiles[0],
        });
      } else {
        // Not enough sequential frames, treat as standalone
        standaloneFiles.push(...seqFiles);
      }
    } else {
      // Too few files, treat as standalone
      standaloneFiles.push(...seqFiles);
    }
  }
  
  return {
    sequences,
    nonSequenceFiles: [...standaloneFiles, ...nonImageFiles],
  };
}

/**
 * Format sequence range for display
 * e.g., "frame_[0001-0100].png"
 */
export function formatSequenceRange(seq: SequenceGroup): string {
  const startStr = seq.startFrame.toString().padStart(seq.padding, '0');
  const endStr = seq.endFrame.toString().padStart(seq.padding, '0');
  return `${seq.baseName}[${startStr}-${endStr}].${seq.extension}`;
}

/**
 * Get frame file name for a specific frame number
 */
export function getFrameFileName(seq: SequenceGroup, frameNumber: number): string {
  const numStr = frameNumber.toString().padStart(seq.padding, '0');
  return `${seq.baseName}${numStr}.${seq.extension}`;
}
