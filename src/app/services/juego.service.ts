import { Injectable, signal } from '@angular/core';
import { EstadoJuego } from '../models/estado-juego';
import { SistemaEstelar } from '../models/sistema-estelar';
import { NaveAtaque } from '../models/nave-ataque';
import { TipoNave } from '../models/tipo-nave';

@Injectable({
  providedIn: 'root'
})
export class JuegoService {
  private readonly NOMBRES_PREFIJOS = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta', 'Eta', 'Theta'];
  private readonly NOMBRES_SUFIJOS = ['Centauri', 'Draconis', 'Orionis', 'Cassiopeia', 'Vega', 'Sirius', 'Rigel', 'Betelgeuse'];
  private readonly COLORES_ESTRELLAS: Record<string, string> = {
    yellow: '#ffeb3b',
    red: '#f44336',
    blue: '#2196f3',
    white: '#ffffff'
  };

  // Tipos de naves disponibles
  public readonly tiposNave: Record<string, TipoNave> = {
    scout: { cost: {energy: 50, materials: 20}, hp: 30, attack: 10, speed: 3, icon: '🔍', special: 'exploration' },
    fighter: { cost: {energy: 100, materials: 50}, hp: 60, attack: 25, speed: 2, icon: '⚔️', special: 'combat' },
    cruiser: { cost: {energy: 200, materials: 100}, hp: 120, attack: 50, speed: 1, icon: '🚢', special: 'heavy' },
    colony: { cost: {energy: 300, materials: 200, crystals: 50}, hp: 80, attack: 5, speed: 1, icon: '🏴', special: 'colonize' },
    carrier: { cost: {energy: 400, materials: 300, crystals: 100}, hp: 200, attack: 30, speed: 1, icon: '🛸', special: 'support' },
    stealth: { cost: {energy: 250, materials: 150, intel: 50}, hp: 40, attack: 35, speed: 3, icon: '👻', special: 'stealth' },
    titan: { cost: {energy: 800, materials: 600, crystals: 200}, hp: 400, attack: 100, speed: 1, icon: '🏰', special: 'fortress' },
    mining: { cost: {energy: 200, materials: 250}, hp: 100, attack: 5, speed: 1, icon: '⛏️', special: 'mining' }
  };

  // Estado del juego usando signals para reactividad
  public estadoJuego = signal<EstadoJuego>({
    resources: { energy: 1000, materials: 500, crystals: 100, population: 1000, intel: 0, influence: 0 },
    score: 0,
    turn: 1,
    systems: [],
    ships: [],
    selectedSystem: null,
    research: { propulsion: 0, weapons: 0, shields: 0, espionage: 0, terraforming: 0, quantum: 0 },
    autoPlay: false,
    enemies: [],
    heroes: [],
    missions: [],
    artifacts: [],
    spaceStations: [],
    spaceWeather: 'clear',
    weatherTimer: 0,
    achievements: [],
    trade_routes: [],
    alliances: [],
    reputation: { military: 0, economic: 0, scientific: 0 },
    anomalies: [],
    pirates: []
  });
  
  // Logs del juego
  public logs = signal<string[]>([]);

  constructor() {
    this.iniciarJuego();
  }

  iniciarJuego(): void {
    this.generarGalaxia();
    this.agregarLog("¡Bienvenido, Comandante! Tu imperio espacial comienza...");
    
    // Configurar sistema inicial del jugador
    const estado = this.estadoJuego();
    estado.systems[0].owner = 'player';
    estado.systems[0].population = 1000;
    estado.systems[0].development = 3;
    
    // Generar enemigos
    this.generarEnemigos();
    
    // Actualizar el estado
    this.estadoJuego.set(estado);
  }

