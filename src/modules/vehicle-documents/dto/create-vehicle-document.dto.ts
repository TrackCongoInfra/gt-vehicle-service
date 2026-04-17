import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateVehicleDocumentDto {
  @ApiProperty({ example: 'registration', description: 'Document type (registration, insurance, inspection, permit)' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  docType: string;

  @ApiPropertyOptional({ example: 'REG-2024-12345' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  docNumber?: string;

  @ApiPropertyOptional({ example: '2024-01-01' })
  @IsOptional()
  @IsDateString()
  issuedDate?: string;

  @ApiPropertyOptional({ example: '2026-12-31' })
  @IsOptional()
  @IsDateString()
  expiryDate?: string;

  @ApiPropertyOptional({ example: 'https://storage.example.com/docs/reg-123.pdf' })
  @IsOptional()
  @IsString()
  fileUrl?: string;
}
