// Recursos visuales tomados de los planes de Keila (static/plan). Sin fotos de pacientes.
export const PLAN_BASE = '/plan';

export const FOOD_PHOTOS = [
  { key: 'huevo-espinacas', label: 'Huevo con espinacas en pan', tags: 'huevo desayuno espinaca pan tostado' },
  { key: 'huevo-revuelto', label: 'Huevo revuelto', tags: 'huevo desayuno a la mexicana' },
  { key: 'huevos-rancheros', label: 'Huevos rancheros / tostadas con huevo', tags: 'huevo estrellado salsa tostada' },
  { key: 'huevo-aguacate', label: 'Pan con aguacate y huevo', tags: 'huevo aguacate pan toast' },
  { key: 'omelette-frijoles', label: 'Omelette con frijoles y aguacate', tags: 'huevo omelette frijol aguacate' },
  { key: 'pan-aguacate', label: 'Pan con aguacate', tags: 'aguacate pan tostada' },
  { key: 'pan-cottage', label: 'Pan tostado con cottage y nuez', tags: 'pan queso cottage nuez fresa cena' },
  { key: 'pan-jitomate', label: 'Pan tostado con jitomate y queso', tags: 'pan jitomate queso tostada' },
  { key: 'pan-arugula', label: 'Tostada con arúgula', tags: 'pan hummus arugula requesón' },
  { key: 'tostada-jitomate', label: 'Tostada de jitomate', tags: 'tostada jitomate queso' },
  { key: 'hotcakes-avena', label: 'Hot cakes de avena', tags: 'hotcakes avena platano desayuno' },
  { key: 'hotcakes-frutos', label: 'Hot cakes con frutos rojos', tags: 'hotcakes fresas moras yogurt' },
  { key: 'avena-manzana', label: 'Avena cocida con manzana', tags: 'avena manzana canela cena' },
  { key: 'frutos-rojos', label: 'Bowl de frutos rojos', tags: 'fruta fresa mora yogurt snack' },
  { key: 'rajas-pollo', label: 'Rajas poblanas con pollo', tags: 'pollo rajas poblano elote' },
  { key: 'ensalada-pollo', label: 'Ensalada de pollo', tags: 'pollo ensalada verduras' },
  { key: 'ensalada-pollo-2', label: 'Ensalada de pollo con fruta', tags: 'pollo ensalada nuez fruta' },
  { key: 'pollo-verduras', label: 'Pollo con verduras y aguacate', tags: 'pollo pasta verduras aguacate' },
  { key: 'caldo-pollo', label: 'Caldo de pollo con verduras', tags: 'caldo sopa pollo verduras' },
  { key: 'tinga-guacamole', label: 'Tinga / picadillo con guacamole', tags: 'tinga picadillo carne guacamole' },
  { key: 'guisado-carne', label: 'Guisado de carne con chile', tags: 'carne res chile guisado nopal' },
  { key: 'tacos-carne', label: 'Tacos de carne asada', tags: 'tacos carne res tortilla' },
  { key: 'bistec-arroz', label: 'Bistec con arroz y verduras', tags: 'bistec carne arroz verduras' },
  { key: 'pimientos-rellenos', label: 'Pimientos rellenos', tags: 'pimiento relleno carne queso' },
  { key: 'tacos-pescado', label: 'Tacos de pescado', tags: 'pescado tacos tilapia' },
  { key: 'atun-verduras', label: 'Atún con zanahoria y pepino', tags: 'atun pescado verduras ensalada' },
  { key: 'bowl-atun', label: 'Bowl de atún / pollo', tags: 'atun pollo bowl arroz' },
];
export const foodPhoto = (key) => (key ? `${PLAN_BASE}/food/${key}.jpg` : null);

