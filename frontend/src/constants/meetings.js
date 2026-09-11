export const MEETING_TYPES = [
  "CIRCULO DE LIDERAZGO",
  "HEALTH",
  "MENTORIA",
  "MASTERCLASS",
  "ANUNCIOS CORPORATIVOS",
  "ORDINARIA",
];

export const WEEKDAYS = [

  {
    value: 0,
    label: "Domingo",
  },
  {
    value: 1,
    label: "Lunes",
  },
  {
    value: 2,
    label: "Martes",
  },
  {
    value: 3,
    label: "Miércoles",
  },
  {
    value: 4,
    label: "Jueves",
  },
  {
    value: 5,
    label: "Viernes",
  },
  {
    value: 6,
    label: "Sábado",
  },
  
];

export const MEETING_MODES = {
  ONE_TIME: "ONE_TIME",
  RECURRING: "RECURRING",
};

export const CATEGORY_ORDER = [
  "CIRCULO DE LIDERAZGO",
  "HEALTH",
  "MENTORIA",
  "MASTERCLASS",
  "ANUNCIOS CORPORATIVOS",
  "ORDINARIA",
];

/**
 * Configuración predeterminada de Masterclass.
 *
 * Viernes
 * 19:00 = 7:00 PM
 * 20:00 = 8:00 PM
 */
export const MASTERCLASS_DEFAULTS = {
  type: "MASTERCLASS",
  title: "MASTERCLASS",
  weekday: 5,
  time: "19:00",
  endTime: "20:00",
  location: "",
  host: "",
};