  generarGalaxia(): void {
    const estado = this.estadoJuego();
    
    // Tamaño del mapa más grande para permitir mayor dispersión
    const mapWidth = 8000;
    const mapHeight = 6000;
    
    // División del mapa en cuadrantes para distribuir mejor los sistemas
    const cuadrantesH = 5; // 5 cuadrantes horizontales
    const cuadrantesV = 4; // 4 cuadrantes verticales
    const anchoCuadrante = mapWidth / cuadrantesH;
    const altoCuadrante = mapHeight / cuadrantesV;
    
    // Asegurar que el sistema del jugador esté en el centro-izquierda
    let sistemaJugador: SistemaEstelar = {
      id: 0,
      name: 'Terra Nova Prime',
      x: anchoCuadrante * 1.5,
      y: mapHeight / 2,
      owner: 'player',
      population: 1000,
      resources: 200,
      development: 3,
      defense: 100,
      type: 'blue'
    };
    
    estado.systems.push(sistemaJugador);
    
    // Lista de cuadrantes que ya contienen sistemas
    const cuadrantesOcupados: {h: number, v: number}[] = [
      // Marcar el cuadrante del sistema del jugador como ocupado
      {h: 1, v: 2}
    ];
    
    // Generar 29 sistemas estelares restantes (uno ya es del jugador)
    for (let i = 1; i < 30; i++) {
      let h = 0; // Inicializar con valores por defecto
      let v = 0;
      let sistemaValido = false;
      
      // Intentar encontrar un cuadrante no ocupado o con pocos sistemas
      while (!sistemaValido) {
        h = Math.floor(Math.random() * cuadrantesH);
        v = Math.floor(Math.random() * cuadrantesV);
        
        // Contar cuántos sistemas hay en este cuadrante
        const sistemasEnCuadrante = cuadrantesOcupados.filter(c => c.h === h && c.v === v).length;
        
        // Permitir máximo 2 sistemas por cuadrante
        if (sistemasEnCuadrante < 2) {
          sistemaValido = true;
          cuadrantesOcupados.push({h, v});
        }
      }
      
      // Calcular posición dentro del cuadrante con margen
      const margen = 200;
      const xMin = h * anchoCuadrante + margen;
      const xMax = (h + 1) * anchoCuadrante - margen;
      const yMin = v * altoCuadrante + margen;
      const yMax = (v + 1) * altoCuadrante - margen;
      
      // Posición aleatoria dentro del cuadrante con margen
      const x = Math.random() * (xMax - xMin) + xMin;
      const y = Math.random() * (yMax - yMin) + yMin;
      
      // Distribuir tipos de planetas y propietarios
      const tiposPlaneta = ['yellow', 'red', 'blue', 'white'];
      const tipoAleatorio = tiposPlaneta[Math.floor(Math.random() * tiposPlaneta.length)];
      
      // Aumentar probabilidad de planetas neutrales
      const propietarioAleatorio = Math.random() < 0.8 ? 'neutral' : 'enemy';
      
      const sistema: SistemaEstelar = {
        id: i,
        name: this.generarNombreSistema(),
        x: x,
        y: y,
        owner: propietarioAleatorio,
        population: Math.floor(Math.random() * 500) + 100,
        resources: Math.floor(Math.random() * 100) + 50,
        development: Math.floor(Math.random() * 3) + 1,
        defense: Math.floor(Math.random() * 100) + 50,
        type: tipoAleatorio
      };
      
      estado.systems.push(sistema);
    }
    
    this.estadoJuego.set(estado);
  }

  generarNombreSistema(): string {
    const prefijo = this.NOMBRES_PREFIJOS[Math.floor(Math.random() * this.NOMBRES_PREFIJOS.length)];
    const sufijo = this.NOMBRES_SUFIJOS[Math.floor(Math.random() * this.NOMBRES_SUFIJOS.length)];
    return `${prefijo} ${sufijo}`;
  }

  generarEnemigos(): void {
    const estado = this.estadoJuego();
    const nombresFacciones = ['Klingon', 'Romulan', 'Cardassian', 'Dominion', 'Borg'];
    
    for (let i = 0; i < 5; i++) {
      const sistemaEnemigos = estado.systems.filter(s => s.owner === 'enemy').slice(i * 2, (i + 1) * 2);
      
      const enemigo = {
        id: 'enemy_' + i,
        name: 'Imperio ' + nombresFacciones[i],
        ships: Math.floor(Math.random() * 10) + 5,
        aggression: Math.random(),
        systems: sistemaEnemigos
      };
      
      estado.enemies.push(enemigo);
    }
    
    this.estadoJuego.set(estado);
  }

