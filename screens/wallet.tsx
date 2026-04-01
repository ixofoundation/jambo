import { useState, useEffect, useCallback } from 'react';

import CollapsibleHeader from '@components/CollapsibleHeader/CollapsibleHeader';
import Loader from '@components/Loader/Loader';
import { useAuth } from '@hooks/useAuth';
import { createQueryClient } from '@ixo/impactxclient-sdk';
import { CHAIN_RPC_URL } from '@constants/common';
import assetListData from '@constants/assets-list.json';

interface Balance {
  denom: string;
  amount: string;
}

interface AssetInfo {
  symbol: string;
  logoPng: string;
  exponent: number;
  coingeckoId?: string;
}

type PriceMap = Record<string, number>;

const assets = assetListData[0].assets;

function findAsset(denom: string): AssetInfo | null {
  const entry = assets.find((a) => a.base === denom);
  if (!entry) return null;
  return {
    symbol: entry.symbol,
    logoPng: entry.logoURIs.png,
    exponent: entry.denomUnits[0]?.exponent ?? 0,
    coingeckoId: entry.coingeckoId,
  };
}

function formatDenom(denom: string): string {
  if (denom === 'uixo') return 'IXO';
  if (denom.startsWith('ibc/')) return `IBC/${denom.slice(4, 10)}...`;
  if (denom.startsWith('u')) return denom.slice(1).toUpperCase();
  return denom.toUpperCase();
}

function getDisplayAmount(amount: string, exponent: number): number {
  return Number(amount) / Math.pow(10, exponent);
}

function formatDisplayAmount(value: number): string {
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  }).format(value);
}

