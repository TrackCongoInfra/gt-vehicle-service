import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateVehicleDocumentDto {
  @ApiPropertyOptional({ example: 'insurance' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  docType?: string;

  @ApiPropertyOptional({ example: 'INS-2024-67890' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  docNumber?: string;

  @ApiPropertyOptional({ example: '2024-06-01' })
  @IsOptional()
  @IsDateString()
  issuedDate?: string;

  @ApiPropertyOptional({ example: '2027-06-01' })
  @IsOptional()
  @IsDateString()
  expiryDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fileUrl?: string;
}
