import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

const generatedOn = '2026-06-04'
const contentFile = join('content', 'soups', 'initial-100.json')
const migrationFile = join('supabase', 'migrations', '0005_content_taxonomy.sql')
const originalSourceId = 'xuantang-original-2026-06'

const categoryDefinitions = [
  {
    id: 'red',
    name: '红汤',
    description: '死亡、犯罪、严重伤害或沉重真相驱动的暗黑题。',
    tone: 'red',
    sortOrder: 10,
    target: 30,
  },
  {
    id: 'black',
    name: '黑汤',
    description: '恐怖、异常、心理压迫、疑似超自然但可推理的题。',
    tone: 'violet',
    sortOrder: 20,
    target: 25,
  },
  {
    id: 'funny',
    name: '王八汤',
    description: '整蛊、荒诞、搞怪、反套路和轻度恶趣味题。',
    tone: 'green',
    sortOrder: 30,
    target: 15,
  },
  {
    id: 'weird',
    name: '变格汤',
    description: '文字游戏、规则反转、元叙事和题面陷阱题。',
    tone: 'gold',
    sortOrder: 40,
    target: 10,
  },
  {
    id: 'emotion',
    name: '情感汤',
    description: '亲情、爱情、友情和遗憾型反转题。',
    tone: 'amber',
    sortOrder: 50,
    target: 10,
  },
  {
    id: 'clear',
    name: '清汤',
    description: '无死亡、无恐怖，靠日常误会和逻辑反转推进的题。',
    tone: 'cyan',
    sortOrder: 60,
    target: 10,
  },
]

const source = {
  id: originalSourceId,
  title: '玄汤原创首批题库',
  author: '玄汤项目',
  sourceUrl: null,
  license: 'Project original content',
  licenseUrl: null,
  allowedUse: 'owned',
  checkedAt: generatedOn,
  notes: '根据分类计划原创生成，未复制无明确授权的网络题目原文。',
}

