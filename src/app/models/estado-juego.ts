import { Recursos } from './recursos';
import { SistemaEstelar } from './sistema-estelar';
import { NaveAtaque } from './nave-ataque';
import { Edificio } from './edificio';

export interface EstadoJuego {
  resources: Recursos;
  score: number;
  turn: number;
  systems: SistemaEstelar[];
  ships: NaveAtaque[];
  selectedSystem: number | null;
  buildings: Edificio[];
  buildQueue: { id: number, tipo: 'edificio' | 'mejora', turnosRestantes: number, sistemaId: number, nombre: string }[];
  research: {
    propulsion: number;
    weapons: number;
    shields: number;
    espionage: number;
    terraforming: number;
    quantum: number;
  };
  autoPlay: boolean;
  enemies: any[];
  heroes: any[];
  missions: any[];
  artifacts: any[];
  spaceStations: any[];
  spaceWeather: string;
  weatherTimer: number;
  achievements: any[];
  trade_routes: any[];
  alliances: any[];
  reputation: {
    military: number;
    economic: number;
    scientific: number;
  };
  anomalies: any[];
  pirates: any[];
}
