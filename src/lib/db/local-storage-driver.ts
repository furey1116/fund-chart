import { FundOperation } from '@/types/fundOperation';
import { User, LoginRequest, RegisterRequest } from '@/types/user';
import { DatabaseDriver } from './database-driver';
import { createUser } from '@/types/user';
import bcrypt from 'bcryptjs';

// 本地数据库驱动实现（使用localStorage模拟）
export class LocalStorageDriver implements DatabaseDriver {
  private getOperationsStorageKey(fundCode: string): string {
    return `fund_operations_${fundCode}`;
  }
  
  private getUsersStorageKey(): string {
    return 'fund_app_users';
  }

  private getUserByIdStorageKey(userId: string): string {
    return `fund_app_user_${userId}`;
  }
  
  // 保存操作记录
  async saveFundOperation(operation: FundOperation): Promise<boolean> {
    try {
      // 获取现有操作记录
      const existingOperations = await this.getFundOperations(operation.fundCode, operation.userId);
      
      // 添加新操作
      const updatedOperations = [...existingOperations, operation];
      
      // 保存到localStorage
      localStorage.setItem(
        this.getOperationsStorageKey(operation.fundCode),
        JSON.stringify(updatedOperations)
      );
      
      return true;
    } catch (error) {
      console.error('Failed to save to localStorage:', error);
      return false;
    }
  }
  
  async getFundOperations(fundCode: string, userId?: string): Promise<FundOperation[]> {
    try {
      const data = localStorage.getItem(this.getOperationsStorageKey(fundCode));
      if (!data) return [];
      
      const operations = JSON.parse(data) as FundOperation[];
      
      // 如果提供了用户ID，过滤掉不属于该用户的操作
      if (userId) {
        return operations.filter(op => op.userId === userId);
      }
      
      return operations;
    } catch (error) {
      console.error('Failed to get data from localStorage:', error);
      return [];
    }
  }
  
  async getAllFundOperations(userId: string): Promise<FundOperation[]> {
    try {
      // 获取localStorage中所有键
      const allKeys = Object.keys(localStorage);
      
      // 过滤出所有与基金操作相关的键
      const fundOperationKeys = allKeys.filter(key => key.startsWith('fund_operations_'));
      
      // 收集所有操作
      let allOperations: FundOperation[] = [];
      
      for (const key of fundOperationKeys) {
        const data = localStorage.getItem(key);
        if (data) {
          const operations = JSON.parse(data) as FundOperation[];
          // 过滤出属于该用户的操作
          const userOperations = operations.filter(op => op.userId === userId);
          allOperations.push(...userOperations);
        }
      }
      
      // 按操作日期排序
      return allOperations.sort((a, b) => 
        new Date(b.operationDate).getTime() - new Date(a.operationDate).getTime()
      );
    } catch (error) {
      console.error('Failed to get all fund operations:', error);
      return [];
    }
  }
  
  async deleteFundOperation(fundCode: string, operationId: string, userId: string): Promise<boolean> {
    try {
      // 获取现有操作记录
      const existingOperations = await this.getFundOperations(fundCode);
      
      // 过滤掉要删除的操作，并保留其他用户的操作
      const filteredOperations = existingOperations.filter(
        op => !(op.id === operationId && op.userId === userId)
      );
      
      // 如果没有找到要删除的记录
      if (filteredOperations.length === existingOperations.length) {
        return false;
      }
      
      // 保存更新后的操作列表
      localStorage.setItem(
        this.getOperationsStorageKey(fundCode),
        JSON.stringify(filteredOperations)
      );
      
      return true;
    } catch (error) {
      console.error('Failed to delete operation from localStorage:', error);
      return false;
    }
  }

  // 用户相关方法
  async registerUser(userData: RegisterRequest): Promise<User | null> {
    try {
      // 获取现有用户列表
      const existingUsers = this.getUsers();
      
      // 检查用户名是否已存在
      const userExists = existingUsers.some(user => user.username === userData.username);
      if (userExists) {
        console.error('Username already exists');
        return null;
      }
      
      // 生成密码哈希
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(userData.password, salt);
      
      // 创建新用户
      const newUser = createUser({
        username: userData.username,
        password: hashedPassword,
        displayName: userData.displayName,
        email: userData.email
      });
      
      // 将新用户添加到用户列表
      existingUsers.push(newUser);
      localStorage.setItem(this.getUsersStorageKey(), JSON.stringify(existingUsers));
      
      // 保存用户信息
      localStorage.setItem(
        this.getUserByIdStorageKey(newUser.id),
        JSON.stringify(newUser)
      );
      
      // 返回用户信息，不包括密码
      const { password, ...userWithoutPassword } = newUser;
      return userWithoutPassword as User;
    } catch (error) {
      console.error('Failed to register user:', error);
      return null;
    }
  }
  
  async loginUser(credentials: LoginRequest): Promise<User | null> {
    try {
      // 获取所有用户
      const users = this.getUsers();
      
      // 查找用户
      const user = users.find(user => user.username === credentials.username);
      if (!user) {
        return null;
      }
      
      // 验证密码
      const isPasswordValid = await bcrypt.compare(credentials.password, user.password);
      if (!isPasswordValid) {
        return null;
      }
      
      // 更新最近一次登录时间
      this.updateUserLastLogin(user.id);
      
      // 返回用户信息，不包括密码
      const { password, ...userWithoutPassword } = user;
      return userWithoutPassword as User;
    } catch (error) {
      console.error('Failed to login user:', error);
      return null;
    }
  }
  
  async getUserById(userId: string): Promise<User | null> {
    try {
      // 尝试从缓存中获取用户
      const cachedUser = localStorage.getItem(this.getUserByIdStorageKey(userId));
      if (cachedUser) {
        const user = JSON.parse(cachedUser) as User;
        const { password, ...userWithoutPassword } = user;
        return userWithoutPassword as User;
      }
      
      // 如果缓存中没有，从用户列表中查找
      const users = this.getUsers();
      const user = users.find(user => user.id === userId);
      
      if (!user) {
        return null;
      }
      
      // 返回用户信息，不包括密码
      const { password, ...userWithoutPassword } = user;
      return userWithoutPassword as User;
    } catch (error) {
      console.error('Failed to get user by ID:', error);
      return null;
    }
  }
  
  async updateUserLastLogin(userId: string): Promise<boolean> {
    try {
      // 获取所有用户
      const users = this.getUsers();
      
      // 查找要更新的用户
      const userIndex = users.findIndex(user => user.id === userId);
      if (userIndex === -1) {
        return false;
      }
      
      // 更新最近一次登录时间
      users[userIndex].lastLoginAt = new Date().toISOString();
      
      // 保存用户列表
      localStorage.setItem(this.getUsersStorageKey(), JSON.stringify(users));
      
      // 保存用户信息
      localStorage.setItem(
        this.getUserByIdStorageKey(userId),
        JSON.stringify(users[userIndex])
      );
      
      return true;
    } catch (error) {
      console.error('Failed to update user last login:', error);
      return false;
    }
  }
  
  private getUsers(): User[] {
    const data = localStorage.getItem(this.getUsersStorageKey());
    if (!data) return [];
    return JSON.parse(data) as User[];
  }
} 