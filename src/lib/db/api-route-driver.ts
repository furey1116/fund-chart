import { FundOperation } from '@/types/fundOperation';
import { DatabaseDriver } from './database-driver';

// 使用API路由的Vercel Blob数据库驱动
export class ApiRouteDriver implements DatabaseDriver {
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
  
  async deleteFundOperation(fundCode: string, operationId: string): Promise<boolean> {
    try {
      // 通过API路由删除操作记录
      const response = await fetch(`/api/fund-operations?fundCode=${fundCode}&operationId=${operationId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error(`删除失败: ${response.status}`);
      }
      
      const result = await response.json();
      return result.success === true;
    } catch (error) {
      console.error('Failed to delete operation via API:', error);
      return false;
    }
  }
} 