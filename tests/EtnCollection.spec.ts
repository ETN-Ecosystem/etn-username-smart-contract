import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { Cell, toNano, beginCell, Address, Dictionary } from '@ton/core';
import { EtnCollection } from '../wrappers/EtnCollection';
import { EtnItem } from '../wrappers/EtnItem';
import '@ton/test-utils';
import { compile } from '@ton/blueprint';
import { JettonMinter } from '../wrappers/JettonMinter';
import { JettonWallet } from '../wrappers/JettonWallet';
import { sha256 } from 'crypto-hash';

describe('EtnCollection Lazy Minting', () => {
    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let beneficiary: SandboxContract<TreasuryContract>;
    let minterUser: SandboxContract<TreasuryContract>;
    let etnCollection: SandboxContract<EtnCollection>;
    let jettonMinter: SandboxContract<JettonMinter>;
    let jettonWalletCode: Cell;
    let etnItemCode: Cell;

    beforeAll(async () => {
        etnItemCode = await compile('EtnItem');
        const etnCollectionCode = await compile('EtnCollection');
        jettonWalletCode = await compile('JettonWallet'); // A standard jetton wallet
        const jettonMinterCode = await compile('JettonMinter'); // A standard jetton minter

        blockchain = await Blockchain.create();
        deployer = await blockchain.treasury('deployer');
        beneficiary = await blockchain.treasury('beneficiary');
        minterUser = await blockchain.treasury('minterUser');

        jettonMinter = blockchain.openContract(
            JettonMinter.createFromConfig(
                {
                    adminAddress: deployer.address,
                    content: beginCell().endCell(),
                    jettonWalletCode: jettonWalletCode,
                },
                jettonMinterCode
            )
        );
        await jettonMinter.sendDeploy(deployer.getSender(), toNano('0.05'));

        etnCollection = blockchain.openContract(
            EtnCollection.createFromConfig(
                {
                    ownerAddress: deployer.address,
                    nextItemIndex: 0,
                    collectionContent: beginCell().storeStringTail('https://u-nft.etnecosystem.org/api/').endCell(),
                    nftItemCode: etnItemCode,
                    beneficiaryAddress: beneficiary.address,
                    jettonMasterAddress: jettonMinter.address,
                    mintedHashes: Dictionary.empty(Dictionary.Keys.BigUint(256), Dictionary.Values.Cell()),
                },
                etnCollectionCode
            )
        );
        await etnCollection.sendDeploy(deployer.getSender(), toNano('0.05'));
    });

    it('should allow a user to mint a new username and forward funds', async () => {
        const username = 'testuser';
        const mintPrice = toNano('500'); // Price for 7+ characters

        // Mint jettons to the user
        await jettonMinter.sendMint(deployer.getSender(), minterUser.address, mintPrice);
        const userJettonWallet = blockchain.openContract(
            JettonWallet.createFromAddress(await jettonMinter.getWalletAddress(minterUser.address))
        );
        const userJettonBalance = await userJettonWallet.getJettonBalance();
        expect(userJettonBalance).toEqual(mintPrice);

        // User initiates minting
        const mintResult = await etnCollection.sendMintUsername(
            blockchain.provider(minterUser.address),
            minterUser.getSender(),
            userJettonWallet.address,
            {
                username,
                mintPrice,
            }
        );

        // Check for the successful chain of transactions
        expect(mintResult.transactions).toHaveTransaction({
            from: minterUser.address,
            to: userJettonWallet.address,
            success: true,
        });
        const collectionJettonWalletAddress = await jettonMinter.getWalletAddress(etnCollection.address);
        expect(mintResult.transactions).toHaveTransaction({
            from: userJettonWallet.address,
            to: collectionJettonWalletAddress,
            success: true,
        });
        expect(mintResult.transactions).toHaveTransaction({
            from: collectionJettonWalletAddress,
            to: etnCollection.address,
            op: 0x7362d09c, // op::jetton_transfer_notification
            success: true,
        });

        // Check that a new NFT item was deployed
        const usernameHash = BigInt('0x' + (await sha256(username)));
        const itemAddress = await etnCollection.getNftAddressByIndex(usernameHash);
        const itemContract = blockchain.openContract(EtnItem.createFromAddress(itemAddress));
        const itemData = await itemContract.getNftData();

        expect(itemData.init).toBe(-1);
        expect(itemData.owner_address.equals(minterUser.address)).toBe(true);
        expect(itemData.item_index).toEqual(usernameHash);
        expect(itemData.collection_address.equals(etnCollection.address)).toBe(true);

        // Check that funds were forwarded to the beneficiary
        const beneficiaryJettonWallet = blockchain.openContract(
            JettonWallet.createFromAddress(await jettonMinter.getWalletAddress(beneficiary.address))
        );
        const beneficiaryBalance = await beneficiaryJettonWallet.getJettonBalance();
        expect(beneficiaryBalance).toEqual(mintPrice);
    });

    it('should fail to mint a username that is already taken', async () => {
        const username = 'taken-user';
        const mintPrice = toNano('500');

        // First mint is successful
        await jettonMinter.sendMint(deployer.getSender(), minterUser.address, mintPrice);
        const userJettonWallet = blockchain.openContract(
            JettonWallet.createFromAddress(await jettonMinter.getWalletAddress(minterUser.address))
        );
        await etnCollection.sendMintUsername(
            blockchain.provider(minterUser.address),
            minterUser.getSender(),
            userJettonWallet.address,
            {
                username,
                mintPrice,
            }
        );

        // Second attempt to mint the same username
        const mintResult = await etnCollection.sendMintUsername(
            blockchain.provider(minterUser.address),
            minterUser.getSender(),
            userJettonWallet.address,
            {
                username,
                mintPrice,
            }
        );

        // Check that the final transaction to the collection contract fails with the correct error code
        const collectionJettonWalletAddress = await jettonMinter.getWalletAddress(etnCollection.address);
        expect(mintResult.transactions).toHaveTransaction({
            from: collectionJettonWalletAddress,
            to: etnCollection.address,
            success: false,
            exitCode: 409, // 409 Conflict: Username already taken
        });
    });
});
