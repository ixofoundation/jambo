import RampMoved from '@components/RampMoved/RampMoved';

// Off the login guard: nothing here needs an account, and someone arriving on
// an old link should read where to go without signing in first.
export default function OfframpPage() {
  return <RampMoved kind='withdraw' />;
}
