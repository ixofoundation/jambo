import { ChangeEvent, useContext } from 'react';
import type { NextPage } from 'next';
import cls from 'classnames';

import utilsStyles from '@styles/utils.module.scss';
import styles from '@styles/settingsPage.module.scss';
import ColoredIcon, { ICON_COLOR } from '@components/ColoredIcon/ColoredIcon';
import ToggleSwitch from '@components/ToggleSwitch/ToggleSwitch';
import Card, { CARD_SIZE } from '@components/Card/Card';
import Header from '@components/Header/Header';
import Anchor from '@components/Anchor/Anchor';
import Footer from '@components/Footer/Footer';
import Head from '@components/Head/Head';
import Document from '@icons/document.svg';
import { EnableDeveloperMode } from '@constants/chains';
import { ChainContext } from '@contexts/chain';
import config from '@constants/config.json';
import { validateUrl } from '@utils/misc';

const Settings: NextPage = () => {
  const { chain, updateChainNetwork } = useContext(ChainContext);

  const handleChainClick = (e: ChangeEvent<HTMLInputElement>) =>
    updateChainNetwork(e.target.checked ? 'testnet' : 'mainnet');

  return (
    <>
      <Head title='Settings' description='Settings' />
      <Header />
      <main className={cls(utilsStyles.main, styles.settings)}>
        <div className={utilsStyles.spacer3} />
        <Anchor
          active
          href={validateUrl(config.about) ? config.about : '/about'}
          openInNewTab={validateUrl(config.about)}
        >
          <Card className={utilsStyles.rowAlignCenter} size={CARD_SIZE.large}>
            <ColoredIcon icon={Document} size={24} color={ICON_COLOR.primary} className={styles.icon} />
            <p className={styles.settingLabel}>About</p>
          </Card>
        </Anchor>
        <div className={utilsStyles.spacer2} />
        <Anchor
          active
          href={validateUrl(config.termsAndConditions) ? config.termsAndConditions : '/termsAndConditions'}
          openInNewTab={validateUrl(config.termsAndConditions)}
        >
          <Card className={utilsStyles.rowAlignCenter} size={CARD_SIZE.large}>
            <ColoredIcon icon={Document} size={24} color={ICON_COLOR.primary} className={styles.icon} />
            <p className={styles.settingLabel}>Terms & Conditions</p>
          </Card>
        </Anchor>
        {EnableDeveloperMode && (
          <>
            <div className={utilsStyles.spacer2} />
            <p className={styles.label}>developer tools</p>
            <Card className={utilsStyles.rowAlignSpaceBetween} size={CARD_SIZE.large}>
              <p className={styles.settingLabel}>mainnet</p>
              <ToggleSwitch name='network' toggled={chain.chainNetwork === 'testnet'} onToggle={handleChainClick} />
              <p className={styles.settingLabel}>testnet</p>
            </Card>
          </>
        )}
      </main>
      <Footer showAccountButton showActionsButton />
    </>
  );
};

export default Settings;
