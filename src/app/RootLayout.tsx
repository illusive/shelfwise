import { Outlet } from '@tanstack/react-router';
import { RepPicker } from '@/features/session/RepPicker';
import { useCurrentRep } from './data';

/** Requires a selected test rep before any screen is shown. */
export function RootLayout() {
  const { data: rep, isPending } = useCurrentRep();
  if (isPending) return null;
  if (!rep) return <RepPicker />;
  return <Outlet />;
}
