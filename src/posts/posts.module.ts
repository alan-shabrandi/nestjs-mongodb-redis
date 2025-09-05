import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Post, PostSchema } from './schemas/post.schema';
import { PostsService } from './posts.service';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { APP_GUARD } from '@nestjs/core';
import { PublicPostsController } from './posts.public.controller';
import { ProtectedPostsController } from './posts.protected.controller';
import { AppConfigService } from 'src/config/app-config.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Post.name, schema: PostSchema }]),
  ],
  providers: [
    PostsService,
    AppConfigService,
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
  controllers: [PublicPostsController, ProtectedPostsController],
})
export class PostsModule {}
