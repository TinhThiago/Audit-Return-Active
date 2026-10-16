import { useCallback, useEffect, useRef, useState } from "react";
import { errorMessage } from "../data/transport";
type State<T> = {
  key: string;
  data?: T;
  loading: boolean;
  error?: string;
  attempted: boolean;
};
export function useLatestRequest<T>(key: string) {
  const keyRef = useRef(key);
  keyRef.current = key;
  const sequence = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const [state, setState] = useState<State<T>>({
    key,
    loading: false,
    attempted: false,
  });
  useEffect(() => {
    sequence.current++;
    controller.current?.abort();
    setState({ key, loading: false, attempted: false });
    return () => {
      sequence.current++;
      controller.current?.abort();
    };
  }, [key]);
  const run = useCallback(
    async (task: (signal: AbortSignal) => Promise<T>, retain = false) => {
      const n = ++sequence.current;
      controller.current?.abort();
      const abort = new AbortController();
      controller.current = abort;
      setState((s) => ({
        key,
        loading: true,
        attempted: true,
        data: retain && s.key === key ? s.data : undefined,
      }));
      try {
        const data = await task(abort.signal);
        if (
          sequence.current === n &&
          keyRef.current === key &&
          !abort.signal.aborted
        )
          setState({ key, data, loading: false, attempted: true });
      } catch (e) {
        if (
          sequence.current === n &&
          keyRef.current === key &&
          !abort.signal.aborted
        )
          setState((s) => ({ ...s, loading: false, error: errorMessage(e) }));
      }
    },
    [key],
  );
  const clear = useCallback(() => {
    sequence.current++;
    controller.current?.abort();
    setState({ key, loading: false, attempted: false });
  }, [key]);
  return {
    ...(state.key === key ? state : { key, loading: false, attempted: false }),
    run,
    clear,
  };
}
