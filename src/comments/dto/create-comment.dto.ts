import { IsMongoId, IsString, MinLength } from 'class-validator';

export class CreateCommentDto {
  @IsString()
  @MinLength(1)
  text: string;

  @IsMongoId()
  postId: string;
}
