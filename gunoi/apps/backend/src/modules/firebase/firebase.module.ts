import { Global, Module, Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';

export const FIREBASE_ADMIN = Symbol('FIREBASE_ADMIN');

const firebaseProvider: Provider = {
  provide: FIREBASE_ADMIN,
  inject: [ConfigService],
  useFactory: (config: ConfigService): admin.app.App => {
    const projectId = config.get<string>('FIREBASE_PROJECT_ID');
    const clientEmail = config.get<string>('FIREBASE_CLIENT_EMAIL');
    const privateKey = config
      .get<string>('FIREBASE_PRIVATE_KEY')
      ?.replace(/\\n/g, '\n');

    // In development without Firebase creds, use a mock that allows any UID
    if (!projectId) {
      return admin.initializeApp({ projectId: 'rivo-dev' }) as admin.app.App;
    }

    return admin.initializeApp({
      credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
    }) as admin.app.App;
  },
};

@Global()
@Module({
  providers: [firebaseProvider],
  exports: [FIREBASE_ADMIN],
})
export class FirebaseModule {}
