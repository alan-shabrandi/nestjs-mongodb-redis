import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import {
  Notification,
  NotificationDocument,
} from './schemas/notification.schema';
import { Model } from 'mongoose';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectModel(Notification.name)
    private notificationModel: Model<NotificationDocument>,
  ) {}

  async create(
    recipientId: string,
    type: string,
    message: string,
    relatedId?: string,
  ) {
    const notification = new this.notificationModel({
      recipient: recipientId,
      type,
      message,
      relatedId,
    });
    return notification.save();
  }

  async getUserNotification(userId: string) {
    return this.notificationModel
      .find({ recipient: userId })
      .sort({ createdAt: -1 })
      .exec();
  }

  async markAsRead(notificationId: string) {
    return this.notificationModel.findByIdAndUpdate(
      notificationId,
      { read: true },
      { new: true },
    );
  }
}
