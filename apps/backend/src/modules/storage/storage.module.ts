import { Module } from '@nestjs/common';
import { StorageService } from './storage.service';

// ConfigModule is global (see AppModule), so ConfigService is injectable here
// without an explicit import.
@Module({
  providers: [StorageService],
  exports: [StorageService],
})
export class StorageModule {}
