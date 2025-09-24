import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from './schemas/user.schema';
import { CacheModule } from '@nestjs/cache-manager';
import { AppConfigService } from 'src/config/app-config.service';
import { Contact, ContactSchema } from './schemas/contact.schema';
@Module({
  imports: [
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
    MongooseModule.forFeature([{ name: Contact.name, schema: ContactSchema }]),
    CacheModule.register(),
  ],
  controllers: [UsersController],
  providers: [UsersService, AppConfigService],
  exports: [UsersService],
})
export class UsersModule {}
