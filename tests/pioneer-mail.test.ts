// EASTER 버그 수정: 금빛 편지 — 플래그 대신 「개척자 && 장식 미지급 && 우편함에 안 연 편지 없음」이면 켤 때마다 다시 넣기
//  · 저장 맞추기(서버 저장 고르기) 중엔 기다렸다가 · 넣자마자 저장 + 클라우드 · 실제 저장(웅스, 편지가 사라진 상태) 재현
import { beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';

const net = vi.hoisted(() => ({ ready: true, pushes: 0, id: 'woongs' as string | null }));
vi.mock('../src/net/server', async (orig) => ({ ...(await orig<object>()), online: () => true, myPioneer: async () => net.id, pioneers: async () => [] }));
vi.mock('../src/net/sync', async (orig) => ({ ...(await orig<object>()), cloudReady: () => net.ready, pushNow: async () => void net.pushes++ }));

import { checkPioneer } from '../src/ui/easter';
import { P, S, world, resetProgress } from '../src/world/state';

const W = 'tests/fixtures/real_woongs.json';
const pmail = () => P.meta.mail.filter((m) => m.reward?.pioneer);
beforeEach(() => {
  resetProgress();
  world.objs.length = 0;
  S.started = true as never;
  net.ready = true;
  net.pushes = 0;
  net.id = 'woongs';
  document.body.innerHTML = '<div id="toast"></div>';
  localStorage.clear();
});

describe('금빛 편지 다시 넣기', () => {
  it.skipIf(!fs.existsSync(W))('웅스 실제 저장(편지 사라짐 · mail 플래그 없음 · got 없음): 켜면 편지가 오고 바로 저장·클라우드', async () => {
    const sv = JSON.parse(fs.readFileSync(W, 'utf8'));
    Object.assign(P.meta, sv.progress.meta);
    if (sv.progress.decor) Object.assign(P.decor, sv.progress.decor);
    for (const b of sv.buildings) world.objs.push(b);
    expect(pmail().length).toBe(0);
    expect(P.meta.easter?.got).toBeUndefined();
    await checkPioneer();
    expect(pmail().length).toBe(1);
    expect(net.pushes).toBe(1);
    expect(localStorage.length).toBeGreaterThan(0);
    // 다시 켜도 안 연 편지가 있으면 또 넣지 않음
    await checkPioneer();
    expect(pmail().length).toBe(1);
  });
  it('mail 플래그가 남아 있어도 편지가 없으면 다시 넣음 · 이미 받았으면(got/장식) 안 넣음', async () => {
    P.meta.easter = { mail: 'woongs' };
    await checkPioneer();
    expect(pmail().length).toBe(1);
    resetProgress();
    P.meta.easter = { got: 'woongs' };
    await checkPioneer();
    expect(pmail().length).toBe(0);
    resetProgress();
    world.objs.push({ kind: 'duck_spa', tx: 1, ty: 1, fw: 1, fh: 1 } as never);
    await checkPioneer();
    expect(pmail().length).toBe(0);
    expect(P.meta.easter.got).toBe('woongs');
  });
  it('서버 저장 고르기 중엔 넣지 않고 기다림', async () => {
    vi.useFakeTimers();
    net.ready = false;
    await checkPioneer();
    expect(pmail().length).toBe(0);
    net.ready = true;
    await vi.advanceTimersByTimeAsync(5100);
    expect(pmail().length).toBe(1);
    vi.useRealTimers();
  });
  it('개척자가 아니면 아무것도', async () => {
    net.id = null;
    await checkPioneer();
    expect(pmail().length).toBe(0);
  });
});
