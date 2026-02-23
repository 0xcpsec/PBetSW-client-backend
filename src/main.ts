import { config as loadEnv } from 'dotenv';
loadEnv();

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { AllExceptionsFilter } from './utils/http-exception.filter';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import mongoose from 'mongoose';
import * as express from 'express';

const DESKTOP_MENU_PATHS = ['/api/menu/desktopMenu', '/menu/desktopMenu'];

const MONGODB_URI = process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017';
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME ?? 'stra188_adapter_mirror';
const PORT = parseInt(process.env.PORT ?? '5001', 10);

const BETS_COLLECTION = 'stra188_bets';

async function bootstrap() {
  const conn = await mongoose.createConnection(`${MONGODB_URI}/${MONGODB_DB_NAME}`).asPromise();
  const collections = await conn.db.listCollections().toArray();
  for (const { name } of collections) {
    if (name !== BETS_COLLECTION) {
      await conn.db.collection(name).drop().catch(() => {});
    }
  }
  await conn.close();

  const app = await NestFactory.create(AppModule, { bodyParser: false });
  const { httpAdapter } = app.get(HttpAdapterHost);

  // Body parser: desktopMenu accepts any body (plain number, text, or JSON); other routes use JSON
  app.use((req: any, res: any, next: any) => {
    if (req.method === 'POST' && DESKTOP_MENU_PATHS.includes(req.path)) {
      const chunks: any[] = [];
      req.on('data', (chunk: any) => chunks.push(chunk));
      req.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8').trim();
        if (raw === '') {
          req.body = undefined;
        } else {
          try {
            req.body = JSON.parse(raw);
          } catch {
            const n = Number(raw);
            req.body = Number.isNaN(n) ? raw : n;
          }
        }
        next();
      });
      req.on('error', next);
      return;
    }
    express.json({ strict: false, limit: '10mb' })(req, res, next);
  });
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  app.useGlobalPipes(new ValidationPipe({ 
    transform: true, 
    whitelist: false, 
    forbidNonWhitelisted: false,
    skipMissingProperties: true,
    skipNullProperties: true,
    skipUndefinedProperties: true,
  }));
  
  // Custom CORS middleware to allow any headers dynamically
  app.use((req: any, res: any, next: any) => {
    const origin = req.headers.origin;
    if (origin) {
      res.header('Access-Control-Allow-Origin', origin);
      res.header('Access-Control-Allow-Credentials', 'true');
    } else {
      res.header('Access-Control-Allow-Origin', '*');
    }
    
    // Handle preflight OPTIONS requests
    if (req.method === 'OPTIONS') {
      const requestedHeaders = req.headers['access-control-request-headers'];
      if (requestedHeaders) {
        res.header('Access-Control-Allow-Headers', requestedHeaders);
      } else {
        res.header('Access-Control-Allow-Headers', '*');
      }
      res.header('Access-Control-Allow-Methods', 'GET, PUT, POST, PATCH, DELETE, OPTIONS, HEAD');
      res.header('Access-Control-Max-Age', '86400'); // 24 hours
      return res.status(204).send();
    }
    
    // For actual requests, set CORS headers
    res.header('Access-Control-Expose-Headers', '*');
    next();
  });
  app.useGlobalFilters(new AllExceptionsFilter(httpAdapter));

  const config = new DocumentBuilder()
    .setTitle('Stra188 API')
    .setDescription('Stra188 adapter API')
    .setVersion('1.0')
    .addTag('Stra188')
    .build();
  SwaggerModule.setup('api-doc', app, SwaggerModule.createDocument(app, config));

  await app.listen(PORT);
}
bootstrap();
