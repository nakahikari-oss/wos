// 寒霜啟示錄道具基準價（USD / 個）
// 來源：PRICING.md — 兩邊更新時要同步修改
// 快照：2026-10-20
// 區間值用中位數；category 用來分組，status: 's7' 已校驗、's6' S6 快照續用
// 譯名：zh = 中文、en = 遊戲內英文（來源 TERMS.md，未確認的標 (TBD)）

const WOS_PRICES = [
  // ─── 戰力資源 ───
  { id: 'steel',             zh: '鋼材',               en: 'Steel',                      price: 0.0000667, source: '客製化奇貨',       cat: 'resource', status: 's7' },
  { id: 'fc',                zh: '火晶',               en: 'Fire Crystal',               price: 0.0744,    source: '客製化奇貨',       cat: 'resource', status: 's7' },
  { id: 'mithril',           zh: '秘銀',               en: 'Mithril',                    price: 5.00,      source: '常規禮包 $5',      cat: 'resource', status: 's7' },

  // ─── 加速 ───
  { id: 'speed_1h_general',  zh: '1 小時通用加速',     en: '1h General Speedup',         price: 0.096,     source: '常規加速禮包',     cat: 'speed',    status: 's6', range: [0.064, 0.128] },
  { id: 'speed_1h_build',    zh: '1 小時建造加速',     en: '1h Construction Speedup',    price: 0.1075,    source: '客製化奇貨',       cat: 'speed',    status: 's7' },
  { id: 'speed_1h_train',    zh: '1 小時訓練加速',     en: '1h Training Speedup',        price: 0.1075,    source: '客製化奇貨',       cat: 'speed',    status: 's7' },
  { id: 'speed_1h_research', zh: '1 小時研究加速',     en: '1h Research Speedup',        price: 0.1075,    source: '客製化奇貨',       cat: 'speed',    status: 's7' },

  // ─── 領主裝備 ───
  { id: 'alloy',             zh: '強韌合金',           en: 'Hardened Alloy',             price: 0.000112,  source: '工匠的寶庫',       cat: 'gear',     status: 's6' },
  { id: 'polish',            zh: '拋光液',             en: 'Polishing Solution',         price: 0.0112,    source: '工匠的寶庫',       cat: 'gear',     status: 's6' },
  { id: 'design_plans',      zh: '設計圖紙',           en: 'Design Plans',               price: 0.056,     source: '工匠的寶庫',       cat: 'gear',     status: 's6' },
  { id: 'lucky_hero_gear',   zh: '英雄裝備幸運寶箱',   en: 'Lucky Hero Gear Chest',      price: 0.167,     source: '客製化戰備',       cat: 'gear',     status: 's6' },
  { id: 'mythic_hero_gear',  zh: '傳說英雄裝備客製化箱子', en: 'Custom Mythic Hero Gear Chest', price: 19.2, source: '客製化戰備',   cat: 'gear',     status: 's6', range: [13.4, 25] },

  // ─── 寶石 ───
  { id: 'charm_design',      zh: '寶石圖紙',           en: 'Charm Design',               price: 0.0641,    source: '客製化匠心',       cat: 'charm',    status: 's7' },
  { id: 'charm_guide',       zh: '寶石手冊',           en: 'Charm Guide',                price: 0.0694,    source: '客製化匠心',       cat: 'charm',    status: 's7' },
  { id: 'charm_secrets',     zh: '寶石秘典',           en: 'Charm Secrets',              price: 0.783,     source: '常規禮包 A 包回推', cat: 'charm',   status: 's7' },

  // ─── 英雄養成 ───
  { id: 'essence_stone',     zh: '專精能源石',         en: 'Essence Stones',             price: 0.167,     source: '客製化戰備',       cat: 'hero',     status: 's6' },

  // ─── 寵物 ───
  { id: 'pet_food',          zh: '寵物口糧',           en: 'Pet Food',                   price: 0.000333,  source: '萌寵客製化禮包',   cat: 'pet',      status: 's7' },
  { id: 'wild_mark_std',     zh: '普通野性印記',       en: 'Wild Mark',                  price: 0.1042,    source: '萌寵客製化禮包',   cat: 'pet',      status: 's7' },
  { id: 'wild_mark_adv',     zh: '高級野性印記',       en: 'Advanced Wild Mark',         price: 0.833,     source: '萌寵客製化禮包',   cat: 'pet',      status: 's7' },
  { id: 'pet_advance',       zh: '寵物突破材料客製化箱子', en: 'Pet Advancement Materials Custom Chest', price: 0.278, source: '萌寵客製化禮包', cat: 'pet', status: 's7' },

  // ─── 專家系統 ───
  { id: 'affinity',          zh: '專家好感度（1 點）', en: 'Expert Affinity (1 pt)',     price: 0.00038,   source: '曙光智慧禮包',     cat: 'expert',   status: 's6' },
  { id: 'burning_heart',     zh: '炙熱之心',           en: 'Burning Heart (TBD)',        price: 0.038,     source: '曙光智慧禮包',     cat: 'expert',   status: 's6' },
  { id: 'conquest_sail',     zh: '征服之帆',           en: 'Conquest Sail (TBD)',        price: 0.38,      source: '曙光智慧禮包',     cat: 'expert',   status: 's6' },
  { id: 'knowledge_book',    zh: '學識之書',           en: 'Book of Knowledge (TBD)',    price: 0.0053,    source: '曙光智慧禮包',     cat: 'expert',   status: 's6', range: [0.0049, 0.0056] },
  { id: 'speed_1h_learn',    zh: '1 小時學習加速',     en: '1h Learning Speedup (TBD)',  price: 0.084,     source: '假設同訓練加速',   cat: 'expert',   status: 's6', range: [0.056, 0.111] },
  { id: 'expert_mark',       zh: '通用專家印記',       en: 'Universal Expert Mark (TBD)', price: 0.625,    source: '常規印記禮包',     cat: 'expert',   status: 's6' },

  // ─── 其他 ───
  { id: 'gem',               zh: '鑽石',               en: 'Gem',                        price: 0.001,     source: '常規鑽石禮包',     cat: 'other',    status: 's6' },
  { id: 'mystery_badge',     zh: '神秘徽章',           en: 'Mystery Badge',              price: 0.002,     source: '常規禮包 $5',      cat: 'other',    status: 's6' },
];

const WOS_CATS = {
  resource: { zh: '戰力資源',   en: 'Resources' },
  speed:    { zh: '加速',       en: 'Speedups' },
  gear:     { zh: '領主裝備',   en: 'Chief Gear' },
  charm:    { zh: '寶石',       en: 'Charms' },
  hero:     { zh: '英雄養成',   en: 'Hero' },
  pet:      { zh: '寵物',       en: 'Pet' },
  expert:   { zh: '專家系統',   en: 'Experts' },
  other:    { zh: '其他',       en: 'Other' },
};
