import {
  IsEmail,
  IsNotEmpty,
  Length,
  IsOptional,
  IsString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'password123' })
  @IsNotEmpty()
  @Length(6)
  password: string;

  @ApiPropertyOptional({
    example: 'device-123',
    description: 'Unique device identifier',
  })
  @IsOptional()
  @IsString()
  deviceId?: string;
}
