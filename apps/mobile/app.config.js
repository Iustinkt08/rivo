// Dynamic Expo config. Extends the static app.json and injects native config
// (Google Maps Android key comes from the environment).
//
// Env vars are loaded by the Expo CLI from .env / .env.local before this file
// is evaluated. Notă: în acest repo fișierele .env sunt commit-uite intenționat,
// deci cheia NU mai e un secret local — vezi „Secrete și acces" din README.md.

const appJson = require('./app.json');

module.exports = () => {
  const base = appJson.expo;

  return {
    ...base,
    android: {
      ...base.android,
      config: {
        ...(base.android && base.android.config),
        googleMaps: {
          apiKey: process.env.GOOGLE_MAPS_ANDROID_API_KEY,
        },
      },
    },
    plugins: [
      ...(base.plugins || []),
      [
        'expo-location',
        {
          locationWhenInUsePermission:
            'NAVIRA folosește locația ta pentru a-ți arăta saloane în apropiere.',
        },
      ],
    ],
  };
};
