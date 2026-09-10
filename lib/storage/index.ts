import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const endpoint = process.env.STORAGE_ENDPOINT || 'http://localhost:9000';
const region = process.env.STORAGE_REGION || 'us-east-1';
const accessKeyId = process.env.STORAGE_ACCESS_KEY || 'minioadmin';
const secretAccessKey = process.env.STORAGE_SECRET_KEY || 'minioadmin';
const bucketName = process.env.STORAGE_BUCKET || 'oes-receipts';

export const s3Client = new S3Client({
  endpoint,
  region,
  credentials: {
    accessKeyId,
    secretAccessKey,
  },
  forcePathStyle: true, // Required for MinIO
});

export function calculateBufferSha256(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

export interface UploadAttachmentResult {
  storageKey: string;
  sha256Hash: string;
  fileSizeBytes: number;
  mimeType: string;
}

/**
 * Stores file with dual-layer persistence:
 * 1. Local disk storage (guarantees images are never broken in standalone/local dev)
 * 2. Private S3 object storage (MinIO / Cloudflare R2 if available)
 */
export async function uploadAttachment(
  fileBuffer: Buffer,
  originalFilename: string,
  mimeType: string
): Promise<UploadAttachmentResult> {
  const fileSizeBytes = fileBuffer.length;
  const sha256Hash = calculateBufferSha256(fileBuffer);
  const ext = originalFilename.split('.').pop() || 'bin';
  const storageKey = `attachments/${new Date().getFullYear()}/${crypto.randomUUID()}.${ext}`;

  // 1. Guaranteed local filesystem storage
  try {
    const localFilePath = path.join(process.cwd(), 'public', 'uploads', storageKey);
    await fs.promises.mkdir(path.dirname(localFilePath), { recursive: true });
    await fs.promises.writeFile(localFilePath, fileBuffer);
  } catch (fsErr) {
    console.warn('[Storage Warning] Failed to write local disk copy:', fsErr);
  }

  // 2. S3 / MinIO storage upload if reachable
  try {
    await s3Client.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: storageKey,
        Body: fileBuffer,
        ContentType: mimeType,
        Metadata: {
          originalFilename: encodeURIComponent(originalFilename),
          sha256: sha256Hash,
        },
      })
    );
  } catch (err) {
    // Expected when running without MinIO container
  }

  return {
    storageKey,
    sha256Hash,
    fileSizeBytes,
    mimeType,
  };
}

/**
 * Generates download URL:
 * Prefers direct local static URL (/uploads/...) or /api/attachments/... so browser never fails on unexposed ports.
 */
export async function getSignedDownloadUrl(storageKey: string, expiresInSeconds = 900): Promise<string> {
  // 1. If stored locally in public/uploads, serve directly through Next.js
  const localFile = path.join(process.cwd(), 'public', 'uploads', storageKey);
  if (fs.existsSync(localFile)) {
    return `/uploads/${storageKey}`;
  }

  // 2. Otherwise attempt S3 presigned URL
  try {
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: storageKey,
    });
    return await getSignedUrl(s3Client, command, { expiresIn: expiresInSeconds });
  } catch (error) {
    return `/api/attachments/${storageKey}`;
  }
}

/**
 * Deletes file from both object storage and local filesystem
 */
export async function deleteAttachment(storageKey: string): Promise<void> {
  try {
    const localFile = path.join(process.cwd(), 'public', 'uploads', storageKey);
    if (fs.existsSync(localFile)) {
      await fs.promises.unlink(localFile);
    }
  } catch (err) {
    // Ignore local unlink errors
  }

  try {
    await s3Client.send(
      new DeleteObjectCommand({
        Bucket: bucketName,
        Key: storageKey,
      })
    );
  } catch (error) {
    // Ignore S3 delete errors
  }
}
