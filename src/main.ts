import { NestFactory } from '@nestjs/core';
import { AppModule } from './modules/app/app.module';
import { Logger, ValidationPipe, INestApplication } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { HttpExceptionFilter } from './core/filters/http-exception.filter';
import { IoAdapter } from '@nestjs/platform-socket.io';
import Redis from 'ioredis';

/**
 * Test Redis connection khi start server
 */
async function testRedisConnection(app: INestApplication): Promise<void> {
  const logger = new Logger('Redis');

  try {
    // Lấy Redis instance từ app context
    const redis = app.get('default_IORedisModuleConnectionToken') as Redis;

    // Test basic Redis operations
    logger.log('🔄 Testing Redis connection...');

    const testKey = `startup_test_${Date.now()}`;
    const testValue = 'connection_test';

    // Set và get test data
    await redis.set(testKey, testValue, 'EX', 10); // 10 seconds TTL
    const retrievedValue = await redis.get(testKey);

    if (retrievedValue === testValue) {
      logger.log('✅ Redis connection successful!');
      logger.log(`📍 Redis server info: ${await redis.info('server')}`);

      // Cleanup test key
      await redis.del(testKey);
    } else {
      throw new Error('Redis test operation failed');
    }

    // Test Redis ping
    const pong = await redis.ping();
    logger.log(`🏓 Redis ping: ${pong}`);
  } catch (error) {
    logger.error('❌ Redis connection failed:', error.message);
    logger.warn('⚠️  Application will continue without Redis cache');
    // Không throw error để app vẫn có thể start mà không có Redis
  }
}

/**
 * Setup graceful shutdown cho Redis
 */
function setupGracefulShutdown(app: INestApplication): void {
  const logger = new Logger('Shutdown');

  const gracefulShutdown = async (signal: string) => {
    logger.log(`🛑 Received ${signal}, starting graceful shutdown...`);

    try {
      // Đóng Redis connection
      const redis = app.get('default_IORedisModuleConnectionToken') as Redis;
      if (redis) {
        await redis.quit();
        logger.log('✅ Redis connection closed');
      }
    } catch (error) {
      logger.warn('⚠️  Error closing Redis connection:', error.message);
    }

    // Đóng app
    await app.close();
    logger.log('✅ Application shutdown complete');
    process.exit(0);
  };

  // Listen for termination signals
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  // Global prefix
  const globalPrefix = 'api';
  app.setGlobalPrefix(globalPrefix);

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Global exception filter
  app.useGlobalFilters(new HttpExceptionFilter());

  // Swagger documentation
  const config = new DocumentBuilder()
    .setTitle('ChatBot Banking API')
    .setDescription('API documentation for ChatBot Banking system')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  // CORS
  app.enableCors({
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true,
  });

  app.useWebSocketAdapter(new IoAdapter(app));

  const port = process.env.PORT || 3000;

  await testRedisConnection(app);

  // Setup graceful shutdown
  setupGracefulShutdown(app);

  const server = await app.listen(port, () => {
    console.log('================ SERVER STARTED ================');
    console.log(
      `🚀 Server is running on http://localhost:${port}/${globalPrefix}`,
    );
    console.log(
      `📚 Swagger docs: http://localhost:${port}/${globalPrefix}/docs`,
    );
    console.log(`🔧 Logger levels enabled: error, warn, log, debug, verbose`);
    console.log('===============================================');

    Logger.log('Listening at http://localhost:' + port + '/' + globalPrefix);
    Logger.log(
      'Swagger docs available at http://localhost:' +
        port +
        '/' +
        globalPrefix +
        '/docs',
    );
    Logger.debug('🔧 Debug logging is enabled');
    Logger.verbose('🔧 Verbose logging is enabled');
  });
}

// Start application với error handling
bootstrap().catch((error) => {
  const logger = new Logger('Bootstrap');
  logger.error('❌ Failed to start application:', error);
  process.exit(1);
});
