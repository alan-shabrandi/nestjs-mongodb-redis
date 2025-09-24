import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { ChatService } from './chat.service';

@WebSocketGateway({ cors: { origin: '*' } })
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private users: Map<string, string> = new Map();

  constructor(private readonly chatService: ChatService) {}

  handleConnection(client: Socket) {
    console.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.users.delete(client.id);
    console.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('join')
  handleJoin(
    @MessageBody() data: { userId: string; roomId: string },
    @ConnectedSocket() client: Socket,
  ) {
    this.users.set(client.id, data.userId);
    client.join(data.roomId);
    console.log(`User ${data.userId} joined room ${data.roomId}`);
  }

  @SubscribeMessage('message')
  async handleMessage(
    @MessageBody() data: { to?: string; content: string; roomId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const fromId = this.users.get(client.id);
    if (!fromId) return;

    const savedMessage = await this.chatService.createMessage({
      from: fromId,
      to: data.to,
      content: data.content,
      roomId: data.roomId,
    });

    client.to(data.roomId).emit('message', savedMessage);
    client.emit('message', savedMessage);
  }

  @SubscribeMessage('getRoomMessages')
  async handleGetRoomMessages(
    @MessageBody() data: { roomId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const messages = await this.chatService.getRoomMessages(data.roomId);
    client.emit('allMessages', messages);
  }
}
