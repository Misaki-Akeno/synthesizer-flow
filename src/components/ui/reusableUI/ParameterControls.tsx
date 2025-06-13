import React, { useState } from 'react';
import { Slider } from '@/components/ui/shadcn/slider';
import { Switch } from '@/components/ui/shadcn/switch';
import { Input } from '@/components/ui/shadcn/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/shadcn/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/shadcn/tooltip';
import { ParameterType } from '@/core/base/ModuleBase';

// 带描述提示的参数名称组件
export const ParamLabel = ({
  label,
  description,
}: {
  label: string;
  description?: string;
}) => {
  if (!description) {
    return <span>{label}:</span>;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span>{label}:</span>
        </TooltipTrigger>
        <TooltipContent>
          <p className="max-w-xs text-xs">{description}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

// 数值参数控制组件
export const NumberParameterControl = ({
  paramKey,
  value,
  min,
  max,
  step,
  updateParameter,
  label,
  description,
}: {
  paramKey: string;
  value: number;
  min: number;
  max: number;
  step: number;
  updateParameter: (key: string, value: number) => void;
  label: string;
  description?: string;
}) => {
  // 使用useEffect来确保inputValue总是跟随value的变化而更新
  const [inputValue, setInputValue] = useState<string>(
    typeof value === 'number' ? value.toFixed(2) : '0.00'
  );

  // 当外部value变化时更新输入框的值
  React.useEffect(() => {
    setInputValue(typeof value === 'number' ? value.toFixed(2) : '0.00');
  }, [value]);

  const [, setIsFocused] = useState(false);

  // 处理滑块值变化
  const handleSliderChange = (newValue: number[]) => {
    updateParameter(paramKey, newValue[0]);
    setInputValue(newValue[0].toFixed(2));
  };

  // 处理输入框值变化
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  // 处理输入框失焦和回车事件
  const handleInputCommit = () => {
    const parsed = parseFloat(inputValue);
    if (!isNaN(parsed)) {
      const clampedValue = Math.min(Math.max(parsed, min), max);
      updateParameter(paramKey, clampedValue);
      setInputValue(clampedValue.toFixed(2));
    } else {
      setInputValue(value.toFixed(2));
    }
    setIsFocused(false);
  };

  // 处理键盘事件
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleInputCommit();
    }
  };

  // 创建参数标签组件
  const labelComponent = <ParamLabel label={label} description={description} />;

  return (
    <div className="mb-3">
      <div className="flex justify-between items-center text-xs mb-1">
        {labelComponent}
        <div className="w-16">
          <Input
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            onBlur={handleInputCommit}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)}
            className="h-6 text-xs px-2 py-0.5 leading-tight"
          />
        </div>
      </div>
      <Slider
        value={[typeof value === 'number' ? value : 0]}
        min={min}
        max={max}
        step={step}
        onValueChange={(val) => handleSliderChange(val)}
      />
    </div>
  );
};

// 布尔参数控制组件
export const BooleanParameterControl = ({
  paramKey,
  value,
  updateParameter,
  label,
  description,
}: {
  paramKey: string;
  value: boolean;
  updateParameter: (key: string, value: boolean) => void;
  label: string;
  description?: string;
}) => {
  // 创建参数标签组件
  const labelComponent = <ParamLabel label={label} description={description} />;

  return (
    <div className="mb-3">
      <div className="flex justify-between items-center text-xs">
        {labelComponent}
        <Switch
          checked={Boolean(value)}
          onCheckedChange={(checked) => updateParameter(paramKey, checked)}
        />
      </div>
    </div>
  );
};

// 列表参数控制组件
export const ListParameterControl = ({
  paramKey,
  value,
  options,
  updateParameter,
  label,
  description,
}: {
  paramKey: string;
  value: string;
  options: string[];
  updateParameter: (key: string, value: string) => void;
  label: string;
  description?: string;
}) => {
  // 创建参数标签组件
  const labelComponent = <ParamLabel label={label} description={description} />;

  return (
    <div className="mb-3">
      <div className="flex justify-between text-xs mb-1">{labelComponent}</div>
      <Select
        value={String(value)}
        onValueChange={(val) => updateParameter(paramKey, val)}
      >
        <SelectTrigger className="w-full text-xs h-8">
          <SelectValue placeholder="选择选项" />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

// 参数控制组件
export const ParameterControl = ({
  paramKey,
  paramType,
  value,
  meta,
  updateParameter,
  label,
  description,
}: {
  paramKey: string;
  paramType: ParameterType;
  value: number | boolean | string;
  meta: {
    min?: number;
    max?: number;
    step?: number;
    options?: string[];
  };
  updateParameter: (key: string, value: number | boolean | string) => void;
  label: string;
  description?: string;
}) => {
  switch (paramType) {
    case ParameterType.NUMBER:
      return (
        <NumberParameterControl
          key={paramKey}
          paramKey={paramKey}
          value={typeof value === 'number' ? value : 0}
          min={meta.min || 0}
          max={meta.max || 1}
          step={meta.step || 0.1}
          updateParameter={
            updateParameter as (key: string, value: number) => void
          }
          label={label}
          description={description}
        />
      );
    case ParameterType.BOOLEAN:
      return (
        <BooleanParameterControl
          key={paramKey}
          paramKey={paramKey}
          value={Boolean(value)}
          updateParameter={
            updateParameter as (key: string, value: boolean) => void
          }
          label={label}
          description={description}
        />
      );
    case ParameterType.LIST:
      return (
        <ListParameterControl
          key={paramKey}
          paramKey={paramKey}
          value={String(value)}
          options={meta.options || []}
          updateParameter={
            updateParameter as (key: string, value: string) => void
          }
          label={label}
          description={description}
        />
      );
    default:
      return <div key={paramKey}>未知参数类型</div>;
  }
};
