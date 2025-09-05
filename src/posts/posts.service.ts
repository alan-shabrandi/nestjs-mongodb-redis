import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Inject,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Post, PostDocument } from './schemas/post.schema';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { RedisClientType } from 'redis';
import { AppConfigService } from 'src/config/app-config.service';

@Injectable()
export class PostsService {
  private readonly ALL_POSTS_CACHE_KEY = 'posts:all';

  constructor(
    @InjectModel(Post.name) private readonly postModel: Model<PostDocument>,
    @Inject(CACHE_MANAGER) private readonly cacheManager: any,
    private readonly appConfigService: AppConfigService,
  ) {}

  private get redisClient(): RedisClientType {
    return this.cacheManager.store.getClient();
  }

  private getPostCacheKey(id: string) {
    return `posts:${id}`;
  }

  async createPost(userId: string, dto: CreatePostDto): Promise<PostDocument> {
    const post = new this.postModel({
      ...dto,
      author: new Types.ObjectId(userId),
    });
    const saved = await post.save();

    const cacheKey = this.getPostCacheKey(saved._id.toString());
    await this.redisClient.set(cacheKey, JSON.stringify(saved), {
      EX: this.appConfigService.cacheTtl,
    });
    await this.redisClient.del(this.ALL_POSTS_CACHE_KEY);

    return saved;
  }

  async findAll(): Promise<Post[]> {
    const cached = await this.redisClient.get(this.ALL_POSTS_CACHE_KEY);
    if (cached) return JSON.parse(cached);

    const posts = await this.postModel
      .find()
      .populate('author', 'name email')
      .exec();
    await this.redisClient.set(
      this.ALL_POSTS_CACHE_KEY,
      JSON.stringify(posts),
      { EX: this.appConfigService.cacheTtl },
    );

    const pipeline = this.redisClient.multi();
    posts.forEach((p) =>
      pipeline.set(this.getPostCacheKey(p._id.toString()), JSON.stringify(p), {
        EX: this.appConfigService.cacheTtl,
      }),
    );
    await pipeline.exec();

    return posts;
  }

  async findById(id: string): Promise<PostDocument> {
    const cacheKey = this.getPostCacheKey(id);
    const cached = await this.redisClient.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const post = await this.postModel
      .findById(id)
      .populate('author', 'name email')
      .exec();
    if (!post) throw new NotFoundException('Post not found');

    await this.redisClient.set(cacheKey, JSON.stringify(post), {
      EX: this.appConfigService.cacheTtl,
    });
    return post;
  }

  async updatePost(
    id: string,
    userId: string,
    dto: UpdatePostDto,
    userRole: string,
  ): Promise<PostDocument> {
    const post = await this.postModel.findById(id).exec();
    if (!post) throw new NotFoundException('Post not found');
    if (post.author.toString() !== userId && userRole !== 'admin')
      throw new ForbiddenException('Access Denied');

    Object.assign(post, dto);
    const updated = await post.save();

    await this.redisClient.set(
      this.getPostCacheKey(updated._id.toString()),
      JSON.stringify(updated),
      { EX: this.appConfigService.cacheTtl },
    );
    await this.redisClient.del(this.ALL_POSTS_CACHE_KEY);

    return updated;
  }

  async deletePost(id: string, userId: string, userRole: string) {
    const post = await this.postModel.findById(id).exec();
    if (!post) throw new NotFoundException('Post not found');
    if (post.author.toString() !== userId && userRole !== 'admin')
      throw new ForbiddenException('Access Denied');

    await this.postModel.deleteOne({ _id: id }).exec();
    await this.redisClient.del(this.getPostCacheKey(id));
    await this.redisClient.del(this.ALL_POSTS_CACHE_KEY);

    return { message: 'Post deleted' };
  }

  async searchPosts(term: string, page = 1, limit = 10) {
    const skip = (page - 1) * limit;
    const results = await this.postModel
      .find({ $text: { $search: term } }, { score: { $meta: 'textScore' } })
      .sort({ score: { $meta: 'textScore' } })
      .skip(skip)
      .limit(limit)
      .exec();
    return results;
  }
}
