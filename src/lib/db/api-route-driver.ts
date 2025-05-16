import { FundOperation } from '@/types/fundOperation';
import { User, LoginRequest, RegisterRequest } from '@/types/user';
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
  
  async getFundOperations(fundCode: string, userId?: string): Promise<FundOperation[]> {
    try {
      // 通过API路由获取操作记录
      let url = `/api/fund-operations?fundCode=${fundCode}`;
      if (userId) {
        url += `&userId=${userId}`;
      }
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`获取失败: ${response.status}`);
      }
      
      return await response.json() as FundOperation[];
    } catch (error) {
      console.error('Failed to get operations via API:', error);
      return [];
    }
  }
  
  async getAllFundOperations(userId: string): Promise<FundOperation[]> {
    try {
      // 通过API路由获取所有操作记录
      const response = await fetch(`/api/fund-operations/all?userId=${userId}`);
      
      if (!response.ok) {
        throw new Error(`获取所有操作失败: ${response.status}`);
      }
      
      return await response.json() as FundOperation[];
    } catch (error) {
      console.error('Failed to get all operations via API:', error);
      return [];
    }
  }
  
  async deleteFundOperation(fundCode: string, operationId: string, userId: string): Promise<boolean> {
    try {
      // 通过API路由删除操作记录
      const response = await fetch(`/api/fund-operations?fundCode=${fundCode}&operationId=${operationId}&userId=${userId}`, {
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
  
  // 用户注册方法
  async registerUser(userData: RegisterRequest): Promise<User | null> {
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      });
      
      if (!response.ok) {
        throw new Error(`注册失败: ${response.status}`);
      }
      
      return await response.json() as User;
    } catch (error) {
      console.error('Failed to register user via API:', error);
      return null;
    }
  }
  
  async loginUser(credentials: LoginRequest): Promise<User | null> {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
      });
      
      if (!response.ok) {
        throw new Error(`登录失败: ${response.status}`);
      }
      
      return await response.json() as User;
    } catch (error) {
      console.error('Failed to login user via API:', error);
      return null;
    }
  }
  
  async getUserById(userId: string): Promise<User | null> {
    try {
      const response = await fetch(`/api/auth/user?userId=${userId}`);
      
      if (!response.ok) {
        throw new Error(`获取用户失败: ${response.status}`);
      }
      
      return await response.json() as User;
    } catch (error) {
      console.error('Failed to get user via API:', error);
      return null;
    }
  }
  
  async updateUserLastLogin(userId: string): Promise<boolean> {
    try {
      const response = await fetch(`/api/auth/login-update?userId=${userId}`, {
        method: 'PUT',
      });
      
      if (!response.ok) {
        throw new Error(`更新最后登录时间失败: ${response.status}`);
      }
      
      const result = await response.json();
      return result.success === true;
    } catch (error) {
      console.error('Failed to update last login via API:', error);
      return false;
    }
  }
} 