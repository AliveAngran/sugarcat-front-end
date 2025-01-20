import { NextResponse } from 'next/server';
import { cloudbase } from '@/utils/cloudbase-admin';
import { CATEGORY_NAMES } from '@/constants/categories';

const _ = cloudbase.database().command;

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// 在文件开头定义通用的时间变量
const currentDate = new Date();
const thirtyDaysAgoTimestamp = currentDate.getTime() - 30 * 24 * 60 * 60 * 1000;
const thirtyDaysAgoDate = new Date(thirtyDaysAgoTimestamp);

// 地址解析和归类函数
function parseAddress(address: string) {
  // 提取市级地址
  const cityMatch = address.match(/(.*?市)/);
  if (cityMatch) {
    return cityMatch[1];
  }
  // 如果没有市,则返回省
  const provinceMatch = address.match(/(.*?省)/);
  if (provinceMatch) {
    return provinceMatch[1];
  }
  return '其他';
}

// 首先定义商品的接口类型
interface Product {
  spuId: string;
  title: string;
  available: number;
  categoryIds: number[];  // 改为 number[] 因为分类 ID 是数字
  brand?: string;
  // ... 其他属性
}

// 定义订单商品项的接口
interface OrderItem {
  spuId: string;
  goodsName: string;
  price: number;
  quantity: number;
}

interface Order {
  _openid: string;
  createTime: string;
  paymentAmount: number;
  goodsList: OrderItem[];
  receiverAddress?: string;
  userStoreName?: string;
}

// 确保 CATEGORY_NAMES 有正确的类型定义
type CategoryId = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18;

type CategoryNames = {
  [K in CategoryId]: string;
};

// 使用类型断言来确保 TypeScript 知道可以用数字索引
const getCategoryName = (categoryId: number): string => {
  return (CATEGORY_NAMES as any)[categoryId] || '其他';
};

// 定义客户分析数据的接口
interface CustomerAnalysis {
  totalAmount: number;
  orderCount: number;
  region: string;
  lastOrderTime: string;
}

// 定义品牌销售数据的接口
interface BrandSalesData {
  salesAmount: number;
  quantity: number;
  productCount: number;
  products: Set<string>;
}

// 定义品类趋势数据的接口
interface CategoryTrendData {
  total: number;
  categories: Record<string, number>;
}

// 定义统计数据的接口
interface StoreStats {
  orderCount: number;
  totalAmount: number;
  salesPerson: string;
}

// 修改用户信息映射的数据结构
interface UserInfo {
  userStoreName: string;
  salesPerson: string;
  createTime: string | Date;
}

// 添加类型定义
interface StoreOrderStats {
  [store: string]: StoreStats;
}

type SalesmanData = {
  totalAmount: number;
  orderCount: number;
  stores: Set<string>;
  newStores: Set<string>;
  repurchaseStores: Set<string>;
  orderDates: Map<string, Set<string>>;
};