const existingCases = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    slug: 'red-raincoat',
    title: '红雨衣',
    prompt: '雨一直下着，男孩穿着红雨衣站在门口，再也没有回来。',
    solution: '男孩其实躲在衣柜里，红雨衣被另一个人穿走，用来制造“他已经离开”的假象。暴雨冲掉了门口的脚印，家人因此错过了真正离开者的线索。',
    categoryId: 'red',
    tags: ['红汤', '身份误导', '雨夜'],
    difficulty: '普通',
    durationMinutes: 15,
    minPlayers: 1,
    maxPlayers: 6,
    rating: 4.8,
    accent: 'red',
    contentRating: '18+暗黑',
    targetClueCount: 6,
    answerKeywords: ['男孩', '红雨衣', '衣柜', '伪装', '暴雨', '脚印', '家人'],
    rules: [
      rule(['男孩', '孩子', '小孩', '衣柜'], '是', '人物', '男孩主动躲了起来，家人看到的身影未必是他。'),
      rule(['红雨衣', '雨衣', '衣服'], '是', '物品', '红雨衣遮住了体型和身份，是误认的关键。'),
      rule(['雨', '暴雨', '脚印', '晚上', '时间'], '部分正确', '时间线', '暴雨让门口痕迹很快消失，时间判断被干扰。'),
      rule(['家人', '父母', '误会'], '部分正确', '动机', '家人的判断来自他们看到的“红雨衣身影”。'),
      rule(['死', '死亡', '杀', '伤害'], '否'),
      rule(['逃', '离开', '出门', '门口'], '是', '时间线', '真正离开门口的人借暴雨完成了替换。'),
    ],
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    slug: 'empty-mirror',
    title: '空镜子',
    prompt: '她每天对着镜子化妆，直到有天镜子里只剩房间。',
    solution: '那面“镜子”其实是双向镜。她以为自己每天独处，另一侧的人却一直在观察；那天她被带走后，镜面只映出空房间。',
    categoryId: 'black',
    tags: ['黑汤', '监视', '心理压迫'],
    difficulty: '困难',
    durationMinutes: 20,
    minPlayers: 2,
    maxPlayers: 8,
    rating: 4.7,
    accent: 'violet',
    contentRating: '18+暗黑',
    targetClueCount: 5,
    answerKeywords: ['镜子', '双向镜', '观察', '房间', '带走', '化妆'],
    rules: [
      rule(['镜子', '玻璃', '反光'], '部分正确', '物品', '那面“镜子”的作用不只是反射。'),
      rule(['她', '女人', '化妆'], '是', '人物', '她一直相信自己只是独处。'),
      rule(['房间', '空房间', '消失'], '是', '时间线', '房间变空发生在她被带离之后。'),
      rule(['偷窥', '观察', '监视', '双向'], '是', '动机', '镜子另一侧有人长期观察她。'),
      rule(['鬼', '灵异'], '否'),
    ],
  },
  {
    id: '33333333-3333-4333-8333-333333333333',
    slug: 'white-elevator',
    title: '白色电梯',
    prompt: '电梯停在不存在的楼层，所有人都说她迟到了。',
    solution: '所谓不存在的楼层是医院隔离层。她因事故昏迷，错过了约定；醒来后所有人只说她“迟到”，却没人愿意直接说出病房真相。',
    categoryId: 'black',
    tags: ['黑汤', '医院', '时间错位'],
    difficulty: '普通',
    durationMinutes: 15,
    minPlayers: 1,
    maxPlayers: 5,
    rating: 4.6,
    accent: 'violet',
    contentRating: '18+暗黑',
    targetClueCount: 5,
    answerKeywords: ['电梯', '楼层', '医院', '隔离', '昏迷', '迟到'],
    rules: [
      rule(['电梯', '楼层', '按钮'], '是', '物品', '电梯能到达普通访客看不到的楼层。'),
      rule(['她', '迟到', '约定'], '部分正确', '人物', '她不是主观迟到，而是失去了一段时间。'),
      rule(['医院', '病房', '昏迷', '事故'], '是', '时间线', '缺失的时间发生在一次医疗处置后。'),
      rule(['鬼', '灵异', '死亡'], '否'),
    ],
  },
  {
    id: '44444444-4444-4444-8444-444444444444',
    slug: 'no-coffee',
    title: '没有咖啡',
    prompt: '老板说咖啡售罄后，整条街的人都安静了下来。',
    solution: '“咖啡”不是饮品，而是这条街地下广播的暗号。老板说“没有咖啡”代表行动取消，所以收到暗号的人同时沉默下来。',
    categoryId: 'funny',
    tags: ['王八汤', '暗号', '荒诞'],
    difficulty: '新手',
    durationMinutes: 15,
    minPlayers: 1,
    maxPlayers: 4,
    rating: 4.6,
    accent: 'green',
    contentRating: '16+荒诞',
    targetClueCount: 4,
    answerKeywords: ['咖啡', '暗号', '老板', '街', '沉默', '取消'],
    rules: [
      rule(['咖啡', '饮品', '售罄'], '部分正确', '物品', '咖啡这个词在故事里有第二层含义。'),
      rule(['老板', '店员'], '是', '人物', '老板知道这句话会被特定的人听懂。'),
      rule(['街', '安静', '沉默', '人群'], '是', '动机', '整条街的沉默来自同一个信号。'),
      rule(['暗号', '行动', '取消', '广播'], '是', '时间线', '“没有咖啡”是行动取消的暗号。'),
    ],
  },
  {
    id: '55555555-5555-4555-8555-555555555555',
    slug: 'vanished-dinner',
    title: '消失的晚餐',
    prompt: '一家人围坐在餐桌前，却没有人记得是谁做了晚餐。',
    solution: '晚餐是失踪的母亲提前做好的。家人被改写了当天记忆，只记得围坐吃饭，却忘了做饭的人已经不在餐桌旁。',
    categoryId: 'emotion',
    tags: ['情感汤', '家庭', '记忆'],
    difficulty: '困难',
    durationMinutes: 20,
    minPlayers: 3,
    maxPlayers: 8,
    rating: 4.5,
    accent: 'amber',
    contentRating: '18+暗黑',
    targetClueCount: 5,
    answerKeywords: ['晚餐', '母亲', '提前', '记忆', '家人', '餐桌'],
    rules: [
      rule(['晚餐', '饭菜', '做饭'], '是', '物品', '晚餐真实存在，而且是在众人入座前完成的。'),
      rule(['家人', '一家人', '餐桌'], '部分正确', '人物', '围坐的人并不完整，有一个关键位置被忽略了。'),
      rule(['记得', '忘记', '记忆'], '是', '动机', '他们缺失的不是饭菜，而是关于做饭者的记忆。'),
      rule(['母亲', '妈妈', '失踪'], '是', '时间线', '做饭的人在开饭前已经离开或失踪。'),
    ],
  },
]

