import Link from 'next/link';

export default function AuthHeader() {
  return (
    <nav
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 5,
        height: 'var(--header-height)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 16px',
      }}
    >
      <Link href='/' style={{ display: 'flex', alignItems: 'center', height: '32px' }} aria-label='Home'>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src='/images/logo.png' alt='Jambo' style={{ height: '100%', width: 'auto', objectFit: 'contain' }} />
      </Link>
    </nav>
  );
}
