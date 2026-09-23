import type { WindowId } from '@/lib/kernel/types';
import type { AndroidRole } from '../model';

export interface AndroidAppProps {
  readonly id: WindowId;
  readonly role: AndroidRole;
  readonly active: boolean;
  readonly layout: 'phone' | 'large';
  readonly headingId: string;
}
