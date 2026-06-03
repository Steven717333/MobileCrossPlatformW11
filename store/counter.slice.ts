import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface CounterState {
  value: number;
  status: 'idle' | 'loading' | 'succeeded' | 'failed';
  error: string | null;
}

const initialState: CounterState = {
  value: 0,
  status: 'idle',
  error: null,
};

export const fetchPostsCount = createAsyncThunk<number>(
  'counter/fetchPostsCount',
  async () => {
    const response = await fetch('https://jsonplaceholder.typicode.com/posts');
    const data = await response.json();
    return Array.isArray(data) ? data.length : 0;
  }
);

const counterSlice = createSlice({
  name: 'counter',
  initialState,
  reducers: {
    increment(state) {
      state.value += 1;
    },
    decrement(state) {
      state.value -= 1;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchPostsCount.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchPostsCount.fulfilled, (state, action: PayloadAction<number>) => {
        state.status = 'succeeded';
        state.value = action.payload;
      })
      .addCase(fetchPostsCount.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.error.message ?? 'Fetch failed';
      });
  },
});

export const { increment, decrement } = counterSlice.actions;
export default counterSlice.reducer;
