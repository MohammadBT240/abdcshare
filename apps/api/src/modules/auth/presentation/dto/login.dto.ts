import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'admin@abdcshare.local' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'ChangeMe!123' })
  @IsString()
  @MinLength(8)
  password!: string;
}