const pools = {
  red: {
    titleWords: ['最后一班车', '无声报警', '空白遗嘱', '迟到的花束', '锁住的伞', '地下车位', '反方向的门牌', '冷掉的茶', '雨棚下的影子', '借来的外套', '第五张票', '深夜取件', '重复的签名', '停电十二秒', '旧钥匙', '无人认领', '黑色礼盒', '消失的回执', '倒放的铃声', '错位座位', '窄巷红灯', '未寄出的信', '玻璃上的手印', '晚到的救护车', '同名病历', '断线电话', '过期门禁', '倒数十分钟', '被擦掉的鞋印'],
    people: ['夜班司机', '独居画师', '仓库管理员', '剧场检票员', '便利店店长', '出租屋房东', '急诊护士', '旧楼保安', '摄影师', '保险调查员'],
    places: ['地下车库', '老式公寓', '空剧场', '雨夜巷口', '停业商场', '值班室', '快递站', '医院走廊', '城郊车站', '影棚'],
    objects: ['雨伞', '门禁卡', '录音笔', '保温杯', '手套', '钥匙扣', '旧手机', '收据', '围巾', '礼盒'],
    signals: ['定时短信', '倒放录音', '自动门记录', '错位监控', '伪造签名', '延迟报警', '影子反光', '借名登记'],
    motives: ['隐瞒真正到场时间', '替另一个人制造不在场证明', '把意外伪装成自行离开', '保护真正的目击者', '转移赔偿责任'],
  },
  black: {
    titleWords: ['墙里的电台', '凌晨三点的门铃', '不会眨眼的人', '多出来的床位', '黑屏合照', '空病房', '楼梯间的歌', '镜后房间', '停在门口的雨', '无人的直播间', '第七个脚步声', '反复醒来的梦', '旧玩具柜', '窗外的白伞', '关不掉的灯', '地下二层', '没有回声的房间', '永远在线', '陌生的家人', '蓝色值班灯', '锁屏照片', '空椅子', '过曝人像'],
    people: ['失眠的主播', '值夜护士', '档案室新人', '独居老人', '心理咨询师', '巡楼保安', '修表匠', '实习记者', '清洁员', '电台主持'],
    places: ['直播间', '疗养院', '档案室', '地下通道', '旧宿舍', '咨询室', '值班楼层', '无人展厅', '录音棚', '封闭电梯'],
    objects: ['旧收音机', '白色窗帘', '备用钥匙', '监控屏', '录音带', '值班灯', '合照', '病历夹', '玩具熊', '电子门锁'],
    signals: ['循环播放的声音', '提前录好的问候', '被替换的照片', '延迟上传的直播', '自动感应灯', '镜面后的观察孔', '重复的脚步声'],
    motives: ['长期监视带来的错觉', '为了测试他的恐惧反应', '有人冒充亲近者', '房间结构被刻意改造', '记忆被暗示扭曲'],
  },
  funny: {
    titleWords: ['严肃的香蕉', '不许喝水', '会迟到的钟', '三只左鞋', '老板的暗号', '沉默的外卖', '不能说谢谢', '倒着排队', '红灯不准停', '万能钥匙', '假装失忆', '过敏的机器人', '最后一颗糖', '禁止眨眼'],
    people: ['社恐店员', '过分认真的主持人', '恶作剧社长', '新人保安', '魔术助理', '外卖骑手', '婚礼司仪', '实习客服'],
    places: ['密室店', '办公室茶水间', '婚礼现场', '社区活动室', '快餐店', '电梯口', '桌游吧', '影城入口'],
    objects: ['香蕉', '水杯', '工牌', '玩具章鱼', '空盒子', '左鞋', '假胡子', '遥控器'],
    signals: ['约定好的暗号', '整蛊挑战', '误开的群消息', '自动回复', '错贴的标签', '反着读的规则'],
    motives: ['想让新人通过入会测试', '为了躲开尴尬的表白', '误把游戏规则当成现实命令', '把广告活动演过了头', '全员配合一个荒唐直播效果'],
  },
  weird: {
    titleWords: ['少了一个字', '答案在题目里', '不能问为什么', '第零个人', '向左的右手', '重复的结局', '没有主语', '空白选项', '倒数第一名', '被删掉的问题'],
    people: ['出题人', '记录员', '答题者', '旁观者', '校对员', '主持人'],
    places: ['线上题库', '排练室', '考试教室', '白板前', '聊天室', '录制现场'],
    objects: ['题卡', '白板笔', '计时器', '空白纸', '编号贴', '撤回消息'],
    signals: ['标点位置', '编号从零开始', '被省略的主语', '同音词', '断句误导', '撤回顺序'],
    motives: ['题面本身就是机关', '参与者按字面规则行动', '答案藏在格式而不是剧情里', '主持人故意限制提问方向', '所有人理解的“他”不是同一个人'],
  },
  emotion: {
    titleWords: ['没送出的伞', '迟来的生日歌', '空座位', '最后一通语音', '旧相册', '雨天留言', '没有署名的花', '重复的晚安', '未完成的拼图'],
    people: ['退休教师', '长途司机', '独自生活的女儿', '失联多年的朋友', '疗养院护工', '搬家工人', '旧书店老板'],
    places: ['旧家客厅', '车站候车室', '疗养院花园', '学校礼堂', '老照片馆', '河边长椅', '旧书店'],
    objects: ['录音笔', '旧相册', '生日蜡烛', '围巾', '车票', '花束', '拼图'],
    signals: ['提前录好的祝福', '寄错地址的包裹', '被保留的座位', '重复播放的留言', '迟到的快递', '未署名的字迹'],
    motives: ['想把告别伪装成普通一天', '不愿让对方带着愧疚生活', '保护一个迟来的承诺', '让家人误以为自己还在附近', '把真相藏进日常习惯里'],
  },
  clear: {
    titleWords: ['消失的冰块', '永远湿的地板', '不开门的邻居', '两张电影票', '空杯子', '迟到的闹钟', '无人的排队号', '会变短的路', '反向电梯', '打不开的伞'],
    people: ['图书管理员', '咖啡师', '快递员', '学生会长', '前台客服', '物业经理', '摄影助理'],
    places: ['图书馆', '咖啡店', '学校走廊', '小区大厅', '电影院', '办公室', '展览馆'],
    objects: ['冰块', '闹钟', '电影票', '雨伞', '杯子', '排队号', '门牌', '快递柜'],
    signals: ['时区设置错误', '镜像门牌', '自动续号', '融化痕迹', '反光误认', '同名预约'],
    motives: ['大家误会了地点', '时间显示被设置错了', '看似消失其实被换了位置', '规则说明被省略了一半', '两个同名的人造成混淆'],
  },
}

