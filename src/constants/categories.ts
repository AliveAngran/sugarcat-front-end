// 所有分类的权威源数据（id: 原始ID, order: 排序ID）
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
  { name: '单个面包', id: 30, order: 12 },
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

// 原始ID => 排序ID 映射
export const CATEGORY_MAPPING = Object.fromEntries(
  ALL_CATEGORIES.map(c => [c.id, c.order])
) as { [key: number]: number };

// 排序ID => 分类名称 映射
export const CATEGORY_NAMES = Object.fromEntries(
  ALL_CATEGORIES.map(c => [c.id, c.name])
) as { [key: number]: string };

/**
 * 根据原始 category ID 获取映射后的排序 ID（order）
 * @param originalId - 原始的分类 ID（例如：0, 1, 2...）
 * @returns 映射后的排序 ID（例如：0, 1, 2...）
 */
export const getMappedCategory = (originalId: number): number => {
  const category = ALL_CATEGORIES.find(c => c.id === originalId);
  return category?.order ?? originalId;
};

/**
 * 根据映射后的排序 ID（order）获取原始的 category ID
 * @param mappedCategory - 排序 ID（例如：0, 1, 2...）
 * @returns 原始的分类 ID（例如：0, 1, 2...）
 */
export const getOriginalCategory = (mappedCategory: number): number => {
  const category = ALL_CATEGORIES.find(c => c.order === mappedCategory);
  return category?.id ?? mappedCategory;
};
