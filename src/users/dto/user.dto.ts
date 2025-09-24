import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '../schemas/user.schema';
import { Exclude, Expose, Transform } from 'class-transformer';

@Exclude()
export class UserDto {
  @ApiProperty({ example: '507f1f77bcf86cd799439011' })
  @Expose()
  @Transform(({ obj }) => obj._id.toString())
  id: string;

  @ApiProperty({ example: 'Alan Shabrandi' })
  @Expose()
  name: string;

  @ApiProperty({ example: 'alan.shabrandi@gmail.com' })
  @Expose()
  email: string;

  @Exclude()
  password: string;

  @ApiProperty({ enum: UserRole, example: UserRole.USER })
  @Expose()
  role: UserRole;

  @ApiProperty({ example: '2025-09-20T12:34:56.789Z' })
  @Expose()
  createdAt: Date;

  @ApiProperty({ example: '2025-09-20T12:34:56.789Z' })
  @Expose()
  updatedAt: Date;
}
