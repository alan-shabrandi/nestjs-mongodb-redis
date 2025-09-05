import { Controller, Get, Param } from '@nestjs/common';
import { PostsService } from './posts.service';
import { ApiTags, ApiOkResponse, ApiNotFoundResponse } from '@nestjs/swagger';
import { Post as PostEntity } from './schemas/post.schema';

@ApiTags('Public Posts')
@Controller('posts')
export class PublicPostsController {
  constructor(private readonly postsService: PostsService) {}

  @Get()
  @ApiOkResponse({ description: 'Returns all posts', type: [PostEntity] })
  async findAll() {
    return this.postsService.findAll();
  }

  @Get(':id')
  @ApiOkResponse({ description: 'Returns a post by id', type: PostEntity })
  @ApiNotFoundResponse({ description: 'Post not found' })
  async findById(@Param('id') id: string) {
    return this.postsService.findById(id);
  }
}