  seleccionarSistema(sistemaId: number): void {
    const estado = this.estadoJuego();
    estado.selectedSystem = sistemaId;
    this.estadoJuego.set(estado);
  }

  construirNave(tipo: string): boolean {
    const tipoNave = this.tiposNave[tipo];
    if (!tipoNave) return false;
    
    const estado = this.estadoJuego();
    
    // Comprobar si podemos pagar la nave
    if (!this.puedeComprar(tipoNave.cost)) {
      return false;
    }
    
    // Gastar recursos
    this.gastarRecursos(tipoNave.cost);
    
    // Crear la nave
    const nuevaNave: NaveAtaque = {
      id: Date.now(),
      type: tipo,
      hp: tipoNave.hp,
      maxHp: tipoNave.hp,
      attack: tipoNave.attack,
      speed: tipoNave.speed,
      location: 0, // Sistema inicial por defecto
      moving: false,
      owner: 'player' // El jugador es dueño de las naves que construye
    };
    
    estado.ships.push(nuevaNave);
    this.estadoJuego.set(estado);
    
    this.agregarLog(`🚀 ${tipo} construido exitosamente!`);
    return true;
  }

  puedeComprar(costos: Partial<Record<string, number>>): boolean {
    const estado = this.estadoJuego();
    return Object.entries(costos).every(([recurso, cantidad]) => 
      cantidad !== undefined && estado.resources[recurso as keyof typeof estado.resources] >= cantidad
    );
  }

  gastarRecursos(costos: Partial<Record<string, number>>): void {
    const estado = this.estadoJuego();
    
    Object.entries(costos).forEach(([recurso, cantidad]) => {
      if (cantidad !== undefined) {
        const key = recurso as keyof typeof estado.resources;
        estado.resources[key] -= cantidad;
      }
    });
    
    this.estadoJuego.set(estado);
  }

  siguienteTurno(): void {
    const estado = this.estadoJuego();
    estado.turn++;
    
    // Generar recursos
    let energyIncome = 50;
    let materialsIncome = 20;
    let crystalsIncome = 5;
    
    estado.systems.filter(s => s.owner === 'player').forEach(system => {
      energyIncome += system.development * 20;
      materialsIncome += system.resources * 0.5;
      crystalsIncome += system.development * 2;
    });
    
    estado.resources.energy += energyIncome;
    estado.resources.materials += materialsIncome;
    estado.resources.crystals += crystalsIncome;
    
    // IA enemiga
    this.procesarIAEnemiga();
    
    // Eventos aleatorios
    if (Math.random() < 0.1) {
      this.dispararEventoAleatorioPositivo();
    }
    
    if (Math.random() < 0.1) {
      this.dispararEventoAleatorioNegativo();
    }
    
    this.estadoJuego.set(estado);
    this.agregarLog(`⏰ Turno ${estado.turn} - Recursos generados`);
  }

  procesarIAEnemiga(): void {
    const estado = this.estadoJuego();
    
    estado.enemies.forEach(enemy => {
      if (Math.random() < enemy.aggression * 0.3) {
        // El enemigo puede atacar un sistema del jugador
        const playerSystems = estado.systems.filter(s => s.owner === 'player');
        if (playerSystems.length > 0) {
          const target = playerSystems[Math.floor(Math.random() * playerSystems.length)];
          if (Math.random() < 0.2) { // 20% de probabilidad de ataque
            this.agregarLog(`⚠️ ¡${enemy.name} está atacando ${target.name}!`);
            this.simularBatalla(target, 'enemy');
          }
        }
      }
    });
  }

  dispararEventoAleatorioNegativo(): void {
    if(this.estadoJuego().resources.crystals > 0 && this.estadoJuego().resources.materials > 0 && this.estadoJuego().resources.energy > 0){
    const estado = this.estadoJuego();
    const eventos = [
      { msg: "🌒 Eclipse!", effect: () => estado.resources.energy -= 50 },
      { msg: "⛓️‍💥 Cristales en mal estado encontrados en el almacen!", effect: () => estado.resources.crystals -= 100 },
      { msg: "🔩 Materiales en mal estado encontrados en el almacen!", effect: () => estado.resources.materials -= 75 },
      { msg: "👥 Atentado alienigena enemigo!", effect: () => estado.resources.population -= 200 },
      { msg: "🚀 Tecnología alienígena perdida!", effect: () => estado.score -= 100 }
    ];
    
    const evento = eventos[Math.floor(Math.random() * eventos.length)];
    evento.effect();
    this.agregarLog(evento.msg);
    this.estadoJuego.set(estado);
    }
  }

