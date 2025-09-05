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
import { CommentsService } from './comments.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { AuthGuard } from '@nestjs/passport';

@Controller('comments')
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @UseGuards(AuthGuard('jwt'))
  @Post()
  async createComment(@Body() dto: CreateCommentDto, @Request() req) {
    return this.commentsService.createComment(req.user.userId, dto);
  }

  @Get('post/:postId')
  async findByPost(@Param('postId') postId: string) {
    return this.commentsService.findByPost(postId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Patch(':id')
  async updateComment(
    @Param('id') id: string,
    @Body() dto: UpdateCommentDto,
    @Request() req,
  ) {
    return this.commentsService.updateComment(
      id,
      req.user.userId,
      dto,
      req.user.role,
    );
  }

  @UseGuards(AuthGuard('jwt'))
  @Delete(':id')
  async deleteComment(@Param('id') id: string, @Request() req) {
    return this.commentsService.deleteComment(
      id,
      req.user.userId,
      req.user.role,
    );
  }
}
