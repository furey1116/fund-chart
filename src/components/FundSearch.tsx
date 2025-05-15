import React, { useState } from 'react';
import { Input, Button, List, Spin, message } from 'antd';
import { searchFunds, FundSearchResult } from '@/api/fund';

interface FundSearchProps {
  onSelect: (fund: FundSearchResult) => void;
}

const FundSearch: React.FC<FundSearchProps> = ({ onSelect }) => {
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<FundSearchResult[]>([]);

  const handleSearch = async () => {
    if (!keyword.trim()) return;
    
    setLoading(true);
    try {
      const results = await searchFunds(keyword);
      console.log('搜索结果:', results); // 调试用
      setSearchResults(results || []);
    } catch (error) {
      console.error('搜索失败:', error);
      // 显示用户友好的错误信息
      message.error('搜索失败，请稍后再试');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <div className="p-4 bg-white rounded-lg shadow-sm">
      <div className="flex gap-2 mb-4">
        <Input
          placeholder="输入基金代码或名称"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <Button type="primary" onClick={handleSearch} loading={loading}>
          搜索
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-4">
          <Spin />
        </div>
      ) : searchResults.length > 0 ? (
        <List
          className="max-h-60 overflow-y-auto"
          itemLayout="horizontal"
          dataSource={searchResults}
          renderItem={(item) => (
            <List.Item
              className="cursor-pointer hover:bg-gray-50"
              onClick={() => onSelect(item)}
            >
              <div className="w-full">
                <div className="flex justify-between">
                  <span className="font-bold">{item.NAME}</span>
                  <span className="text-gray-500">{item.CODE}</span>
                </div>
                <div className="text-sm text-gray-500">
                  {item.FundBaseInfo?.FTYPE || '未知类型'}
                </div>
              </div>
            </List.Item>
          )}
        />
      ) : keyword ? (
        <div className="text-center text-gray-500 py-4">未找到相关基金</div>
      ) : null}
    </div>
  );
};

export default FundSearch; 