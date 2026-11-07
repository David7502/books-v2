import { useEffect, useState } from "react";
import { normalizePath } from "./path.ts";

export function usePath(): readonly [string, (to: string) => void] {
  const [path, setPath] = useState(() =>
    normalizePath(window.location.pathname),
  );

  useEffect(() => {
    function onPopState() {
      setPath(normalizePath(window.location.pathname));
    }

    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("popstate", onPopState);
    };
  }, []);

  function navigate(to: string) {
    const next = normalizePath(to);
    if (next !== normalizePath(window.location.pathname)) {
      window.history.pushState(null, "", next);
    }
    setPath(next);
  }

  return [path, navigate] as const;
}
