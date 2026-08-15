import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'org.juliankaiser.apex',
  appName: 'Apex',
  webDir: 'dist',
  plugins: {
    GoogleSignIn: {
      clientId: '708398928493-8qkjhla9p00kkjrse5f0l4d8spo9pj6c.apps.googleusercontent.com',
      scopes: ['profile', 'email'],
      forceCodeForRefreshToken: true,
    }
  }
};

export default config;
