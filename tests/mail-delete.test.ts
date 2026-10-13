// 우편함: 읽은 편지 지우기 — 받음/읽음만 · 안 받은 보상 편지는 못 지움 · 한꺼번에
import { beforeEach, describe, expect, it } from 'vitest';
import { addMail, claimMail, deleteMail, deleteReadMail, mailWaiting, readMailCount } from '../src/world/meta';
import { P, resetProgress } from '../src/world/state';

beforeEach(() => {
  resetProgress();
  document.body.innerHTML = '<div id="toast"></div>';
});
describe('우편함 지우기', () => {
  it('받은 편지만 지워짐 · 보상 남은 편지는 그대로', () => {
    addMail({ from: 'system', title: 'a', body: '', reward: { gold: 100 } });
    addMail({ from: 'system', title: 'b', body: '', reward: {} });
    addMail({ from: 'system', title: 'c', body: '', reward: { gold: 5 } });
    const [a, b, c] = ['a', 'b', 'c'].map((t) => P.meta.mail.find((m) => m.title === t)!);
    expect(deleteMail(a.id)).toBe(false);
    claimMail(a.id);
    claimMail(b.id);
    expect(readMailCount()).toBe(2);
    expect(deleteMail(a.id)).toBe(true);
    expect(deleteReadMail()).toBe(1);
    expect(P.meta.mail.map((m) => m.title)).toEqual(['c']);
    expect(mailWaiting()).toBe(1);
    void c;
  });
});
