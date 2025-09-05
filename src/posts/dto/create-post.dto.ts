import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreatePostDto {
  @IsString()
  @MinLength(3)
  @ApiProperty({
    description: 'Title of the post (min 3 characters)',
    example: 'My First Post',
  })
  title: string;

  @IsString()
  @ApiProperty({
    description: 'Content of the post',
    example: 'This is the content of my first post.',
  })
  content: string;
}
