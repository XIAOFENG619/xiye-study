// The source supplies the accepted answer. These editorial notes supply unambiguous
// contexts and intentional distractors for the subset used in the playable demo.
function sound(target, fullReading, wrongReading, hint, first, second, wrongForm = '') {
  return { target, fullReading, wrongReading, hint, contexts: [first, second], wrongForm };
}

export const readings = {
  吮吸: sound('吮', 'shǔn xī', 'yǔn', '用嘴吸取。', '小牛站稳脚跟，低头吮吸母乳。', '小猫闭着眼睛，轻轻吮吸奶嘴。', '允吸'),
  鞭挞: sound('挞', 'biān tà', 'dá', '原指鞭打，也指严厉地抨击。', '这篇杂文用尖锐的笔锋鞭挞奢靡之风。', '漫画家借一组夸张的形象鞭挞造假行为。', '鞭达'),
  骈文: sound('骈', 'pián wén', 'bìng', '多用成对句式、讲究对仗的一种文体。', '展柜里的那篇骈文，多处用了工整的对仗。', '老师把两组相对的句子圈出来，讲解这篇骈文的句式。', '篇文'),
  绚丽: sound('绚', 'xuàn lì', 'xún', '灿烂而美丽。', '晚霞给灰白的云层镀上了绚丽的色彩。', '剧场的灯一齐亮起，舞台呈现出绚丽的光影。'),
  修葺: sound('葺', 'xiū qì', 'róng', '修理房屋等建筑物。', '雨季来临前，工匠重新修葺了漏雨的屋顶。', '老站房完成修葺后，重新向居民开放。', '修茸'),
  灵柩: sound('柩', 'líng jiù', 'jiǔ', '装着逝者遗体的棺木。', '亲友们静立两旁，目送灵柩缓缓离开。', '仪式结束后，人们在灵柩旁放下白色的花。'),
  差别: sound('差', 'chā bié', 'chà', '事物之间的不同。', '仔细观察叶缘，就能发现两种树叶的差别。', '实验结果反映出两种材料在韧性上的差别。'),
  差事: sound('差', 'chāi shi', 'chā', '受派去做的事。', '他把送信这件差事交给了最细心的队员。', '登记样品的差事虽然琐碎，却容不得一点马虎。'),
  角落: sound('角', 'jiǎo luò', 'jué', '两面墙相接处或偏僻的地方。', '窗边的角落放着一把竹椅。', '他在书架最里面的角落找到了旧地图。'),
  角色: sound('角', 'jué sè', 'jiǎo', '演员在剧中扮演的人物。', '她在校园短剧里扮演邮递员的角色。', '为演好这个角色，他专门到车站观察售票员的动作。'),
  请帖: sound('帖', 'qǐng tiě', 'tiè', '邀请客人参加活动的帖子。', '开幕前，社团给老校友送去了一封手写的请帖。', '她把婚礼的日期工整地写在请帖上。', '请贴'),
  字帖: sound('帖', 'zì tiè', 'tiě', '供临摹、练习书法的范本。', '他摊开字帖，照着上面的笔画一笔一笔地临写。', '桌边那本字帖已经翻旧，页角还有练字时溅上的墨点。'),
  宿儒: sound('宿', 'sù rú', 'xiù', '学问深厚、素有声望的读书人。', '年轻的学者带着书稿，登门向这位宿儒请教。', '书院请来一位研究经学数十年的宿儒讲学。'),
  星宿: sound('宿', 'xīng xiù', 'sù', '古人划分星空时所说的星群。', '老师在星图上依次指出二十八个星宿的位置。', '石壁的天文图上，古人用连线标出了不同的星宿。'),
  里巷: sound('巷', 'lǐ xiàng', 'hàng', '街巷，也指民间。', '清晨的叫卖声穿过里巷，一直传到桥边。', '他沿着城南的里巷走访，记下了老人们的童谣。'),
  巷道: sound('巷', 'hàng dào', 'xiàng', '采矿等工程中供通行、运输或通风的地下通道。', '矿工进井前先检查了巷道里的通风设备。', '救援队沿矿井的巷道敷设通信线路。'),
  拘泥: sound('泥', 'jū nì', 'ní', '固执于某种方式或成规。', '设计新展台时，他没有拘泥于往年的布局。', '翻译这首短诗不能过分拘泥于原句的语序。'),
  泥土: sound('泥', 'ní tǔ', 'nì', '土壤。', '新翻的泥土散发出潮湿的气息。', '她用手拨开泥土，发现种子已经长出了细根。'),
  禁闭: sound('禁', 'jìn bì', 'jīn', '关押在特定地方，限制行动自由。', '史料记载，那名士兵曾因严重违纪受到禁闭处分。', '展板上写着，旧时这里是执行禁闭的场所。'),
  毛骨悚然: sound('悚', 'máo gǔ sǒng rán', 'sù', '形容十分恐惧。', '空楼里忽然传来一阵怪响，让他毛骨悚然。', '回忆起那场险些坠崖的经历，他至今仍毛骨悚然。'),
  振聋发聩: sound('聩', 'zhèn lóng fā kuì', 'guì', '比喻用言论唤醒糊涂麻木的人。', '面对长久的沉默，调查员提出了一个振聋发聩的问题。', '那篇揭露童工处境的报道，在当时产生了振聋发聩的力量。'),
  暴殄天物: sound('殄', 'bào tiǎn tiān wù', 'zhěn', '任意糟蹋物品。', '把一桌几乎没动过的好菜倒掉，实在是暴殄天物。', '让珍贵的古书在雨里发霉，岂不是暴殄天物？'),
  迥然不同: sound('迥', 'jiǒng rán bù tóng', 'huí', '彼此相差很远。', '同一段旋律用二胡和长笛演奏，听感迥然不同。', '两张照片拍的是同一条街，四十年前后的景象却迥然不同。'),
  参差不齐: sound('差', 'cēn cī bù qí', 'chā', '长短、高低或程度不一致。', '风吹过山坡上参差不齐的树梢。', '新队员的训练水平参差不齐，教练分组安排了练习。'),
  戛然而止: sound('戛', 'jiá rán ér zhǐ', 'gá', '形容声音突然停止。', '电源被切断的瞬间，舞台上的伴奏戛然而止。', '指挥把手一合，雄壮的乐声便戛然而止。'),
  相形见绌: sound('绌', 'xiāng xíng jiàn chù', 'zhuó', '相互比较之后显出不足。', '把两组测量数据放在一起，旧仪器的精度就相形见绌了。', '展厅里那幅巨作让旁边几幅习作显得相形见绌。'),
  鳞次栉比: sound('栉', 'lín cì zhì bǐ', 'jié', '形容房屋等密集而有次序地排列着。', '站在桥上望去，两岸的店铺鳞次栉比。', '古镇沿河的民居鳞次栉比，屋檐连成一条曲线。'),
  量体裁衣: sound('量', 'liàng tǐ cái yī', 'liáng', '比喻根据具体情况办事。', '给每位队员制定训练计划，教练的做法可以说是量体裁衣。', '为山村设计供水方案要量体裁衣，先弄清当地的地势。'),
  忍俊不禁: sound('禁', 'rěn jùn bù jīn', 'jìn', '忍不住笑。', '听完孩子一本正经的解释，爷爷忍俊不禁。', '小狗对着自己的倒影摇尾巴，路过的人都忍俊不禁。'),
  渐入佳境: sound('渐', 'jiàn rù jiā jìng', 'jiān', '逐渐进入良好的境地。', '换了更合手的球拍之后，她在第二局渐入佳境。', '最初几笔有些生涩，画到远山时他已渐入佳境。'),
};

