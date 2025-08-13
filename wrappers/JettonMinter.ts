import { Address, beginCell, Cell, Contract, contractAddress, ContractProvider, Sender, SendMode, toNano } from '@ton/core';

export type JettonMinterConfig = {
    adminAddress: Address;
    content: Cell;
    jettonWalletCode: Cell;
};

export function jettonMinterConfigToCell(config: JettonMinterConfig): Cell {
    return beginCell()
        .storeCoins(0) // total_supply
        .storeAddress(config.adminAddress)
        .storeRef(config.content)
        .storeRef(config.jettonWalletCode)
        .endCell();
}

export class JettonMinter implements Contract {
    constructor(readonly address: Address, readonly init?: { code: Cell; data: Cell }) {}

    static createFromAddress(address: Address) {
        return new JettonMinter(address);
    }

    static createFromConfig(config: JettonMinterConfig, code: Cell, workchain = 0) {
        const data = jettonMinterConfigToCell(config);
        const init = { code, data };
        return new JettonMinter(contractAddress(workchain, init), init);
    }

    async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().endCell(),
        });
    }

    async sendMint(provider: ContractProvider, via: Sender, toAddress: Address, jettonAmount: bigint) {
        const body = beginCell()
            .storeUint(21, 32) // op_mint
            .storeUint(0, 64) // query_id
            .storeAddress(toAddress)
            .storeCoins(jettonAmount)
            .storeRef(
                beginCell()
                    .storeUint(0x178d4519, 32) // op_internal_transfer
                    .storeUint(0, 64)
                    .storeCoins(jettonAmount)
                    .storeAddress(null)
                    .storeAddress(toAddress)
                    .storeCoins(0)
                    .storeBit(false)
                .endCell()
            )
            .endCell();

        await provider.internal(via, {
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: body,
            value: toNano('0.1'),
        });
    }

    async getWalletAddress(provider: ContractProvider, forAddress: Address): Promise<Address> {
        const result = await provider.get('get_wallet_address', [
            { type: 'slice', cell: beginCell().storeAddress(forAddress).endCell() }
        ]);
        return result.stack.readAddress();
    }
}
