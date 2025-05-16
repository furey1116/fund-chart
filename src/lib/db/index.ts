import { FundOperation } from '@/types/fundOperation';
import { DatabaseDriver, getDatabaseDriver, migrateDatabase } from './database-driver';
import { ApiRouteDriver } from './api-route-driver';
import { LocalStorageDriver } from './local-storage-driver';

// 导出统一的数据库接口函数
export async function saveFundOperation(operation: FundOperation): Promise<boolean> {
  const driver = getDatabaseDriver();
  return await driver.saveFundOperation(operation);
}

export async function getFundOperations(fundCode: string, userId?: string): Promise<FundOperation[]> {
  const driver = getDatabaseDriver();
  return await driver.getFundOperations(fundCode, userId);
}

export async function getAllFundOperations(userId: string): Promise<FundOperation[]> {
  const driver = getDatabaseDriver();
  return await driver.getAllFundOperations(userId);
}

export async function deleteFundOperation(fundCode: string, operationId: string, userId: string): Promise<boolean> {
  const driver = getDatabaseDriver();
  return await driver.deleteFundOperation(fundCode, operationId, userId);
}

// 导出接口、类型、工具函数和驱动类
export type { DatabaseDriver };
export { getDatabaseDriver, migrateDatabase };
export { ApiRouteDriver, LocalStorageDriver }; 