function form(fullReading, hint, first, second) {
  return { fullReading, hint, contexts: [first, second] };
}

export const spellings = {
  完璧归赵: form('wán bì guī zhào', '把原物完好地归还本人。', '古籍修复完成，馆员终于能把这部旧书完璧归赵。', '外借的玉器展览结束后，博物馆按期将它完璧归赵。'),
  川流不息: form('chuān liú bù xī', '像河水一样连续不断，多形容行人、车辆。', '新桥通车后，桥面上的车辆川流不息。', '《清明上河图》里，城门前的商贩和行人川流不息。'),
  墨守成规: form('mò shǒu chéng guī', '固执地沿用旧的规矩和办法。', '试验条件已经改变，我们不能墨守成规。', '面对新材料，这位工匠肯动脑筋，从不墨守成规。'),
  出类拔萃: form('chū lèi bá cuì', '在同类中明显超出众人。', '在同龄的选手中，她的节奏感尤为出类拔萃。', '这批实习生都很勤奋，小周的观察力尤其出类拔萃。'),
  披星戴月: form('pī xīng dài yuè', '形容早出晚归或连夜赶路。', '为了赶在汛期前完工，测量队连日披星戴月。', '那些年他披星戴月，把信件一封封送进山里。'),
  破釜沉舟: form('pò fǔ chén zhōu', '比喻下定决心，拼尽全力。', '最后一局，他们拿出破釜沉舟的勇气放手一搏。', '他在日记里写下破釜沉舟四字，决心把最难的实验做完。'),
  言简意赅: form('yán jiǎn yì gāi', '话虽简短，意思却完备。', '她用两句话概括了方案，言简意赅。', '门口的参观说明言简意赅，游客一眼就能看懂。'),
  不计其数: form('bù jì qí shù', '数量极多，无法计算。', '滩涂上栖息的候鸟不计其数。', '修这部词典时，编者翻过的资料不计其数。'),
  再接再厉: form('zài jiē zài lì', '继续努力，毫不松懈。', '拿到第一组数据后，全队再接再厉，完成了第二次试验。', '预赛夺得第一名后，教练鼓励她再接再厉。'),
  不胫而走: form('bù jìng ér zǒu', '形容消息迅速传播。', '展览即将免费开放的消息不胫而走。', '旧书店要重新开张的喜讯在街坊间不胫而走。'),
  含辛茹苦: form('hán xīn rú kǔ', '经受艰辛困苦。', '这部传记记录了母亲含辛茹苦把孩子养大的岁月。', '几十年来，他们含辛茹苦，把荒地一点点变成果园。'),
  滥竽充数: form('làn yú chōng shù', '用无真才实学的人或次品凑数。', '合唱排练要求人人开口练习，谁也不能滥竽充数。', '抽检时发现，几个不合格的零件混在其中滥竽充数。'),
};

