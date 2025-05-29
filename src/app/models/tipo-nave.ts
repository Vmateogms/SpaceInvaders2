import { Recursos } from './recursos';

export interface TipoNave {
  cost: Partial<Recursos>;
  hp: number;
  attack: number;
  speed: number;
  icon: string;
  special: string;
}
