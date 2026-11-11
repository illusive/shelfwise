import { Link } from '@tanstack/react-router';
import { t } from '@/i18n/strings';
import { Screen } from '@/ui/primitives/Screen';
import { EmptyState } from '@/ui/primitives/Text';

export function NotFound() {
  return (
    <Screen nav>
      <EmptyState title={t.common.notFound}>
        <Link to="/">{t.nav.home}</Link>
      </EmptyState>
    </Screen>
  );
}
