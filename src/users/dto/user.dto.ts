import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '../schemas/user.schema';
import { Exclude, Expose } from 'class-transformer';

export class UserDto {
  @ApiProperty({ example: '507f1f77bcf86cd799439011' })
  @Expose()
  id: string;

  @ApiProperty({ example: 'Alan Shabrandi' })
  @Expose()
  name: string;

  @ApiProperty({ example: 'alan.shabrandi@gmail.com' })
  email: string;

  @Exclude()
  password: string;

  @ApiProperty({ enum: UserRole, example: UserRole.USER })
  role: UserRole;

  @ApiProperty({ example: '2025-09-20T12:34:56.789Z' })
  createdAt: Date;

  @ApiProperty({ example: '2025-09-20T12:34:56.789Z' })
  updatedAt: Date;
}
