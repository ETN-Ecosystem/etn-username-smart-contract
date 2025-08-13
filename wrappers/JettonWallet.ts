import { Address, beginCell, Cell, Contract, ContractProvider, Sender, SendMode, toNano } from '@ton/core';

export class JettonWallet implements Contract {
    constructor(readonly address: Address, readonly init?: { code: Cell; data: Cell }) {}

    async sendTransfer(
        provider: ContractProvider,
        via: Sender,
        gas: bigint,
        jettonAmount: bigint,
        to: Address,
        responseAddress: Address,
        customPayload: Cell | null,
        forwardTonAmount: bigint,
        forwardPayload: Cell | null
    ) {
        const body = beginCell()
            .storeUint(0xf8a7ea5, 32) // op jetton transfer
            .storeUint(0, 64) // query id
            .storeCoins(jettonAmount)
            .storeAddress(to)
            .storeAddress(responseAddress)
            .storeMaybeRef(customPayload)
            .storeCoins(forwardTonAmount)
            .storeMaybeRef(forwardPayload)
            .endCell();

        await provider.internal(via, {
            to: this.address,
            value: gas,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: body,
        });
    }

    async getJettonBalance(provider: ContractProvider) {
        let state = await provider.getState();
        if (state.balance === 0n) {
            return 0n;
        }
        const result = await provider.get('get_wallet_data', []);
        return result.stack.readBigNumber();
    }
}
