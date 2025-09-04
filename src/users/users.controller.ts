import { Body, Controller, Post } from '@nestjs/common';
import { UsersService } from './users.service';
import { User } from './schemas/user.schema';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  async create(
    @Body() body: { name: string; email: string; password: string },
  ): Promise<User> {
    return this.usersService.createUser(body.name, body.email, body.password);
  }
}
