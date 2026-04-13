import { Module } from '@nestjs/common';
import { ClientProfilesController } from './client-profiles.controller';
import { ClientProfilesService } from './client-profiles.service';

@Module({
  controllers: [ClientProfilesController],
  providers: [ClientProfilesService],
})
export class ClientProfilesModule {}
