import { Injectable, signal } from '@angular/core';
import { EstadoJuego } from '../models/estado-juego';
import { SistemaEstelar } from '../models/sistema-estelar';
import { NaveAtaque } from '../models/nave-ataque';
import { TipoNave } from '../models/tipo-nave';
import { Edificio, TIPOS_EDIFICIOS, calcularCostoEdificio, calcularProduccionEdificio } from '../models/edificio';

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
    scout: { cost: {energy: 50, materials: 20}, hp: 30, attack: 10, speed: 3, icon: '', special: 'exploration' },
    fighter: { cost: {energy: 100, materials: 50}, hp: 60, attack: 25, speed: 2, icon: '', special: 'combat' },
    cruiser: { cost: {energy: 200, materials: 100}, hp: 120, attack: 50, speed: 1, icon: '', special: 'heavy' },
    colony: { cost: {energy: 300, materials: 200, crystals: 50}, hp: 80, attack: 5, speed: 1, icon: '', special: 'colonize' },
    carrier: { cost: {energy: 400, materials: 300, crystals: 100}, hp: 200, attack: 30, speed: 1, icon: '', special: 'support' },
    stealth: { cost: {energy: 250, materials: 150, intel: 50}, hp: 40, attack: 35, speed: 3, icon: '', special: 'stealth' },
    titan: { cost: {energy: 800, materials: 600, crystals: 200}, hp: 400, attack: 100, speed: 1, icon: '', special: 'fortress' },
    mining: { cost: {energy: 200, materials: 250}, hp: 100, attack: 5, speed: 1, icon: '', special: 'mining' }
  };

  // Estado del juego usando signals para reactividad
  public estadoJuego = signal<EstadoJuego>({
    resources: { energy: 1000, materials: 500, crystals: 100, population: 1000, intel: 0, influence: 0 },
    score: 0,
    turn: 1,
    systems: [],
    ships: [],
    selectedSystem: null,
    buildings: [], // Lista de todos los edificios construidos
    buildQueue: [], // Cola de construcción
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
      type: 'blue',
      edificios: [],
      slotsTotales: 8,
      tieneAstillero: false
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

  construirNave(tipoNave: string): boolean {
    const estado = this.estadoJuego();
    
    // Verificar si el tipo es válido
    if (!this.tiposNave[tipoNave]) {
      return false;
    }
    
    // Verificar si hay sistema seleccionado
    if (estado.selectedSystem === null) {
      return false;
    }
    
    const sistemaSeleccionado = estado.systems[estado.selectedSystem];
    
    // Temporalmente hacemos el astillero opcional hasta implementar la interfaz de edificios
    /*
    // Verificar que el sistema tenga un astillero
    if (!sistemaSeleccionado.tieneAstillero) {
      this.agregarLog(`❌ No puedes construir naves en ${sistemaSeleccionado.name} sin un astillero`);
      return false;
    }
    */
    
    // Verificar costos
    const costoNave = this.tiposNave[tipoNave].cost;
    if (!this.puedeComprar(costoNave)) {
      return false;
    }
    
    // Gastar recursos
    this.gastarRecursos(costoNave);
    
    // Crear la nave
    const nuevaNave: NaveAtaque = {
      id: Date.now(),
      type: tipoNave,
      hp: this.tiposNave[tipoNave].hp,
      attack: this.tiposNave[tipoNave].attack,
      owner: 'player',
      x: sistemaSeleccionado.x,
      y: sistemaSeleccionado.y,
      speed: this.tiposNave[tipoNave].speed,
      moving: false,
      size: 2 // Tamaño predeterminado
    };
    
    estado.ships.push(nuevaNave);
    
    this.agregarLog(`🚀 Nave ${tipoNave} construida en ${sistemaSeleccionado.name}`);
    this.estadoJuego.set(estado);
    return true;
  }

  puedeComprar(costos: Partial<Record<string, number>> | { energy: number, materials: number, crystals?: number }): boolean {
    const estado = this.estadoJuego();
    return Object.entries(costos).every(([recurso, cantidad]) => 
      cantidad !== undefined && estado.resources[recurso as keyof typeof estado.resources] >= cantidad
    );
  }

  gastarRecursos(costos: Partial<Record<string, number>> | { energy: number, materials: number, crystals?: number }): void {
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
    estado.turn += 1;
    
    // Generar recursos de sistemas controlados
    let energiaGenerada = 0;
    let materialesGenerados = 0;
    let cristalesGenerados = 0;
    let poblacionGenerada = 0;
    let investigacionGenerada = 0;
    
    estado.systems.forEach(sistema => {
      if (sistema.owner === 'player') {
        // Recursos base por sistema
        const baseEnergia = 5 + (sistema.development * 2);
        const baseMateriales = 3 + sistema.development;
        const baseCristales = sistema.resources > 100 ? 1 : 0;
        const basePoblacion = Math.floor(sistema.population * 0.02); // Crecimiento del 2%
        
        energiaGenerada += baseEnergia;
        materialesGenerados += baseMateriales;
        cristalesGenerados += baseCristales;
        poblacionGenerada += basePoblacion;
        
        // Actualizar población del sistema
        sistema.population += basePoblacion;
        
        // Recursos adicionales de edificios
        if (sistema.edificios && sistema.edificios.length > 0) {
          sistema.edificios.forEach(edificioId => {
            const edificio = estado.buildings.find(b => b.id === edificioId);
            if (edificio && edificio.produccion) {
              if (edificio.produccion.energy) energiaGenerada += edificio.produccion.energy;
              if (edificio.produccion.materials) materialesGenerados += edificio.produccion.materials;
              if (edificio.produccion.crystals) cristalesGenerados += edificio.produccion.crystals;
              if (edificio.produccion.research) investigacionGenerada += edificio.produccion.research;
            }
          });
        }
      }
    });
    
    // Actualizar recursos
    estado.resources.energy += energiaGenerada;
    estado.resources.materials += materialesGenerados;
    estado.resources.crystals += cristalesGenerados;
    estado.resources.population += poblacionGenerada;
    estado.resources.intel += investigacionGenerada;
    
    // Procesar cola de construcción
    this.procesarColaConstruccion();
    
    // Verificar eventos aleatorios
    if (Math.random() < 0.1) { // 10% de probabilidad de evento negativo
      this.dispararEventoAleatorioNegativo();
    }
    
    if (Math.random() < 0.07) { // 7% de probabilidad de evento positivo
      this.dispararEventoAleatorioPositivo();
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
  
  // Métodos para la IA enemiga
  
  // Devuelve el tamaño del mapa para cálculos de IA
  getMapSize(): { width: number, height: number } {
    return { width: 8000, height: 6000 }; // Mismo tamaño definido en generarGalaxia
  }
  
  // Obtiene todas las naves del jugador para la IA enemiga
  getNavesJugador(): NaveAtaque[] {
    return this.estadoJuego().ships.filter(nave => nave.owner === 'player');
  }
  
  // Crear un conflicto/batalla entre naves
  crearConflicto(conflicto: {
    atacantes: { id: string, tipo: string, hp: number }[],
    defensores: { id: string, tipo: string, hp: number }[],
    posX: number,
    posY: number
  }): void {
    // Emitir evento de conflicto para que el componente de galaxia lo maneje
    console.log('Conflicto creado:', conflicto);
    // Aquí se podría usar un EventEmitter o un servicio de eventos para notificar
    // Por ahora, solo registramos en el log
    this.agregarLog(`⚡ Conflicto detectado: ${conflicto.atacantes.length} atacante(s) contra ${conflicto.defensores.length} defensor(es)`);
  }
  
  // Dañar una nave del jugador
  dañarNave(naveId: string, daño: number): void {
    const estado = this.estadoJuego();
    const nave = estado.ships.find(n => n.id.toString() === naveId);
    
    if (nave) {
      nave.hp = Math.max(0, nave.hp - daño);
      
      // Si la nave es destruida
      if (nave.hp <= 0) {
        this.agregarLog(`💥 Nave ${nave.type} (ID: ${nave.id}) ha sido destruida en combate`);
        estado.ships = estado.ships.filter(n => n.id !== nave.id);
      } else {
        this.agregarLog(`🔥 Nave ${nave.type} (ID: ${nave.id}) ha recibido ${daño} puntos de daño`);
      }
      
      this.estadoJuego.set(estado);
    }
  }
  
  // Métodos para la gestión de edificios
  
  construirEdificio(tipoEdificio: string): boolean {
    const estado = this.estadoJuego();
    
    // Verificar si hay un sistema seleccionado
    if (estado.selectedSystem === null) {
      return false;
    }
    
    const sistema = estado.systems[estado.selectedSystem];
    
    // Verificar si el sistema es del jugador
    if (sistema.owner !== 'player') {
      this.agregarLog(`❌ No puedes construir en un sistema que no te pertenece`);
      return false;
    }
    
    // Verificar si hay slots disponibles
    if (!sistema.edificios) sistema.edificios = [];
    if (!sistema.slotsTotales) sistema.slotsTotales = sistema.development * 2 + 2;
    
    if (sistema.edificios.length >= sistema.slotsTotales) {
      this.agregarLog(`❌ No hay slots disponibles en ${sistema.name}. Mejora el desarrollo para obtener más slots.`);
      return false;
    }
    
    // Verificar si el tipo de edificio existe
    if (!TIPOS_EDIFICIOS[tipoEdificio]) {
      return false;
    }
    
    // Verificar si el sistema cumple los requisitos para el edificio
    const edificioInfo = TIPOS_EDIFICIOS[tipoEdificio];
    if (edificioInfo.requiereNivel && sistema.development < edificioInfo.requiereNivel) {
      this.agregarLog(`❌ ${sistema.name} necesita nivel de desarrollo ${edificioInfo.requiereNivel} para construir ${edificioInfo.nombre}`);
      return false;
    }
    
    // Calcular costo basado en el nivel de desarrollo
    const costo = calcularCostoEdificio(tipoEdificio);
    
    // Verificar si hay recursos suficientes
    if (!this.puedeComprar(costo)) {
      this.agregarLog(`❌ Recursos insuficientes para construir ${edificioInfo.nombre}`);
      return false;
    }
    
    // Gastar recursos
    this.gastarRecursos(costo);
    
    // Crear el edificio
    const nuevoEdificio: Edificio = {
      id: Date.now(),
      tipo: tipoEdificio as any,
      nivel: 1,
      sistemaId: sistema.id,
      produccion: calcularProduccionEdificio(tipoEdificio),
      defensa: edificioInfo.defensa,
      icono: edificioInfo.icono
    };
    
    // Añadir a la lista de edificios
    estado.buildings.push(nuevoEdificio);
    sistema.edificios.push(nuevoEdificio.id);
    
    // Si es un astillero, actualizar la propiedad del sistema
    if (tipoEdificio === 'astillero') {
      sistema.tieneAstillero = true;
    }
    
    // Si es una defensa, actualizar la defensa del sistema
    if (tipoEdificio === 'defensa') {
      sistema.defense += nuevoEdificio.defensa || 0;
    }
    
    this.agregarLog(`🏗️ ${edificioInfo.nombre} en construcción en ${sistema.name}`);
    
    // Añadir a la cola de construcción (3 turnos para completarse)
    estado.buildQueue.push({
      id: nuevoEdificio.id,
      tipo: 'edificio',
      turnosRestantes: 3,
      sistemaId: sistema.id,
      nombre: edificioInfo.nombre
    });
    
    this.estadoJuego.set(estado);
    return true;
  }
  
  mejorarEdificio(edificioId: number): boolean {
    const estado = this.estadoJuego();
    const edificio = estado.buildings.find(e => e.id === edificioId);
    
    if (!edificio) {
      return false;
    }
    
    const sistema = estado.systems.find(s => s.id === edificio.sistemaId);
    if (!sistema || sistema.owner !== 'player') {
      return false;
    }
    
    // Máximo nivel 3
    if (edificio.nivel >= 3) {
      this.agregarLog(`❌ ${TIPOS_EDIFICIOS[edificio.tipo].nombre} ya está al nivel máximo`);
      return false;
    }
    
    // Calcular costo de mejora (150% del costo base)
    const costoMejora = calcularCostoEdificio(edificio.tipo, edificio.nivel + 1);
    
    // Verificar recursos
    if (!this.puedeComprar(costoMejora)) {
      this.agregarLog(`❌ Recursos insuficientes para mejorar ${TIPOS_EDIFICIOS[edificio.tipo].nombre}`);
      return false;
    }
    
    // Gastar recursos
    this.gastarRecursos(costoMejora);
    
    // Añadir a la cola de construcción (2 turnos para completarse)
    estado.buildQueue.push({
      id: edificio.id,
      tipo: 'mejora',
      turnosRestantes: 2,
      sistemaId: sistema.id,
      nombre: TIPOS_EDIFICIOS[edificio.tipo].nombre
    });
    
    this.agregarLog(`🔧 Mejorando ${TIPOS_EDIFICIOS[edificio.tipo].nombre} en ${sistema.name} a nivel ${edificio.nivel + 1}`);
    
    this.estadoJuego.set(estado);
    return true;
  }
  
  demolerEdificio(edificioId: number): boolean {
    const estado = this.estadoJuego();
    const edificio = estado.buildings.find(e => e.id === edificioId);
    
    if (!edificio) {
      return false;
    }
    
    const sistema = estado.systems.find(s => s.id === edificio.sistemaId);
    if (!sistema || sistema.owner !== 'player') {
      return false;
    }
    
    // Eliminar el edificio
    estado.buildings = estado.buildings.filter(e => e.id !== edificioId);
    sistema.edificios = sistema.edificios?.filter(id => id !== edificioId) || [];
    
    // Si era un astillero, actualizar la propiedad del sistema
    if (edificio.tipo === 'astillero') {
      // Verificar si aún queda algún astillero
      const aúnTieneAstillero = sistema.edificios?.some(id => {
        const edif = estado.buildings.find(e => e.id === id);
        return edif?.tipo === 'astillero';
      });
      
      sistema.tieneAstillero = aúnTieneAstillero || false;
    }
    
    // Si era una defensa, actualizar la defensa del sistema
    if (edificio.tipo === 'defensa') {
      sistema.defense -= edificio.defensa || 0;
    }
    
    this.agregarLog(`🧨 ${TIPOS_EDIFICIOS[edificio.tipo].nombre} demolido en ${sistema.name}`);
    
    this.estadoJuego.set(estado);
    return true;
  }
  
  procesarColaConstruccion(): void {
    const estado = this.estadoJuego();
    
    // Procesar cada item en la cola
    const nuevaCola = [];
    
    for (const item of estado.buildQueue) {
      item.turnosRestantes--;
      
      if (item.turnosRestantes <= 0) {
        // Construcción completada
        if (item.tipo === 'edificio') {
          const edificio = estado.buildings.find(e => e.id === item.id);
          const sistema = estado.systems.find(s => s.id === item.sistemaId);
          
          if (edificio && sistema) {
            this.agregarLog(`✅ ${item.nombre} completado en ${sistema.name}`);
          }
        } 
        else if (item.tipo === 'mejora') {
          const edificio = estado.buildings.find(e => e.id === item.id);
          const sistema = estado.systems.find(s => s.id === item.sistemaId);
          
          if (edificio && sistema) {
            edificio.nivel++;
            edificio.produccion = calcularProduccionEdificio(edificio.tipo, edificio.nivel);
            
            // Si es una defensa, actualizar la defensa del sistema
            if (edificio.tipo === 'defensa') {
              // Calcular nuevo valor de defensa
              const defensaAnterior = edificio.defensa || 0;
              const tipoInfo = TIPOS_EDIFICIOS[edificio.tipo];
              edificio.defensa = tipoInfo && tipoInfo.defensa ? 
                tipoInfo.defensa * Math.pow(1.5, edificio.nivel - 1) : 0;
              
              // Actualizar defensa del sistema
              sistema.defense = sistema.defense - defensaAnterior + (edificio.defensa || 0);
            }
            
            this.agregarLog(`✅ ${item.nombre} mejorado a nivel ${edificio.nivel} en ${sistema.name}`);
          }
        }
      } else {
        // Aún no completado, mantener en la cola
        nuevaCola.push(item);
      }
    }
    
    estado.buildQueue = nuevaCola;
    this.estadoJuego.set(estado);
  }
  
  getEdificiosSistema(sistemaId: number): Edificio[] {
    const estado = this.estadoJuego();
    const sistema = estado.systems.find(s => s.id === sistemaId);
    
    if (!sistema || !sistema.edificios) {
      return [];
    }
    
    return sistema.edificios
      .map(id => estado.buildings.find(e => e.id === id))
      .filter(e => e !== undefined) as Edificio[];
  }
}
