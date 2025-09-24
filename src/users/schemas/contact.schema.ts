import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { User } from 'src/users/schemas/user.schema';
import { Types } from 'mongoose';

@Schema({ timestamps: true })
export class Contact extends Document {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  email: string;

  @Prop({ type: Types.ObjectId, ref: User.name, required: true })
  owner: Types.ObjectId;
}

export type ContactDocument = Contact & Document;

export const ContactSchema = SchemaFactory.createForClass(Contact);
