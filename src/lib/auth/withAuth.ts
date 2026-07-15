import { auth } from './auth';
import { Session } from 'next-auth';

type AuthedAction<TArgs extends unknown[], TResult> = (
  session: Session & { user: { id: string } },
  ...args: TArgs
) => Promise<TResult>;

type ActionResult<TResult> = TResult | { success: false; error: string };

export function withAuth<TArgs extends unknown[], TResult>(
  action: AuthedAction<TArgs, TResult>
): (...args: TArgs) => Promise<ActionResult<TResult>> {
  return async (...args: TArgs): Promise<ActionResult<TResult>> => {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: 'Unauthorized' };
    }
    return action(session as Session & { user: { id: string } }, ...args);
  };
}
