import { useEffect, useState } from 'react';
import { createSigningClient } from '@ixo/impactxclient-sdk';
import { MsgVote } from '@ixo/impactxclient-sdk/types/codegen/cosmos/gov/v1beta1/tx';

const useIXOGovernance = (
    proposalId: string,
    vote: string,
    voterAddress: string,
    mnemonic: string,
) => {
    const [txHash, setTxHash] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        const castVote = async () => {
            try {
                const client = await createSigningClient('https://testnet.ixo.world/api/v1', mnemonic);
                const governanceContract = await client.getTx('ixoGovernance');

                const msgVote = new MsgVote({
                    proposalId: proposalId,
                    voter: voterAddress,
                    option: vote,
                })

                const txHash = await governanceContract.submitMsg(msgVote)
                setTxHash(txHash);
            } catch (err) {
                setError(err);
            }
        };

        castVote();
    }, [proposalId, vote, voterAddress, mnemonic]);

    return { txHash, error };
};

export default useIXOGovernance;
