// 새 버전 저장 지키기 (플래그 없음): 이 앱보다 높은 버전의 저장(이 기기·클라우드)은 옮기지도·덮지도·지우지도·올리지도 않는다
//  다음 업데이트가 저장 버전을 올려도(v8 → v9) 옛 앱이 새 저장을 망가뜨리지 않게 — 지금 먼저 배포해 둔다
import { beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';

const net = vi.hoisted(() => ({ cloud: null as null | { data: Record<string, unknown>; updated_at: string }, pushes: 0, villages: 0 }));
vi.mock('../src/net/server', async (orig) => ({
  ...(await orig<object>()),
  online: () => true,
  isGuest: () => false,
  pullSave: async () => net.cloud,
  pushSave: async () => void net.pushes++,
  pushVillage: async () => void net.villages++,
}));
vi.mock('../src/net/gbSync', () => ({ pollGuestbook: async () => {} }));

import { CONFIG } from '../src/data/config';
import { _resetFutureSave, clearSave, futureHooks, hasSave, isFutureSave, migrate, readSave, writeSave } from '../src/save/save';
import { compareSaves, pushNow, setCloudReady, useServerSave } from '../src/net/sync';
import { S } from '../src/world/state';

const KEY = CONFIG.save.key;
const FUTURE = JSON.stringify({ version: CONFIG.save.version + 1, savedAt: 1, land: 8, buildings: [{ kind: 'inn', tx: 30, ty: 30 }], gold: 777, innName: '미래 여관', progress: {} });
const load = (v: number) => JSON.parse(fs.readFileSync(`tests/fixtures/v${v}.json`, 'utf8'));
let found = 0;

beforeEach(() => {
  localStorage.clear();
  _resetFutureSave();
  net.cloud = null;
  net.pushes = 0;
  net.villages = 0;
  found = 0;
  futureHooks.found = () => void found++;
  S.started = true;
  S.innName = '솔바람 여관';
});

describe('이 기기의 새 버전 저장', () => {
  it('readSave 전 첫 writeSave도 덮지 않는다', () => {
    localStorage.setItem(KEY, FUTURE);
    writeSave();
    expect(localStorage.getItem(KEY)).toBe(FUTURE);
    expect(isFutureSave()).toBe(true);
    expect(found).toBe(1);
  });
  it('옮기지 않고 원본 그대로 · hasSave 참 · 쓰기·지우기 없음 · 백업 키도 안 만든다', () => {
    localStorage.setItem(KEY, FUTURE);
    expect(readSave()).toBeNull();
    expect(isFutureSave()).toBe(true);
    expect(hasSave()).toBe(true);
    writeSave();
    clearSave();
    expect(localStorage.getItem(KEY)).toBe(FUTURE);
    expect(localStorage.getItem(KEY + '.bak')).toBeNull();
    expect(localStorage.getItem(KEY + '.bak7')).toBeNull();
    expect(found).toBe(1);
  });
  it('다른 탭(새 버전)이 저장을 바꾸면 이 탭 자동 저장이 멈춘다', () => {
    writeSave();
    expect(isFutureSave()).toBe(false);
    localStorage.setItem(KEY, FUTURE);
    dispatchEvent(new StorageEvent('storage', { key: KEY, newValue: FUTURE }));
    expect(isFutureSave()).toBe(true);
    writeSave();
    expect(localStorage.getItem(KEY)).toBe(FUTURE);
  });
  it('클라우드가 옛 저장이어도 고르기 없음 · 클라우드로 덮지 않음 · 올리지 않음', async () => {
    localStorage.setItem(KEY, FUTURE);
    net.cloud = { data: { ...load(6), version: CONFIG.save.version }, updated_at: new Date().toISOString() };
    expect(await compareSaves()).toBeNull();
    useServerSave(net.cloud.data);
    setCloudReady(true);
    await pushNow();
    expect(net.pushes).toBe(0);
    expect(net.villages).toBe(0);
    expect(localStorage.getItem(KEY)).toBe(FUTURE);
  });
});

describe('클라우드의 새 버전 저장', () => {
  it('불러오지 않고 · 올리지 않고 · 이 기기 저장도 멈춘다', async () => {
    writeSave();
    const mine = localStorage.getItem(KEY);
    expect(mine).not.toBeNull();
    net.cloud = { data: JSON.parse(FUTURE), updated_at: new Date().toISOString() };
    expect(await compareSaves()).toBeNull();
    expect(isFutureSave()).toBe(true);
    expect(found).toBe(1);
    useServerSave(net.cloud.data);
    expect(localStorage.getItem(KEY)).toBe(mine);
    setCloudReady(true);
    await pushNow();
    expect(net.pushes).toBe(0);
    S.gold += 5;
    writeSave();
    expect(localStorage.getItem(KEY)).toBe(mine);
  });
});

describe('보통 저장은 예전 그대로', () => {
  it('v8 저장: 읽기·쓰기·올리기 · 지우기', async () => {
    localStorage.setItem(KEY, JSON.stringify(load(6)));
    const v8 = JSON.stringify(readSave());
    localStorage.setItem(KEY, v8);
    const s = readSave()!;
    expect(s.version).toBe(CONFIG.save.version);
    expect(s.gold).toBe(load(6).gold);
    expect(hasSave()).toBe(true);
    writeSave();
    expect(localStorage.getItem(KEY)).not.toBe(v8);
    expect(isFutureSave()).toBe(false);
    setCloudReady(true);
    await pushNow();
    expect(net.pushes).toBe(1);
    clearSave();
    expect(localStorage.getItem(KEY)).toBeNull();
    expect(hasSave()).toBe(false);
  });
  it('옛 저장(v1·v6)은 그대로 옮겨진다 · migrate(99)는 여전히 null', () => {
    for (const v of [1, 6]) {
      localStorage.setItem(KEY, JSON.stringify(load(v)));
      expect(readSave()!.version).toBe(CONFIG.save.version);
    }
    expect(migrate({ version: 99 })).toBeNull();
    expect(isFutureSave()).toBe(false);
    expect(found).toBe(0);
  });
  it('클라우드가 같은 버전의 다른 마을이면 예전처럼 고르게 한다', async () => {
    writeSave();
    net.cloud = { data: { ...load(6), version: CONFIG.save.version, savedAt: Date.now() + 60000, innName: '다른 여관' }, updated_at: new Date().toISOString() };
    const c = await compareSaves();
    expect(c).not.toBeNull();
    expect(c!.server.innName).toBe('다른 여관');
    useServerSave(net.cloud.data);
    expect(JSON.parse(localStorage.getItem(KEY)!).innName).toBe('다른 여관');
  });
});