export async function GET() {
  try {
    const db = cloudbase.database();
    
    // 获取所有订单
    const ordersResult = await db.collection('orders')
      .where({
        orderStatus: _.in([10, 40, 50]),
      })
      .limit(2000)
      .get();
    
    // 获取所有商品
    const productsResult = await db.collection('spu_db')
      .where({
        isPutOnSale: 1,
        available: _.gt(0)
      })
      .limit(2000)
      .get();
    
    const orders = ordersResult.data || [];
    const products = productsResult.data || [];
    
    // 计算基础数据
    const totalOrders = orders.length;
    const totalRevenue = orders.reduce((sum, order) => sum + (order.paymentAmount || 0), 0);
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    const totalProducts = products.length;

    // 计算最7天的订单趋势
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - i);
      return date.toISOString().split('T')[0];
    }).reverse();

    const ordersByDate = orders.reduce((acc, order) => {
      const date = new Date(order.createTime).toISOString().split('T')[0];
      acc[date] = (acc[date] || 0) + order.paymentAmount;
      return acc;
    }, {} as Record<string, number>);

    // 计算商品分类分布
    const categoryCount = products.reduce((acc: Record<string, number>, product: Product) => {
      (product.categoryIds || []).forEach((categoryId: number) => {
        const categoryName = getCategoryName(categoryId);
        acc[categoryName] = (acc[categoryName] || 0) + 1;
      });
      return acc;
    }, {});

    // 计算热销商品
    const productSales = orders.reduce((acc, order) => {
      (order.goodsList || []).forEach((item: OrderItem) => {
        const salesAmount = (item.price || 0) * (item.quantity || 0);
        if (!acc[item.goodsName]) {
          acc[item.goodsName] = {
            salesAmount: 0,
            quantity: 0
          };
        }
        acc[item.goodsName].salesAmount += salesAmount;
        acc[item.goodsName].quantity += (item.quantity || 0);
      });
      return acc;
    }, {} as Record<string, { salesAmount: number; quantity: number }>);

    // 定义销售数据的类型
    interface SalesData {
      salesAmount: number;
      quantity: number;
    }

    // 定义销售条目的类型
    type SalesEntry = [string, SalesData];

    // 修改排序代码
    const topProducts = Object.entries(productSales)
      .map(entry => entry as SalesEntry)
      .sort((a, b) => b[1].salesAmount - a[1].salesAmount)
      .slice(0, 20);

    // 算每周最佳销售时段分布
    const hourlyDistribution = orders.reduce((acc, order) => {
      const hour = new Date(order.createTime).getHours();
      acc[hour] = (acc[hour] || 0) + order.paymentAmount;
      return acc;
    }, {} as Record<number, number>);

    // 计算商品组合分析
    const productCombinations = orders.reduce((acc, order) => {
      const items = order.goodsList.map((item: OrderItem) => item.goodsName).sort();
      for (let i = 0; i < items.length; i++) {
        for (let j = i + 1; j < items.length; j++) {
          const combo = `${items[i]}_${items[j]}`;
          acc[combo] = (acc[combo] || 0) + 1;
        }
      }
      return acc;
    }, {} as Record<string, number>);

    // 计算滞销商品分析
    const productSalesInLast30Days = products.map(product => {
      const sales = orders
        .filter(order => new Date(order.createTime).getTime() > thirtyDaysAgoTimestamp)
        .reduce((sum, order) => {
          const item = order.goodsList.find((item: OrderItem) => item.spuId === product.spuId);
          return sum + (item?.quantity || 0);
        }, 0);
      
      return {
        name: product.title,
        spuId: product.spuId,
        sales,
        available: product.available
      };
    }).sort((a, b) => a.sales - b.sales);

    // 计算客户分
    const customerAnalysis = orders.reduce((acc, order) => {
      const customerId = order._openid;
      if (!acc[customerId]) {
        acc[customerId] = {
          totalAmount: 0,
          orderCount: 0,
          region: order.receiverAddress?.split(' ')[0] || '未知',
          lastOrderTime: order.createTime
        };
      }
      acc[customerId].totalAmount += order.paymentAmount;
      acc[customerId].orderCount += 1;
      return acc;
    }, {} as Record<string, CustomerAnalysis>);

    // 计算客户价值分布
    const customerValueRanges = (Object.values(customerAnalysis) as CustomerAnalysis[]).reduce((acc, customer) => {
      const range = Math.floor(customer.totalAmount / 10000) * 10000; // 按1万元分组
      acc[range] = (acc[range] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);

    // 计算地域分布
    const regionDistribution = orders.reduce((acc, order) => {
      const address = order.receiverAddress || '';
      const city = parseAddress(address);
      
      if (!acc[city]) {
        acc[city] = 0;
      }
      acc[city] += order.paymentAmount;
      
      return acc;
    }, {} as Record<string, number>);

    // 转换为数组并排序
    type RegionEntry = [string, number];

    const sortedRegionDistribution = Object.entries(regionDistribution)
      .map(entry => entry as RegionEntry)
      .sort(([, a], [, b]) => b - a)
      .map(([region, amount]) => ({
        region,
        amount
      }));

    // 计算品牌销售数据
    const brandSales = orders.reduce((acc, order) => {
      (order.goodsList || []).forEach((item: OrderItem) => {
        const product = products.find(p => p.spuId === item.spuId);
        if (!product?.brand) return;
        
        if (!acc[product.brand]) {
          acc[product.brand] = {
            salesAmount: 0,
            quantity: 0,
            productCount: 0,
            products: new Set()
          };
        }
        acc[product.brand].salesAmount += (item.price || 0) * (item.quantity || 0);
        acc[product.brand].quantity += (item.quantity || 0);
        acc[product.brand].products.add(item.spuId);
      });
      return acc;
    }, {} as Record<string, BrandSalesData>);

    // 转换为数组并计算平均值
    const brandAnalysis = (Object.entries(brandSales) as Array<[string, BrandSalesData]>)
      .map(([brand, data]) => ({
        brand,
        salesAmount: data.salesAmount,
        quantity: data.quantity,
        productCount: data.productCount,
        averageSalesPerProduct: data.salesAmount / data.products.size || 0
      }));

    // 热销品牌（按销售额排序）
    const topBrands = [...brandAnalysis]
      .sort((a, b) => b.salesAmount - a.salesAmount)
      .slice(0, 10);

    // 滞销品牌（按平均销售额排序）
    const slowMovingBrands = [...brandAnalysis]
      .filter(brand => brand.productCount >= 3) // 只考虑有3个及以上商品的品牌
      .sort((a, b) => a.averageSalesPerProduct - b.averageSalesPerProduct)
      .slice(0, 10);

    // 计算品类市场份额趋势（按月）
    const categoryTrends = orders.reduce((acc, order) => {
      const month = new Date(order.createTime).toISOString().slice(0, 7); // YYYY-MM
      if (!acc[month]) {
        acc[month] = {
          total: 0,
          categories: {}
        };
      }
      
      order.goodsList.forEach((item: OrderItem) => {
        const product = products.find(p => p.spuId === item.spuId);
        const amount = (item.price || 0) * (item.quantity || 0);
        acc[month].total += amount;
        
        (product?.categoryIds || []).forEach((categoryId: number) => {
          const categoryName = getCategoryName(categoryId);
          acc[month].categories[categoryName] = (acc[month].categories[categoryName] || 0) + amount;
        });
      });
      return acc;
    }, {} as Record<string, { 
      total: number; 
      categories: Record<string, number> 
    }>);

    // 计算品类组合购买分析
    const categoryCombinations = orders.reduce((acc, order) => {
      const orderCategories = new Set<string>();
      order.goodsList.forEach((item: OrderItem) => {
        const product = products.find(p => p.spuId === item.spuId);
        (product?.categoryIds || []).forEach((categoryId: number) => {
          orderCategories.add(getCategoryName(categoryId));
        });
      });
      
      const categories = Array.from(orderCategories).sort();
      for (let i = 0; i < categories.length; i++) {
        for (let j = i + 1; j < categories.length; j++) {
          const combo = `${categories[i]}_${categories[j]}`;
          acc[combo] = (acc[combo] || 0) + order.paymentAmount;
        }
      }
      return acc;
    }, {} as Record<string, number>);

    // 计算新客户增长趋势 (按日)
    const customerGrowth = orders.reduce((acc, order) => {
      const date = new Date(order.createTime).toISOString().split('T')[0]; // YYYY-MM-DD
      const customerId = order._openid;
      
      if (!acc[date]) {
        acc[date] = { total: 0, new: new Set() };
      }
      
      if (!acc.allCustomers) {
        acc.allCustomers = new Set();
      }
      
      if (!acc.allCustomers.has(customerId)) {
        acc[date].new.add(customerId);
      }
      
      acc.allCustomers.add(customerId);
      acc[date].total = acc.allCustomers.size;
      
      return acc;
    }, { allCustomers: new Set() } as Record<string, any>);

    // 获取最近30天日期范围
    const last30Days = Array.from({ length: 30 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - i);
      return date.toISOString().split('T')[0];
    }).reverse();

    // 格式化数据，确保每天都有数据
    const dailyCustomerGrowth = last30Days.map(date => {
      const dayData = customerGrowth[date] || { total: 0, new: new Set() };
      return {
        date,
        total: dayData.total || 0,
        new: dayData.new?.size || 0
      };
    });

    // 计算户集中度分析
    type CustomerEntry = [string, CustomerAnalysis];

    const customerEntries = Object.entries(customerAnalysis) as CustomerEntry[];
    const customerConcentration = customerEntries
      .sort(([, a], [, b]) => b.totalAmount - a.totalAmount)
      .reduce((acc, [, customer], index) => {
        const percentage = ((index + 1) / customerEntries.length) * 100;
        const revenuePercentage = (customer.totalAmount / totalRevenue) * 100;
        acc.push({
          customerPercentage: Math.floor(percentage),
          revenuePercentage: revenuePercentage
        });
        return acc;
      }, [] as Array<{ customerPercentage: number; revenuePercentage: number }>);

    // 获取所有相关用户的 openid
    const openids = Array.from(new Set(orders.map(order => order._openid)));

    // 批量获取用户信息
    const usersResult = await db.collection('users')
      .where({
        _openid: _.in(openids)
      })
      .limit(2000)
      .get();

    // 修改用户信息映射的数据结构
    const userMap = new Map<string, UserInfo>(
      usersResult.data.map(user => [
        user._openid,
        {
          userStoreName: user.userStoreName || "未知店家",
          salesPerson: user.salesPerson || "未知业务员",
          createTime: user.createTime || new Date()
        }
      ])
    );

    // 1. 先计算店家订单统计
    const storeOrderStats = orders.reduce((acc, order) => {
      if (order.payStatus === 'PAID' && order.orderStatus !== 80) {
        const userInfo = userMap.get(order._openid);
        const storeName = userInfo?.userStoreName || "未知店家";
        if (!acc[storeName]) {
          acc[storeName] = {
            orderCount: 0,
            totalAmount: 0,
            salesPerson: userInfo?.salesPerson || "未知业务员"
          };
        }
        acc[storeName].orderCount += 1;
        acc[storeName].totalAmount += order.paymentAmount;
      }
      return acc;
    }, {} as Record<string, { 
      orderCount: number; 
      totalAmount: number;
      salesPerson: string;
    }>);

    // 2. 生成storeStats数组（确保在使用之前定义）
    const storeStats = (Object.entries(storeOrderStats) as [string, StoreStats][])
      .map(([store, stats]) => ({
        storeName: store,
        orderCount: stats.orderCount,
        totalAmount: stats.totalAmount,
        salesPerson: stats.salesPerson
      }))
      .sort((a, b) => b.orderCount - a.orderCount);

    // 3. 计算店家总数
    const totalStores = storeStats.length;

    // 4. 计算业务员分析
    const salesmanAnalysis = orders.reduce((acc, order) => {
      const userInfo = userMap.get(order._openid);
      if (!userInfo) return acc;
      
      const salesPerson = userInfo.salesPerson;
      const storeName = userInfo.userStoreName;
      
      if (!acc[salesPerson]) {
        acc[salesPerson] = {
          totalAmount: 0,
          orderCount: 0,
          stores: new Set<string>(),
          newStores: new Set<string>(),
          repurchaseStores: new Set<string>(),
          orderDates: new Map<string, Set<string>>()
        };
      }
      
      acc[salesPerson].totalAmount += order.paymentAmount;
      acc[salesPerson].orderCount += 1;
      acc[salesPerson].stores.add(storeName);
      
      if (!acc[salesPerson].orderDates.has(storeName)) {
        acc[salesPerson].orderDates.set(storeName, new Set());
      }
      const orderDate = new Date(order.createTime).toISOString().split('T')[0];
      acc[salesPerson].orderDates.get(storeName)?.add(orderDate);
      
      return acc;
    }, {} as Record<string, {
      totalAmount: number;
      orderCount: number;
      stores: Set<string>;
      newStores: Set<string>;
      repurchaseStores: Set<string>;
      orderDates: Map<string, Set<string>>;
    }>);

    // 5. 计算新店和复购数据
    (Object.entries(salesmanAnalysis) as [string, SalesmanData][]).forEach(([salesman, data]) => {
      data.stores.forEach(storeName => {
        const userInfo = Array.from(userMap.values())
          .find(info => info.userStoreName === storeName);
        
        if (userInfo && new Date(userInfo.createTime) > thirtyDaysAgoDate) {
          data.newStores.add(storeName);
        }
      });
      
      data.orderDates.forEach((dates, store) => {
        if (dates.size > 1) {
          data.repurchaseStores.add(store);
        }
      });
    });

    // 6. 格式化业务员统计数据
    const salesmanStats = (Object.entries(salesmanAnalysis) as [string, SalesmanData][])
      .filter(([salesman]) => salesman !== "未知业务员")
      .map(([salesman, data]) => ({
        salesman,
        totalAmount: data.totalAmount,
        orderCount: data.orderCount,
        storeCount: data.stores.size,
        newStoreCount: data.newStores.size,
        repurchaseStoreCount: data.repurchaseStores.size,
        repurchaseCount: Array.from(data.orderDates.values())
          .reduce((sum, dates) => sum + Math.max(0, dates.size - 1), 0), // 计算总复购次数
        averageAmountPerStore: data.totalAmount / data.stores.size || 0,
        repurchaseRate: (data.repurchaseStores.size / data.stores.size * 100).toFixed(1)
      }))
      .sort((a, b) => b.totalAmount - a.totalAmount);

    // 7. 返回数据
    return NextResponse.json({
      success: true,
      data: {
        totalOrders,
        totalRevenue,
        averageOrderValue,
        totalProducts,
        recentOrders: {
          dates: last7Days,
          values: last7Days.map(date => ordersByDate[date] || 0),
        },
        productCategories: {
          labels: Object.keys(categoryCount),
          data: Object.values(categoryCount),
        },
        topProducts: {
          names: topProducts.map(([name]) => name),
          amounts: topProducts.map(([, data]) => data.salesAmount),
        },
        additionalMetrics: {
          hourlyDistribution: Array.from({ length: 24 }, (_, i) => ({
            hour: i,
            amount: hourlyDistribution[i] || 0
          })),
          topCombinations: (Object.entries(productCombinations) as [string, number][])
            .sort(([, a], [, b]) => b - a)
            .slice(0, 20)
            .map(([combo, count]) => ({
              products: combo.split('_'),
              count
            })),
          slowMovingProducts: productSalesInLast30Days.slice(0, 20),
          customerValueRanges: Object.entries(customerValueRanges)
            .sort(([a], [b]) => Number(a) - Number(b))
            .map(([range, count]) => ({
              range: Number(range),
              count
            })),
          regionDistribution: sortedRegionDistribution,
          topBrands: topBrands.map(brand => ({
            name: brand.brand,
            salesAmount: brand.salesAmount,
            quantity: brand.quantity,
            productCount: brand.productCount
          })),
          slowMovingBrands: slowMovingBrands.map(brand => ({
            name: brand.brand,
            averageSales: brand.averageSalesPerProduct,
            productCount: brand.productCount,
            totalSales: brand.salesAmount
          })),
          categoryTrends: (Object.entries(categoryTrends) as Array<[string, CategoryTrendData]>)
            .map(([month, data]) => ({
              month,
              shares: Object.entries(data.categories).map(([category, amount]) => ({
                category,
                share: (amount / data.total) * 100
              }))
            })),
          topCategoryCombos: (Object.entries(categoryCombinations) as [string, number][])
            .sort(([, a], [, b]) => b - a)
            .slice(0, 10)
            .map(([combo, amount]) => ({
              categories: combo.split('_'),
              amount
            })),
          customerGrowth: dailyCustomerGrowth,
          customerConcentration,
          storeAnalysis: {
            totalStores,
            storeStats
          },
          salesmanStats
        }
      }
    });
  } catch (error) {
    console.error('获取看板数据失败:', error);
    return NextResponse.json({ success: false, error: '获取失败' }, { status: 500 });
  }
} 