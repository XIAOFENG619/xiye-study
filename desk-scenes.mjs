// Coordinates refer to the visible 9:10 frame, from its top-left corner.
// Turn on guides here while adjusting a painting, then refresh the desk.
export const DEBUG_HOTSPOTS = false;

export const SCENES = [
  {
    id: 'default', image: './assets/river-print.jpg', description: '松崖映着朱日，小舟穿过青绿江峡',
    verse: ['山静似太古', '日长如小年'], seal: '闲读',
    inscription: { left: '49%', top: '5%', width: '16%', height: '26%' },
    hotspots: { sun: { left: '76%', top: '1.5%', width: '12%', height: '11%' } },
  },
  {
    id: 'poetry', image: './assets/desk-poetry.jpg', description: '春山晓日，桃花低垂江岸',
    verse: ['桃花流水', '静候诗来'], seal: '吟春',
    inscription: { left: '56%', top: '7%', width: '17%', height: '31%' },
    hotspots: {
      sun: { left: '78.4%', top: '9.4%', width: '13%', height: '11%' },
      blossoms: { left: '2%', top: '40%', width: '38%', height: '36%' },
    },
  },
  {
    id: 'pronunciation', image: './assets/desk-pronunciation.jpg', description: '翠竹临溪，远山藏在薄雾里',
    verse: ['风过竹梢', '清音自辨'], seal: '听竹',
    inscription: { left: '75%', top: '6%', width: '17%', height: '31%' },
    hotspots: {
      water: { left: '58%', top: '80%', width: '32%', height: '10%' },
      sky: { left: '47%', top: '7%', width: '26%', height: '21%' },
    },
  },
  {
    id: 'character', image: './assets/desk-character.jpg', description: '古松掩着岸边小亭，远岫如黛',
    verse: ['横平竖直', '结构天成'], seal: '观形',
    inscription: { left: '75%', top: '7%', width: '17%', height: '31%' },
    hotspots: {
      water: { left: '59%', top: '79%', width: '37%', height: '17%' },
      sky: { left: '46%', top: '8%', width: '25%', height: '21%' },
    },
  },
];
