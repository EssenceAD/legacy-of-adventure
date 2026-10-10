// 서버 연결 한 곳. 2차에서 Supabase 구현으로 이 줄들만 바꾼다.
import { localAuth, localChat, localCloud, localRanking } from './local';

export const net = {
  ranking: localRanking,
  auth: localAuth,
  cloud: localCloud,
  chat: localChat,
};
