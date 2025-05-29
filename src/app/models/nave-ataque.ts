export interface NaveAtaque {
  id: number;
  type: string;
  hp: number;
  maxHp: number;
  attack: number;
  speed: number;
  location: number;
  moving: boolean;
  owner: string;
}
