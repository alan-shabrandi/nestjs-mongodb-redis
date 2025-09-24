import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Message, MessageDocument } from './schemas/message.schema';
import { Room, RoomDocument } from './schemas/room.schema';
import { User, UserDocument } from 'src/users/schemas/user.schema';

@Injectable()
export class ChatService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Message.name) private messageModel: Model<MessageDocument>,
    @InjectModel(Room.name) private roomModel: Model<RoomDocument>,
  ) {}

  async createMessage(data: {
    from: string;
    to?: string;
    content: string;
    roomId: string;
  }) {
    const fromUser = await this.userModel.findById(data.from);
    if (!fromUser) throw new Error('Sender not found');

    const room = await this.roomModel.findById(data.roomId);
    if (!room) throw new Error('Room not found');

    let toUser: UserDocument | null = null;
    if (data.to) {
      toUser = await this.userModel.findById(data.to);
      if (!toUser) throw new Error('Recipient not found');
    }

    const message = new this.messageModel({
      from: fromUser._id,
      to: toUser?._id,
      room: room._id,
      content: data.content,
    });

    const savedMessage = await message.save();
    await savedMessage.populate([
      { path: 'from', select: 'username' },
      { path: 'to', select: 'username' },
    ]);
    room.messages.push(savedMessage._id as Types.ObjectId);
    await room.save();
    return savedMessage;
  }

  async getRoomMessages(roomId: string) {
    const room = await this.roomModel.findById(roomId).populate({
      path: 'messages',
      populate: [
        { path: 'from', select: 'username' },
        { path: 'to', select: 'username' },
      ],
    });
    if (!room) throw new Error('Room not found');
    return room.messages;
  }

  async createRoom(name: string, memberIds: string[]) {
    const members = await this.userModel.find({ _id: { $in: memberIds } });
    const room = new this.roomModel({
      name,
      members: members.map((m) => m._id),
      messages: [],
    });
    return room.save();
  }
}
