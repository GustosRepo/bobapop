const IS_PRODUCTION_BUILD = process.env.EAS_BUILD_PROFILE === 'production';
const EAS_BUILD_PLATFORM = process.env.EAS_BUILD_PLATFORM;
const TEST_ANDROID_ADMOB_APP_ID = 'ca-app-pub-3940256099942544~3347511713';
const TEST_IOS_ADMOB_APP_ID = 'ca-app-pub-3940256099942544~1458002511';

function resolveAdMobAppId(platform, envValue, testValue) {
  const required = IS_PRODUCTION_BUILD && (!EAS_BUILD_PLATFORM || EAS_BUILD_PLATFORM === platform);
  if (envValue && /^ca-app-pub-\d+~\d+$/.test(envValue) && !envValue.includes('0000000000000000')
    && (!required || !envValue.includes('3940256099942544'))) return envValue;
  if (!required) return testValue;
  throw new Error(`Missing EXPO_PUBLIC_ADMOB_${platform.toUpperCase()}_APP_ID for production builds.`);
}

const PROD_ANDROID_ADMOB_APP_ID = resolveAdMobAppId(
  'android',
  process.env.EXPO_PUBLIC_ADMOB_ANDROID_APP_ID,
  TEST_ANDROID_ADMOB_APP_ID,
);

const PROD_IOS_ADMOB_APP_ID = resolveAdMobAppId(
  'ios',
  process.env.EXPO_PUBLIC_ADMOB_IOS_APP_ID,
  TEST_IOS_ADMOB_APP_ID,
);

if (IS_PRODUCTION_BUILD) {
  if (process.env.EXPO_PUBLIC_ALLOW_TEST_ADS_IN_RELEASE === 'true' || process.env.EXPO_PUBLIC_ADMOB_USE_TEST_ADS === 'true') {
    throw new Error('Production builds must disable release test ads. Use a preview build for test ads.');
  }
  for (const platform of EAS_BUILD_PLATFORM ? [EAS_BUILD_PLATFORM] : ['ios', 'android']) {
    for (const placement of ['CONTINUE', 'ENERGY', 'CLEAR_BONUS']) {
      const unit = process.env[`EXPO_PUBLIC_ADMOB_${placement}_${platform.toUpperCase()}_UNIT_ID`]
        || process.env[`EXPO_PUBLIC_ADMOB_REWARDED_${platform.toUpperCase()}_UNIT_ID`];
      if (!/^ca-app-pub-\d+\/\d+$/.test(unit ?? '') || /3940256099942544|0000000000000000/.test(unit)) {
        throw new Error(`Missing live rewarded ad unit ID for ${platform} ${placement.toLowerCase()}.`);
      }
      const appId = platform === 'ios' ? PROD_IOS_ADMOB_APP_ID : PROD_ANDROID_ADMOB_APP_ID;
      if (unit.split('/')[0] !== appId.split('~')[0]) throw new Error(`AdMob publisher mismatch for ${platform} ${placement}.`);
    }
  }
}

for (const name of ['EXPO_PUBLIC_ENERGY_AD_REWARD', 'EXPO_PUBLIC_CONTINUE_AD_LIVES']) {
  if (process.env[name] && !/^[1-3]$/.test(process.env[name])) throw new Error(`${name} must be 1, 2, or 3.`);
}

const GOOGLE_MOBILE_ADS_CONFIG = {
  delayAppMeasurementInit: true,
  userTrackingUsageDescription: 'Your permission helps show relevant ads and supports free gameplay.',
  skAdNetworkItems: require('./config/skadnetwork-ids.js'),
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
    orientation: 'default',
    icon: './assets/icon.png',
    userInterfaceStyle: 'dark',
    splash: {
      image: './assets/splash-icon.png',
      resizeMode: 'contain',
      backgroundColor: '#2A0F05',
    },
    ios: {
      supportsTablet: false,
      bundleIdentifier: 'com.codewerx.bobapop',
      statusBarHidden: true,
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
      },
    },
    android: {
      package: 'com.codewerx.bobapop',
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#2A0F05',
      },
      predictiveBackGestureEnabled: false,
    },
    web: {
      favicon: './assets/favicon.png',
    },
    plugins: [
      'expo-asset',
      'expo-status-bar',
      'expo-font',
      ['expo-audio', {
        microphonePermission: false,
        recordAudioAndroid: false,
        enableBackgroundPlayback: false,
      }],
      'expo-iap',
      ['react-native-google-mobile-ads', GOOGLE_MOBILE_ADS_CONFIG],
    ],
    'react-native-google-mobile-ads': {
      delay_app_measurement_init: true,
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
