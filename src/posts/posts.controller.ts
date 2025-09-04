import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Request,
  UseGuards,
} from '@nestjs/common';
import { PostsService } from './posts.service';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { AuthGuard } from '@nestjs/passport';

@Controller('posts')
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @UseGuards(AuthGuard('jwt'))
  @Post()
  async createPost(@Body() dto: CreatePostDto, @Request() req) {
    return this.postsService.createPost(req.user.userId, dto);
  }

  @Get()
  async findAll() {
    return this.postsService.findAll();
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    return this.postsService.findById(id);
  }

  @UseGuards(AuthGuard('jwt'))
  @Patch(':id')
  async updatePost(
    @Param('id') id: string,
    @Body() dto: UpdatePostDto,
    @Request() req,
  ) {
    return this.postsService.updatePost(
      id,
      req.user.userId,
      dto,
      req.user.role,
    );
  }

  @UseGuards(AuthGuard('jwt'))
  @Delete(':id')
  async deletePost(@Param('id') id: string, @Request() req) {
    return this.postsService.deletePost(id, req.user.userId, req.user.role);
  }
}
