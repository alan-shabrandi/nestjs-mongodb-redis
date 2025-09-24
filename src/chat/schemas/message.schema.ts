import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { Room } from './room.schema';
import { User } from 'src/users/schemas/user.schema';

export type MessageDocument = Message & Document;

@Schema({ timestamps: true })
export class Message {
  @Prop({ type: Types.ObjectId, ref: User.name, required: true })
  from: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: User.name })
  to: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: Room.name })
  room: Types.ObjectId;

  @Prop({ required: true })
  content: string;
}

export const MessageSchema = SchemaFactory.createForClass(Message);
