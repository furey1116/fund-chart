import { FundOperation } from '@/types/fundOperation';
import { User, LoginRequest, RegisterRequest } from '@/types/user';
import { DatabaseDriver } from './database-driver';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

// 使用Prisma的PostgreSQL数据库驱动
export class PrismaDriver implements DatabaseDriver {
  async saveFundOperation(operation: FundOperation): Promise<boolean> {
    try {
      // 将JavaScript日期字符串转换为Date对象
      const operationDate = new Date(operation.operationDate);
      
      // 使用Prisma创建基金操作记录
      await prisma.fundOperation.create({
        data: {
          id: operation.id,
          userId: operation.userId,
          fundCode: operation.fundCode,
          fundName: operation.fundName,
          operationType: operation.operationType,
          operationDate: operationDate,
          price: operation.price,
          shares: operation.shares,
          amount: operation.amount,
          fee: operation.fee,
          holdingShares: operation.holdingShares,
          marketValue: operation.marketValue,
          remark: operation.remark
        }
      });
      
      return true;
    } catch (error) {
      console.error('Failed to save operation via Prisma:', error);
      return false;
    }
  }
  
  async getFundOperations(fundCode: string, userId?: string): Promise<FundOperation[]> {
    try {
      // 构建查询条件
      const whereClause: any = { fundCode };
      if (userId) {
        whereClause.userId = userId;
      }
      
      // 使用Prisma查询基金操作记录
      const operations = await prisma.fundOperation.findMany({
        where: whereClause,
        orderBy: { operationDate: 'desc' }
      });
      
      // 将Prisma模型转换为应用程序类型
      return operations.map(op => ({
        id: op.id,
        userId: op.userId,
        fundCode: op.fundCode,
        fundName: op.fundName,
        operationType: op.operationType as 'buy' | 'sell',
        operationDate: op.operationDate.toISOString().split('T')[0], // 转换为YYYY-MM-DD格式
        price: op.price,
        shares: op.shares,
        amount: op.amount,
        fee: op.fee,
        holdingShares: op.holdingShares || undefined,
        marketValue: op.marketValue || undefined,
        remark: op.remark || undefined,
        createdAt: op.createdAt.toISOString()
      }));
    } catch (error) {
      console.error('Failed to get operations via Prisma:', error);
      return [];
    }
  }
  
  async getAllFundOperations(userId: string): Promise<FundOperation[]> {
    try {
      // 使用Prisma查询用户的所有基金操作记录
      const operations = await prisma.fundOperation.findMany({
        where: { userId },
        orderBy: { operationDate: 'desc' }
      });
      
      // 将Prisma模型转换为应用程序类型
      return operations.map(op => ({
        id: op.id,
        userId: op.userId,
        fundCode: op.fundCode,
        fundName: op.fundName,
        operationType: op.operationType as 'buy' | 'sell',
        operationDate: op.operationDate.toISOString().split('T')[0], // 转换为YYYY-MM-DD格式
        price: op.price,
        shares: op.shares,
        amount: op.amount,
        fee: op.fee,
        holdingShares: op.holdingShares || undefined,
        marketValue: op.marketValue || undefined,
        remark: op.remark || undefined,
        createdAt: op.createdAt.toISOString()
      }));
    } catch (error) {
      console.error('Failed to get all operations via Prisma:', error);
      return [];
    }
  }
  
  async deleteFundOperation(fundCode: string, operationId: string, userId: string): Promise<boolean> {
    try {
      // 使用Prisma删除基金操作记录
      const result = await prisma.fundOperation.deleteMany({
        where: {
          id: operationId,
          fundCode: fundCode,
          userId: userId
        }
      });
      
      return result.count > 0;
    } catch (error) {
      console.error('Failed to delete operation via Prisma:', error);
      return false;
    }
  }
  
  async registerUser(userData: RegisterRequest): Promise<User | null> {
    try {
      // 检查用户名是否已存在
      const existingUser = await prisma.user.findUnique({
        where: { username: userData.username }
      });
      
      if (existingUser) {
        return null; // 用户名已存在
      }
      
      // 加密密码
      const hashedPassword = await bcrypt.hash(userData.password, 10);
      
      // 创建新用户
      const newUser = await prisma.user.create({
        data: {
          username: userData.username,
          password: hashedPassword,
          displayName: userData.displayName,
          email: userData.email
        }
      });
      
      return {
        id: newUser.id,
        username: newUser.username,
        displayName: newUser.displayName,
        email: newUser.email || undefined,
        createdAt: newUser.createdAt.toISOString(),
        lastLoginAt: newUser.lastLoginAt?.toISOString()
      };
    } catch (error) {
      console.error('Failed to register user via Prisma:', error);
      return null;
    }
  }
  
  async loginUser(credentials: LoginRequest): Promise<User | null> {
    try {
      // 查找用户
      const user = await prisma.user.findUnique({
        where: { username: credentials.username }
      });
      
      if (!user) {
        return null; // 用户不存在
      }
      
      // 验证密码
      const isPasswordValid = await bcrypt.compare(credentials.password, user.password);
      
      if (!isPasswordValid) {
        return null; // 密码错误
      }
      
      // 更新最后登录时间
      await this.updateUserLastLogin(user.id);
      
      return {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        email: user.email || undefined,
        createdAt: user.createdAt.toISOString(),
        lastLoginAt: user.lastLoginAt?.toISOString()
      };
    } catch (error) {
      console.error('Failed to login user via Prisma:', error);
      return null;
    }
  }
  
  async getUserById(userId: string): Promise<User | null> {
    try {
      // 通过ID查找用户
      const user = await prisma.user.findUnique({
        where: { id: userId }
      });
      
      if (!user) {
        return null; // 用户不存在
      }
      
      return {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        email: user.email || undefined,
        createdAt: user.createdAt.toISOString(),
        lastLoginAt: user.lastLoginAt?.toISOString()
      };
    } catch (error) {
      console.error('Failed to get user by ID via Prisma:', error);
      return null;
    }
  }
  
  async updateUserLastLogin(userId: string): Promise<boolean> {
    try {
      // 更新用户最后登录时间
      await prisma.user.update({
        where: { id: userId },
        data: { lastLoginAt: new Date() }
      });
      
      return true;
    } catch (error) {
      console.error('Failed to update user last login via Prisma:', error);
      return false;
    }
  }
} 