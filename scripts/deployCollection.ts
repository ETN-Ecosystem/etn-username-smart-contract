import { toNano, Address, beginCell, Dictionary } from '@ton/core';
import { EtnCollection, EtnCollectionConfig } from '../wrappers/EtnCollection';
import { compile, NetworkProvider } from '@ton/blueprint';

export async function run(provider: NetworkProvider) {
    const owner = provider.sender();
    const ownerAddress = owner.address;
    if (!ownerAddress) {
        throw new Error('No deployer address specified');
    }

    // --- Configuration from Pre-Flight Checklist ---
    const beneficiaryAddress = Address.parse('UQDqkn-Y1G77_un13nqgx1jGh6XXH6deL737gdUxlpFhz9eF');
    const jettonMasterAddress = Address.parse('EQAz_XrD0hA4cqlprWkpS7TIAhCG4CknAfob1VQm-2mBf5VI');
    const metadataUrl = "https://u-nft.etnecosystem.org/api/";

    const config: EtnCollectionConfig = {
        ownerAddress: ownerAddress,
        nextItemIndex: 0,
        collectionContent: beginCell().storeStringTail(metadataUrl).endCell(),
        nftItemCode: await compile('EtnItem'),
        beneficiaryAddress: beneficiaryAddress,
        jettonMasterAddress: jettonMasterAddress,
        mintedHashes: Dictionary.empty(Dictionary.Keys.BigUint(256), Dictionary.Values.Cell())
    };

    const etnCollection = provider.open(
        EtnCollection.createFromConfig(config, await compile('EtnCollection'))
    );

    await etnCollection.sendDeploy(provider.sender(), toNano('0.1'));
    await provider.waitForDeploy(etnCollection.address);

    console.log('✅ ETN Username Collection deployed at:', etnCollection.address.toString());
}
