// Each scene looks for consecutive clauses in one reviewed textbook passage.
// Only the first two scenes may use the learner's earlier trial as a sample.
const scenes = [
  ['将进酒', '父亲翻到自己的毕业照，摸了摸如今花白的鬓角，轻声说：“拍这张照片，好像还是昨天的事。”请用两句诗给这一页相册配文。', ['君不见高堂明镜悲白发，朝如青丝暮成雪'], true],
  ['将进酒', '比赛失利后，朋友把剩下的积蓄拿出来，准备再试一次。他相信自己总有用武之地，也看得开眼前的得失。哪两句诗适合写在他新计划的扉页上？', ['天生我材必有用，千金散尽还复来'], true],
  ['沁园春·长沙', '展厅想用一幅画表现水天之间的生机。画家抬头画长空，又低头画浅水中的游鱼。请从词中选出与这两个镜头相应的两句。', ['鹰击长空，鱼翔浅底']],
  ['伐檀', '同学排演诗中的劳动场面，开场要用伐木声引观众走到河岸。请写出第一章里与这个开场对应的两句。', ['坎坎伐檀兮，寘之河之干兮', '坎坎伐檀兮，置之河之干兮']],
  ['无衣', '出征前，有人担心身边的士卒缺衣。战友朗声作答，要同他分享战袍。请写出第一章中这一问一答。', ['岂曰无衣，与子同袍']],
  ['念奴娇·赤壁怀古', '纪录片的镜头掠过高耸的岩壁，转向江水冲击的岸边，最后定格在白色的浪花上。请用词中连写这三幅画面的句子配音。', ['乱石穿空，惊涛拍岸，卷起千堆雪', '乱石崩云，惊涛裂岸，卷起千堆雪', '乱石崩云，惊涛掠岸，卷起千堆雪']],
  ['永遇乐·京口北固亭怀古', '登临北固亭，眼前的江山还在，昔日以江东为基业的英雄却已难寻。请写出词中由江山追想孙权的开篇数句。', ['千古江山，英雄无觅，孙仲谋处']],
  ['声声慢', '短片的最后一个镜头对着庭院里的梧桐。天色渐暗，收音里始终留着细雨落下的声音。请用词中写这一幕的句子配音。', ['梧桐更兼细雨，到黄昏，点点滴滴']],
  ['归园田居', '乡村相册里，一张拍远处的村落，一张拍屋顶上轻轻升起的炊烟。请从课文中找出适合给这两张照片配文的诗句。', ['暧暧远人村，依依墟里烟']],
  ['登高', '秋江长卷需要两行题字，先写大片树叶在秋风中纷纷飘落，再写江水奔来的声势。你会从诗中选哪两句？', ['无边落木萧萧下，不尽长江滚滚来']],
  ['七律二首《送瘟神》其一', '展板回顾昔日疫病肆虐的乡村，要用诗中一副对仗写出村落荒芜、人烟稀少的景象。请写出对应的两句。', ['千村薜荔人遗矢，万户萧疏鬼唱歌']],
  ['七律二首《送瘟神》其二', '展览画上，人们在绵延的山岭间一齐挥锄，仿佛连脚下的大地也在震动。请从第二首中选出能给这幅劳动场面配文的两句。', ['天连五岭银锄落，地动三河铁臂摇']],
  ['劝学', '同桌觉得每天多走一小步没有意义。你想借荀子的话鼓励他，从一步步走远说到细小的水流。请默写这组推论，写全开头表示承接的字。', ['故不积跬步，无以至千里；不积小流，无以成江海']],
  ['师说', '学徒在一门手艺上超过了师傅，师傅也乐于向他请教。请用韩愈对弟子与老师才学高下的判断，给这次交流写一句按语。写全这句推论的开头。', ['是故弟子不必不如师，师不必贤于弟子']],
];

const separator = '[\\s，。；、！？：,.!?;:]';
function verifiedPassage(sources, versions) {
  const matches = new Map();
  const patterns = versions.map(version => {
    const letters = version.match(/\p{Script=Han}/gu);
    // The two boundaries prevent a matching substring of a longer clause from scoring.
    const whole = new RegExp(`(?:^|(?<=${separator}))${letters.join(`${separator}*`)}(?=$|${separator})`, 'gu');
    // A further passage with similar ends can veto a grade, never supply its answer.
    const similar = new RegExp(`${letters.slice(0, 3).join('')}\\p{Script=Han}{0,${letters.length + 8}}${letters.slice(-3).join('')}`, 'u');
    return { version, whole, similar };
  });
  for (const source of sources) {
    for (const paragraph of source.text.split(/\r?\n[^\S\n]*\n/u)) {
      let remainder = paragraph;
      for (const { version, whole } of patterns) {
        remainder = remainder.replace(whole, expected => {
          if (!matches.has(version)) matches.set(version, { expected, sourceId: source.id, locator: source.locator });
          return '◇';
        });
      }
      const otherText = remainder.replace(/[^\p{Script=Han}◇]/gu, '');
      if (patterns.some(({ similar }) => similar.test(otherText))) return null;
    }
  }
  return matches.size === 1 ? matches.values().next().value : null;
}

function available(records, title) {
  const sources = records.filter(r => r.section === 'poetry' && r.title === title && r.status === 'text');
  return scenes.filter(scene => scene[0] === title).flatMap(([, prompt, versions, sample]) => {
    if (!sources.length) return sample ? [{ title, prompt, expected: versions[0], locator: '此前试做的情境样题', referenceOnly: true }] : [];
    const passage = verifiedPassage(sources, versions);
    return passage ? [{ title, prompt, ...passage, referenceOnly: false }] : [];
  });
}

export function poemCatalog(records) {
  const titles = [...new Set(records.filter(r => r.section === 'poetry' && ['title', 'text'].includes(r.status)).map(r => r.title))];
  return titles.map(title => {
    const choices = available(records, title);
    const hasText = records.some(r => r.section === 'poetry' && r.title === title && r.status === 'text');
    return { title, hasText, status: choices.length ? (hasText ? 'ready' : 'sample') : 'pending' };
  });
}

export function poemList(records) {
  const poems = [];
  const titles = new Set();
  for (const record of records) {
    if (record.section !== 'poetry' || record.status !== 'text') continue;
    const { title, text, locator } = record;
    // Keep different editions or source pages individually selectable.
    const id = titles.has(title) ? record.id : title;
    poems.push({ id, title, text, locator, sourceId: record.id });
    titles.add(title);
  }
  return poems;
}

export function buildPoem(records, title, previousPrompt = '') {
  if (!records.some(r => r.section === 'poetry' && r.title === title && ['title', 'text'].includes(r.status))) return null;
  const choices = available(records, title);
  const next = choices.find(q => q.prompt !== previousPrompt) || choices[0];
  return next ? { ...next, section: 'poetry', kind: 'poetry', id: crypto.randomUUID() } : null;
}
