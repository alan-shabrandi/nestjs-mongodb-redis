import { Injectable, Logger as NestLogger } from '@nestjs/common';
import { Client } from '@elastic/elasticsearch';

@Injectable()
export class AppLogger extends NestLogger {
  private esClient: Client;

  constructor() {
    super();
    this.esClient = new Client({
      node: 'http://127.0.0.1:9200',
      auth: {
        username: 'elastic',
        password: 'alan123456',
      },
      tls: { rejectUnauthorized: false },
    });
  }

  private async sendToElasticsearch(logEntry: Record<string, any>) {
    try {
      await this.esClient.index({
        index: 'logs',
        document: logEntry,
      });
    } catch (error) {
      super.error('Failed to send log to Elasticsearch', error.stack);
    }
  }

  private buildLog(
    level: string,
    message: string,
    context?: string,
    meta?: Record<string, any>,
  ) {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: context || this.context,
      ...meta,
    };
  }

  async infoJson(
    message: string,
    context?: string,
    meta?: Record<string, any>,
  ) {
    const logEntry = this.buildLog('info', message, context, meta);
    console.log(JSON.stringify(logEntry));
    await this.sendToElasticsearch(logEntry);
  }

  async warnJson(
    message: string,
    context?: string,
    meta?: Record<string, any>,
  ) {
    const logEntry = this.buildLog('warn', message, context, meta);
    console.warn(JSON.stringify(logEntry));
    await this.sendToElasticsearch(logEntry);
  }

  async errorJson(
    message: string,
    context?: string,
    meta?: Record<string, any>,
  ) {
    const logEntry = this.buildLog('error', message, context, meta);
    console.error(JSON.stringify(logEntry));
    await this.sendToElasticsearch(logEntry);
  }
}