const checkedAlternatives = {
  完璧归赵: '完壁归赵', 川流不息: '穿流不息', 墨守成规: '墨守陈规', 出类拔萃: '出类拔粹',
  披星戴月: '披星带月', 破釜沉舟: '破斧沉舟', 言简意赅: '言简意该', 不计其数: '不记其数',
  再接再厉: '再接再励', 不胫而走: '不径而走', 含辛茹苦: '含辛如苦', 滥竽充数: '滥芋充数',
};

const passages = [
  { words: ['修葺', '角落', '骈文', '迥然不同'], text: '修葺后的校史馆今天开放。我在展柜的角落发现一张泛黄的手稿，上面是一篇写街市的骈文。望向窗外，同一条街如今的景象已与文中描绘的迥然不同。' },
  { words: ['请帖', '字帖', '角色', '渐入佳境'], text: '接到戏剧社送来的请帖，林宁带着一本字帖参加排演。他这回扮演教书先生的角色，刚登台还有些拘谨，写完第一行字便渐入佳境。' },
];

function shuffle(items) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function material(record, section) {
  const word = record.title;
  if (record.status !== 'candidate') return null;
  let note, target, pinyin, distractor;
  if (record.section === 'sound') {
    note = readings[word];
    if (!note || (section === 'spelling' && word.length !== 2)) return null;
    target = note.target;
    const sourceReading = note.fullReading.split(' ')[word.indexOf(target)];
    if (record.terms[1] !== target || record.terms[2] !== sourceReading) return null;
    pinyin = section === 'sound' ? sourceReading : note.fullReading;
    distractor = section === 'sound' ? note.wrongReading : note.wrongForm;
  } else if (section === 'spelling' && record.section === 'spelling') {
    note = spellings[word];
    if (!note || record.terms[1] !== checkedAlternatives[word]) return null;
    target = record.terms[2];
    pinyin = note.fullReading;
    distractor = record.terms[1];
  } else return null;
  return { word, target, pinyin, shownWord: word, shownPinyin: section === 'sound' ? pinyin : '',
    key: [section, word, target].join(':'), sourceId: record.id, locator: record.locator,
    hint: note.hint, contexts: [...note.contexts], distractor };
}

function groupRows(words) {
  const shorts = shuffle([...words.values()].filter(item => item.word.length === 2));
  const longs = shuffle([...words.values()].filter(item => item.word.length === 4));
  if (shorts.length < 12 || longs.length < 4) {
    throw new Error('当前资料中可核对的词例不足，每题需要十二个短词和四个四字词。');
  }
  return longs.slice(0, 4).map((long, i) => [...shorts.slice(i * 3, i * 3 + 3), long]);
}

export function buildChineseQuestion(records, section, { kind = 'group' } = {}) {
  if (!['sound', 'spelling'].includes(section)) throw new Error('请选择字音或字形专项。');
  if (kind !== 'group' && !(kind === 'passage' && section === 'sound')) throw new Error('此专项不支持该题式。');
  const words = new Map();
  for (const record of records) {
    const item = material(record, section);
    if (item && !words.has(item.word)) words.set(item.word, item);
  }
  let originals, passage;
  if (kind === 'passage') {
    const available = passages.filter(p => p.words.every(word => words.has(word)));
    if (!available.length) throw new Error('当前资料没有凑齐短文所需的四个已核词例。');
    const template = shuffle(available)[0];
    passage = template.text;
    originals = Array.from({ length: 4 }, () => template.words.map(word => words.get(word)));
  } else originals = groupRows(words);

  const correctIndex = Math.floor(Math.random() * 4);
  // In a passage each reading appears twice, so counting repeated options cannot reveal the answer.
  const positions = shuffle([0, 1, 2, 3]);
  const passageErrors = shuffle([positions.slice(0, 2), positions.slice(2), positions]);
  const rows = originals.map((row, index) => {
    const possibleErrors = row.map((item, i) => item.distractor ? i : -1).filter(i => i !== -1);
    let changed = [];
    if (index !== correctIndex) changed = kind === 'passage' ? passageErrors.pop() : [shuffle(possibleErrors)[0]];
    return row.map(({ distractor, ...item }, i) => {
      if (changed.includes(i)) {
        if (section === 'sound') item.shownPinyin = distractor;
        else item.shownWord = distractor;
      }
      return item;
    });
  });
  const prompt = kind === 'passage' ? '阅读短文。下列对文中四个词的加点字注音全部正确的一项是'
    : section === 'sound' ? '下列各组词语中，加点字的读音完全正确的一项是'
      : '下列各组词语中，没有错别字的一项是';
  return { id: crypto.randomUUID(), section, kind, prompt, ...(passage ? { passage } : {}), rows, correctIndex };
}