  dispararEventoAleatorioPositivo(): void {
    const estado = this.estadoJuego();
    const eventos = [
      { msg: "🌟 Descubierto nuevo depósito de cristales!", effect: () => estado.resources.crystals += 50 },
      { msg: "⚡ Tormenta solar aumenta producción de energía!", effect: () => estado.resources.energy += 100 },
      { msg: "🔩 Asteroide rico en materiales detectado!", effect: () => estado.resources.materials += 75 },
      { msg: "👥 Nueva colonia se une al imperio!", effect: () => estado.resources.population += 200 },
      { msg: "🚀 Tecnología alienígena encontrada!", effect: () => estado.score += 100 }
    ];
    
    const evento = eventos[Math.floor(Math.random() * eventos.length)];
    evento.effect();
    this.agregarLog(evento.msg);
    this.estadoJuego.set(estado);
  }

  atacarSistema(): boolean {
    const estado = this.estadoJuego();
    if (estado.selectedSystem === null) return false;
    
    const sistema = estado.systems[estado.selectedSystem];
    const navesJugador = estado.ships.filter(s => s.location === estado.selectedSystem);
    
    if (navesJugador.length === 0) {
      return false;
    }
    
    this.agregarLog(`⚔️ Atacando ${sistema.name}...`);
    this.simularBatalla(sistema, 'player');
    return true;
  }

  simularBatalla(sistema: SistemaEstelar, atacante: 'player' | 'enemy'): void {
    const estado = this.estadoJuego();
    const esAtaqueJugador = atacante === 'player';
    const poderAtaque = esAtaqueJugador ? 
      estado.ships.filter(s => s.location === sistema.id).reduce((sum, ship) => sum + ship.attack, 0) :
      Math.floor(Math.random() * 100) + 50;
    
    const poderDefensa = sistema.defense + (sistema.population / 10);
    
    if (poderAtaque > poderDefensa) {
      if (esAtaqueJugador) {
        sistema.owner = 'player';
        sistema.population = Math.floor(sistema.population * 0.7);
        estado.resources.population += sistema.population;
        estado.score += 200;
        this.agregarLog(`🎉 ¡${sistema.name} conquistado!`);
      } else {
        sistema.owner = 'enemy';
        sistema.population = Math.floor(sistema.population * 0.5);
        this.agregarLog(`💀 ${sistema.name} ha caído en manos enemigas!`);
      }
    } else {
      this.agregarLog(`🛡️ Ataque a ${sistema.name} repelido!`);
      
      // Dañar naves atacantes si es el jugador
      if (esAtaqueJugador) {
        estado.ships = estado.ships.map(ship => {
          if (ship.location === sistema.id) {
            ship.hp -= Math.floor(Math.random() * 20) + 10;
            if (ship.hp <= 0) {
              this.agregarLog(`💥 ${ship.type} destruido en batalla!`);
            }
          }
          return ship;
        }).filter(ship => ship.hp > 0); // Eliminar naves destruidas
      }
    }
    
    this.estadoJuego.set(estado);
  }

  colonizarSistema(): boolean {
    const estado = this.estadoJuego();
    if (estado.selectedSystem === null) return false;
    
    const sistema = estado.systems[estado.selectedSystem];
    const navesColonia = estado.ships.filter(s => 
      s.location === estado.selectedSystem && s.type === 'colony'
    );
    
    if (navesColonia.length === 0) {
      return false;
    }
    
    // Usar la nave colonia (eliminarla)
    estado.ships = estado.ships.filter(s => s.id !== navesColonia[0].id);
    
    sistema.owner = 'player';
    sistema.population += 500;
    estado.resources.population += sistema.population;
    estado.score += 150;
    
    this.agregarLog(`🏴 ${sistema.name} colonizado exitosamente!`);
    this.estadoJuego.set(estado);
    return true;
  }

