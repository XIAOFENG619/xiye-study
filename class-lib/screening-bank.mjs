import { readings, spellings } from './chinese-bank.mjs';

// Keep the four reviewed alternatives in a fixed order so returning to a word
// also restores the positions of the learner's first pick and its correction.
const soundChoices = {
  吮吸: 'yǔn shǔn sǔn shùn',
  鞭挞: 'dá tā tà tǎ',
  骈文: 'pián piān biàn biān',
  绚丽: 'xuán xún xùn xuàn',
  毛骨悚然: 'sǒng sōng sù sòng',
  振聋发聩: 'guì kuì kuī guī',
  暴殄天物: 'zhěn tiān tiǎn diǎn',
  不屑一顾: 'xiē xuè xiě xiè',
  修葺: 'qì qī jí róng',
  灵柩: 'jiǔ jiū jiù gōu',
  街头巷隅: 'ǒu yù yǔ yú',
  迥然不同: 'huí jiǒng jiōng jiòng',
  差别: 'chāi cī chā chà',
  差事: 'chāi chā chà cī',
  参差不齐: 'chā chāi chà cī',
  角落: 'jué jiǎo jiào juě',
  角色: 'jué jiǎo jiào juě',
  请帖: 'tiè tiē tiě dié',
  字帖: 'tiē tiè tiě dié',
  宿儒: 'xiù xiǔ sū sù',
  星宿: 'sù xiǔ xiù xiū',
  戛然而止: 'jiá gá jiǎ jiā',
  转弯抹角: 'mā mǒ mò mó',
  根深蒂固: 'tì dì tí dī',
  相形见绌: 'zhuó chū chuò chù',
  鳞次栉比: 'zhì jié zhī zì',
  量体裁衣: 'liáng liǎng liàng niàng',
  里巷: 'hàng xiàng xiāng hāng',
  巷道: 'hàng hāng xiàng xiāng',
  忍俊不禁: 'jìng jìn jīn jīng',
  禁闭: 'jīn jīng jìng jìn',
  泥土: 'nì ní nǐ nī',
  拘泥: 'ní nǐ nì nī',
  渐入佳境: 'jiàn jiān jiǎn qián',
};

// Use unambiguous distractors in the printed expression. For example, leave
// out 带 in 披星戴月 to avoid grading a spelling used in another edition.
const spellingChoices = {
  英雄辈出: '倍辈背焙', 民生凋敝: '蔽闭敝憋', 脉搏微弱: '搏膊博薄',
  赤膊上阵: '博搏薄膊', 扬长而去: '常长尝偿', 墨守成规: '城诚成承',
  川流不息: '穿传串川', 出类拔萃: '萃粹翠悴', 鞠躬尽瘁: '萃悴瘁粹',
  披星戴月: '代戴贷袋', 以逸待劳: '代贷带待', 中流砥柱: '砥抵邸诋',
  完璧归赵: '壁碧璧避', 破釜沉舟: '斧釜俯辅', 入不敷出: '付肤孵敷',
  言简意赅: '赅该骇垓', 英雄气概: '慨溉概盖', 性格粗犷: '旷犷矿广',
  貌合神离: '和合河禾', 随声附和: '合荷和贺', 精神涣散: '焕唤换涣',
  病入膏肓: '肓盲荒慌', 言谈诙谐: '恢灰诙挥', 风雨如晦: '海晦悔诲',
  不计其数: '记纪技计', 龙盘虎踞: '踞距倨剧', 绝对服从: '决诀绝觉',
  功亏一篑: '匮篑馈溃', 味同嚼蜡: '腊辣蜡猎', 陈词滥调: '烂澜缆滥',
  无耻谰言: '谰滥澜阑', 变本加厉: '利励厉历', 再接再厉: '励历利厉',
  厉行节约: '励厉利历', 一枕黄粱: '粱梁粮凉', 书写潦草: '了嘹缭潦',
  浏览一遍: '流留浏琉', 语无伦次: '仑伦论轮', 不胫而走: '胫径劲茎',
  漠不关心: '莫默寞漠', 碑帖临摹: '摩摹模磨', 蓬荜生辉: '篷逢蓬鹏',
  纰漏百出: '纰批披毗', 感情融洽: '恰掐袷洽', 尚待商榷: '确榷阙雀',
  却之不恭: '缺怯却阙', 矫揉造作: '揉柔糅蹂', 耳濡目染: '儒孺濡嚅',
  含辛茹苦: '如茹儒孺', 列出提纲: '题堤啼提', 枉费心机: '枉妄往旺',
  从中斡旋: '乾翰斡握', 瑕瑜互见: '暇瑕霞遐', 声闻遐迩: '瑕暇霞遐',
  寒暄客套: '暄喧宣渲', 徇私舞弊: '循殉徇询', 偃旗息鼓: '揠偃堰掩',
  苦心孤诣: '旨指谐诣', 滥竽充数: '竽芋盂宇',
};

