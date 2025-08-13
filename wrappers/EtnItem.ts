import { Address, Builder, Cell, Contract, ContractProvider, Sender, SendMode } from '@ton/core';

export class EtnItem implements Contract {
    constructor(readonly address: Address, readonly init?: { code: Cell; data: Cell }) {}

    static createFromAddress(address: Address) {
        return new EtnItem(address);
    }

    async getNftData(provider: ContractProvider) {
        const result = await provider.get('get_nft_data', []);
        const stack = result.stack;
        return {
            init: stack.readNumber(),
            item_index: stack.readBigNumber(),
            collection_address: stack.readAddress(),
            owner_address: stack.readAddress(),
            content: stack.readCell(),
        };
    }
}