function rule(keywords, answer, clueType, clue) {
  return { keywords, answer, clueType, clue }
}

function pick(values, index, offset = 0) {
  return values[(index + offset) % values.length]
}

function makeGeneratedCase(categoryId, index) {
  const pool = pools[categoryId]
  const category = categoryDefinitions.find((item) => item.id === categoryId)
  const titleWord = pool.titleWords[index]
  const person = pick(pool.people, index)
  const place = pick(pool.places, index, 2)
  const object = pick(pool.objects, index, 4)
  const signal = pick(pool.signals, index, 6)
  const motive = pick(pool.motives, index, 8)
  const slug = `${categoryId}-original-${String(index + 1).padStart(2, '0')}`
  const base = {
    id: uuidFromSlug(slug),
    slug,
    title: titleWord,
    categoryId,
    difficulty: index % 4 === 0 ? '困难' : index % 3 === 0 ? '新手' : '普通',
    durationMinutes: categoryId === 'clear' || categoryId === 'funny' ? 15 : index % 2 === 0 ? 20 : 15,
    minPlayers: categoryId === 'clear' ? 1 : 1 + (index % 3 === 0 ? 1 : 0),
    maxPlayers: categoryId === 'black' || categoryId === 'emotion' ? 6 : 8,
    rating: Number((4.2 + ((index % 7) * 0.08)).toFixed(1)),
    accent: category.tone,
    sourceKind: 'original',
    sourceId: originalSourceId,
  }

  if (categoryId === 'red') {
    return finalizeCase({
      ...base,
      prompt: `${place}里，${person}被发现已经死亡，旁边只有一件${object}。可监控显示，事故发生后他还发出过一条消息。`,
      solution: `${person}在死亡前就设置了${signal}，让人误以为他事后仍能行动。${object}被故意留在${place}，目的是${motive}。真正的关键不是密室，而是消息被触发的时间。`,
      tags: ['红汤', '死亡', '不在场证明'],
      contentRating: '18+暗黑',
      targetClueCount: 5,
      answerKeywords: [person, object, place, signal, motive, '死亡', '时间'],
      rules: [
        rule([person, '死者', '他'], '是', '人物', `${person}无法在事故后主动行动。`),
        rule([object, '旁边', '物品'], '是', '物品', `${object}是被刻意留下的误导物。`),
        rule([place, '现场', '密室'], '部分正确', '时间线', `${place}的封闭状态只说明发现时的情况。`),
        rule(['消息', '短信', '监控', signal], '是', '时间线', `${signal}制造了“事后还活着”的错觉。`),
        rule(['动机', '为什么', '隐瞒', '证明'], '部分正确', '动机', motive),
      ],
    })
  }

  if (categoryId === 'black') {
    return finalizeCase({
      ...base,
      prompt: `${person}在${place}值守时，总能看到${object}自己移动。最可怕的是，记录里显示移动发生在他闭眼之后。`,
      solution: `${object}并没有自己移动，${place}被人提前布置了${signal}。${person}因为长期紧张产生判断偏差，而布置者这么做是${motive}。`,
      tags: ['黑汤', '心理压迫', '异常现场'],
      contentRating: '18+暗黑',
      targetClueCount: 5,
      answerKeywords: [person, object, place, signal, motive, '布置', '判断偏差'],
      rules: [
        rule([person, '值守', '看到'], '是', '人物', `${person}看到的现象并不等于事实本身。`),
        rule([object, '移动', '东西'], '是', '物品', `${object}的位置变化是真的，但原因不神秘。`),
        rule([place, '房间', '现场'], '部分正确', '时间线', `${place}在值守前已经被改造过。`),
        rule(['鬼', '灵异', '超自然'], '否'),
        rule([signal, '机关', '布置', '记录'], '是', '动机', motive),
      ],
    })
  }

  if (categoryId === 'funny') {
    return finalizeCase({
      ...base,
      prompt: `${place}里，${person}只说了一句“${object}不见了”，所有人立刻停止手上的事并鼓掌。`,
      solution: `这不是危机，而是${signal}。${object}是活动里的暗号道具，${person}说出这句话代表整蛊成功，大家鼓掌是因为${motive}。`,
      tags: ['王八汤', '整蛊', '荒诞'],
      contentRating: '16+荒诞',
      targetClueCount: 4,
      answerKeywords: [person, object, place, signal, motive, '暗号', '整蛊'],
      rules: [
        rule([person, '他说', '她说'], '是', '人物', `${person}知道这句话会触发后续反应。`),
        rule([object, '不见', '道具'], '部分正确', '物品', `${object}的缺失是设计好的，不是真正事故。`),
        rule(['鼓掌', '停止', '所有人'], '是', '时间线', '大家同时反应，说明他们共享同一套规则。'),
        rule([signal, '暗号', '游戏', '整蛊'], '是', '动机', motive),
      ],
    })
  }

  if (categoryId === 'weird') {
    return finalizeCase({
      ...base,
      prompt: `${person}拿到标题写着“${titleWord}”的题卡，明明按规则答对了问题，却仍被判失败。题卡上没有错字，答案也完全正确。`,
      solution: `失败原因不在剧情，而在“${titleWord}”这张题卡的${signal}。${person}忽略了${object}上的格式规则，所以回答虽然正确，却不是题目要求的那一种答案。`,
      tags: ['变格汤', '文字游戏', '规则反转'],
      contentRating: '16+反转',
      targetClueCount: 4,
      answerKeywords: [person, object, signal, titleWord, '规则', '格式', '答案'],
      rules: [
        rule([person, '答题者', '失败'], '是', '人物', `${person}的逻辑答案没有问题。`),
        rule([object, '题卡', '纸'], '是', '物品', `${object}上有比文字内容更重要的信息。`),
        rule(['错字', '答案', '正确'], '无关'),
        rule([signal, '格式', '规则', '标点'], '是', '动机', '这题考的不是剧情事实，而是读题方式。'),
      ],
    })
  }

  if (categoryId === 'emotion') {
    return finalizeCase({
      ...base,
      prompt: `${person}每年都会把${object}放在${place}，今年却第一次笑着离开。旁人以为他终于放下了。`,
      solution: `${person}不是放下了，而是终于发现${signal}。${object}一直承载着一个迟来的告别，今年的变化说明${motive}。`,
      tags: ['情感汤', '遗憾', '记忆'],
      contentRating: '18+暗黑',
      targetClueCount: 5,
      answerKeywords: [person, object, place, signal, motive, '告别', '记忆'],
      rules: [
        rule([person, '他', '她', '每年'], '是', '人物', `${person}长期重复同一个纪念动作。`),
        rule([object, '东西', '纪念'], '是', '物品', `${object}不是普通礼物，而是记忆锚点。`),
        rule([place, '今年', '离开'], '部分正确', '时间线', '今年发生了一个让他改变反应的新信息。'),
        rule([signal, '留言', '快递', '字迹', '祝福'], '是', '动机', motive),
        rule(['忘记', '放下', '告别'], '部分正确', '动机', '他笑着离开，是因为终于理解了对方留下的意思。'),
      ],
    })
  }

  return finalizeCase({
    ...base,
    prompt: `${place}里，${person}明明没有离开座位，${object}却出现在了另一端。没有人偷拿，也没有机关。`,
    solution: `关键是${signal}。大家把${place}里的参照物看错了，${object}没有神秘移动，只是因为${motive}。`,
    tags: ['清汤', '日常误会', '逻辑'],
    contentRating: '12+推理',
    targetClueCount: 4,
    answerKeywords: [person, object, place, signal, motive, '误会', '参照物'],
    rules: [
      rule([person, '没有离开', '座位'], '是', '人物', `${person}确实没有主动搬动物品。`),
      rule([object, '出现', '东西'], '是', '物品', `${object}的位置变化来自观察角度。`),
      rule([place, '现场', '另一端'], '部分正确', '时间线', `${place}里的参照关系被误读。`),
      rule([signal, '误会', '规则', '设置'], '是', '动机', motive),
      rule(['偷', '机关', '死亡', '鬼'], '否'),
    ],
  })
}