export const SUPPLEMENTS = [
  { key: 'kefir', name: 'Kéfir (shot)', img: 'kefir.png', dose: '1 shot en ayunas' },
  { key: 'kefir-coco', name: 'Kéfir de leche / coco', img: 'kefir-coco.jpg', dose: '1 vaso en ayunas' },
  { key: 'probioticos', name: 'Probióticos', img: 'probioticos.jpg', dose: '1 tableta en ayunas' },
  { key: 'vitamina-d', name: 'Vitamina D3', img: 'vitamina-d.jpg', dose: '1 tableta después del desayuno' },
  { key: 'omega3', name: 'Omega 3', img: 'omega3.png', dose: '1 cápsula después del desayuno' },
  { key: 'v-omega3', name: 'V-Omega 3', img: 'v-omega3.png', dose: '1 cápsula después del desayuno' },
  { key: 'v-collagen', name: 'Vitalage Collagen', img: 'v-collagen.png', dose: '1 scoop en 200 ml de agua' },
  { key: 'v-control', name: 'V-Control', img: 'v-control.png', dose: '1 cápsula después del desayuno' },
  { key: 'v-daily', name: 'V-Daily', img: 'v-daily.png', dose: '1 scoop antes de entrenar' },
  { key: 'v-te-detox', name: 'V-Té Detox', img: 'v-te-detox.png', dose: 'Diluir en 250 ml de agua' },
  { key: 'v-lattekafe', name: 'LatteKafe', img: 'v-lattekafe.png', dose: 'Diluir en 200 ml' },
  { key: 'v-performance', name: 'V-Performance', img: 'v-performance.png', dose: '1 scoop antes de entrenar' },
  { key: 'kombucha', name: 'Kombucha artesanal', img: 'kombucha.jpg', dose: 'Acompañar una comida' },
];
export const SUPP_MAP = Object.fromEntries(SUPPLEMENTS.map((s) => [s.key, s]));
export const suppImg = (key) => (SUPP_MAP[key] ? `${PLAN_BASE}/supp/${SUPP_MAP[key].img}` : null);

export const TIP_IMAGES = [
  { key: 'kefir', label: 'Kéfir', src: `${PLAN_BASE}/supp/kefir.png` },
  { key: 'agua-jamaica', label: 'Agua de jamaica', src: `${PLAN_BASE}/deco/agua-jamaica.png` },
  { key: 'agua-pepino', label: 'Agua de pepino', src: `${PLAN_BASE}/deco/agua-pepino.png` },
  { key: 'cafe', label: 'Café', src: `${PLAN_BASE}/deco/cafe.png` },
  { key: 'v-te-detox', label: 'Té detox', src: `${PLAN_BASE}/supp/v-te-detox.png` },
  { key: 'kombucha', label: 'Kombucha', src: `${PLAN_BASE}/supp/kombucha.jpg` },
];
export const tipImg = (key) => TIP_IMAGES.find((t) => t.key === key)?.src || null;

// Páginas fijas del diseño de Keila
export const STATIC_PAGES = {
  portada: `${PLAN_BASE}/pages/portada.jpg`,
  requisitos: `${PLAN_BASE}/pages/requisitos.jpg`,
  instrucciones: `${PLAN_BASE}/pages/instrucciones.jpg`,
  marcas1: `${PLAN_BASE}/pages/marcas-1.jpg`,
  marcas2: `${PLAN_BASE}/pages/marcas-2.jpg`,
  necesitas: `${PLAN_BASE}/pages/lo-que-necesitas.jpg`,
  guiaVisual: `${PLAN_BASE}/pages/guia-visual.jpg`,
  rutinaIndicaciones: `${PLAN_BASE}/pages/rutina-indicaciones.jpg`,
  rutinaConceptos1: `${PLAN_BASE}/pages/rutina-conceptos-1.jpg`,
  rutinaConceptos2: `${PLAN_BASE}/pages/rutina-conceptos-2.jpg`,
};

export const MEAL_SLOTS = ['ALMUERZO', 'SNACK OPCIONAL', 'COMIDA', 'SNACK MEDIA TARDE', 'CENA'];
export const MAIN_SLOTS = ['ALMUERZO', 'COMIDA', 'CENA'];
export const WEEK_DAYS = ['LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES'];
export const BLOCK_KINDS = ['EJERCICIO SENCILLO', 'BI SERIE', 'TRI SERIE', 'CIRCUITO'];
