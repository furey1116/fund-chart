import { FundOperation } from '@/types/fundOperation';
import { User, LoginRequest, RegisterRequest } from '@/types/user';
import { ApiRouteDriver } from './api-route-driver';
import { LocalStorageDriver } from './local-storage-driver';
import { PrismaDriver } from './prisma-driver';

// 数据库操作接口
export interface DatabaseDriver {
  saveFundOperation(operation: FundOperation): Promise<boolean>;
  getFundOperations(fundCode: string, userId?: string): Promise<FundOperation[]>;
  getAllFundOperations(userId: string): Promise<FundOperation[]>;
  deleteFundOperation(fundCode: string, operationId: string, userId: string): Promise<boolean>;
  registerUser(userData: RegisterRequest): Promise<User | null>;
  loginUser(credentials: LoginRequest): Promise<User | null>;
  getUserById(userId: string): Promise<User | null>;
  updateUserLastLogin(userId: string): Promise<boolean>;
  migrateData?(source: DatabaseDriver): Promise<boolean>;
}

// 获取数据库驱动实例
export function getDatabaseDriver(): DatabaseDriver {
  // 检查环境变量或其他配置以决定使用哪个驱动
  // 这里我们默认使用Prisma驱动
  return new PrismaDriver();
}

// 数据库迁移助手
export async function migrateDatabase(
  source: DatabaseDriver, 
  target: DatabaseDriver,
  fundCodes: string[],
  userId: string
): Promise<{success: boolean, message: string}> {
  try {
    let totalOperations = 0;
    
    // 遍历所有基金代码
    for (const fundCode of fundCodes) {
      // 获取源数据库中的操作记录
      const operations = await source.getFundOperations(fundCode, userId);
      
      if (operations.length === 0) continue;
      
      // 逐个保存到目标数据库
      for (const operation of operations) {
        await target.saveFundOperation(operation);
        totalOperations++;
      }
    }
    
    return {
      success: true,
      message: `成功迁移 ${totalOperations} 条操作记录`
    };
  } catch (error) {
    console.error('数据迁移失败:', error);
    return {
      success: false,
      message: `迁移失败: ${error instanceof Error ? error.message : String(error)}`
    };
  }
} 