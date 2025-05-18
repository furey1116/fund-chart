import { NextRequest, NextResponse } from 'next/server';
import { FundOperation } from '@/types/fundOperation';
import { prisma } from '@/lib/prisma';

// 使用 as any 临时解决类型问题
const prismaClient = prisma as any;

// 获取基金操作记录
export async function GET(request: NextRequest) {
  try {
    // 从URL获取基金代码和用户ID
    const searchParams = request.nextUrl.searchParams;
    const fundCode = searchParams.get('fundCode');
    const userId = searchParams.get('userId');
    
    if (!fundCode) {
      return NextResponse.json({ error: '缺少基金代码' }, { status: 400 });
    }
    
    // 构建查询条件
    const whereClause: any = { fundCode };
    if (userId) {
      whereClause.userId = userId;
    }
    
    // 查询数据库
    const operations = await prismaClient.fundOperation.findMany({
      where: whereClause,
      orderBy: { operationDate: 'desc' }
    });
    
    // 格式化结果
    const formattedOperations = operations.map((op: any) => ({
      id: op.id,
      userId: op.userId,
      fundCode: op.fundCode,
      fundName: op.fundName,
      operationType: op.operationType,
      operationDate: op.operationDate.toISOString().split('T')[0], // 转换为YYYY-MM-DD格式
      price: op.price,
      shares: op.shares,
      amount: op.amount,
      fee: op.fee,
      holdingShares: op.holdingShares,
      marketValue: op.marketValue,
      remark: op.remark,
      createdAt: op.createdAt.toISOString()
    }));
    
    return NextResponse.json(formattedOperations, { status: 200 });
  } catch (error) {
    console.error('获取基金操作记录失败:', error);
    return NextResponse.json({ error: '获取基金操作记录失败' }, { status: 500 });
  }
}

// 保存基金操作记录
export async function POST(request: NextRequest) {
  try {
    // 获取请求体
    const operation = await request.json() as FundOperation;
    
    if (!operation || !operation.fundCode || !operation.userId) {
      return NextResponse.json({ error: '无效的操作数据' }, { status: 400 });
    }
    
    // 将操作日期字符串转换为Date对象
    const operationDate = new Date(operation.operationDate);
    
    // 保存到数据库
    await prismaClient.fundOperation.create({
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
    
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('保存基金操作记录失败:', error);
    return NextResponse.json({ error: '保存基金操作记录失败' }, { status: 500 });
  }
}

// 删除基金操作记录
export async function DELETE(request: NextRequest) {
  try {
    // 从URL获取参数
    const searchParams = request.nextUrl.searchParams;
    const fundCode = searchParams.get('fundCode');
    const operationId = searchParams.get('operationId');
    const userId = searchParams.get('userId');
    
    if (!fundCode || !operationId || !userId) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }
    
    // 从数据库中删除记录
    const result = await prismaClient.fundOperation.deleteMany({
      where: {
        id: operationId,
        fundCode: fundCode,
        userId: userId
      }
    });
    
    if (result.count === 0) {
      return NextResponse.json({ error: '未找到操作记录或无权删除' }, { status: 404 });
    }
    
    return NextResponse.json({
      success: true,
      message: '已成功删除操作记录'
    }, { status: 200 });
  } catch (error) {
    console.error('删除基金操作记录失败:', error);
    return NextResponse.json({ error: '删除基金操作记录失败' }, { status: 500 });
  }
} 