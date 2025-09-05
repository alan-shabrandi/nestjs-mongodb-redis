import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Inject,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { User, UserDocument } from './schemas/user.schema';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { AppConfigService } from 'src/config/app-config.service';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private readonly appConfigService: AppConfigService,
  ) {}

  // --- Create user ---
  async createUser(
    name: string,
    email: string,
    password: string,
  ): Promise<User> {
    const existingUser = await this.findByEmail(email);
    if (existingUser) throw new BadRequestException('Email already exist');

    const hashedPassword = await this.hashPassword(password);
    const newUser = new this.userModel({
      name,
      email,
      password: hashedPassword,
    });
    return newUser.save();
  }

  // --- Find by email ---
  async findByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ email }).exec();
  }

  // --- Find all users ---
  async findAll(): Promise<User[]> {
    const cacheKey = 'users:all';
    const cached = await this.cacheManager.get<User[]>(cacheKey);
    if (cached) return cached;

    const users = await this.userModel.find().exec();
    await this.cacheManager.set(
      cacheKey,
      users,
      this.appConfigService.cacheTtl,
    );
    return users;
  }

  // --- Find by ID ---
  async findById(userId: string): Promise<UserDocument | null> {
    const cacheKey = `users:${userId}`;
    const cached = await this.cacheManager.get<UserDocument>(cacheKey);
    if (cached) return cached;

    const user = await this.userModel.findById(userId).exec();
    if (!user) throw new NotFoundException(`User with id ${userId} not found`);

    await this.cacheManager.set(cacheKey, user, this.appConfigService.cacheTtl);
    return user;
  }

  // --- Update user ---
  async updateUser(id: string, data: Partial<User>): Promise<User> {
    const updated = await this.userModel
      .findByIdAndUpdate(id, { $set: data }, { new: true })
      .exec();
    if (!updated) throw new NotFoundException(`User with id ${id} not found`);

    await this.cacheManager.del(`users:${id}`);
    await this.cacheManager.del('users:all');
    return updated;
  }

  // --- Change password ---
  async changePassword(
    userId: string,
    oldPassword: string,
    newPassword: string,
  ): Promise<User> {
    const user = await this.userModel
      .findById(userId)
      .select('+password')
      .exec();
    if (!user) throw new NotFoundException(`User with id ${userId} not found`);

    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) throw new BadRequestException('Old password incorrect');

    user.password = await this.hashPassword(newPassword);
    await user.save();

    await this.cacheManager.del(`users:${userId}`);
    await this.cacheManager.del('users:all');
    return user;
  }

  // --- Utility: hash password ---
  private async hashPassword(password: string): Promise<string> {
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(password, salt);
  }
}