function formatUsd(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

async function fetchPrices(coingeckoIds: string[]): Promise<PriceMap> {
  if (coingeckoIds.length === 0) return {};
  try {
    const ids = coingeckoIds.join(',');
    const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`);
    if (!res.ok) return {};
    const data = await res.json();
    const prices: PriceMap = {};
    for (const id of coingeckoIds) {
      if (data[id]?.usd != null) prices[id] = data[id].usd;
    }
    return prices;
  } catch {
    return {};
  }
}

export default function WalletScreen() {
  const { address } = useAuth();
  const [balances, setBalances] = useState<Balance[]>([]);
  const [prices, setPrices] = useState<PriceMap>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBalances = useCallback(async () => {
    if (!address) return;
    setLoading(true);
    setError(null);
    try {
      const queryClient = await createQueryClient(CHAIN_RPC_URL);
      const response = await queryClient.cosmos.bank.v1beta1.allBalances({ address });
      const bals = (response.balances as Balance[]) ?? [];
      setBalances(bals);

      const ids = bals
        .map((b) => findAsset(b.denom)?.coingeckoId)
        .filter((id): id is string => !!id);
      const uniqueIds = [...new Set(ids)];
      const priceMap = await fetchPrices(uniqueIds);
      setPrices(priceMap);
    } catch (err: any) {
      console.error('Failed to fetch balances:', err);
      setError(err.message || 'Failed to load balances');
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    fetchBalances();
  }, [fetchBalances]);

  const enriched = balances.map((bal) => {
    const asset = findAsset(bal.denom);
    const exponent = asset?.exponent ?? (bal.denom.startsWith('u') ? 6 : 0);
    const displayAmount = getDisplayAmount(bal.amount, exponent);
    const usdPrice = asset?.coingeckoId ? prices[asset.coingeckoId] ?? null : null;
    const usdValue = usdPrice != null ? displayAmount * usdPrice : null;
    return {
      denom: bal.denom,
      symbol: asset?.symbol ?? formatDenom(bal.denom),
      logoPng: asset?.logoPng ?? null,
      displayAmount,
      usdValue,
    };
  });

  const totalUsd = enriched.reduce((sum, b) => sum + (b.usdValue ?? 0), 0);
  const hasPrices = enriched.some((b) => b.usdValue != null);

  return (
    <div style={{ position: 'relative', minHeight: '100vh' }}>
      <CollapsibleHeader
        variant='blue'
        logo='/images/yoma-impacts-exchange-mono-logo.png'
        logoAlt='Yoma Impacts Exchange'
        title='Wallet'
      />
      <main
        style={{
          position: 'relative',
          zIndex: 1,
          maxWidth: 'var(--max-width)',
          margin: '0 auto',
          padding: '16px',
          paddingTop: 'calc(min(30vh, 300px) + 16px)',
          paddingBottom: 'calc(var(--footer-height) + 16px)',
          minHeight: 'calc(100vh + min(30vh, 300px) - var(--header-height))',
          display: 'flex',
          flexDirection: 'column' as const,
        }}
      >
        {/* Total portfolio value */}
        {!loading && !error && hasPrices && balances.length > 0 && (
          <div style={{ textAlign: 'center', marginBottom: '16px' }}>
            <p style={{ margin: '0 0 4px', fontSize: '13px', color: 'var(--text-secondary)' }}>Total Balance</p>
            <p style={{ margin: 0, fontSize: '28px', fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
              {formatUsd(totalUsd)}
            </p>
          </div>
        )}

        {/* Balances card */}
        <div
          style={{
            backgroundColor: 'var(--bg-secondary)',
            borderRadius: '16px',
            border: '1px solid var(--border-color)',
            padding: '16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <h3
              style={{
                margin: 0,
                fontSize: '13px',
                fontWeight: 600,
                color: 'var(--text-secondary)',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              Token Balances
            </h3>
            {!loading && (
              <button
                onClick={() => fetchBalances()}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px',
                  color: 'var(--text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                }}
                title='Refresh'
              >
                <svg
                  width='16'
                  height='16'
                  viewBox='0 0 24 24'
                  fill='none'
                  stroke='currentColor'
                  strokeWidth='2'
                  strokeLinecap='round'
                  strokeLinejoin='round'
                >
                  <polyline points='23 4 23 10 17 10' />
                  <polyline points='1 20 1 14 7 14' />
                  <path d='M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15' />
                </svg>
              </button>
            )}
          </div>

          {loading && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 0' }}>
              <Loader size={36} />
            </div>
          )}

          {!loading && error && (
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <p style={{ margin: '0 0 12px', fontSize: '14px', color: 'var(--error-color)' }}>{error}</p>
              <button
                onClick={() => fetchBalances()}
                style={{
                  padding: '8px 20px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'transparent',
                  cursor: 'pointer',
                  fontSize: '13px',
                  color: 'var(--text-primary)',
                }}
              >
                Retry
              </button>
            </div>
          )}

          {!loading && !error && balances.length === 0 && (
            <p style={{ margin: 0, padding: '24px 0', textAlign: 'center', fontSize: '14px', color: 'var(--text-secondary)' }}>
              No token balances found
            </p>
          )}

          {!loading && !error && enriched.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {enriched.map((bal) => (
                <div
                  key={bal.denom}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px 14px',
                    borderRadius: '10px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--card-bg-color)',
                  }}
                >
                  {/* Token logo */}
                  {bal.logoPng ? (
                    <img
                      src={bal.logoPng}
                      alt={bal.symbol}
                      width={32}
                      height={32}
                      style={{ borderRadius: '50%', flexShrink: 0 }}
                    />
                  ) : (
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: '50%',
                        backgroundColor: 'var(--accent-color)',
                        color: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '13px',
                        fontWeight: 600,
                        flexShrink: 0,
                      }}
                    >
                      {bal.symbol.charAt(0)}
                    </div>
                  )}

                  {/* Token name */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>
                      {bal.symbol}
                    </p>
                  </div>

                  {/* Amount + USD */}
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <p style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                      {formatDisplayAmount(bal.displayAmount)}
                    </p>
                    {bal.usdValue != null && (
                      <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
                        {formatUsd(bal.usdValue)}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
