import { Outlet } from '@tanstack/react-router';
import { useCurrentRep } from './data';

/** Waits for the current rep (defaulted at start-up) before rendering screens. */
export function RootLayout() {
  const { isPending } = useCurrentRep();
  if (isPending) return null;
  return <Outlet />;
}
