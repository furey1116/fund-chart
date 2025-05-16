import { FundOperation } from '@/types/fundOperation';

// 数据库操作接口
interface DatabaseDriver {
  saveFundOperation(operation: FundOperation): Promise<boolean>;
  getFundOperations(fundCode: string): Promise<FundOperation[]>;
}

// 使用API路由的Vercel Blob数据库驱动
class ApiRouteDriver implements DatabaseDriver {
  async saveFundOperation(operation: FundOperation): Promise<boolean> {
    try {
      // 通过API路由保存操作记录
      const response = await fetch('/api/fund-operations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(operation),
      });
      
      if (!response.ok) {
        throw new Error(`保存失败: ${response.status}`);
      }
      
      const result = await response.json();
      return result.success === true;
    } catch (error) {
      console.error('Failed to save operation via API:', error);
      return false;
    }
  }
  
  async getFundOperations(fundCode: string): Promise<FundOperation[]> {
    try {
      // 通过API路由获取操作记录
      const response = await fetch(`/api/fund-operations?fundCode=${fundCode}`);
      
      if (!response.ok) {
        throw new Error(`获取失败: ${response.status}`);
      }
      
      return await response.json() as FundOperation[];
    } catch (error) {
      console.error('Failed to get operations via API:', error);
      return [];
    }
  }
}

// 本地数据库驱动实现（使用localStorage模拟）
class LocalStorageDriver implements DatabaseDriver {
  private getStorageKey(fundCode: string): string {
    return `fund_operations_${fundCode}`;
  }
  
  async saveFundOperation(operation: FundOperation): Promise<boolean> {
    try {
      // 获取现有操作记录
      const existingOperations = await this.getFundOperations(operation.fundCode);
      
      // 添加新操作
      const updatedOperations = [...existingOperations, operation];
      
      // 保存到localStorage
      localStorage.setItem(
        this.getStorageKey(operation.fundCode),
        JSON.stringify(updatedOperations)
      );
      
      return true;
    } catch (error) {
      console.error('Failed to save to localStorage:', error);
      return false;
    }
  }
  
  async getFundOperations(fundCode: string): Promise<FundOperation[]> {
    try {
      const data = localStorage.getItem(this.getStorageKey(fundCode));
      if (!data) return [];
      return JSON.parse(data) as FundOperation[];
    } catch (error) {
      console.error('Failed to get data from localStorage:', error);
      return [];
    }
  }
}

// 工厂函数，根据环境返回适当的数据库驱动
export function getDatabaseDriver(): DatabaseDriver {
  // 检查是否在浏览器环境中运行
  if (typeof window === 'undefined') {
    // 服务器端不能使用localStorage，返回API路由驱动
    return new ApiRouteDriver();
  }
  
  // 检查是否在Vercel环境或者生产环境
  const isVercelOrProduction = 
    process.env.NEXT_PUBLIC_VERCEL_ENV || 
    process.env.VERCEL_ENV || 
    process.env.NODE_ENV === 'production';
  
  // 如果是Vercel或生产环境，使用API路由驱动
  if (isVercelOrProduction) {
    return new ApiRouteDriver();
  }
  
  // 本地开发环境使用localStorage
  return new LocalStorageDriver();
}

// 导出统一的数据库接口函数
export async function saveFundOperation(operation: FundOperation): Promise<boolean> {
  const driver = getDatabaseDriver();
  return await driver.saveFundOperation(operation);
}

export async function getFundOperations(fundCode: string): Promise<FundOperation[]> {
  const driver = getDatabaseDriver();
  return await driver.getFundOperations(fundCode);
} 