import { ReactNode } from 'react';
import Link, { LinkProps } from 'next/link';

import styles from './Anchor.module.scss';

type AnchorProps = {
  children: ReactNode;
  active?: boolean;
  openInNewTab?: boolean;
} & LinkProps;

const Anchor = ({ active = true, openInNewTab = false, children, ...other }: AnchorProps) => {
  if (!active) return <>{children}</>;
  return (
    <Link {...other}>
      {openInNewTab ? (
        <a target='_blank' rel='noopener noreferrer'>
          {children}
        </a>
      ) : (
        <a>{children}</a>
      )}
    </Link>
  );
};

export default Anchor;
