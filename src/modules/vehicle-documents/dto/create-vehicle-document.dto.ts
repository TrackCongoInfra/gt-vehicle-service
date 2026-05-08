import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from 'class-validator';
import { coerceToIsoDate } from '../../vehicles/dto/date-format.helper';

export class CreateVehicleDocumentDto {
  @ApiProperty({
    example: 'registration',
    description:
      'Document type. Common values: registration, insurance, inspection, permit. Free-form (max 50 chars).',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  docType: string;

  @ApiPropertyOptional({ example: 'REG-2024-12345' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  docNumber?: string;

  @ApiPropertyOptional({
    example: '01/01/2024',
    description: 'Issued date — accepts dd/MM/yyyy or ISO 8601',
  })
  @IsOptional()
  @Transform(({ value }) => coerceToIsoDate(value))
  @IsDateString()
  issuedDate?: string;

  @ApiPropertyOptional({
    example: '31/12/2026',
    description: 'Expiry date — accepts dd/MM/yyyy or ISO 8601',
  })
  @IsOptional()
  @Transform(({ value }) => coerceToIsoDate(value))
  @IsDateString()
  expiryDate?: string;

  @ApiPropertyOptional({
    example: 'https://storage.example.com/docs/reg-123.pdf',
    description: 'Public or signed URL to the document file',
  })
  @IsOptional()
  @IsString()
  @IsUrl({ require_tld: false })
  fileUrl?: string;
}
