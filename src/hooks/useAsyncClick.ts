import { useCallback, useState } from "react";

type AsyncHandler = (...args: never[]) => void | Promise<void>;

export function useAsyncClick<T extends AsyncHandler>(handler: T): [boolean, T] {
  const [busy, setBusy] = useState(false);

  const wrapped = useCallback(
    ((...args: Parameters<T>) => {
      const result = handler(...args);
      if (!result || typeof (result as Promise<void>).then !== "function") return result;

      setBusy(true);
      return Promise.resolve(result).finally(() => {
        setBusy(false);
      });
    }) as T,
    [handler],
  );

  return [busy, wrapped];
}
