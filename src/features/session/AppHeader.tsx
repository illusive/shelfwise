import { useState } from 'react';
import { useCurrentRep } from '@/app/data';
import { t } from '@/i18n/strings';
import { Wordmark } from '@/ui/primitives/Screen';
import shared from '../shared/shared.module.css';
import { Avatar } from './Avatar';
import styles from './session.module.css';
import { UserDrawer } from './UserDrawer';

/** Top bar for the main tabs: wordmark left, user drawer trigger top right. */
export function AppHeader() {
  const { data: rep } = useCurrentRep();
  const [open, setOpen] = useState(false);
  return (
    <div className={shared.spread}>
      <Wordmark />
      {rep && (
        <button
          type="button"
          className={styles.userButton}
          aria-label={t.reps.menu(rep.name)}
          aria-haspopup="dialog"
          onClick={() => setOpen(true)}
        >
          <Avatar name={rep.name} size="sm" />
        </button>
      )}
      <UserDrawer open={open} onOpenChange={setOpen} />
    </div>
  );
}
