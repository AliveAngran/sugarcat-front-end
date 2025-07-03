// export const CATEGORY_MAPPING = {
//   0: 0, 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 14: 9,
//   9: 10, 10: 11, 15: 12, 17: 13, 16: 14, 11: 15, 12: 16, 13: 18, 18: 17,
//   19: 19, 20: 20, 21: 21, 22: 22, 23: 23
// } as const;

// export const CATEGORY_NAMES = {
//   0: '每月新品',
//   1: '前台糖果',
//   2: '巧克力',
//   3: '缤纷糖果',
//   4: '儿童糖玩',
//   5: '饼干糕点',
//   6: '肉干肉脯',
//   7: '麻辣素食',
//   8: '蜜饯果干',
//   9: '海苔类',
//   10: '膨化食品',
//   11: '散装食品',
//   12: '熟食卤味',
//   13: '礼盒类',
//   14: '其他休食',
//   15: '1元2元区',
//   16: '饮品类',
//   17: '咖啡冲调',
//   18: '特价专区',
//   19: '果冻布丁',
//   20: '方便速食',
//   21: '日用百货',
//   22: '一次性用品',
//   23: '卡游'
// } as const;

// // 获取反向映射的函数
// export const getOriginalCategory = (mappedCategory: number): number => {
//   return Object.entries(CATEGORY_MAPPING).find(
//     ([_, value]) => value === mappedCategory
//   )?.[0] as unknown as number || mappedCategory;
// };
// 所有分类的权威源数据
export const ALL_CATEGORIES = [
  { name: '每月新品', id: 0, order: 0 },
  { name: '前台糖果', id: 1, order: 1 },
  { name: '巧克力', id: 2, order: 2 },
  { name: '缤纷糖果', id: 3, order: 3 },
  { name: '儿童糖玩', id: 4, order: 4 },
  { name: '饼干糕点', id: 5, order: 5 },
  { name: '肉干肉脯', id: 6, order: 6 },
  { name: '麻辣素食', id: 7, order: 7 },
  { name: '蜜饯果干', id: 8, order: 8 },
  { name: '海苔类', id: 9, order: 9 },
  { name: '膨化食品', id: 10, order: 10 },
  { name: '散装食品', id: 11, order: 11 },

  // 新增项
  { name: '单个面包', id: 30, order: 12 },

  // 原来 order >= 12 的项，order 全部 +1
  { name: '熟食卤味', id: 12, order: 13 },
  { name: '礼盒类', id: 13, order: 14 },
  { name: '其他休食', id: 14, order: 15 },
  { name: '1元2元区', id: 15, order: 16 },
  { name: '蛋类', id: 24, order: 17 },
  { name: '坚果炒货', id: 25, order: 18 },
  { name: '厨房调味', id: 26, order: 19 },
  { name: '办公文具', id: 27, order: 20 },
  { name: '家庭清洁', id: 28, order: 21 },
  { name: '饮品类', id: 16, order: 22 },
  { name: '咖啡冲调', id: 17, order: 23 },
  { name: '果冻布丁', id: 19, order: 24 },
  { name: '方便速食', id: 20, order: 25 },
  { name: '日用百货', id: 21, order: 26 },
  { name: '卡游', id: 23, order: 27 },
  { name: '特价专区', id: 18, order: 28 },
  { name: '一次性用品', id: 22, order: 29 },
  { name: '地推商品', id: 29, order: 30 },
] as const;

 
 // 根据 ALL_CATEGORIES 自动生成 CATEGORY_MAPPING
 // 格式: { [原始ID: number]: 排序ID: number }
 export const CATEGORY_MAPPING = Object.fromEntries(
   ALL_CATEGORIES.map(c => [c.id, c.order])
 ) as { [key: number]: number };
 
 // 根据 ALL_CATEGORIES 自动生成 CATEGORY_NAMES
 // 格式: { [排序ID: number]: 名称: string }
 export const CATEGORY_NAMES = Object.fromEntries(
   ALL_CATEGORIES.map(c => [c.order, c.name])
 ) as { [key: number]: string };
 
 // 创建一个反向映射以便高效查找
 const REVERSE_CATEGORY_MAPPING = Object.fromEntries(
   Object.entries(CATEGORY_MAPPING).map(([key, value]) => [value, Number(key)])
 ) as { [key: number]: number };
 
 /**
  * 根据映射后的 category ID 获取原始的 ID。
  * @param mappedCategory - 映射后的 category ID (即 order)
  * @returns 原始的 category ID
  */
 export const getOriginalCategory = (mappedCategory: number): number => {
   return REVERSE_CATEGORY_MAPPING[mappedCategory] ?? mappedCategory;
 };