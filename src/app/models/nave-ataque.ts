export interface NaveAtaque {
  id: number;
  type: string;
  hp: number;
  maxHp?: number;
  attack: number;
  speed: number;
  location?: number; // Original system-based location
  x?: number;       // X coordinate in world space
  y?: number;       // Y coordinate in world space
  moving: boolean;
  owner: string;
  size?: number;     // Size for rendering
  target?: { x: number, y: number } // Target for movement
}
