// 그림 캐시 상한 (따밤 신고: 삼성 인터넷이 메모리가 모자라면 그림·캔버스를 버린다)
//  Map의 넣은 순서 = 쓴 순서. 꺼내 쓰면 맨 뒤로 → 꽉 차면 가장 오래 안 쓴 것(화면 밖 건물)부터 버린다.
//  다른 게임 모듈을 불러오지 않는다 (테스트에서 그대로 쓰게)

export class Lru<K, V> {
  private m = new Map<K, V>();
  /** 버린 횟수 (측정용) */
  evicted = 0;
  constructor(
    public cap: number,
    private onEvict?: (v: V, k: K) => void,
  ) {}
  get size() {
    return this.m.size;
  }
  /** 꺼내기 (있으면 「방금 씀」으로) */
  get(k: K): V | undefined {
    const v = this.m.get(k);
    if (v === undefined) return undefined;
    this.m.delete(k);
    this.m.set(k, v);
    return v;
  }
  /** 순서를 안 바꾸고 보기 */
  peek(k: K): V | undefined {
    return this.m.get(k);
  }
  has(k: K) {
    return this.m.has(k);
  }
  set(k: K, v: V): V {
    this.m.delete(k);
    this.m.set(k, v);
    while (this.m.size > this.cap) {
      const [ok, ov] = this.m.entries().next().value as [K, V];
      this.m.delete(ok);
      this.evicted++;
      this.onEvict?.(ov, ok);
    }
    return v;
  }
  delete(k: K) {
    return this.m.delete(k);
  }
  /** 조건에 맞는 것 모두 버리기 (그림을 다시 불러왔을 때 등) */
  deleteWhere(fn: (k: K, v: V) => boolean) {
    for (const [k, v] of [...this.m]) if (fn(k, v)) this.m.delete(k);
  }
  clear() {
    this.m.clear();
  }
  keys() {
    return this.m.keys();
  }
  values() {
    return this.m.values();
  }
}

/** 캔버스가 살아 있나 (삼성 인터넷이 메모리 부족 때 폭 0으로 만들거나 컨텍스트를 잃는다) */
export function canvasAlive(c: { width: number; height: number; getContext?: (t: '2d') => unknown }): boolean {
  if (!c.width || !c.height) return false;
  try {
    return !c.getContext || c.getContext('2d') != null;
  } catch {
    return false;
  }
}

/** 그릴 수 있는 그림인가: <img>는 다 받았고 크기가 있어야 (깨진 그림 = complete && naturalWidth 0), 캔버스는 살아 있어야 */
export function drawable(im: unknown): boolean {
  if (!im) return false;
  const i = im as { complete?: boolean; naturalWidth?: number; width: number; height: number; tagName?: string };
  if (i.tagName === 'IMG') return !!i.complete && (i.naturalWidth ?? 0) > 0;
  return i.width > 0 && i.height > 0;
}
