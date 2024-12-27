import type { ImportResponse } from '../types';

/**
 * 解析店铺列表JSON文件
 */
export async function parseStoreListJson(): Promise<ImportResponse> {
  try {
    const response = await fetch('/api/stores');
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || '请求失败');
    }

    return result;
  } catch (error) {
    console.error('解析店铺列表失败:', error);
    return {
      success: false,
      error: '解析店铺列表失败: ' + (error instanceof Error ? error.message : String(error))
    };
  }
} 