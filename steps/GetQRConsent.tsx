import { FC, FormEvent, lazy, Suspense, useMemo, useState } from 'react';
import { sanitize } from 'dompurify';
import cls from 'classnames';

import utilsStyles from '@styles/utils.module.scss';
import styles from '@styles/stepsPages.module.scss';
import ColoredIcon, { ICON_COLOR } from '@components/ColoredIcon/ColoredIcon';
import Header from '@components/Header/Header';
import Footer from '@components/Footer/Footer';
import UserApprove from '@icons/user_approve.svg';
import QRScan from '@icons/qr_scan.svg';
import QRCode from '@icons/qr_code.svg';
import { StepConfigType, StepDataType, STEPS } from 'types/steps';
import useWindowDimensions from '@hooks/useWindowDimensions';
import useModalState from '@hooks/useModalState';
import EmptySteps from './EmptySteps';

const CustomQRScanner = lazy(() => import('@components/CustomQRScanner/CustomQRScanner'));

type QRConsentProps = {
  onSuccess: (data: StepDataType<STEPS.get_qr_consent>) => void;
  onBack?: () => void;
  data?: StepDataType<STEPS.get_qr_consent>;
  config: StepConfigType<STEPS.get_qr_consent>;
  header?: string;
};

const QRConsent: FC<QRConsentProps> = ({ onSuccess, onBack, config, data, header }) => {
  const [qrCameraVisible, showQrCamera, hideQrCamera] = useModalState(false);
  const [address, setAddress] = useState(data?.address ?? '');
  const { width, height, footerHeight, headerHeight } = useWindowDimensions();

  const content = useMemo(
    () => (config.description ? sanitize(config.description, { USE_PROFILES: { html: true } }) : undefined),
    [config.description],
  );

  const handleQrSuccess = (value: string) => {
    setAddress(value);
    hideQrCamera();
  };

  const clearAddress = () => setAddress('');

  const formIsValid = () => address.length > 0;

  const handleSubmit = (event: FormEvent<HTMLFormElement> | null) => {
    event?.preventDefault();
    if (!formIsValid()) return alert('Address must be provided');
    onSuccess({ address });
  };

  return (
    <>
      <Header header={header} />

      <main className={cls(utilsStyles.main, utilsStyles.bare, utilsStyles.columnJustifyCenter, styles.stepContainer)}>
        {qrCameraVisible ? (
          <Suspense fallback={<EmptySteps loading={true} />}>
            <CustomQRScanner
              width={width ?? 250}
              height={(height ?? 250) - footerHeight - headerHeight}
              fps={2}
              size={300}
              onSuccess={handleQrSuccess}
              onError={console.error}
            />
          </Suspense>
        ) : address ? (
          <form
            className={cls(styles.stepsForm, utilsStyles.columnAlignCenter)}
            onSubmit={handleSubmit}
            autoComplete='none'
          >
            <ColoredIcon icon={UserApprove} color={ICON_COLOR.primary} size={122} />
            <p className={utilsStyles.paragraph}>You got consent to take a photo of {address}</p>
          </form>
        ) : (
          <form className={cls(styles.stepsForm)} onSubmit={showQrCamera} autoComplete='none'>
            <div className={cls(styles.alignLeft, styles.marginX10)}>
              <h3 className={styles.label}>{config.title}</h3>
              <div className={utilsStyles.spacer1} />
              {content && <p className={styles.paragraph} dangerouslySetInnerHTML={{ __html: content }} />}
            </div>
            <div className={utilsStyles.spacer3} />

            <div onClick={showQrCamera}>
              <QRScan width='160px' height='160px' className={styles.qrScan} />
              <div className={utilsStyles.spacer1} />
              <p>Scan the customer QR code.</p>
            </div>
            <div className={utilsStyles.spacer2} />
          </form>
        )}
      </main>

      <Footer
        onBack={address ? clearAddress : onBack}
        onBackUrl={onBack || address?.length ? undefined : ''}
        onForward={!address && !qrCameraVisible ? showQrCamera : formIsValid() ? () => handleSubmit(null) : null}
        forwardIcon={!address && !qrCameraVisible ? QRCode : undefined}
      />
    </>
  );
};

export default QRConsent;
