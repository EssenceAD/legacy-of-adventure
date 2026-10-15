import { afterEach, describe, expect, it } from 'vitest';
import { setFlag } from '../src/world/flags';
import { communityCard, communityLink, communityOn } from '../src/ui/community';
import { MANUAL_V2 } from '../src/data/story/manual';

describe('유저 톡방 링크 숨김 (communityLinks · 10/16 형철)', () => {
  afterEach(() => setFlag('communityLinks', false));
  it('기본 꺼짐: 공지 카드 · 편지·제보 링크 모두 빈 글', () => {
    expect(communityOn()).toBe(false);
    expect(communityCard()).toBe('');
    expect(communityLink('mail', '톡방 가기 →')).toBe('');
  });
  it('다시 켜면 돌아온다 (코드는 그대로)', () => {
    setFlag('communityLinks', true);
    expect(communityCard()).toContain('kcard');
    expect(communityLink('mail', '톡방 가기 →')).toContain('open.kakao.com');
  });
  it('안내서: 톡방 줄은 켰을 때만 · 꺼지면 모모에게 편지 안내', () => {
    const lines = JSON.stringify(MANUAL_V2);
    expect(lines).toContain('@communityLinks 메뉴 맨 아래');
    expect(lines).toContain('!communityLinks 버그·건의는 메뉴 「모모에게 편지」');
  });
});
