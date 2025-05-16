import { FundOperation } from '@/types/fundOperation';
import { DatabaseDriver } from './database-driver';

// 本地数据库驱动实现（使用localStorage模拟）
export class LocalStorageDriver implements DatabaseDriver {
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
  
  async deleteFundOperation(fundCode: string, operationId: string): Promise<boolean> {
    try {
      // 获取现有操作记录
      const existingOperations = await this.getFundOperations(fundCode);
      
      // 过滤掉要删除的操作
      const filteredOperations = existingOperations.filter(op => op.id !== operationId);
      
      // 如果没有找到要删除的记录
      if (filteredOperations.length === existingOperations.length) {
        return false;
      }
      
      // 保存更新后的操作列表
      localStorage.setItem(
        this.getStorageKey(fundCode),
        JSON.stringify(filteredOperations)
      );
      
      return true;
    } catch (error) {
      console.error('Failed to delete operation from localStorage:', error);
      return false;
    }
  }
} 