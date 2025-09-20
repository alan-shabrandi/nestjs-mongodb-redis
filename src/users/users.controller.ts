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
import { ChangePasswordDto } from './dto/change-password.dto';
import { AuthGuard } from '@nestjs/passport';
import { RolesOwnerGuard } from 'src/common/guards/roles-owner.guard';
import { RolesOwner } from 'src/common/decorators/roles-owner.decorator';
import { Throttle } from '@nestjs/throttler';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiParam,
} from '@nestjs/swagger';
import { UserDto } from './dto/user.dto';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { plainToInstance } from 'class-transformer';

const THROTTLE_LIMIT = Number(process.env.THROTTLE_LIMIT) || 3;
const THROTTLE_TTL = Number(process.env.THROTTLE_TTL) || 60;
const PASSWORD_THROTTLE_LIMIT =
  Number(process.env.PASSWORD_THROTTLE_LIMIT) || 5;
const PASSWORD_THROTTLE_TTL = Number(process.env.PASSWORD_THROTTLE_TTL) || 60;

@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new user' })
  @ApiResponse({ status: 201, description: 'User created', type: UserDto })
  @ApiBody({ type: CreateUserDto })
  async create(@Body() createUserDto: CreateUserDto): Promise<User> {
    return this.usersService.createUser(
      createUserDto.name,
      createUserDto.email,
      createUserDto.password,
    );
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({
    status: 200,
    description: 'User profile returned',
    type: UserDto,
  })
  async getProfile(@Request() req) {
    const user = await this.usersService.findById(req.user.userId);
    return plainToInstance(UserDto, user, { excludeExtraneousValues: true });
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN)
  @Throttle({ default: { limit: THROTTLE_LIMIT, ttl: THROTTLE_TTL } })
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all users (admin only)' })
  @ApiResponse({ status: 200, description: 'List of users', type: [UserDto] })
  @Get()
  async findAll(): Promise<User[]> {
    return this.usersService.findAll();
  }

  @UseGuards(AuthGuard('jwt'), RolesOwnerGuard)
  @RolesOwner(['user', 'admin'])
  @Patch(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update user data (owner or admin)' })
  @ApiResponse({ status: 200, description: 'User updated', type: UserDto })
  @ApiParam({ name: 'id', description: 'User ID' })
  async updateUser(@Param('id') id: string, @Body() data: Partial<User>) {
    return this.usersService.updateUser(id, data);
  }

  @UseGuards(AuthGuard('jwt'), RolesOwnerGuard)
  @RolesOwner(['user', 'admin'])
  @Patch(':id/change-password')
  @Throttle({
    default: { limit: PASSWORD_THROTTLE_LIMIT, ttl: PASSWORD_THROTTLE_TTL },
  })
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change user password' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiBody({ type: ChangePasswordDto })
  @ApiResponse({
    status: 200,
    description: 'Password changed successfully',
    type: UserDto,
  })
  async changePassword(
    @Param('id') id: string,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.usersService.changePassword(
      id,
      dto.oldPassword,
      dto.newPassword,
    );
  }
}
