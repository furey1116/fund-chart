import { FundOperation } from '@/types/fundOperation';

// 数据库操作接口
interface DatabaseDriver {
  saveFundOperation(operation: FundOperation): Promise<boolean>;
  getFundOperations(fundCode: string): Promise<FundOperation[]>;
}

// Vercel Blob 数据库驱动实现
class VercelBlobDriver implements DatabaseDriver {
  private async getBlob(fundCode: string): Promise<FundOperation[]> {
    try {
      // 动态导入 @vercel/blob 包，避免在本地环境中报错
      const vercelBlob = await import('@vercel/blob');
      
      interface BlobItem {
        url: string;
        uploadedAt: string;
        pathname: string;
      }
      
      // 查找该基金的所有操作记录文件
      const { blobs } = await vercelBlob.list({
        prefix: `fundOperations/${fundCode}/`,
      });
      
      if (blobs.length === 0) {
        return [];
      }
      
      // 获取最新的操作记录文件
      const latestBlob = (blobs as BlobItem[]).sort((a, b) => 
        new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
      )[0];
      
      // 获取文件内容
      const response = await fetch(latestBlob.url);
      if (!response.ok) return [];
      
      const text = await response.text();
      return JSON.parse(text) as FundOperation[];
    } catch (error) {
      console.error('Failed to get data from Vercel Blob:', error);
      return [];
    }
  }
  
  async saveFundOperation(operation: FundOperation): Promise<boolean> {
    try {
      // 获取现有操作记录
      const existingOperations = await this.getFundOperations(operation.fundCode);
      
      // 添加新操作
      const updatedOperations = [...existingOperations, operation];
      
      // 动态导入 @vercel/blob 包
      const vercelBlob = await import('@vercel/blob');
      
      // 保存更新后的操作记录
      const fileName = `fundOperations/${operation.fundCode}/${Date.now()}.json`;
      await vercelBlob.put(fileName, JSON.stringify(updatedOperations), {
        access: 'public',
      });
      
      return true;
    } catch (error) {
      console.error('Failed to save to Vercel Blob:', error);
      return false;
    }
  }
  
  async getFundOperations(fundCode: string): Promise<FundOperation[]> {
    return await this.getBlob(fundCode);
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
  // 检查是否在 Vercel 环境中（通过环境变量判断）
  const isVercelEnvironment = process.env.NEXT_PUBLIC_VERCEL_ENV || 
                             process.env.VERCEL_ENV;
  
  // 如果是在浏览器环境中运行且不是Vercel环境，使用localStorage
  if (typeof window !== 'undefined' && !isVercelEnvironment) {
    return new LocalStorageDriver();
  }
  
  // 否则使用Vercel Blob存储
  return new VercelBlobDriver();
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