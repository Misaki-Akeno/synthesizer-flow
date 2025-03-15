import { useState, useEffect } from 'react';
import { Observable } from 'rxjs';

/**
 * 自定义 Hook，用于在 React 组件中订阅 Observable
 * @param observable 要订阅的 Observable
 * @param initialValue 初始值
 * @returns 当前 Observable 的值
 */
export function useObservable<T>(
  observable: Observable<T>,
  initialValue: T
): T {
  const [value, setValue] = useState<T>(initialValue);

  useEffect(() => {
    const subscription = observable.subscribe((newValue) => {
      setValue(newValue);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [observable]);

  return value;
}
