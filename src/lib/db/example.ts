import { FundOperation } from '@/types/fundOperation';

// 示例函数，用于验证导入路径
export async function exampleSaveFundOperation(operation: FundOperation): Promise<boolean> {
  console.log('示例保存函数', operation);
  return true;
}

export async function exampleGetFundOperations(fundCode: string): Promise<FundOperation[]> {
  console.log('示例获取函数', fundCode);
  return [];
}

export async function exampleDeleteFundOperation(fundCode: string, operationId: string): Promise<boolean> {
  console.log('示例删除函数', fundCode, operationId);
  return true;
} 