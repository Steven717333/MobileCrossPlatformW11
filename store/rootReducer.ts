import { combineReducers } from '@reduxjs/toolkit';
import counterReducer from './counter.slice';
import firebaseStatsReducer from './firebaseStats.slice';

const rootReducer = combineReducers({
  counter: counterReducer,
  firebaseStats: firebaseStatsReducer,
});

export default rootReducer;
