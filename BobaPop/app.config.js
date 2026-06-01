const PROD_ANDROID_ADMOB_APP_ID =
  process.env.EXPO_PUBLIC_ADMOB_ANDROID_APP_ID ?? 'ca-app-pub-8863066373093222~6277605097';

const PROD_IOS_ADMOB_APP_ID =
  process.env.EXPO_PUBLIC_ADMOB_IOS_APP_ID ?? 'ca-app-pub-8863066373093222~6277605097';

const GOOGLE_MOBILE_ADS_CONFIG = {
  androidAppId: PROD_ANDROID_ADMOB_APP_ID,
  iosAppId: PROD_IOS_ADMOB_APP_ID,
  android_app_id: PROD_ANDROID_ADMOB_APP_ID,
  ios_app_id: PROD_IOS_ADMOB_APP_ID,
};

module.exports = {
  expo: {
    name: 'BobaPop',
    slug: 'bobapop',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'dark',
    newArchEnabled: true,
    splash: {
      image: './assets/splash-icon.png',
      resizeMode: 'contain',
      backgroundColor: '#2A0F05',
    },
    ios: {
      supportsTablet: false,
      bundleIdentifier: 'com.codewerx.bobapop',
      buildNumber: '1',
      statusBarHidden: true,
      requireFullScreen: true,
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
      },
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#2A0F05',
      },
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
      permissions: [
        'android.permission.RECORD_AUDIO',
        'android.permission.MODIFY_AUDIO_SETTINGS',
        'android.permission.FOREGROUND_SERVICE',
        'android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK',
      ],
    },
    web: {
      favicon: './assets/favicon.png',
    },
    plugins: [
      'expo-font',
      'expo-audio',
      'expo-iap',
      ['react-native-google-mobile-ads', GOOGLE_MOBILE_ADS_CONFIG],
    ],
    'react-native-google-mobile-ads': {
      android_app_id: PROD_ANDROID_ADMOB_APP_ID,
      ios_app_id: PROD_IOS_ADMOB_APP_ID,
    },
    extra: {
      eas: {
        projectId: 'ef69fab3-9820-40c4-9974-002e70d18d18',
      },
    },
  },
  'react-native-google-mobile-ads': {
    android_app_id: PROD_ANDROID_ADMOB_APP_ID,
    ios_app_id: PROD_IOS_ADMOB_APP_ID,
  },
};
