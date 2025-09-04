import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { User, UserRole } from './schemas/user.schema';
import { CreateUserDto } from './dto/create-user.dto';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from 'src/auth/roles.guard';
import { Roles } from 'src/auth/roles.decorator';
import { RolesOwnerGuard } from 'src/auth/roles-owner.guard';
import { RolesOwner } from 'src/auth/roles-owner.decorator';
import { Throttle } from '@nestjs/throttler';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  async create(@Body() createUserDto: CreateUserDto): Promise<User> {
    return this.usersService.createUser(
      createUserDto.name,
      createUserDto.email,
      createUserDto.password,
    );
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('me')
  async getProfile(@Request() req) {
    return this.usersService.findById(req.user.userId);
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN)
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @Get()
  async findAll() {
    return this.usersService.findAll();
  }

  @UseGuards(AuthGuard('jwt'), RolesOwnerGuard)
  @RolesOwner(['user', 'admin'])
  @Patch(':id')
  async updateUser(@Param('id') id: string, @Request() req) {
    const data = req.body;
    console.log(data);
    return this.usersService.updateUser(id, data);
  }
}
