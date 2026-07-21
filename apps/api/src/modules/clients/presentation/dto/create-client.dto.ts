import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDate,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

/** The client's primary contact — becomes their login (role = Client). */
export class ClientContactDto {
  @ApiPropertyOptional() @IsOptional() @IsInt() titleId?: number;
  @ApiProperty() @IsString() @MaxLength(100) firstName!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) middleName?: string;
  @ApiProperty() @IsString() @MaxLength(100) surname!: string;
  @ApiProperty() @IsEmail() email!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20) phoneNumber?: string;
}

export class CreateClientDto {
  @ApiProperty() @IsString() @MaxLength(255) name!: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() clientTypeId?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() companyName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() companyRegisteredAddress?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Date) @IsDate() incorporationDate?: Date;
  @ApiPropertyOptional() @IsOptional() @IsString() incorporationNo?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() officialAddress?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() residentialAddress?: string;
  @ApiPropertyOptional() @IsOptional() @IsEmail() email?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() phoneNumber?: string;

  @ApiProperty({ type: ClientContactDto })
  @ValidateNested()
  @Type(() => ClientContactDto)
  contact!: ClientContactDto;
}
