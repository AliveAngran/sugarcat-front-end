interface Product {
  _id: string;
  name: string;
  price: number;
  description?: string;
  images?: string[];
  isPutOnSale: number; // 0: 补货中, 1: 可购买
  buyAtMultipleTimes: boolean; // true: 倍购模式, false: 普通模式
  minBuyNum: number; // 最小购买数量
  // ... 其他已有字段
} 