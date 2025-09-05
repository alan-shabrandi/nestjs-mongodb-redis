import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ApiProperty } from '@nestjs/swagger';
@Schema({ timestamps: true })
export class Post {
  @ApiProperty({ description: 'Title of the post', example: 'My First Post' })
  @Prop({ required: true })
  title: string;

  @ApiProperty({
    description: 'Content of the post',
    example: 'This is the content of my first post.',
  })
  @Prop()
  content: string;

  @ApiProperty({ description: 'ID of the author', type: String })
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  author: Types.ObjectId;

  @ApiProperty({ description: 'Creation timestamp', type: String })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp', type: String })
  updatedAt: Date;
}

export type PostDocument = Post & Document & { _id: Types.ObjectId };
export const PostSchema = SchemaFactory.createForClass(Post);

PostSchema.index({ title: 'text', content: 'text' });
