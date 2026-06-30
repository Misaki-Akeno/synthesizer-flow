import { useMemo, useState, useEffect } from 'react';
import { BehaviorSubject } from 'rxjs';
import { throttleTime } from 'rxjs/operators';
import { ModuleBase, ModuleInterface, PortType } from '../base/ModuleBase';

// UI 刷新率上限：输出端口（如 LFO signal）可能以 60fps 推送值，
// 但 React 侧只需 ~10fps 显示即可。音频处理链路直接订阅 BehaviorSubject，不受此影响。
const UI_OUTPUT_THROTTLE_MS = 100;

/**
 * 自定义Hook，用于订阅模块数据并返回当前值，主要用于UI
 * @param module 模块实例
 * @returns 包含参数值、输入端口值和输出端口值的对象
 */
export function useModuleSubscription(module: ModuleBase | undefined) {
  // 使用状态存储参数和端口的当前值
  const [paramValues, setParamValues] = useState<{
    [key: string]: number | boolean | string;
  }>({});
  const [inputPortValues, setInputPortValues] = useState<{
    [key: string]: ModuleInterface;
  }>({});
  const [outputPortValues, setOutputPortValues] = useState<{
    [key: string]: ModuleInterface;
  }>({});

  const inputPortTypes = useMemo(() => {
    if (!module) return {};

    return Object.fromEntries(
      Object.keys(module.inputPorts).map((key) => [
        key,
        module.getInputPortType(key),
      ])
    ) as { [key: string]: PortType };
  }, [module]);

  const outputPortTypes = useMemo(() => {
    if (!module) return {};

    return Object.fromEntries(
      Object.keys(module.outputPorts).map((key) => [
        key,
        module.getOutputPortType(key),
      ])
    ) as { [key: string]: PortType };
  }, [module]);

  // 订阅参数和端口的变化
  useEffect(() => {
    if (!module) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const subscriptions: { [key: string]: any } = {};

    // 订阅参数变化
    Object.entries(module.parameters).forEach(([key, subject]) => {
      const paramSubject = subject as BehaviorSubject<
        number | boolean | string
      >;

      subscriptions[`param_${key}`] = paramSubject.subscribe((value) => {
        setParamValues((prev) => ({ ...prev, [key]: value }));
      });
    });

    // 订阅输入端口变化
    Object.entries(module.inputPorts).forEach(([key, subject]) => {
      const portSubject = subject as BehaviorSubject<ModuleInterface>;

      subscriptions[`input_${key}`] = portSubject.subscribe((value) => {
        setInputPortValues((prev) => ({ ...prev, [key]: value }));
      });
    });

    // 订阅输出端口变化（限流：UI 不需要跟随音频帧率更新）
    Object.entries(module.outputPorts).forEach(([key, subject]) => {
      const portSubject = subject as BehaviorSubject<ModuleInterface>;

      subscriptions[`output_${key}`] = portSubject
        .pipe(throttleTime(UI_OUTPUT_THROTTLE_MS, undefined, { leading: true, trailing: true }))
        .subscribe((value) => {
          setOutputPortValues((prev) => ({ ...prev, [key]: value }));
        });
    });

    // 组件卸载时取消订阅
    return () => {
      Object.values(subscriptions).forEach((sub) => sub.unsubscribe());
    };
  }, [module]);

  return {
    paramValues,
    inputPortValues,
    inputPortTypes,
    outputPortValues,
    outputPortTypes,
  };
}
