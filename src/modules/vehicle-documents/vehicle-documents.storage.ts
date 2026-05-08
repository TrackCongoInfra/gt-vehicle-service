import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Storage } from '@google-cloud/storage';

/**
 * GCS-backed file storage for vehicle documents.
 *
 * Layout: gs://<bucket>/<orgId>/<vehicleId>/<docId>/<originalFilename>
 * Returns the canonical https URL stored on `vehicle_documents.file_url`.
 */
@Injectable()
export class VehicleDocumentsStorage implements OnModuleInit {
  private readonly logger = new Logger(VehicleDocumentsStorage.name);
  private readonly storage = new Storage();
  private bucketName!: string;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    this.bucketName =
      this.config.get<string>('GCS_BUCKET_VEHICLE_DOCUMENTS') ??
      'gt-vehicle-document';
  }

  async upload(
    orgId: string,
    vehicleId: string,
    docId: string,
    file: Express.Multer.File,
  ): Promise<string> {
    const safeName = this.sanitiseName(file.originalname);
    const objectPath = `${orgId}/${vehicleId}/${docId}/${safeName}`;
    const obj = this.storage.bucket(this.bucketName).file(objectPath);

    await obj.save(file.buffer, {
      contentType: file.mimetype || 'application/octet-stream',
      resumable: false,
      metadata: {
        cacheControl: 'private, max-age=0, no-transform',
        metadata: {
          orgId,
          vehicleId,
          docId,
          originalFilename: file.originalname,
          uploadedAt: new Date().toISOString(),
        },
      },
    });

    const url = `https://storage.googleapis.com/${this.bucketName}/${objectPath}`;
    this.logger.log(
      `Uploaded ${file.size}B (${file.mimetype}) -> ${objectPath}`,
    );
    return url;
  }

  /**
   * Delete an object referenced by the same canonical https URL we wrote.
   * Best-effort — used for rollback when the DB write fails after upload.
   */
  async deleteByUrl(url: string): Promise<void> {
    const prefix = `https://storage.googleapis.com/${this.bucketName}/`;
    if (!url.startsWith(prefix)) return;
    const objectPath = url.slice(prefix.length);
    try {
      await this.storage.bucket(this.bucketName).file(objectPath).delete();
    } catch (err) {
      this.logger.warn(
        `Rollback delete failed for ${objectPath}: ${(err as Error).message}`,
      );
    }
  }

  /**
   * Strip path separators and other characters that don't belong in an
   * object name — keep dots so the extension survives.
   */
  private sanitiseName(name: string): string {
    const trimmed = name.trim().replace(/^.*[\\/]/, '');
    const cleaned = trimmed.replace(/[^A-Za-z0-9._\-+()]/g, '_');
    return cleaned.length > 0 ? cleaned : 'file.bin';
  }
}
