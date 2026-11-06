import type { Status } from '../shared/link';

/** Shown to a guest until the host's room actually answers, so nobody thinks they're in when they aren't. */
export function Joining({ status }: { status: { st: Status; msg?: string } }) {
  return (
    <section className="card joining">
      <span className="spinner" />
      <b>{status.msg ?? 'Connecting to the host…'}</b>
      <small>You’ll appear in your friend’s room as soon as this connects. Different networks can take a few seconds.</small>
    </section>
  );
}