  mejorarSistema(): boolean {
    const estado = this.estadoJuego();
    if (estado.selectedSystem === null) return false;
    
    const costo = { energy: 100, materials: 50 };
    const sistema = estado.systems[estado.selectedSystem];
    
    if (sistema.owner !== 'player') {
      return false;
    }
    
    if (sistema.development >= 5) {
      return false;
    }
    
    if (!this.puedeComprar(costo)) {
      return false;
    }
    
    this.gastarRecursos(costo);
    sistema.development++;
    sistema.defense += 25;
    sistema.population += 200;
    
    this.agregarLog(`🏗️ ${sistema.name} mejorado a nivel ${sistema.development}!`);
    this.estadoJuego.set(estado);
    return true;
  }

  moverNave(naveId: number, sistemaDestinoId: number): boolean {
    const estado = this.estadoJuego();
    const nave = estado.ships.find(s => s.id === naveId);
    if (!nave) return false;
    
    if (nave.location === sistemaDestinoId) {
      return false;
    }
    
    const energiaCosto = 20;
    if (estado.resources.energy < energiaCosto) {
      return false;
    }
    
    estado.resources.energy -= energiaCosto;
    
    const sistemaDestino = estado.systems[sistemaDestinoId];
    
    nave.location = sistemaDestinoId;
    nave.moving = true;
    
    this.agregarLog(`🚀 ${nave.type} moviéndose a ${sistemaDestino.name}`);
    
    // Simular el movimiento
    setTimeout(() => {
      const estadoActualizado = this.estadoJuego();
      const naveActualizada = estadoActualizado.ships.find(s => s.id === naveId);
      if (naveActualizada) {
        naveActualizada.moving = false;
        this.agregarLog(`✅ ${naveActualizada.type} ha llegado a ${sistemaDestino.name}`);
        this.estadoJuego.set(estadoActualizado);
      }
    }, 2000);
    
    this.estadoJuego.set(estado);
    return true;
  }

  desmantelarNave(naveId: number): boolean {
    const estado = this.estadoJuego();
    const nave = estado.ships.find(s => s.id === naveId);
    if (!nave) return false;
    
    const tipoNave = this.tiposNave[nave.type];
    
    // Recuperar algunos recursos
    if (tipoNave.cost.materials) {
      estado.resources.materials += Math.floor(tipoNave.cost.materials * 0.5);
    }
    if (tipoNave.cost.energy) {
      estado.resources.energy += Math.floor(tipoNave.cost.energy * 0.3);
    }
    
    estado.ships = estado.ships.filter(s => s.id !== naveId);
    
    this.agregarLog(`♻️ ${nave.type} desmantelado por recursos`);
    this.estadoJuego.set(estado);
    return true;
  }

  investigar(tipo: string): boolean {
    const costo = 30; // Cristales
    const estado = this.estadoJuego();
    
    if (estado.resources.crystals < costo) {
      return false;
    }
    
    estado.resources.crystals -= costo;
    estado.research[tipo as keyof typeof estado.research] += 25;
    
    if (estado.research[tipo as keyof typeof estado.research] >= 100) {
      estado.research[tipo as keyof typeof estado.research] = 100;
      this.agregarLog(`🔬 ¡Investigación de ${tipo} completada!`);
    }
    
    this.estadoJuego.set(estado);
    return true;
  }

  agregarLog(mensaje: string): void {
    const logs = this.logs();
    const nuevoLog = `T${this.estadoJuego().turn}: ${mensaje}`;
    logs.push(nuevoLog);
    
    // Mantener solo los últimos 20 mensajes
    if (logs.length > 20) {
      logs.shift();
    }
    
    this.logs.set([...logs]);
  }

  getColorEstrella(tipo: string): string {
    return this.COLORES_ESTRELLAS[tipo] || this.COLORES_ESTRELLAS['yellow'];
  }

  getNombrePropietario(propietario: string): string {
    switch(propietario) {
      case 'player': return 'Tuyo';
      case 'neutral': return 'Neutral';
      case 'enemy': return 'Enemigo';
      default: return 'Desconocido';
    }
  }
}
