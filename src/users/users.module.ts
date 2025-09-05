import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from './schemas/user.schema';
import { CacheModule } from '@nestjs/cache-manager';
import { AppConfigService } from 'src/config/app-config.service';
@Module({
  imports: [
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
    CacheModule.register(),
  ],
  controllers: [UsersController],
  providers: [UsersService, AppConfigService],
  exports: [UsersService],
})
export class UsersModule {}
