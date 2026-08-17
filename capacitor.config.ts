import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'org.juliankaiser.apex',
  appName: 'Apex',
  webDir: 'dist',
  plugins: {
    GoogleSignIn: {
      clientId: process.env.VITE_GOOGLE_CLIENT_ID || 'your_google_client_id.apps.googleusercontent.com',
      scopes: ['profile', 'email'],
      forceCodeForRefreshToken: true,
    }
  }
};

export default config;
