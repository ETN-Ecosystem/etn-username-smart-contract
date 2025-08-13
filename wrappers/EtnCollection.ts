import { Address, beginCell, Cell, Contract, contractAddress, ContractProvider, Sender, SendMode, toNano } from '@ton/core';

export type EtnCollectionConfig = {
    ownerAddress: Address;
    nextItemIndex: number;
    collectionContent: Cell;
    nftItemCode: Cell;
    beneficiaryAddress: Address;
    jettonMasterAddress: Address;
    mintedHashes: Cell;
};

export function etnCollectionConfigToCell(config: EtnCollectionConfig): Cell {
    return beginCell()
       .storeAddress(config.ownerAddress)
       .storeUint(config.nextItemIndex, 64)
       .storeRef(config.collectionContent)
       .storeRef(config.nftItemCode)
       .storeAddress(config.beneficiaryAddress)
       .storeAddress(config.jettonMasterAddress)
       .storeDict(config.mintedHashes)
       .endCell();
}

export class EtnCollection implements Contract {
    constructor(readonly address: Address, readonly init?: { code: Cell; data: Cell }) {}

    static createFromAddress(address: Address) {
        return new EtnCollection(address);
    }

    static createFromConfig(config: EtnCollectionConfig, code: Cell, workchain = 0) {
        const data = etnCollectionConfigToCell(config);
        const init = { code, data };
        return new EtnCollection(contractAddress(workchain, init), init);
    }

    async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().endCell(),
        });
    }

    // A message from a user's jetton wallet to the collection contract
    async sendMintUsername(
        provider: ContractProvider,
        via: Sender, // The user's wallet that sends the message
        userJettonWalletAddress: Address, // The user's jetton wallet address
        opts: {
            username: string;
            mintPrice: bigint;
            gasAmount?: bigint;
            queryId?: number;
        }
    ) {
        const forwardPayload = beginCell().storeStringTail(opts.username).endCell();

        // This is the body of the message that will be sent from the user's wallet
        // to their jetton wallet. The jetton wallet will then send a jetton_transfer
        // message to the collection contract.
        const jettonTransferBody = beginCell()
           .storeUint(0xf8a7ea5, 32) // op::jetton_transfer
           .storeUint(opts.queryId ?? 0, 64)
           .storeCoins(opts.mintPrice)
           .storeAddress(this.address) // destination is the collection contract
           .storeAddress(via.address) // response_destination
           .storeMaybeRef(null) // custom_payload
           .storeCoins(toNano('0.1')) // forward_ton_amount to trigger notification
           .storeRef(forwardPayload)
       .endCell();

        // The user's wallet sends a message to their own jetton wallet,
        // instructing it to perform the transfer.
        await provider.internal(via, {
            to: userJettonWalletAddress,
            value: opts.gasAmount ?? toNano('0.5'),
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: jettonTransferBody,
        });
    }

    async getCollectionData(provider: ContractProvider) {
        const { stack } = await provider.get('get_collection_data', []);
        const next_item_index = stack.readNumber();
        const collection_content = stack.readCell();
        const owner_address = stack.readAddress();
        const beneficiary_address = stack.readAddress();
        const jetton_master_address = stack.readAddress();
        return {
            next_item_index,
            collection_content,
            owner_address,
            beneficiary_address,
            jetton_master_address,
        };
    }

    async getNftAddressByIndex(provider: ContractProvider, index: bigint): Promise<Address> {
        const { stack } = await provider.get('get_nft_address_by_index', [{ type: 'int', value: index }]);
        return stack.readAddress();
    }
}
