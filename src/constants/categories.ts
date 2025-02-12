export const CATEGORY_MAPPING = {
  0: 0, 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 14: 9,
  9: 10, 10: 11, 15: 12, 17: 13, 16: 14, 11: 15, 12: 16, 13: 18, 18: 17,
  19: 19, 20: 20, 21: 21, 22: 22, 23: 23
} as const;

export const CATEGORY_NAMES = {
  0: '每月新品',
  1: '前台糖果',
  2: '巧克力',
  3: '缤纷糖果',
  4: '儿童糖玩',
  5: '饼干糕点',
  6: '肉干肉脯',
  7: '麻辣素食',
  8: '蜜饯果干',
  9: '海苔类',
  10: '膨化食品',
  11: '散装食品',
  12: '熟食卤味',
  13: '礼盒类',
  14: '其他休食',
  15: '1元2元区',
  16: '饮品类',
  17: '咖啡冲调',
  18: '特价专区',
  19: '果冻布丁',
  20: '方便速食',
  21: '日用百货',
  22: '一次性用品',
  23: '卡游'
} as const;

// 获取反向映射的函数
export const getOriginalCategory = (mappedCategory: number): number => {
  return Object.entries(CATEGORY_MAPPING).find(
    ([_, value]) => value === mappedCategory
  )?.[0] as unknown as number || mappedCategory;
};
