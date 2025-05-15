import React from 'react';
import { Radio, DatePicker } from 'antd';
import type { RadioChangeEvent } from 'antd';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;

export type DateRangeType = '1m' | '3m' | '6m' | '1y' | 'custom';

interface DateRangePickerProps {
  value: {
    type: DateRangeType;
    startDate: dayjs.Dayjs | null;
    endDate: dayjs.Dayjs | null;
  };
  onChange: (value: {
    type: DateRangeType;
    startDate: dayjs.Dayjs | null;
    endDate: dayjs.Dayjs | null;
  }) => void;
}

const DateRangePicker: React.FC<DateRangePickerProps> = ({ value, onChange }) => {
  const handleTypeChange = (e: RadioChangeEvent) => {
    const type = e.target.value as DateRangeType;
    let startDate: dayjs.Dayjs | null = null;
    let endDate = dayjs();

    if (type === '1m') {
      startDate = dayjs().subtract(1, 'month');
    } else if (type === '3m') {
      startDate = dayjs().subtract(3, 'month');
    } else if (type === '6m') {
      startDate = dayjs().subtract(6, 'month');
    } else if (type === '1y') {
      startDate = dayjs().subtract(1, 'year');
    } else {
      // 保持自定义日期不变
      startDate = value.startDate;
      endDate = value.endDate || endDate;
    }

    onChange({ type, startDate, endDate });
  };

  const handleDateChange = (dates: [dayjs.Dayjs | null, dayjs.Dayjs | null] | null) => {
    if (dates) {
      onChange({
        type: 'custom',
        startDate: dates[0],
        endDate: dates[1],
      });
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-4">
      <Radio.Group value={value.type} onChange={handleTypeChange}>
        <Radio.Button value="1m">近1月</Radio.Button>
        <Radio.Button value="3m">近3月</Radio.Button>
        <Radio.Button value="6m">近6月</Radio.Button>
        <Radio.Button value="1y">近1年</Radio.Button>
        <Radio.Button value="custom">自定义</Radio.Button>
      </Radio.Group>

      {value.type === 'custom' && (
        <RangePicker
          value={[value.startDate, value.endDate]}
          onChange={handleDateChange as any}
        />
      )}
    </div>
  );
};

export default DateRangePicker; 