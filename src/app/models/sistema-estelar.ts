export interface SistemaEstelar {
  id: number;
  name: string;
  x: number;
  y: number;
  owner: string; // 'player', 'enemy', o 'neutral'
  population: number;
  resources: number;
  development: number;
  defense: number;
  type: string;
  hasOutpost?: boolean;
  outpostLevel?: number; // 1-3, determina el radio de defensa
  edificios?: number[]; // IDs de los edificios construidos
  slotsTotales?: number; // Número máximo de edificios que se pueden construir (basado en development)
  tieneAstillero?: boolean; // Si tiene un astillero para construir naves
}

export interface OutpostEspacial {
  id: number;
  x: number;
  y: number;
  owner: string; // 'player' o 'enemy'
  nivel: number; // 1-3, determina el radio de defensa
  health: number; // 100 por defecto
  rangoDefensa: number; // Calculado basado en el nivel
  sistemaVinculado?: number; // ID del sistema que lo creó
}

export interface NaveEnMovimiento {
  id: number;
  tipoNave: string;
  owner: string; // 'player' o 'enemy'
  origen: {x: number, y: number};
  destino: {x: number, y: number};
  progreso: number; // 0-100
  velocidad: number; // Pixels por ciclo
  posicionActual: {x: number, y: number};
  mision: 'atacar' | 'defender' | 'colonizar' | 'patrullar';
  targetId?: number; // ID del sistema u outpost objetivo
  size?: number; // Tamaño de la nave basado en su tipo: pequeño (1), mediano (2), grande (3)
}

export interface ConflictoBatalla {
  id: number;
  ubicacion: {x: number, y: number};
  atacantes: any[]; // Naves atacantes
  defensores: any[]; // Naves o defensas
  estado: 'activo' | 'finalizado';
  resultados?: {
    ganador: string;
    navesPerdidasAtacante: number;
    navesPerdidasDefensor: number;
    recursosCapturados?: number;
  };
}
