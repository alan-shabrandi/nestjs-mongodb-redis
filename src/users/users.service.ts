import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { User, UserDocument } from './schemas/user.schema';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async createUser(
    name: string,
    email: string,
    password: string,
  ): Promise<User> {
    const existingUser = await this.findByEmail(email);
    if (existingUser) throw new BadRequestException('Email already exist');

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const newUser = new this.userModel({
      name,
      email,
      password: hashedPassword,
    });
    return newUser.save();
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.userModel.findOne({ email }).exec();
  }

  async findAll() {
    const cacheKey = 'users:all';
    const cached = await this.cacheManager.get<User[]>(cacheKey);
    if (cached) {
      console.log('from cache');
      return cached;
    }
    const users = await this.userModel.find().exec();

    await this.cacheManager.set(cacheKey, users, 60000);
    return users;
  }

  async findById(userId: string): Promise<User | null> {
    const cacheKey = `users:${userId}`;
    const cached = await this.cacheManager.get<User>(cacheKey);
    if (cached) {
      console.log(`from cache: ${userId}`);
      return cached;
    }

    const user = await this.userModel.findOne({ _id: userId }).exec();
    if (user) await this.cacheManager.set(cacheKey, user, 60000);
    return user;
  }

  async updateUser(id: string, data: Partial<User>) {
    const updated = await this.userModel
      .findByIdAndUpdate(id, { $set: data }, { new: true })
      .exec();
    await this.cacheManager.del(`users:${id}`);
    await this.cacheManager.del('users:all');
    return updated;
  }
}
