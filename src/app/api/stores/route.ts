import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import type { Store } from '@/app/delivery-planning/types';
import storeListData from '@/app/delivery-planning/files/store1227.json';

const STORE_LOCATIONS_FILE = path.join(process.cwd(), 'src/app/delivery-planning/data/storeLocations.json');

interface StoreLocations {
  stores: Store[];
  unlocatedStores: Store[];
}

interface AMapGeoResponse {
  status: string;
  info: string;
  infocode: string;
  count: string;
  geocodes: Array<{
    location: string;
    formatted_address: string;
  }>;
}

/**
 * 生成唯一ID
 */
function generateId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

/**
 * 地理编码
 */
async function geocodeAddress(address: string): Promise<{ latitude: number; longitude: number } | null> {
  try {
    // 使用内部 geocode API
    const url = new URL('/api/geocode', 'http://localhost:3000');
    url.searchParams.append('address', address);
    url.searchParams.append('city', '杭州');

    console.log('发送地理编码请求:', url.toString());
    const response = await fetch(url.toString());
    const data = await response.json();

    if (!response.ok) {
      console.error('地理编码请求失败:', data.error);
      return null;
    }

    if (data.status === '1' && data.geocodes?.length > 0) {
      const [longitude, latitude] = data.geocodes[0].location.split(',').map(Number);
      console.log('地理编码成功:', { address, latitude, longitude });
      return { latitude, longitude };
    }

    console.warn('地理编码未找到结果:', { address, data });
    return null;
  } catch (error) {
    console.error('地理编码失败:', error);
    return null;
  }
}

/**
 * 验证位置是否在合理范围内
 * 杭州湖州大致范围：
 * 纬度: 30.0 - 31.0
 * 经度: 119.5 - 120.5
 */
function isValidLocation(location: { latitude: number; longitude: number }): boolean {
  return (
    location.latitude >= 30.0 && 
    location.latitude <= 31.0 &&
    location.longitude >= 119.5 && 
    location.longitude <= 120.5
  );
}

/**
 * 处理原始店铺数据
 */
async function processRawStores(): Promise<Store[]> {
  const stores: Store[] = [];
  const processedAddresses = new Set<string>(); // 用于去重
  
  // 分批处理，每批3个请求
  const BATCH_SIZE = 3;
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
  
  console.log('开始处理店铺数据, 总数:', storeListData.length);
  
  for (let i = 0; i < storeListData.length; i += BATCH_SIZE) {
    const batch = storeListData.slice(i, i + BATCH_SIZE);
    console.log(`处理第 ${i + 1} - ${Math.min(i + BATCH_SIZE, storeListData.length)} 条数据`);
    
    const batchPromises = batch.map(async (item) => {
      if (!item.khmc || !item.khdz) {
        console.log('跳过无效数据:', item);
        return;
      }

      const name = item.khmc.trim();
      const address = item.khdz.trim();
      
      // 去重处理
      const key = `${name}|${address}`;
      if (processedAddresses.has(key)) {
        console.log('跳过重复店铺:', { name, address });
        return;
      }
      processedAddresses.add(key);

      const store: Store = {
        id: generateId(),
        name,
        address
      };

      // 尝试地理编码
      const location = await geocodeAddress(store.address);
      if (location && isValidLocation(location)) {
        store.location = location;
        console.log('店铺定位成功:', { name: store.name, address: store.address, location });
      } else {
        if (location) {
          console.warn('店铺定位结果超出合理范围:', { name: store.name, address: store.address, location });
        } else {
          console.warn('店铺定位失败:', { name: store.name, address: store.address });
        }
      }

      return store;
    });

    const batchResults = await Promise.all(batchPromises);
    stores.push(...batchResults.filter((store): store is Store => store !== undefined));

    // 每批之间等待1秒，避免请求过于频繁
    if (i + BATCH_SIZE < storeListData.length) {
      console.log('等待下一批处理...');
      await delay(1000);
    }
  }

  return stores;
}

// GET /api/stores
export async function GET() {
  try {
    // 读取店铺定位信息
    let storeLocations: StoreLocations = { stores: [], unlocatedStores: [] };
    try {
      const data = await fs.readFile(STORE_LOCATIONS_FILE, 'utf-8');
      storeLocations = JSON.parse(data);
      console.log('读取已有定位信息:', {
        已定位: storeLocations.stores.length,
        未定位: storeLocations.unlocatedStores.length
      });
    } catch (error) {
      console.warn('读取店铺定位信息失败:', error);
    }

    // 处理原始数据
    const stores = await processRawStores();
    console.log('处理原始数据完成, 总数:', stores.length);

    // 处理每个店铺
    const locatedMap = new Map(storeLocations.stores.map(store => [store.address, store]));
    const newStores: Store[] = [];
    const newUnlocatedStores: Store[] = [];

    for (const store of stores) {
      if (store.location && isValidLocation(store.location)) {
        // 如果成功获取到位置信息且在合理范围内，加入已定位列表
        newStores.push(store);
      } else if (locatedMap.has(store.address)) {
        // 如果之前已经定位过，验证位置是否合理
        const locatedStore = locatedMap.get(store.address)!;
        if (locatedStore.location && isValidLocation(locatedStore.location)) {
          newStores.push({
            ...store,
            id: locatedStore.id,
            location: locatedStore.location
          });
        } else {
          newUnlocatedStores.push(store);
        }
      } else {
        // 未能定位的店铺
        newUnlocatedStores.push(store);
      }
    }

    // 保存更新后的定位信息
    await fs.writeFile(
      STORE_LOCATIONS_FILE, 
      JSON.stringify({ stores: newStores, unlocatedStores: newUnlocatedStores }, null, 2)
    );

    console.log('保存定位信息完成:', {
      已定位: newStores.length,
      未定位: newUnlocatedStores.length,
      定位成功率: `${((newStores.length / stores.length) * 100).toFixed(1)}%`
    });

    return NextResponse.json({
      success: true,
      stores: newStores,
      unlocatedStores: newUnlocatedStores
    });
  } catch (error) {
    console.error('处理店铺数据失败:', error);
    return NextResponse.json({
      success: false,
      error: '处理店铺数据失败: ' + (error instanceof Error ? error.message : String(error))
    }, { status: 500 });
  }
} 