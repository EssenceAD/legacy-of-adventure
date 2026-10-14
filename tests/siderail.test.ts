// FIRSTLOOK §5 flSideRail: 접힌 채 2개(배율 · 「⋯」) · 펼치기/접기(바깥 탭 · 고른 뒤) · 빨간 점이 「⋯」로 · 끄면 예전 다섯 그대로
import fs from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FLAG_DEFAULTS, setFlag } from "../src/world/flags";
import { setLab } from "../src/world/visual";
import {
  hasDot,
  initSideRail,
  railDot,
  railOpen,
  railTick,
  setRailOpen,
  sideRailOn,
} from "../src/ui/sideRail";

// style.css 의 §5 블록만 (jsdom 계산 스타일로 「보이는 버튼」을 센다)
const css = fs.readFileSync("src/style.css", "utf8");
const RAIL_CSS = css.slice(css.indexOf("/* FIRSTLOOK §5"));
const RIGHT = ["bDN", "bHarm", "hSpk", "bZoom", "bEye", "bRail"];

function mount() {
  document.head.innerHTML = `<style>${RAIL_CSS}</style>`;
  document.body.innerHTML = `<div id="hud"><div class="top"><button id="bDN" class="ibtn px hb"><b>☾</b></button></div>
    <button id="bHarm" class="ibtn px hb"></button><button id="hSpk" class="ibtn px hb"></button>
    <button id="bZoom" class="ibtn px">×1</button><button id="bEye" class="ibtn px hb"><b>👁</b></button><div id="map"></div></div>`;
}
const shown = () =>
  RIGHT.filter((id) => {
    const e = document.getElementById(id);
    return !!e && getComputedStyle(e).display !== "none";
  });

beforeEach(() => {
  localStorage.clear();
  setLab(false);
  setFlag("flSideRail", false);
  document.body.className = "hud2";
  mount();
});
afterEach(() => {
  setFlag("flSideRail", false);
  document.body.className = "";
  vi.useRealTimers();
});

