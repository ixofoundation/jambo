import { FormEvent, useContext, useEffect, useState, FC, useRef } from 'react';
import cls from 'classnames';
import { Coin } from '@cosmjs/proto-signing';
import { customQueries } from '@ixo/impactxclient-sdk';

import utilsStyles from '@styles/utils.module.scss';
import styles from '@styles/stepsPages.module.scss';
import IconText from '@components/IconText/IconText';
import Header from '@components/Header/Header';
import Footer from '@components/Footer/Footer';
import SadFace from '@icons/sad_face.svg';
import { StepConfigType, StepDataType, STEPS } from 'types/steps';
import { WalletContext } from '@contexts/wallet';
import { CURRENCY_TOKEN } from 'types/wallet';
import { queryGovParams } from '@utils/query';
import useChainContext from '@hooks/useChainContext';
import Loader from '@components/Loader/Loader';
import {
  validateAmountAgainstBalance,
  validateIbcDenom,
  getDisplayAmountFromCurrencyToken,
  getDisplayDenomFromCurrencyToken,
} from '@utils/currency';

type ProposalDepositProps = {
  onSuccess: (data: StepDataType<STEPS.define_proposal_deposit>) => void;
  onBack?: () => void;
  config?: StepConfigType<STEPS.define_proposal_deposit>;
  data?: StepDataType<STEPS.define_proposal_deposit>;
  header?: string;
};

const ProposalDeposit: FC<ProposalDepositProps> = ({ onSuccess, onBack, header }) => {
  const [token, setToken] = useState<CURRENCY_TOKEN | undefined>();
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const loadingRef = useRef<boolean>(false);

  const { wallet, fetchAssets } = useContext(WalletContext);
  const { queryClient, chainInfo, chain } = useChainContext();

  useEffect(() => {
    fetchAssets();
    fetchDepositParams();
  }, []);

  const fetchDepositParams = async () => {
    try {
      if (loadingRef.current) return;
      setLoading(true);
      loadingRef.current = true;
      const params = await queryGovParams(queryClient!, 'deposit');
      const { depositParams } = params ?? {};
      if (!depositParams) throw new Error('Unable to fetch proposal deposit requirements');
      const minDeposits = depositParams.minDeposit;
      if (!Array.isArray(minDeposits)) throw new Error('Unable to fetch proposal deposit requirements');
      if (!minDeposits.length) {
        onSuccess({
          token: {
            token: undefined,
            ibc: false,
            chain: chainInfo?.chainName ?? chain.chainId,
            amount: '',
            denom: '',
          } as CURRENCY_TOKEN,
        });
      } else {
        const minDeposit = minDeposits[0];
        const minDepositToken = customQueries.currency.findTokenFromDenom(minDeposit.denom);
        // TODO: add support for multiple types/denoms of deposits (if supported by chain)
        setToken({
          token: minDepositToken,
          ibc: validateIbcDenom(minDeposit.denom) ?? '',
          chain: chainInfo?.chainName ?? chain.chainId,
          amount: minDeposit.amount,
          denom: minDeposit.denom,
        });
      }
    } catch (error) {
      console.error('fetchDepositParams::', error);
      setError((error as { message: string }).message);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  };

  const formIsValid = () =>
    token &&
    validateAmountAgainstBalance(
      Number(token?.amount ?? 0),
      Number(wallet?.balances?.data?.find((b) => b?.denom === token?.denom)?.amount ?? 0),
      false,
    );

  const handleSubmit = (event: FormEvent<HTMLFormElement> | null) => {
    event?.preventDefault();
    if (!formIsValid()) return alert("You don't have enough tokens to deposit");
    onSuccess({ token: token! });
  };

  return (
    <>
      <Header header={header} />

      <main className={cls(utilsStyles.main, utilsStyles.columnJustifyCenter, styles.stepContainer)}>
        {loading || !token ? (
          <div className={utilsStyles.center}>
            <Loader />
          </div>
        ) : !wallet.balances?.data ? (
          <IconText title="You don't have any tokens to deposit." Img={SadFace} imgSize={50} />
        ) : (
          <form className={styles.stepsForm} onSubmit={handleSubmit} autoComplete='none'>
            {error ? (
              <IconText title={error} Img={SadFace} imgSize={50} />
            ) : (
              <>
                <p className={styles.label}>
                  Submitting Proposals to{' '}
                  <strong>
                    {chainInfo?.chainName ?? chain?.chainId ?? 'unknown chain'} {chain.chainNetwork}
                  </strong>{' '}
                  requires a deposit of{' '}
                  <strong>
                    {getDisplayAmountFromCurrencyToken(token)} {getDisplayDenomFromCurrencyToken(token)}
                  </strong>
                  .
                </p>
                <div className={utilsStyles.spacer1} />
                {!formIsValid() ? (
                  <IconText title="You don't have enough tokens to deposit." Img={SadFace} imgSize={50} />
                ) : (
                  <>
                    <p className={styles.label}>The deposit will be refunded if the proposal passes.</p>
                    <div className={utilsStyles.spacer7} />
                    <p className={styles.label}>
                      Deposit{' '}
                      <span className={styles.highlighted}>
                        {getDisplayAmountFromCurrencyToken(token)} {getDisplayDenomFromCurrencyToken(token)}
                      </span>
                      ?
                    </p>
                  </>
                )}
              </>
            )}
          </form>
        )}
      </main>

      <Footer
        onBack={onBack}
        onBackUrl={onBack ? undefined : ''}
        onForward={formIsValid() ? () => handleSubmit(null) : null}
      />
    </>
  );
};

export default ProposalDeposit;
