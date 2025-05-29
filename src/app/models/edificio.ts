export interface Edificio {
  id: number;
  tipo: 'mina' | 'fabrica' | 'laboratorio' | 'astillero' | 'defensa';
  nivel: number;
  sistemaId: number;
  produccion?: {
    energy?: number;
    materials?: number;
    crystals?: number;
    research?: number;
  };
  defensa?: number;
  icono: string;
}

export interface CostoEdificio {
  energy: number;
  materials: number;
  crystals?: number;
}

export const TIPOS_EDIFICIOS: Record<string, {
  nombre: string,
  descripcion: string,
  icono: string,
  costoBase: CostoEdificio,
  produccion: Edificio['produccion'],
  defensa?: number,
  requiereNivel?: number
}> = {
  mina: {
    nombre: 'Mina',
    descripcion: 'Extrae materiales del planeta',
    icono: '⛏️',
    costoBase: { energy: 50, materials: 20 },
    produccion: { materials: 10 },
    requiereNivel: 1
  },
  fabrica: {
    nombre: 'Fábrica',
    descripcion: 'Genera energía y acelera la construcción',
    icono: '🏭',
    costoBase: { energy: 100, materials: 50 },
    produccion: { energy: 15 },
    requiereNivel: 1
  },
  laboratorio: {
    nombre: 'Laboratorio',
    descripcion: 'Incrementa puntos de investigación',
    icono: '🔬',
    costoBase: { energy: 150, materials: 75, crystals: 20 },
    produccion: { research: 5 },
    requiereNivel: 2
  },
  astillero: {
    nombre: 'Astillero',
    descripcion: 'Permite construir naves espaciales',
    icono: '🚀',
    costoBase: { energy: 200, materials: 100, crystals: 30 },
    produccion: {},
    requiereNivel: 2
  },
  defensa: {
    nombre: 'Sistema de Defensa',
    descripcion: 'Mejora la defensa del planeta contra ataques',
    icono: '🛡️',
    costoBase: { energy: 150, materials: 100, crystals: 25 },
    produccion: {},
    defensa: 50,
    requiereNivel: 2
  }
};

// Calcula el costo de un edificio según su nivel
export function calcularCostoEdificio(tipo: string, nivel: number = 1): CostoEdificio {
  const edificioInfo = TIPOS_EDIFICIOS[tipo];
  if (!edificioInfo) return { energy: 0, materials: 0 };

  const factorNivel = Math.pow(1.5, nivel - 1);
  return {
    energy: Math.floor(edificioInfo.costoBase.energy * factorNivel),
    materials: Math.floor(edificioInfo.costoBase.materials * factorNivel),
    crystals: edificioInfo.costoBase.crystals 
      ? Math.floor(edificioInfo.costoBase.crystals * factorNivel) 
      : undefined
  };
}

// Calcula la producción de un edificio según su nivel
export function calcularProduccionEdificio(tipo: string, nivel: number = 1): Edificio['produccion'] {
  const edificioInfo = TIPOS_EDIFICIOS[tipo];
  if (!edificioInfo || !edificioInfo.produccion) return {};

  const factorNivel = Math.pow(1.3, nivel - 1);
  const produccion: Edificio['produccion'] = {};

  if (edificioInfo.produccion.energy) {
    produccion.energy = Math.floor(edificioInfo.produccion.energy * factorNivel);
  }
  if (edificioInfo.produccion.materials) {
    produccion.materials = Math.floor(edificioInfo.produccion.materials * factorNivel);
  }
  if (edificioInfo.produccion.crystals) {
    produccion.crystals = Math.floor(edificioInfo.produccion.crystals * factorNivel);
  }
  if (edificioInfo.produccion.research) {
    produccion.research = Math.floor(edificioInfo.produccion.research * factorNivel);
  }

  return produccion;
}