function finalizeCase(item) {
  return {
    ...item,
    sourceKind: item.sourceKind ?? 'original',
    sourceId: item.sourceId ?? originalSourceId,
    sourceUrl: null,
    sourceLicense: 'Project original content',
    licenseVerifiedAt: generatedOn,
    curationNotes: '原创生成，未复制外部题库原文。',
    isPublished: true,
  }
}

function buildCases() {
  const cases = [...existingCases.map(finalizeCase)]

  for (const category of categoryDefinitions) {
    const current = cases.filter((item) => item.categoryId === category.id).length
    const missing = category.target - current

    for (let index = 0; index < missing; index += 1) {
      cases.push(makeGeneratedCase(category.id, index))
    }
  }

  return cases.map((item) => ({
    ...item,
    contentHash: hashContent(item),
  }))
}

function uuidFromSlug(slug) {
  const hash = createHash('sha256').update(`xuantang:${slug}`).digest('hex')
  const variant = ((Number.parseInt(hash.slice(16, 18), 16) & 0x3f) | 0x80).toString(16).padStart(2, '0')
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-${variant}${hash.slice(18, 20)}-${hash.slice(20, 32)}`
}

function hashContent(item) {
  return createHash('sha256').update(`${item.prompt}\n---\n${item.solution}`).digest('hex')
}

function sqlString(value) {
  if (value == null) return 'null'
  return `'${String(value).replaceAll("'", "''")}'`
}

