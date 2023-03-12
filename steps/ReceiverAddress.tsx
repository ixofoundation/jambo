import { ChangeEvent, FC, FormEvent, lazy, Suspense, useContext, useState } from 'react';
import cls from 'classnames';

import utilsStyles from '@styles/utils.module.scss';
import styles from '@styles/stepsPages.module.scss';
import InputWithSuffixIcon from '@components/InputWithSuffixIcon/InputWithSuffixIcon';
import IconText from '@components/IconText/IconText';
import Header from '@components/Header/Header';
import Footer from '@components/Footer/Footer';
// import QRScan from '@icons/qr_scan.svg';
import SadFace from '@icons/sad_face.svg';
import Paste from '@icons/paste.svg';
import { StepDataType, STEPS } from 'types/steps';
import { WalletContext } from '@contexts/wallet';
import EmptySteps from './EmptySteps';

const QRCamera = lazy(() => import('./QRCamera'));

type ReceiverAddressProps = {
  onSuccess: (data: StepDataType<STEPS.get_receiver_address>) => void;
  onBack?: () => void;
  data?: StepDataType<STEPS.get_receiver_address>;
  header?: string;
};

const ReceiverAddress: FC<ReceiverAddressProps> = ({ onSuccess, onBack, data, header }) => {
  const [showQRCamera, setShowQRCamera] = useState(false);
  const [address, setAddress] = useState(
    data?.data ? data.data[data.currentIndex ?? data.data.length - 1]?.address ?? '' : '',
  );
  const { wallet } = useContext(WalletContext);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    setAddress(event.target.value);
  };

  const formIsValid = () => address.length > 0;

  const handleSubmit = (event: FormEvent<HTMLFormElement> | null) => {
    event?.preventDefault();
    const newData = { address };
    const isEditing = !!data?.data[data?.currentIndex];
    if (!formIsValid()) return alert('Address must be provided');
    onSuccess(
      !isEditing
        ? { ...data, currentIndex: 0, data: [...(data?.data ?? []), newData] }
        : {
            ...data,
            data: [...data.data.slice(0, data.currentIndex), newData, ...data.data.slice(data.currentIndex + 1)],
          },
    );
  };

  return (
    <>
      {showQRCamera ? (
        <Suspense fallback={<EmptySteps loading={true} />}>
          {/* <QRCamera onSuccess={(address) => onSuccess({ address })} onBack={() => setShowQRCamera(false)} /> */}
        </Suspense>
      ) : (
        <>
          <Header header={header} />

          <main className={cls(utilsStyles.main, utilsStyles.columnJustifyCenter, styles.stepContainer)}>
            {/* <div onClick={() => setShowQRCamera(true)}>
							<QRScan width="100px" height="100px" className={styles.qrScan} />
							<p>Scan address</p>
						</div>
						<p>or</p> */}
            {!wallet?.balances?.data?.length ? (
              <IconText title="You don't have any tokens to send." Img={SadFace} imgSize={50} />
            ) : (
              <form className={styles.stepsForm} onSubmit={handleSubmit} autoComplete='none'>
                <p className={styles.label}>Paste address here</p>
                <InputWithSuffixIcon name='address' required onChange={handleChange} value={address} icon={Paste} />
              </form>
            )}
          </main>

          <Footer
            onBack={onBack}
            onBackUrl={onBack ? undefined : ''}
            onForward={formIsValid() ? () => handleSubmit(null) : null}
          />
        </>
      )}
    </>
  );
};

export default ReceiverAddress;