function note(fullReading, first, second) {
  return { fullReading, contexts: [first, second] };
}

// The source record is the authority for the tested character and answer.
// These sentences only supply a different situation for each recall attempt.
const additionalNotes = {
  不屑一顾: note('bù xiè yī gù', '他一心要修好这台旧钟，对高价收购的提议不屑一顾。', '面对投机取巧的办法，她总是不屑一顾。'),
  街头巷隅: note('jiē tóu xiàng yú', '摄影师走遍小城的街头巷隅，拍下各色老招牌。', '节庆的鼓声传遍街头巷隅，连最深的小巷也能听到。'),
  转弯抹角: note('zhuǎn wān mò jiǎo', '你有不同意见尽管直说，用不着转弯抹角。', '他不再转弯抹角，直接说出了此行的目的。'),
  根深蒂固: note('gēn shēn dì gù', '改变这种根深蒂固的偏见，需要长时间的交流。', '老匠人对质量的坚持早已根深蒂固。'),
  英雄辈出: note('yīng xióng bèi chū', '这部纪录片讲述了那个英雄辈出的年代。', '翻开这座城市的抗洪史，那是一段英雄辈出的岁月。'),
  民生凋敝: note('mín shēng diāo bì', '地方志记下了战乱之后民生凋敝的情形。', '连年旱灾使村田荒芜，民生凋敝。'),
  脉搏微弱: note('mài bó wēi ruò', '急救员摸到伤者脉搏微弱，立刻呼叫支援。', '护士在交班记录上写下“脉搏微弱”，提醒同事继续观察。'),
  赤膊上阵: note('chì bó shàng zhèn', '戏台上的武将脱下战袍，赤膊上阵。', '鼓声一响，演义中的许褚赤膊上阵，与马超交锋。'),
  扬长而去: note('yáng cháng ér qù', '他丢下一句气话便扬长而去。', '对方把茶杯往桌上一放，头也不回地扬长而去。'),
  鞠躬尽瘁: note('jū gōng jìn cuì', '这位医生为乡亲们鞠躬尽瘁，在山村行医五十年。', '碑文记下了他为重修水渠鞠躬尽瘁的一生。'),
  以逸待劳: note('yǐ yì dài láo', '对手连夜赶来，守方养足精神，以逸待劳。', '教练让主力保留体能，以逸待劳，准备迎接最后一节。'),
  中流砥柱: note('zhōng liú dǐ zhù', '最艰难的抢险时刻，老队员成了救援队的中流砥柱。', '这几位经验丰富的技师一直是车间的中流砥柱。'),
  入不敷出: note('rù bù fū chū', '连着几个月客人稀少，小店已入不敷出。', '会计列出收支明细，发现这个月又是入不敷出。'),
  英雄气概: note('yīng xióng qì gài', '壁画用寥寥几笔画出了将士临危不惧的英雄气概。', '面对洪峰，他们挺身而出，展现了英雄气概。'),
  性格粗犷: note('xìng gé cū guǎng', '作者借一场酣畅的赛马，写出了主人公性格粗犷的一面。', '这位渔民性格粗犷，说起漂流的经历总是声如洪钟。'),
  貌合神离: note('mào hé shén lí', '两人台上握着手，私下却各有盘算，早已貌合神离。', '这对搭档表面上十分客气，实际却貌合神离。'),
  随声附和: note('suí shēng fù hè', '讨论会上，她先核对数据，从不随声附和。', '即使大家都赞成，他也会自己想一想，很少随声附和。'),
  精神涣散: note('jīng shén huàn sàn', '连续熬夜使他精神涣散，读了两遍仍记不住。', '休息片刻后，队员们一扫刚才精神涣散的样子。'),
  病入膏肓: note('bìng rù gāo huāng', '故事里的国君一再拒绝医治，终于病入膏肓。', '这出戏的结尾，病入膏肓的老人把家书交给了孙女。'),
  言谈诙谐: note('yán tán huī xié', '那位解说员言谈诙谐，把枯燥的数字讲得很有趣。', '祖父言谈诙谐，一桌人常被他的妙语逗笑。'),
  风雨如晦: note('fēng yǔ rú huì', '清晨忽然风雨如晦，街边的路灯又亮了起来。', '海面上风雨如晦，小船只能循着灯塔辨认方向。'),
  龙盘虎踞: note('lóng pán hǔ jù', '登高俯瞰，群山环抱古城，颇有龙盘虎踞之势。', '游记用龙盘虎踞四字形容金陵雄伟的地势。'),
  绝对服从: note('jué duì fú cóng', '救援开始前，全队约定行动时必须绝对服从现场指挥。', '在演习中，各小组绝对服从统一调度。'),
  功亏一篑: note('gōng kuī yī kuì', '最后一道工序没做好，前面的努力便会功亏一篑。', '为防测量工作功亏一篑，他在收工前又校验了一遍仪器。'),
  味同嚼蜡: note('wèi tóng jiáo là', '满篇空话的稿子读起来味同嚼蜡。', '他惦记着走失的小狗，再好的饭菜也吃得味同嚼蜡。'),
  陈词滥调: note('chén cí làn diào', '她删掉致辞里的陈词滥调，改讲亲身经历。', '这份采访的好处在于保留了原话，避开了陈词滥调。'),
  无耻谰言: note('wú chǐ lán yán', '证人带来了原始书信，当面驳斥了那些无耻谰言。', '面对捏造事实的无耻谰言，他拿出了完整的调查记录。'),
  变本加厉: note('biàn běn jiā lì', '被人劝阻后，他的恶作剧反而变本加厉。', '他们起初只是乱收费，后来竟变本加厉地扣留货物。'),
  厉行节约: note('lì xíng jié yuē', '食堂从按需备菜做起，厉行节约。', '施工队厉行节约，把可用的旧木料一一回收。'),
  一枕黄粱: note('yī zhěn huáng liáng', '黄粱饭还没熟，他梦中的富贵便化作一枕黄粱。', '他醒来后望着客栈的土墙，才明白方才的荣华不过是一枕黄粱。'),
  书写潦草: note('shū xiě liáo cǎo', '这页便笺书写潦草，收信人辨认了好一会儿。', '因为赶时间，他在末页书写潦草，几个字几乎连成一片。'),
  浏览一遍: note('liú lǎn yī biàn', '请先把目录浏览一遍，再决定细读哪一章。', '出发前，她把行程表浏览一遍，确认了集合地点。'),
  语无伦次: note('yǔ wú lún cì', '他一紧张就语无伦次，半天没讲清事情的经过。', '听到获奖的消息，她激动得语无伦次。'),
  漠不关心: note('mò bù guān xīn', '他对名次漠不关心，却很在意自己哪一步算错。', '邻居有困难，大家都伸出援手，没有一个人漠不关心。'),
  碑帖临摹: note('bēi tiè lín mó', '本周的碑帖临摹课从观察运笔开始。', '老师把碑帖临摹作业贴在墙上，逐幅点评笔画的起落。'),
  蓬荜生辉: note('péng bì shēng huī', '收到老师题赠的墨宝，他回信道：“挂在家里，真是蓬荜生辉。”', '主人迎客时笑着说：“您能光临寒舍，真使蓬荜生辉。”'),
  纰漏百出: note('pī lòu bǎi chū', '缺少核验的统计表纰漏百出，连总数都加错了。', '演出前仓促更换的流程纰漏百出，只好重新核对。'),
  感情融洽: note('gǎn qíng róng qià', '姐妹俩感情融洽，遇事总会坐下来商量。', '队员们在长期合作中感情融洽，配合也越来越默契。'),
  尚待商榷: note('shàng dài shāng què', '两块石碑的年代能否据此确定，仍有几点尚待商榷。', '这份方案思路清楚，但取样时间是否合适尚待商榷。'),
  却之不恭: note('què zhī bù gōng', '乡亲们再三相邀，他觉得却之不恭，便留下吃饭。', '老友亲手刻了一方印送给他，他觉得再推辞下去倒是却之不恭了。'),
  矫揉造作: note('jiǎo róu zào zuò', '这段朗读自然流畅，丝毫没有矫揉造作的腔调。', '导演请演员卸下矫揉造作的姿态，像平常说话那样再演一遍。'),
  耳濡目染: note('ěr rú mù rǎn', '他自幼在木工作坊长大，耳濡目染，也学会了辨木纹。', '在戏班里耳濡目染多年，她连冷门曲牌都哼得出来。'),
  列出提纲: note('liè chū tí gāng', '动笔之前，他先按时间顺序列出提纲。', '老师让大家根据采访录音列出提纲，再整理成稿。'),
  枉费心机: note('wǎng fèi xīn jī', '想靠篡改日期蒙混过关，终究只是枉费心机。', '原始档案都在，伪造者掩饰的办法越多，越是枉费心机。'),
  从中斡旋: note('cóng zhōng wò xuán', '双方陷入僵局后，一位老船长主动从中斡旋。', '两队对于场地使用各执一词，校方请教练从中斡旋。'),
  瑕瑜互见: note('xiá yú hù jiàn', '这幅习作瑕瑜互见，构图很有新意，色彩却显得杂乱。', '评委认为他的演奏瑕瑜互见，音色动人，但节奏还不够稳。'),
  声闻遐迩: note('shēng wén xiá ěr', '这位制琴师凭借精湛的手艺声闻遐迩。', '当地的木版年画早已声闻遐迩，引来各地访客。'),
  寒暄客套: note('hán xuān kè tào', '两人落座后省去了寒暄客套，直接翻开图纸。', '事情紧急，他们顾不上寒暄客套，立刻赶往码头。'),
  徇私舞弊: note('xùn sī wǔ bì', '考务人员须回避亲属，防止徇私舞弊。', '调查组查实他在录取时徇私舞弊，暗中调换了名单。'),
  偃旗息鼓: note('yǎn qí xī gǔ', '演义中，守将命城头偃旗息鼓，使敌军不敢贸然前进。', '连番碰壁之后，那群四处兜售假药的人终于偃旗息鼓。'),
  苦心孤诣: note('kǔ xīn gū yì', '她苦心孤诣地钻研古琴指法，终于解开了残谱里的难题。', '几代匠人在这门技艺上苦心孤诣，才做出了能眨眼的木偶。'),
};

export function buildScreeningItems(records, section) {
  const sound = section === 'sound';
  if (!sound && section !== 'spelling') throw new Error('请选择字音或字形筛查。');
  const choiceTable = sound ? soundChoices : spellingChoices;
  const seen = new Set();
  const items = [];
  for (const record of records) {
    if (record.section !== section || record.status !== 'candidate') continue;
    const word = record.title;
    if (!Object.hasOwn(choiceTable, word)) continue;
    const choicesText = choiceTable[word];
    const editorial = (sound ? readings : spellings)[word] ?? additionalNotes[word];
    const target = record.terms[sound ? 1 : 2];
    const targetReading = editorial.fullReading.split(' ')[word.indexOf(target)];
    const choices = sound ? choicesText.split(' ') : [...choicesText];
    if (!targetReading || (sound && targetReading !== record.terms[2]) ||
        !choices.includes(sound ? targetReading : target)) continue;
    const key = [section, word, target].join(':');
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({ key, section, word, target, targetReading, fullReading: editorial.fullReading,
      pinyin: sound ? targetReading : editorial.fullReading, choices, contexts: [...editorial.contexts],
      sourceId: record.id, locator: record.locator });
  }
  return items;
}
