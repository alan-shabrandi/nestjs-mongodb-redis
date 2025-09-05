import { Controller } from '@nestjs/common';
import { NotificationService } from './notifications.service';

@Controller('notification')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}
}
