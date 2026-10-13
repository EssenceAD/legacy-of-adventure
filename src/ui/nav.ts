// 「가기」: 오늘의 목표·임무 카드가 가리키는 곳을 바로 연다 (5단계 0·1장)
import { bestOf } from '../world/town';
import { def, type Kind } from '../data/catalog';
import { world, S, type Building } from '../world/state';
import { focusTile } from '../game';
import { openBoard } from './expedition';
import { openGuests } from './guests';
import { openGarden, openSmith } from './smith';
import { closeWin, openBuild, openLand, showObj, toast } from './windows';

export type Place =
  | 'board' | 'build' | 'land' | 'guests' | 'village' | 'owner' | 'goals' | 'hunt' | 'raid' | 'bag' | 'dex' | 'menu'
  | 'inn' | 'tavern' | 'smith' | 'garden' | 'training' | 'well' | 'fire' | 'boardObj' | 'eval';

const homeObjs = () => world.home?.objs ?? world.objs;
const obj = (k: Kind): Building | undefined => bestOf(k, homeObjs(), true);

/** 이 장소의 아래 메뉴 버튼 (손가락이 가리킬 곳) */
export const PLACE_BTN: Partial<Record<Place, string>> = {
  board: '#bExp', hunt: '#bExp', raid: '#bExp', build: '#bBuild', land: '#bBuild', guests: '#bGuest', village: '#bVillage', owner: '#bOwner',
  goals: '#bMenu2', menu: '#bMenu2', bag: '#bGuest', dex: '#bMenu2', well: '#bBuild', fire: '#bBuild', boardObj: '#bBuild', eval: '#evalbar',
};

/** 이동 함수는 순환 import를 피해 나중에 채운다 (hunt·goals·owner 창) */
export const navHooks = {
  hunt: () => toast('사냥터는 원정 게시판에서 열려요'),
  goals: () => {},
  owner: () => {},
  menu: () => {},
  dex: () => {},
  eval: () => {},
};

/** target = CHECKIN §B-1 장부 임무의 건설 대상 (건설 창 맨 위 + 반짝 · 플래그 firstFlowFix는 openBuild가 본다) */
export function openPlace(p: Place, target?: Kind) {
  if (S.visiting) return toast('이웃 마을에서 돌아온 뒤에 해요');
  closeWin();
  const building = (k: Kind, then: (o: Building) => void) => {
    const o = obj(k);
    if (!o) {
      toast(`${def(k).name}을(를) 먼저 지어요 (건설)`);
      return openBuild(k);
    }
    focusTile(o.tx + o.fw / 2, o.ty + o.fh / 2);
    then(o);
  };
  switch (p) {
    case 'board':
    case 'raid':
      return openBoard();
    case 'hunt':
      return navHooks.hunt();
    case 'build':
    case 'well':
    case 'fire':
    case 'boardObj':
      return openBuild(target);
    case 'land':
      return openLand();
    case 'guests':
    case 'bag':
      return openGuests();
    case 'village':
      return toast('마을을 둘러보며 손님을 기다려요');
    case 'owner':
      return navHooks.owner();
    case 'goals':
      return navHooks.goals();
    case 'menu':
      return navHooks.menu();
    case 'dex':
      return navHooks.dex();
    case 'eval':
      return navHooks.eval();
    case 'inn':
      return building('inn', showObj);
    case 'tavern':
      return building('tavern', showObj);
    case 'training':
      return building('training', showObj);
    case 'smith':
      return building('smith', (o) => openSmith(o));
    case 'garden':
      return building('garden', (o) => openGarden(o));
  }
}
