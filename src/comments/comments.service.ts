import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Comment, CommentDocument } from './schemas/comment.schema';
import { Model, Types } from 'mongoose';
import { Post, PostDocument } from 'src/posts/schemas/post.schema';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { NotificationsGateway } from 'src/notification/notifications.gateway';

@Injectable()
export class CommentsService {
  constructor(
    @InjectModel(Comment.name) private commentModel: Model<CommentDocument>,
    @InjectModel(Post.name) private postModel: Model<PostDocument>,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private notificationsGateway: NotificationsGateway,
  ) {}

  async createComment(userId: string, dto: CreateCommentDto) {
    const post = await this.postModel.findById(dto.postId).exec();
    if (!post) throw new NotFoundException('Post not found');

    const comment = new this.commentModel({
      text: dto.text,
      author: userId,
      post: dto.postId,
    });

    const saved = await comment.save();

    if (post.author._id.toString() !== userId) {
      const message = `New comment on your post: ${dto.text}`;
      this.notificationsGateway.sendNotification(
        post.author._id.toString(),
        'comment',
        message,
        (saved._id as Types.ObjectId).toString(),
      );
    }

    await this.cacheManager.del(`posts:${dto.postId}`);
    return saved;
  }

  async findByPost(postId: string) {
    const cacheKey = `post:${postId}:comments`;
    const cached = await this.cacheManager.get<Comment[]>(cacheKey);
    if (cached) return cached;
    const comments = await this.commentModel
      .find({ post: postId })
      .populate('author', 'name email')
      .exec();
    await this.cacheManager.set(cacheKey, comments, 60000);
    return comments;
  }

  async updateComment(
    id: string,
    userId: string,
    dto: UpdateCommentDto,
    userRole: string,
  ) {
    const comment = await this.commentModel.findById(id).exec();
    if (!comment) throw new NotFoundException('Comment not found');
    if (comment.author.toString() !== userId && userRole !== 'admin')
      throw new Error('Access Denied');
    Object.assign(comment, dto);
    const updated = await comment.save();
    await this.cacheManager.del(`post:${comment.post.toString()}:comments`);
    return updated;
  }

  async deleteComment(id: string, userId: string, userRole: string) {
    const comment = await this.commentModel.findById(id).exec();
    if (!comment) throw new NotFoundException('Comment not found');

    if (comment.author.toString() !== userId && userRole !== 'admin')
      throw new Error('Access Denied');

    await this.commentModel.deleteOne({ _id: id }).exec();
    await this.cacheManager.del(`post:${comment.post.toString()}:comments`);
    return { message: 'Comment deleted' };
  }
}
