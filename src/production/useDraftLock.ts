import { useCallback, useEffect, useRef, useState } from "react";
import { claimLease, draftKey } from "./storage";
export function useDraftLock(userId: string, date: string) {
  const key = draftKey(userId, date);
  const [owner, setOwner] = useState("");
  const ownerRef = useRef("");
  const [held, setHeld] = useState(false);
  const [checking, setChecking] = useState(true);
  const [retry, setRetry] = useState(0);
  const [error, setError] = useState("");
  const heldRef = useRef(false);
  // A StrictMode setup or retry waits for its previous native request to release.
  // Otherwise ifAvailable can observe this hook's own cancelled request as busy.
  const nativeTail = useRef<Promise<unknown>>(Promise.resolve());
  const leaseTail = useRef<Promise<unknown>>(Promise.resolve());
  const native =
    typeof navigator !== "undefined" &&
    typeof navigator.locks?.request === "function";
  useEffect(() => {
    let cancelled = false;
    let releaseNative: (() => void) | undefined;
    let heartbeat: ReturnType<typeof setInterval> | undefined;
    const generationOwner = crypto.randomUUID();
    ownerRef.current = generationOwner;
    setOwner(generationOwner);
    heldRef.current = false;
    setHeld(false);
    setChecking(true);
    setError("");
    const update = (owns: boolean) => {
      if (!cancelled && ownerRef.current === generationOwner) {
        heldRef.current = owns;
        setHeld(owns);
        setChecking(false);
      }
    };
    if (native) {
      const task = nativeTail.current
        .catch(() => {})
        .then(async () => {
          if (cancelled) return;
          await navigator.locks.request(
            `danielli-draft:${key}`,
            { mode: "exclusive", ifAvailable: true },
            async (lock) => {
              if (cancelled || !lock) {
                update(false);
                return;
              }
              update(true);
              await new Promise<void>((resolve) => {
                releaseNative = resolve;
                if (cancelled) resolve();
              });
            },
          );
        });
      nativeTail.current = task;
      void task.catch(() => {
        if (!cancelled) {
          update(false);
          setError(
            "Não foi possível obter exclusividade para editar. Tente novamente.",
          );
        }
      });
    } else {
      const renew = async () => {
        if (cancelled) return;
        try {
          const owns = await claimLease(key, generationOwner);
          if (cancelled) {
            if (owns) await claimLease(key, generationOwner, true);
            return;
          }
          update(owns);
        } catch {
          update(false);
          if (!cancelled)
            setError(
              "Este navegador não conseguiu proteger o rascunho. Use outro navegador para editar.",
            );
        }
      };
      const initial = leaseTail.current.catch(() => {}).then(renew);
      leaseTail.current = initial;
      void initial;
      heartbeat = setInterval(() => {
        if (heldRef.current && ownerRef.current === generationOwner)
          void renew();
      }, 5000);
    }
    return () => {
      cancelled = true;
      if (ownerRef.current === generationOwner) heldRef.current = false;
      releaseNative?.();
      if (heartbeat) clearInterval(heartbeat);
      // Generation-specific owners prevent old cleanup from releasing a new lease.
      if (!native) {
        const released = leaseTail.current
          .catch(() => {})
          .then(() => claimLease(key, generationOwner, true));
        leaseTail.current = released;
        void released.catch(() => {});
      }
    };
  }, [key, retry, native]);
  const assert = useCallback(async () => {
    if (!heldRef.current || ownerRef.current !== owner) return false;
    if (native) return true;
    try {
      const owns = await claimLease(key, owner);
      if (ownerRef.current !== owner) return false;
      heldRef.current = owns;
      setHeld(owns);
      return owns;
    } catch {
      if (ownerRef.current === owner) {
        heldRef.current = false;
        setHeld(false);
      }
      return false;
    }
  }, [key, owner, native]);
  return {
    held,
    checking,
    error,
    assert,
    leaseOwner: native ? undefined : owner,
    isHeld: () => heldRef.current && ownerRef.current === owner,
    retry: () => setRetry((value) => value + 1),
  };
}
