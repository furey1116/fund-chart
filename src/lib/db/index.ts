import { FundOperation } from '@/types/fundOperation';
import { DatabaseDriver, getDatabaseDriver, migrateDatabase } from './database-driver';
import { ApiRouteDriver } from './api-route-driver';
import { LocalStorageDriver } from './local-storage-driver';

// 导出统一的数据库接口函数
export async function saveFundOperation(operation: FundOperation): Promise<boolean> {
  const driver = getDatabaseDriver();
  return await driver.saveFundOperation(operation);
}

export async function getFundOperations(fundCode: string): Promise<FundOperation[]> {
  const driver = getDatabaseDriver();
  return await driver.getFundOperations(fundCode);
}

export async function deleteFundOperation(fundCode: string, operationId: string): Promise<boolean> {
  const driver = getDatabaseDriver();
  return await driver.deleteFundOperation(fundCode, operationId);
}

// 导出接口、类型、工具函数和驱动类
export type { DatabaseDriver };
export { getDatabaseDriver, migrateDatabase };
export { ApiRouteDriver, LocalStorageDriver }; 