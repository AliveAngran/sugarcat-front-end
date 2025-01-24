interface Product {
  _id: string;
  name: string;
  price: number;
  description?: string;
  images?: string[];
  isPutOnSale: boolean;
  // ... 其他已有字段
} 