describe("flSideRail", () => {
  it("코드 기본은 꺼짐 · v0.25.42 형철 OK로 flags.json 켬", () => {
    expect(FLAG_DEFAULTS.flSideRail).toBe(false);
    expect(
      JSON.parse(fs.readFileSync("public/flags.json", "utf8")).flSideRail,
    ).toBe(true);
  });

  it("끄면 예전 그대로: 「⋯」 없음 · 다섯 버튼 다 보임", () => {
    initSideRail();
    expect(sideRailOn()).toBe(false);
    expect(document.getElementById("bRail")).toBeNull();
    expect(document.body.classList.contains("flrail")).toBe(false);
    expect(shown()).toEqual(["bDN", "bHarm", "hSpk", "bZoom", "bEye"]);
  });

  it("예전 HUD(body.hud2 아님)면 켜도 아무것도 안 함", () => {
    document.body.className = "";
    setFlag("flSideRail", true);
    initSideRail();
    expect(document.getElementById("bRail")).toBeNull();
  });

  it("켜면 접힌 채 2개(배율 · 「⋯」)만", () => {
    setFlag("flSideRail", true);
    initSideRail();
    expect(shown()).toEqual(["bZoom", "bRail"]);
    expect(railOpen()).toBe(false);
  });

  it("실험실(이 기기)로도 켜진다", () => {
    setLab(true);
    initSideRail();
    expect(shown()).toEqual(["bZoom", "bRail"]);
    setLab(false);
  });

  it("「⋯」 누르면 펼침 → 다섯 + 「⋯」 · 다시 누르면 접힘", () => {
    setFlag("flSideRail", true);
    initSideRail();
    const b = document.getElementById("bRail")!;
    b.click();
    expect(railOpen()).toBe(true);
    expect(b.getAttribute("aria-expanded")).toBe("true");
    expect(shown().sort()).toEqual([...RIGHT].sort());
    // 보이는 것끼리 차례 (빈칸 없이)
    expect(
      ["bDN", "bHarm", "hSpk", "bEye"].map((id) =>
        document.getElementById(id)!.style.getPropertyValue("--ri"),
      ),
    ).toEqual(["0", "1", "2", "3"]);
    b.click();
    expect(railOpen()).toBe(false);
    expect(shown()).toEqual(["bZoom", "bRail"]);
  });

  it("숨은 항목은 건너뛰고 차례를 매긴다", () => {
    setFlag("flSideRail", true);
    document.getElementById("bHarm")!.hidden = true;
    initSideRail();
    setRailOpen(true);
    expect(
      ["bDN", "hSpk", "bEye"].map((id) =>
        document.getElementById(id)!.style.getPropertyValue("--ri"),
      ),
    ).toEqual(["0", "1", "2"]);
  });

  it("바깥을 누르면 접힘 · 안쪽 버튼을 누를 땐 그 동작 뒤에 접힘", () => {
    vi.useFakeTimers();
    setFlag("flSideRail", true);
    initSideRail();
    setRailOpen(true);
    document
      .getElementById("map")!
      .dispatchEvent(new Event("pointerdown", { bubbles: true }));
    expect(railOpen()).toBe(false);

    setRailOpen(true);
    let fired = 0;
    const s = document.getElementById("hSpk")!;
    s.onclick = (e) => {
      e.stopPropagation();
      fired++;
      expect(railOpen()).toBe(true); // 동작하는 동안은 아직 펼쳐 있음
    };
    s.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    expect(railOpen()).toBe(true); // 안쪽 pointerdown 은 안 접음
    s.click();
    expect(fired).toBe(1);
    vi.advanceTimersByTime(1);
    expect(railOpen()).toBe(false);
  });

  it("창이 열리면 접힘", () => {
    setFlag("flSideRail", true);
    initSideRail();
    setRailOpen(true);
    document.body.classList.add("winopen");
    railTick();
    expect(railOpen()).toBe(false);
  });

  it("빨간 점: 안의 항목에 점이 있으면 「⋯」에 점", () => {
    setFlag("flSideRail", true);
    initSideRail();
    const b = document.getElementById("bRail")!;
    expect(b.classList.contains("rdot")).toBe(false);
    document.getElementById("hSpk")!.classList.add("rdot");
    railTick();
    expect(b.classList.contains("rdot")).toBe(true);
    document.getElementById("hSpk")!.classList.remove("rdot");
    railTick();
    expect(b.classList.contains("rdot")).toBe(false);
    // 숨긴 .dot 은 점이 아님 · 보이는 .dot 은 점
    const d = document.createElement("i");
    d.className = "dot";
    d.hidden = true;
    document.getElementById("bHarm")!.appendChild(d);
    railTick();
    expect(b.classList.contains("rdot")).toBe(false);
    d.hidden = false;
    railTick();
    expect(b.classList.contains("rdot")).toBe(true);
  });

  it("hasDot · railDot 규칙", () => {
    const a = document.createElement("button");
    const c = document.createElement("button");
    expect(railDot([a, c])).toBe(false);
    c.innerHTML = '<i class="ndot"></i>';
    expect(hasDot(c)).toBe(true);
    expect(railDot([a, c])).toBe(true);
  });
});

describe("R28 「⋯」 운명의 별 ★ · .px 빨간 점", () => {
  it("접힌 동안 낮밤 버튼 ★(#starMark)가 보이면 「⋯」에도 ★ · 펼치면 끔 · 별 없으면 끔", () => {
    document.getElementById("bDN")!.innerHTML =
      '<b>☾</b><i id="starMark" hidden>★</i>';
    setFlag("flSideRail", true);
    initSideRail();
    const star = () => document.getElementById("railStar")!;
    expect(star().textContent).toBe("★");
    expect(star().hidden).toBe(true);
    document.getElementById("starMark")!.hidden = false;
    railTick();
    expect(star().hidden).toBe(false);
    setRailOpen(true);
    expect(star().hidden).toBe(true);
    setRailOpen(false);
    expect(star().hidden).toBe(false);
    document.getElementById("starMark")!.hidden = true;
    railTick();
    expect(star().hidden).toBe(true);
  });

  it("★ 모양은 #starMark 와 같은 색·크기·그림자", () => {
    const rule = (sel: string) =>
      css.match(new RegExp("\n" + sel + "\{([^}]*)\}"))?.[1];
    expect(rule("#railStar")).toBe(rule("#starMark"));
  });

  it(".px.rdot::before 가 .px::before{display:none} 보다 세다 (규칙 순서와 상관없이)", () => {
    expect(css).toContain(".px.rdot::before{display:block;content:'';left:auto;bottom:auto}");
    // 선택자 세기: .px.rdot::before (클래스 2) > .px::before · .rdot::before (클래스 1) — 실제 빌드 확인은 dist CSS·스크린샷
  });
});
