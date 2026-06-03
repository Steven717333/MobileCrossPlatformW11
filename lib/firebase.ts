import { getApp, getApps, initializeApp } from '@react-native-firebase/app';

const app = getApps().length === 0 ? initializeApp({}) : getApp();

export default app;
