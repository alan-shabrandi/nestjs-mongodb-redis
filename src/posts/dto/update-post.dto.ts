import { IsOptional, IsString, MinLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdatePostDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @ApiPropertyOptional({
    description: 'Title of the post (min 3 characters)',
    example: 'Updated post title',
  })
  title?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({
    description: 'Content of the post',
    example: 'Updated content for the post...',
  })
  content?: string;
}