function sqlBool(value) {
  return value ? 'true' : 'false'
}

function sqlTextArray(values) {
  return `array[${values.map(sqlString).join(', ')}]::text[]`
}

function generateMigration(payload) {
  const soups = payload.soups
  const ids = soups.map((item) => sqlString(item.id)).join(', ')
  const categoryRows = payload.categories
    .map(
      (item) =>
        `  (${sqlString(item.id)}, ${sqlString(item.name)}, ${sqlString(item.description)}, ${sqlString(item.tone)}, ${item.sortOrder})`,
    )
    .join(',\n')
  const soupRows = soups
    .map(
      (item) =>
        `  (${sqlString(item.id)}, ${sqlString(item.slug)}, ${sqlString(item.title)}, ${sqlString(item.prompt)}, ${sqlString(item.difficulty)}, ${item.durationMinutes}, ${item.minPlayers}, ${item.maxPlayers}, ${item.rating}, ${sqlString(item.accent)}, ${sqlBool(item.isPublished)}, ${sqlTextArray(item.tags)}, ${sqlString(item.contentRating)}, ${sqlString(item.sourceKind)}, ${sqlString(item.sourceId)}, ${sqlString(item.contentHash)}, ${sqlString(item.curationNotes)})`,
    )
    .join(',\n')
  const caseRows = soups
    .map(
      (item) =>
        `  (${sqlString(item.id)}, ${sqlString(item.solution)}, ${item.targetClueCount}, ${sqlTextArray(item.answerKeywords)})`,
    )
    .join(',\n')
  const linkRows = soups
    .map((item) => `  (${sqlString(item.id)}, ${sqlString(item.categoryId)}, true)`)
    .join(',\n')
  const ruleRows = soups
    .flatMap((item) =>
      item.rules.map(
        (entry) =>
          `  (${sqlString(item.id)}, ${sqlTextArray(entry.keywords)}, ${sqlString(entry.answer)}, ${sqlString(entry.clueType)}, ${sqlString(entry.clue)})`,
      ),
    )
    .join(',\n')

  return `begin;

create table if not exists public.content_sources (
  id text primary key,
  title text not null,
  author text,
  source_url text,
  license text not null,
  license_url text,
  allowed_use text not null,
  checked_at date not null,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.soup_categories (
  id text primary key,
  name text not null,
  description text not null,
  tone text not null,
  sort_order int not null default 0
);

alter table public.soups add column if not exists tags text[] not null default '{}';
alter table public.soups add column if not exists content_rating text not null default '16+';
alter table public.soups add column if not exists source_kind text not null default 'original';
alter table public.soups add column if not exists source_id text references public.content_sources(id);
alter table public.soups add column if not exists content_hash text;
alter table public.soups add column if not exists curation_notes text;

create table if not exists public.soup_category_links (
  soup_id uuid not null references public.soups(id) on delete cascade,
  category_id text not null references public.soup_categories(id) on delete restrict,
  is_primary boolean not null default true,
  primary key (soup_id, category_id)
);

create unique index if not exists idx_soups_content_hash_unique
on public.soups (content_hash)
where content_hash is not null;

create index if not exists idx_soup_category_links_category
on public.soup_category_links (category_id, soup_id);

create index if not exists idx_soups_source
on public.soups (source_id);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'soups_source_kind_check'
      and conrelid = 'public.soups'::regclass
  ) then
    alter table public.soups
      add constraint soups_source_kind_check check (source_kind in ('original', 'licensed'));
  end if;
end $$;

alter table public.content_sources enable row level security;
alter table public.soup_categories enable row level security;
alter table public.soup_category_links enable row level security;

drop policy if exists "content sources are readable" on public.content_sources;
create policy "content sources are readable"
on public.content_sources for select
to authenticated
using (true);

drop policy if exists "soup categories are readable" on public.soup_categories;
create policy "soup categories are readable"
on public.soup_categories for select
to authenticated
using (true);

drop policy if exists "published soup category links are readable" on public.soup_category_links;
create policy "published soup category links are readable"
on public.soup_category_links for select
to authenticated
using (
  exists (
    select 1
    from public.soups
    where soups.id = soup_category_links.soup_id
      and soups.is_published = true
  )
);

insert into public.content_sources (id, title, author, source_url, license, license_url, allowed_use, checked_at, notes)
values (
  ${sqlString(payload.source.id)},
  ${sqlString(payload.source.title)},
  ${sqlString(payload.source.author)},
  ${sqlString(payload.source.sourceUrl)},
  ${sqlString(payload.source.license)},
  ${sqlString(payload.source.licenseUrl)},
  ${sqlString(payload.source.allowedUse)},
  ${sqlString(payload.source.checkedAt)}::date,
  ${sqlString(payload.source.notes)}
)
on conflict (id) do update set
  title = excluded.title,
  author = excluded.author,
  source_url = excluded.source_url,
  license = excluded.license,
  license_url = excluded.license_url,
  allowed_use = excluded.allowed_use,
  checked_at = excluded.checked_at,
  notes = excluded.notes;

insert into public.soup_categories (id, name, description, tone, sort_order)
values
${categoryRows}
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  tone = excluded.tone,
  sort_order = excluded.sort_order;

insert into public.soups (
  id,
  slug,
  title,
  prompt,
  difficulty,
  duration_minutes,
  min_players,
  max_players,
  rating,
  accent,
  is_published,
  tags,
  content_rating,
  source_kind,
  source_id,
  content_hash,
  curation_notes
)
values
${soupRows}
on conflict (id) do update set
  slug = excluded.slug,
  title = excluded.title,
  prompt = excluded.prompt,
  difficulty = excluded.difficulty,
  duration_minutes = excluded.duration_minutes,
  min_players = excluded.min_players,
  max_players = excluded.max_players,
  rating = excluded.rating,
  accent = excluded.accent,
  is_published = excluded.is_published,
  tags = excluded.tags,
  content_rating = excluded.content_rating,
  source_kind = excluded.source_kind,
  source_id = excluded.source_id,
  content_hash = excluded.content_hash,
  curation_notes = excluded.curation_notes;

insert into public.soup_cases (soup_id, solution, target_clue_count, answer_keywords)
values
${caseRows}
on conflict (soup_id) do update set
  solution = excluded.solution,
  target_clue_count = excluded.target_clue_count,
  answer_keywords = excluded.answer_keywords;

delete from public.soup_category_links
where soup_id in (${ids});

insert into public.soup_category_links (soup_id, category_id, is_primary)
values
${linkRows}
on conflict (soup_id, category_id) do update set
  is_primary = excluded.is_primary;

delete from public.soup_rules
where soup_id in (${ids});

insert into public.soup_rules (soup_id, keywords, answer, clue_type, clue)
values
${ruleRows};

commit;
`
}

async function main() {
  const payload = {
    generatedOn,
    sourcePolicy: 'Only exact text from explicitly licensed sources may be imported; this batch is original content.',
    source,
    categories: categoryDefinitions,
    soups: buildCases(),
  }

  await mkdir(dirname(contentFile), { recursive: true })
  await mkdir(dirname(migrationFile), { recursive: true })
  await writeFile(contentFile, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
  await writeFile(migrationFile, generateMigration(payload), 'utf8')
  console.log(`Generated ${payload.soups.length} soups into ${contentFile}`)
  console.log(`Generated migration ${migrationFile}`)
}

await main()
