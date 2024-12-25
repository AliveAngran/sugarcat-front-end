import * as XLSX from 'xlsx';
import type { Store } from '../types';
import { geocodeAddress } from '../components/AMapContainer';
import storeListData from '../files/storelist_1225.json';

interface ParseResult {
  success: boolean;
  stores?: Store[];
  error?: string;
}

// 延时函数
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// 分批处理函数
const processBatch = async <T>(
  items: T[],
  batchSize: number,
  processItem: (item: T) => Promise<void>
) => {
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    await Promise.all(batch.map(processItem));
    if (i + batchSize < items.length) {
      await delay(1000); // 每批之间等待1秒
    }
  }
};

/**
 * 解析JSON数据
 * @returns 解析结果
 */
export const parseStoreListJson = async (): Promise<ParseResult> => {
  try {
    console.log('开始解析JSON数据, 数据条数:', storeListData.length);
    const stores: Store[] = [];
    
    // 遍历JSON数据
    for (const item of storeListData) {
      if (!item.khmc || !item.khdz) {
        console.log('跳过无效数据:', item);
        continue;
      }

      const store = {
        id: generateId(),
        name: item.khmc.trim(),
        address: item.khdz.trim(),
      };

      stores.push(store);
    }

    console.log('数据处理完成, 有效数据条数:', stores.length);

    if (!stores.length) {
      return {
        success: false,
        error: '未找到有效的地址数据',
      };
    }

    // 在客户端环境下进行地理编码
    if (typeof window !== 'undefined') {
      console.log('开始批量地理编码...');
      
      // 分批处理地理编码请求
      const BATCH_SIZE = 3; // 每批5个请求
      await processBatch(stores, BATCH_SIZE, async (store) => {
        try {
          console.log('处理店铺:', store.name, store.address);
          const location = await geocodeAddress(store.address);
          if (location) {
            console.log('地理编码成功:', location);
            (store as any).location = location;
          } else {
            console.log('地理编码失败: 未获取到坐标');
          }
        } catch (error) {
          console.error('地理编码失败:', error);
        }
      });

      console.log('批量地理编码完成');
    }

    return {
      success: true,
      stores,
    };
  } catch (error) {
    console.error('解析失败:', error);
    return {
      success: false,
      error: '数据解析失败: ' + (error as Error).message,
    };
  }
};

/**
 * 解析Excel/CSV文件
 * @param file 文件对象
 * @returns 解析结果
 */
export const parseAddressFile = async (file: File): Promise<ParseResult> => {
  try {
    const data = await readFileAsArrayBuffer(file);
    const workbook = XLSX.read(data, { type: 'array' });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(worksheet);

    if (!rows.length) {
      return {
        success: false,
        error: '文件内容为空',
      };
    }

    // 验证表头
    const firstRow = rows[0] as any;
    if (!firstRow.name || !firstRow.address) {
      return {
        success: false,
        error: '文件格式错误,请确保包含"name"和"address"列',
      };
    }

    // 解析数据
    const stores: Store[] = [];
    for (const row of rows) {
      const store = {
        id: generateId(),
        name: (row as any).name?.toString().trim(),
        address: (row as any).address?.toString().trim(),
      };

      if (!store.name || !store.address) {
        continue;
      }

      // 地理编码
      try {
        const location = await geocodeAddress(store.address);
        if (location) {
          (store as any).location = location;
        }
      } catch (error) {
        console.error('地理编码失败:', error);
      }

      stores.push(store);
    }

    if (!stores.length) {
      return {
        success: false,
        error: '未找到有效的地址数据',
      };
    }

    return {
      success: true,
      stores,
    };
  } catch (error) {
    return {
      success: false,
      error: '文件解析失败: ' + (error as Error).message,
    };
  }
};

/**
 * 读取文件为ArrayBuffer
 */
const readFileAsArrayBuffer = (file: File): Promise<ArrayBuffer> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      resolve(e.target?.result as ArrayBuffer);
    };
    reader.onerror = (e) => {
      reject(new Error('文件读取失败'));
    };
    reader.readAsArrayBuffer(file);
  });
};

/**
 * 生成唯一ID
 */
const generateId = (): string => {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}; 