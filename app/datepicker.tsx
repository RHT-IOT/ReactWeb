import React from 'react';
import { DatePicker, Space } from 'antd';
import type { DatePickerProps, GetProps } from 'antd';
import dayjs from "dayjs";
type RangePickerProps = GetProps<typeof DatePicker.RangePicker>;

const { RangePicker } = DatePicker;

const onOk = (value: DatePickerProps['value'] | RangePickerProps['value']) => {
  console.log('onOk: ', value);
};

export function DateTimeRangePickerValue({
  setStartDateTime,
  setEndDateTime,
}) {
  return(
    <Space direction="vertical" size={12}>
    <RangePicker
        showTime={{ format: 'HH:mm:ss' }}
        format="YYYY-MM-DD HH:mm:ss"
        onChange={(value, dateString) => {
        console.log('Selected Time: ', value);
        console.log('Formatted Selected Time: ', dateString);
        const formatted = value?.map(d =>
            dayjs(d).format("YYYY-MM-DD HH:mm:ss")
            );
        setStartDateTime(formatted[0].replace(" ","T")+".000Z");
        setEndDateTime(formatted[1].replace(" ","T")+".000Z");
        }}
        onOk={onOk}
    />
    </Space>);
};

export default DateTimeRangePickerValue;