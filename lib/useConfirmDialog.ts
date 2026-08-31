'use client';
import { useRef, useState } from 'react';

export type ConfirmRequest = { title: string; detail: string; confirmLabel?: string; tone?: 'danger' | 'neutral' };

export function useConfirmDialog() {
  const [request, setRequest] = useState<ConfirmRequest | null>(null);
  const resolver = useRef<((value: boolean) => void) | null>(null);
  function confirm(next: ConfirmRequest) { setRequest(next); return new Promise<boolean>((resolve) => { resolver.current = resolve; }); }
  function answer(value: boolean) { resolver.current?.(value); resolver.current = null; setRequest(null); }
  return { request, confirm, answer };
}
