import {
  Controller,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { PostsService } from './posts.service';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { AuthGuard } from '@nestjs/passport';
import { User } from 'src/common/decorators/user.decorator';
import { Roles } from 'src/common/decorators/roles.decorator';
import { RolesGuard } from 'src/common/guards/roles.guard';
import type { JwtPayload } from 'src/auth/interface/jwt-payload.interface';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
} from '@nestjs/swagger';
import { Post as PostEntity } from './schemas/post.schema';

@ApiTags('Protected Posts')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('posts')
export class ProtectedPostsController {
  constructor(private readonly postsService: PostsService) {}

  @Post()
  @ApiCreatedResponse({
    description: 'Post created successfully',
    type: PostEntity,
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  async create(@Body() dto: CreatePostDto, @User() user: JwtPayload) {
    return this.postsService.createPost(user.userId, dto);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('admin', 'author')
  @ApiOkResponse({ description: 'Post updated successfully', type: PostEntity })
  @ApiForbiddenResponse({ description: 'Access denied' })
  @ApiNotFoundResponse({ description: 'Post not found' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdatePostDto,
    @User() user: JwtPayload,
  ) {
    return this.postsService.updatePost(id, user.userId, dto, user.role);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('admin', 'author')
  @ApiOkResponse({ description: 'Post deleted successfully' })
  @ApiForbiddenResponse({ description: 'Access denied' })
  @ApiNotFoundResponse({ description: 'Post not found' })
  async delete(@Param('id') id: string, @User() user: JwtPayload) {
    return this.postsService.deletePost(id, user.userId, user.role);
  }
}
