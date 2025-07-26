import { pinyin } from 'pinyin-pro';

export const salesPersonMap: Record<string, string> = {
  '847392': '张倩倩',
  '156234': '赵志忠',
  '739481': '魏经选',
  '628451': '李傲然',
  '394756': '李兵',
  '582647': '刘飞',
  '916374': '赵智国',
  '473819': '陈华',
  '285946': '纪中乐',
  '647193': '李伟斌',
  '528461': '王亮亮',
  '374851': '王从洁',
  '194627': '王俊男',
  '836492': '杨晓',
  '729384': '杨雪峰',
  '463728': '王盼盼',
  '591837': '杨春红',
  '313049': '陈俊辉',
  '497192': '张世虎',
  '897979': '姚雨轩',
};

// Generates the login key for a salesperson (e.g., 847392zqq)
const generateLoginKey = (id: string, name: string): string => {
  const namePinyin = pinyin(name, { pattern: 'first', toneType: 'none' }).replace(/\s/g, '');
  return `${id}${namePinyin}`;
};

// Validates an access key and returns user info if successful
export const validateAccessKey = (key: string): { role: 'admin' | 'salesperson'; id: string | null } | null => {
  // Admin check
  if (key === 'chaodan2025') {
    return { role: 'admin', id: 'admin' };
  }

  // Salesperson check
  for (const [id, name] of Object.entries(salesPersonMap)) {
    if (key === generateLoginKey(id, name)) {
      return { role: 'salesperson', id };
    }
  }

  return null;
}; 