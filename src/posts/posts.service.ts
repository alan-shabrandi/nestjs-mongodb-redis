import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Post, PostDocument } from './schemas/post.schema';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { Model } from 'mongoose';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';

@Injectable()
export class PostsService {
  constructor(
    @InjectModel(Post.name) private postModel: Model<PostDocument>,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async createPost(userId: string, dto: CreatePostDto) {
    const post = new this.postModel({ ...dto, author: userId });
    const saved = await post.save();
    await this.cacheManager.del('posts:all');
    return saved;
  }

  async findAll() {
    const cacheKey = 'posts:all';
    const cached = await this.cacheManager.get<Post[]>(cacheKey);
    if (cached) return cached;

    const posts = await this.postModel
      .find()
      .populate('author', 'name email')
      .exec();
    await this.cacheManager.set(cacheKey, posts, 60000);
  }

  async findById(id: string) {
    const cacheKey = `posts:${id}`;
    const cached = await this.cacheManager.get<Post>(cacheKey);
    if (cached) return cached;

    const post = await this.postModel
      .findById(id)
      .populate('author', 'name email')
      .exec();
    if (!post) throw new NotFoundException('Post not found');
    await this.cacheManager.set(cacheKey, post, 60000);
  }

  async updatePost(
    id: string,
    userId: string,
    dto: UpdatePostDto,
    userRole: string,
  ) {
    const post = await this.postModel.findById(id).exec();
    if (!post) throw new NotFoundException('Post not found');

    if (post.author.toString() !== userId && userRole !== 'admin')
      throw new Error('Access Denied');

    Object.assign(post, dto);
    const updated = await post.save();

    await this.cacheManager.del(`posts:${id}`);
    await this.cacheManager.del('posts:all');

    return updated;
  }

  async deletePost(id: string, userId: string, userRole: string) {
    const post = await this.postModel.findById(id).exec();
    if (!post) throw new NotFoundException('Post not found');

    if (post.author.toString() !== userId && userRole !== 'admin')
      throw new Error('Access Denied');

    await this.postModel.deleteOne({ _id: id }).exec();
    await this.cacheManager.del(`posts:${id}`);
    await this.cacheManager.del('posts:all');
    return { message: 'Post deleted' };
  }
}
