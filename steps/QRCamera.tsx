import { FC } from 'react';
import cls from 'classnames';

import utilsStyles from '@styles/utils.module.scss';
import styles from '@styles/stepsPages.module.scss';
import Footer from '@components/Footer/Footer';
import QRScanner from '@components/QRScanner/QRScanner';
import useWindowDimensions from '@hooks/windowDimensions';
import Loader from '@components/Loader/Loader';
import SadFace from '@icons/sad_face.svg';
import IconText from '@components/IconText/IconText';

type QRCameraProps = {
  onSuccess: (text: string) => void;
  onBack?: () => void;
};

const QRCamera: FC<QRCameraProps> = ({ onSuccess, onBack }) => {
  const { height, width, footerHeight } = useWindowDimensions();

  const errorDisplay = () => <IconText title='Unable to load QR Scanner.' Img={SadFace} imgSize={50} />;

  return (
    <>
      <main
        className={cls(utilsStyles.main, utilsStyles.columnJustifyCenter, styles.stepContainer, styles.qrCameraMain)}
      >
        {width != null && height != null ? (
          <QRScanner
            qrCodeSuccessCallback={onSuccess}
            qrCodeErrorCallback={(e) => {}}
            qrbox={250}
            // width={width + 'px'}
            // height={height - footerHeight + 'px'}
            // aspectRatio={width / (height - footerHeight)}
            ErrorDisplay={errorDisplay}
            useDialog={true}
          />
        ) : (
          <Loader />
        )}

        <Footer onBack={onBack} onBackUrl={onBack ? undefined : ''} />
      </main>
    </>
  );
};

export default QRCamera;
