interface GoodsItem {
  spuId: string;
  goodsName: string;
  goodsImg: string;
  price: number;
  quantity: number;
  settlePrice: number;
}

export interface Order {
  _id: string;
  _openid: string;
  orderNo: string;
  orderStatus: number;
  payStatus: string;
  totalAmount: number;
  paymentAmount: number;
  createTime: { $date: string };
  receiverName: string;
  receiverPhone: string;
  receiverAddress: string;
  goodsList: GoodsItem[];
  userStoreName?: string;
} 