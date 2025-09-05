import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { NotificationsService } from './notifications.service';

@WebSocketGateway({ cors: { origin: '*' } })
export class NotificationsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server: Server;
  private onlineUsers: Map<string, string[]> = new Map(); // userId -> socketIds

  constructor(private notificationsService: NotificationsService) {}

  afterInit(server: Server) {
    console.log('Notifications Gateway Initialized');
  }

  handleConnection(client: Socket) {
    const userId = client.handshake.query.userId as string;
    if (!userId) return client.disconnect();
    const sockets = this.onlineUsers.get(userId) || [];
    sockets.push(client.id);
    this.onlineUsers.set(userId, sockets);
    console.log(`User connected: ${userId}`);
  }

  handleDisconnect(client: Socket) {
    for (const [userId, sockets] of this.onlineUsers.entries()) {
      const index = sockets.indexOf(client.id);
      if (index !== -1) {
        sockets.splice(index, 1);
        if (sockets.length === 0) this.onlineUsers.delete(userId);
        else this.onlineUsers.set(userId, sockets);
        break;
      }
    }
  }

  async sendNotification(
    userId: string,
    type: string,
    message: string,
    relatedId?: string,
  ) {
    // save in DB
    await this.notificationsService.create(userId, type, message, relatedId);
    // emit to online sockets
    const sockets = this.onlineUsers.get(userId) || [];
    sockets.forEach((socketId) =>
      this.server
        .to(socketId)
        .emit('notification', { type, message, relatedId }),
    );
  }

  // optional: client can request to mark read
  @SubscribeMessage('markRead')
  async handleMarkRead(@MessageBody() notificationId: string) {
    return this.notificationsService.markAsRead(notificationId);
  }
}
