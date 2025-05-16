import { FundOperation } from '@/types/fundOperation';
import { User, LoginRequest, RegisterRequest } from '@/types/user';
import { ApiRouteDriver } from './api-route-driver';
import { LocalStorageDriver } from './local-storage-driver';

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
  
  // 本地开发环境判断是否配置了自定义数据库
  const useCustomDb = process.env.NEXT_PUBLIC_USE_CUSTOM_DB === 'true';
  if (useCustomDb) {
    // 如果将来实现了自定义数据库驱动，可以在这里返回
    // return new CustomDatabaseDriver();
    console.warn('自定义数据库驱动尚未实现，回退到localStorage');
  }
  
  // 默认使用localStorage
  return new LocalStorageDriver();
} 