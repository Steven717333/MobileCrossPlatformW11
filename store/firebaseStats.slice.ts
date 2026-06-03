import { createSlice } from '@reduxjs/toolkit';

export interface FirebaseStatsState {
  firestoreSuccess: number;
  firestoreFailed: number;
  fcmSuccess: number;
  fcmFailed: number;
}

const initialState: FirebaseStatsState = {
  firestoreSuccess: 0,
  firestoreFailed: 0,
  fcmSuccess: 0,
  fcmFailed: 0,
};

const firebaseStatsSlice = createSlice({
  name: 'firebaseStats',
  initialState,
  reducers: {
    incrementFirestoreSuccess(state) {
      state.firestoreSuccess += 1;
    },
    incrementFirestoreFailed(state) {
      state.firestoreFailed += 1;
    },
    incrementFcmSuccess(state) {
      state.fcmSuccess += 1;
    },
    incrementFcmFailed(state) {
      state.fcmFailed += 1;
    },
    resetStats(state) {
      state.firestoreSuccess = 0;
      state.firestoreFailed = 0;
      state.fcmSuccess = 0;
      state.fcmFailed = 0;
    },
  },
});

export const {
  incrementFirestoreSuccess,
  incrementFirestoreFailed,
  incrementFcmSuccess,
  incrementFcmFailed,
  resetStats,
} = firebaseStatsSlice.actions;

export default firebaseStatsSlice.reducer;
