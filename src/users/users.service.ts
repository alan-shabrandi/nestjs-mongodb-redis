import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Inject,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { User, UserDocument } from './schemas/user.schema';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { AppConfigService } from 'src/config/app-config.service';
import { CreateContactDto } from './dto/create-contact.dto';
import { Contact, ContactDocument } from './schemas/contact.schema';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Contact.name) private contactModel: Model<ContactDocument>,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private readonly appConfigService: AppConfigService,
  ) {}

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

  // --- Get contacts ---
  async getContacts(userId: string) {
    const user = await this.userModel
      .findById(userId)
      .populate({ path: 'contacts', select: 'name email' })
      .lean();

    if (!user) throw new NotFoundException(`User with ID ${userId} not found`);

    return user.contacts.map((contact) => ({
      ...contact,
      _id: contact._id.toString(),
    }));
  }

  // --- Add contact ---
  async addContact(userId: string, dto: CreateContactDto) {
    const user = await this.userModel.findById(userId);
    if (!user) throw new NotFoundException(`User with ID ${userId} not found`);

    const emailExist = await this.userModel
      .findOne({ email: dto.email })
      .exec();
    if (!emailExist) throw new NotFoundException(`This email not found`);

    const contact = new this.contactModel({
      ...dto,
      owner: new Types.ObjectId(userId),
    });
    await contact.save();
    user.contacts.push(contact._id as Types.ObjectId);
    return (await user.save()).toObject();
  }

  // --- Utility: hash password ---
  async hashPassword(password: string): Promise<string> {
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(password, salt);
  }
}
