import { NextRequest, NextResponse } from 'next/server';
import * as vercelBlob from '@vercel/blob';
import { FundOperation } from '@/types/fundOperation';

// 获取基金操作记录
export async function GET(request: NextRequest) {
  try {
    // 从URL获取基金代码
    const searchParams = request.nextUrl.searchParams;
    const fundCode = searchParams.get('fundCode');
    
    if (!fundCode) {
      return NextResponse.json({ error: '缺少基金代码' }, { status: 400 });
    }
    
    // 查询Blob存储
    const { blobs } = await vercelBlob.list({
      prefix: `fundOperations/${fundCode}/`,
    });
    
    if (blobs.length === 0) {
      return NextResponse.json([], { status: 200 });
    }
    
    // 获取最新的文件
    const latestBlob = blobs.sort((a, b) => 
      new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
    )[0];
    
    // 获取文件内容
    const response = await fetch(latestBlob.url);
    if (!response.ok) {
      return NextResponse.json([], { status: 200 });
    }
    
    const text = await response.text();
    const operations = JSON.parse(text) as FundOperation[];
    
    return NextResponse.json(operations, { status: 200 });
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
    
    if (!operation || !operation.fundCode) {
      return NextResponse.json({ error: '无效的操作数据' }, { status: 400 });
    }
    
    // 先获取现有数据
    const { blobs } = await vercelBlob.list({
      prefix: `fundOperations/${operation.fundCode}/`,
    });
    
    let existingOperations: FundOperation[] = [];
    
    if (blobs.length > 0) {
      // 获取最新的文件
      const latestBlob = blobs.sort((a, b) => 
        new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
      )[0];
      
      // 获取文件内容
      const response = await fetch(latestBlob.url);
      if (response.ok) {
        const text = await response.text();
        existingOperations = JSON.parse(text) as FundOperation[];
      }
    }
    
    // 添加新操作
    const updatedOperations = [...existingOperations, operation];
    
    // 保存到Blob存储
    const fileName = `fundOperations/${operation.fundCode}/${Date.now()}.json`;
    const result = await vercelBlob.put(fileName, JSON.stringify(updatedOperations), {
      access: 'public',
    });
    
    return NextResponse.json({ success: true, url: result.url }, { status: 200 });
  } catch (error) {
    console.error('保存基金操作记录失败:', error);
    return NextResponse.json({ error: '保存基金操作记录失败' }, { status: 500 });
  }
}

// 删除基金操作记录
export async function DELETE(request: NextRequest) {
  try {
    // 从URL获取基金代码和操作ID
    const searchParams = request.nextUrl.searchParams;
    const fundCode = searchParams.get('fundCode');
    const operationId = searchParams.get('operationId');
    
    if (!fundCode || !operationId) {
      return NextResponse.json({
        error: '缺少必要参数',
        details: '需要提供fundCode和operationId'
      }, { status: 400 });
    }
    
    // 查询Blob存储
    const { blobs } = await vercelBlob.list({
      prefix: `fundOperations/${fundCode}/`,
    });
    
    if (blobs.length === 0) {
      return NextResponse.json({
        error: '未找到记录',
        details: '该基金没有操作记录'
      }, { status: 404 });
    }
    
    // 获取最新的文件
    const latestBlob = blobs.sort((a, b) => 
      new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
    )[0];
    
    // 获取文件内容
    const response = await fetch(latestBlob.url);
    if (!response.ok) {
      return NextResponse.json({ error: '读取记录失败' }, { status: 500 });
    }
    
    const text = await response.text();
    const operations = JSON.parse(text) as FundOperation[];
    
    // 过滤掉要删除的操作
    const filteredOperations = operations.filter(op => op.id !== operationId);
    
    // 如果没有找到要删除的记录
    if (filteredOperations.length === operations.length) {
      return NextResponse.json({
        error: '未找到记录',
        details: '未找到指定ID的操作记录'
      }, { status: 404 });
    }
    
    // 保存更新后的操作列表
    const fileName = `fundOperations/${fundCode}/${Date.now()}.json`;
    const result = await vercelBlob.put(fileName, JSON.stringify(filteredOperations), {
      access: 'public',
    });
    
    return NextResponse.json({
      success: true,
      message: '已成功删除操作记录',
      url: result.url
    }, { status: 200 });
  } catch (error) {
    console.error('删除基金操作记录失败:', error);
    return NextResponse.json({ error: '删除基金操作记录失败' }, { status: 500 });
  }
} 