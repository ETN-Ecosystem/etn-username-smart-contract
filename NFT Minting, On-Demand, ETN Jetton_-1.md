

# **A Definitive Architectural and Implementation Guide for a Decentralized, On-Demand Username NFT System on The Open Network**

## **Section 1: System Architecture and On-Chain Protocol Design**

This section establishes the foundational architectural decisions for the ETN Username NFT system. It proposes a revised, robust, and truly decentralized protocol that builds upon the initial Product Requirements Document (PRD).1 The analysis centers on The Open Network's (TON) unique smart contract model, critically evaluates different "on-demand" minting strategies, and defines a secure, scalable transaction flow for user-initiated minting via TEP-74 Jetton payments.

### **1.1. Core Architectural Principles: The TON NFT Paradigm**

The architecture of any non-fungible token system is fundamentally shaped by the capabilities and constraints of its underlying blockchain. On TON, the design philosophy for NFTs diverges significantly from that of EVM-based chains, prioritizing scalability and decentralization through a distinct contract model.

#### **1.1.1. The "One NFT, One Contract" Model**

Unlike Ethereum's ERC-721 standard, where a single smart contract typically manages a large mapping of token IDs to owner addresses, TON employs a "one NFT, one contract" model as specified in the TEP-62 standard.2 In this paradigm, every individual NFT is its own smart contract instance (

nft-item.fc), with its own address, state, and code. These individual item contracts are deployed and managed by a central nft-collection.fc contract, which acts as a factory and a registry for the entire collection.2

This architectural choice is a direct consequence of TON's design for massive scalability through sharding.2 By isolating each NFT into its own contract, the computational load of minting, transferring, and interacting with different NFTs can be distributed across multiple shardchains. This prevents the collection contract from becoming a performance bottleneck, a known issue for highly popular NFT collections on monolithic blockchains where all transactions must be processed by a single contract. While this approach offers superior scalability and flexibility, it necessitates a more complex interaction model, as retrieving information about an entire collection may require querying multiple contracts.2

#### **1.1.2. Analysis of "On-Demand" Minting Models**

The user requirement for "on-demand minting" can be interpreted in two primary ways, each with profound implications for the system's decentralization, cost structure, and scalability.

1. **Pre-Deployed Sale Model:** This model, described in the initial PRD 10, involves the project owner pre-deploying a set of  
   EtnItem smart contracts. These contracts exist on the blockchain in an un-owned state (initially owned by the collection contract). A user "mints" an item by sending a payment to one of these pre-deployed contracts, which then triggers an ownership change. This model is functionally a "sale" of a pre-existing asset rather than a true minting event from the user's perspective. While suitable for small, finite collections, it is fundamentally unscalable for a username system where the potential number of mintable assets is virtually infinite. The upfront gas cost for the project owner to deploy millions or billions of potential username contracts would be economically prohibitive.  
2. **True Lazy Minting Model:** This model defers the creation of the NFT until the moment of its first sale. The NFT does not exist on the blockchain until a user decides to buy it. The user's payment transaction initiates and funds not only the ownership transfer but also the very deployment of the EtnItem smart contract itself. This shifts the upfront gas cost from the project owner to the buyer at the time of purchase, making it a far more cost-effective and scalable approach for large or infinite collections. This method is the only viable path to achieving a truly on-demand and decentralized system for a service like ETN Usernames.

#### **1.1.3. Architectural Recommendation**

This revised specification formally adopts the **True Lazy Minting Model**. This decision directly addresses the core requirements of the user query for a "fully decentralized, on-demand" protocol. The pre-deployed model from the initial PRD is insufficient for the scale of a username system. The lazy minting architecture ensures that the system can scale indefinitely without incurring prohibitive upfront costs for the project owner, aligning the cost of creation with the demand for the asset.

This architectural shift necessitates a re-evaluation of the contract responsibilities outlined in the PRD. The payment and minting logic must be centralized within the collection contract, which will now act as both a factory and the primary point of interaction for users wishing to mint a new username.

The following table provides a comparative analysis of the two minting models, justifying the architectural pivot.

| Feature | Pre-Deployed Sale Model (PRD) | True Lazy Minting Model (Revised) |
| :---- | :---- | :---- |
| **User Gas Cost** | Lower (only pays for transfer) | Higher (pays for deployment \+ transfer) |
| **Owner Gas Cost** | Extremely High (pays for all deployments upfront) | Minimal (only pays for collection deployment) |
| **Scalability** | Low (limited by owner's capital for deployment) | Infinite (scales with user demand) |
| **Decentralization** | Lower (owner must pre-select and deploy mintable items) | Higher (any valid username can be minted by any user at any time) |
| **Implementation Complexity** | Simpler (payment logic is isolated in the item contract) | More Complex (collection contract manages payment, validation, and deployment) |

### **1.2. The On-Chain Contract Ecosystem (Revised Lazy Minting Model)**

The adoption of a true lazy minting model refines the roles and interactions of the on-chain components. The system will consist of two primary FunC smart contracts: a central minter/factory contract and a simplified NFT item contract.

* **EtnCollection (Factory & Minter):** This contract serves as the central hub and sole entry point for the minting process. Its responsibilities are twofold:  
  1. **Factory:** It stores the compiled bytecode of the EtnItem contract and the immutable configuration data for the collection, such as the beneficiary's wallet address and the address of the ETN Jetton master contract.  
  2. **Minter:** It is the direct recipient of the user's jetton\_transfer message. It houses the complete logic for validating a mint request: authenticating the payment notification, checking for username uniqueness against an on-chain registry, verifying the payment amount against the dynamic pricing model, and orchestrating the deployment of the new EtnItem contract. This centralization of logic enhances security and gas efficiency.11  
* **EtnItem (NFT Instance):** The EtnItem contract is simplified to its essential function: representing the state of a single username NFT. Its sole responsibilities are to hold the immutable item\_index and collection\_address, and the mutable owner\_address and content. It will only contain logic for standard TEP-62 operations, primarily ownership transfers.2 All payment validation and initial deployment logic are removed, as these are now handled by the  
  EtnCollection contract. This separation of concerns makes the EtnItem contract more lightweight, reducing its deployment gas cost and minimizing its potential attack surface.13

### **1.3. The Minting Transaction Flow (Revised)**

The asynchronous nature of TON requires a precise sequence of messages to execute the lazy minting process securely. The following flow details the interaction between the user's wallet, the Jetton contracts, and the ETN Username contracts.

1. **User Action (Frontend):** The user initiates the process by sending a standard TEP-74 jetton\_transfer message from their wallet. The destination for this transfer is the EtnCollection contract's address. The forward\_payload of this message is critically important; it must contain a cell with the desired username string encoded in UTF-8.1  
2. **Jetton Wallet Interaction:** The user's Jetton wallet contract sends an internal\_transfer message to the Jetton wallet contract associated with the EtnCollection contract.  
3. **Payment Notification:** Upon receiving the jettons, the EtnCollection's Jetton wallet sends a transfer\_notification message to the EtnCollection smart contract. This notification is the trigger for the minting logic and contains the essential data: the amount of jettons sent, the original sender's address (from\_address), and the forward\_payload containing the username.14  
4. **EtnCollection Validation Logic:** The recv\_internal function of the EtnCollection contract is invoked. It executes a rigorous, sequential validation process:  
   * **Sender Verification:** It confirms that the transfer\_notification originated from its own legitimate Jetton wallet address. This is a non-negotiable security check to prevent spoofed payment notifications.16  
   * **Payload Parsing:** It parses the username string from the forward\_payload.  
   * **Price Calculation:** It determines the required mint price based on the length of the username string.  
   * **Payment Verification:** It compares the required price with the jetton\_amount from the notification. If they do not match exactly, the transaction is terminated with an error.  
   * **Uniqueness Check:** It calculates the SHA-256 hash of the username to create a unique item\_index. It then queries its internal minted\_usernames dictionary to ensure this index has not been previously registered. If the username is already taken, the transaction is terminated.  
5. **NFT Deployment:** If all validation checks pass, the EtnCollection contract proceeds with deployment. It constructs the initial data (StateInit) for a new EtnItem contract. This StateInit includes the item\_index (the username hash), the collection's address, the user's address as the initial owner, and the username string as the content. It then sends a message with this StateInit to the deterministically calculated address of the new EtnItem contract, deploying it on the blockchain.6  
6. **Fund Forwarding:** Finally, the EtnCollection contract constructs a new jetton\_transfer message to send the full amount of the received payment from its own Jetton wallet to the project's designated beneficiary address.

### **1.4. Security and Trust Model**

The security of the entire system hinges on several key principles implemented within the smart contracts.

* **Payment Verification:** The most critical security measure is the validation of the transfer\_notification sender. The EtnCollection contract must calculate what its own Jetton wallet address should be and compare it to the sender of the notification. This check is the sole defense against an attacker sending a fraudulent notification to mint an NFT for free. The calculation of a Jetton wallet address is deterministic and based on the owner's address (the collection contract) and the Jetton master address, a standard practice in the TON ecosystem.  
* **Username Uniqueness (On-Chain Registry):** To guarantee that each username is unique and prevent double-minting, the EtnCollection contract will maintain an on-chain dictionary. A dictionary in FunC is a hashmap data structure.24 The key for this dictionary will be the 256-bit  
  item\_index derived from the username's hash, and the value can be a simple boolean flag. Before deploying a new EtnItem, the contract will perform a udict\_get? operation. This function attempts to retrieve a value for a given key; if it succeeds (returns a value and a \-1 flag), it means the key already exists, and the minting process must be aborted.26 If it fails (returns  
  null and a 0 flag), the key is available, and the mint can proceed.  
* **Replay Attack Prevention:** The use of the username's hash as the item\_index provides robust protection against replay attacks. Since the item\_index is unique to the username, an attacker cannot reuse a valid minting transaction for one username to mint another. The uniqueness check against the on-chain dictionary ensures that even replaying the exact same transaction will fail after the first successful mint.

## **Section 2: Smart Contract Implementation (FunC)**

This section provides the complete, production-ready FunC source code for the revised ETN Username NFT system. The code is designed for clarity, security, and gas efficiency, incorporating established best practices for smart contract development on The Open Network. Each contract is presented with detailed annotations explaining the purpose of key functions and security checks.

### **2.1. Shared Constants and Utilities (contracts/common.fc)**

To maintain code consistency and avoid the use of "magic numbers," a shared constants file is established. This file defines the standard operation codes (op-codes) for TEP-74 Jetton interactions, which are fundamental to the payment mechanism of the system.1

Code snippet

\#ifndef \_COMMON\_FC\_  
\#define \_COMMON\_FC\_

;; Jetton-related constants from TEP-74 standard  
const int op::jetton\_transfer \= 0xf8a7ea5;  
const int op::jetton\_transfer\_notification \= 0x7362d09c;  
const int op::jetton\_internal\_transfer \= 0x178d4519;

\#endif

### **2.2. The EtnCollection Minter Contract (Revised) (contracts/etn-collection.fc)**

This contract is the core of the on-demand minting protocol. It acts as the factory for EtnItem contracts and the sole handler of minting requests. It validates payments, ensures username uniqueness via an on-chain dictionary, and orchestrates the deployment of new NFT items.

#### **2.2.1. Includes and Storage Schema**

The contract begins by including necessary libraries and defining its persistent storage structure. The schema now includes minted\_hashes, a cell that will store the dictionary of all minted username hashes, which is essential for enforcing uniqueness.

Code snippet

\#include "stdlib.fc";  
\#include "common.fc";

;; \================= STORAGE \==================  
;; (owner\_address, next\_item\_index, collection\_content, nft\_item\_code, beneficiary\_address, jetton\_master\_address, minted\_hashes)  
(slice, int, cell, cell, slice, slice, cell) load\_data() inline {  
    slice ds \= get\_data().begin\_parse();  
    return (  
        ds\~load\_msg\_addr(),   ;; owner\_address  
        ds\~load\_uint(64),     ;; next\_item\_index (for statistics)  
        ds\~load\_ref(),        ;; collection\_content (TEP-64)  
        ds\~load\_ref(),        ;; nft\_item\_code  
        ds\~load\_msg\_addr(),   ;; beneficiary\_address  
        ds\~load\_msg\_addr(),   ;; jetton\_master\_address  
        ds\~load\_dict()        ;; minted\_hashes (dictionary cell)  
    );  
}

() save\_data(slice owner\_address, int next\_item\_index, cell collection\_content, cell nft\_item\_code, slice beneficiary\_address, slice jetton\_master\_address, cell minted\_hashes) impure inline {  
    set\_data(  
        begin\_cell()  
          .store\_slice(owner\_address)  
          .store\_uint(next\_item\_index, 64\)  
          .store\_ref(collection\_content)  
          .store\_ref(nft\_item\_code)  
          .store\_slice(beneficiary\_address)  
          .store\_slice(jetton\_master\_address)  
          .store\_dict(minted\_hashes)  
       .end\_cell()  
    );  
}

#### **2.2.2. Helper Functions**

Several helper functions are defined to encapsulate key logic, promoting code readability and reusability. This includes functions for price calculation, Jetton wallet address determination, and the deployment of new NFT items.

Code snippet

;; \================= HELPERS \==================  
int calculate\_mint\_price(int username\_len) {  
    if (username\_len \== 3\) { return 1000000000000; } ;; 1000 ETN  
    if (username\_len \== 4\) { return  900000000000; } ;; 900 ETN  
    if (username\_len \== 5\) { return  800000000000; } ;; 800 ETN  
    if (username\_len \== 6\) { return  700000000000; } ;; 700 ETN  
    return 500000000000; ;; 500 ETN for 7+  
}

(slice) calculate\_jetton\_wallet\_address(slice owner\_address, slice jetton\_master\_address) {  
    cell state\_init \= begin\_cell()  
      .store\_uint(0, 2\) ;; split\_depth, special  
      .store\_dict(jetton\_wallet\_code()) ;; Standard library function to get jetton wallet code  
      .store\_dict(  
            begin\_cell()  
              .store\_coins(0)  
              .store\_slice(owner\_address)  
              .store\_slice(jetton\_master\_address)  
              .store\_ref(jetton\_wallet\_code())  
          .end\_cell()  
        )  
      .store\_uint(0, 1\) ;; library  
  .end\_cell();  
    return address(workchain(), cell\_hash(state\_init));  
}

() deploy\_new\_nft(int query\_id, int item\_index, slice new\_owner\_address, cell item\_content, cell nft\_item\_code, int forward\_value) impure {  
    cell item\_data \= begin\_cell()  
       .store\_slice(my\_address())      ;; collection\_address  
       .store\_uint(item\_index, 256\)    ;; item\_index (now 256-bit hash)  
       .store\_slice(new\_owner\_address) ;; initial owner is the minter  
       .store\_ref(item\_content)  
   .end\_cell();

    cell state\_init \= begin\_cell()  
       .store\_uint(4, 3\) ;; has code, has data, library is absent  
       .store\_ref(nft\_item\_code)  
       .store\_ref(item\_data)  
   .end\_cell();

    slice item\_address \= address(workchain(), cell\_hash(state\_init));

    var msg \= begin\_cell()  
       .store\_uint(0x18, 6\)  
       .store\_slice(item\_address)  
       .store\_grams(0)  
       .store\_uint(4 \+ 2 \+ 1, 1 \+ 4 \+ 4 \+ 64 \+ 32 \+ 1 \+ 1\) ;; has state\_init, send all value  
       .store\_ref(state\_init)  
       .store\_grams(forward\_value);

    send\_raw\_message(msg.end\_cell(), 128); ;; mode 128: send all remaining balance  
}

#### **2.2.3. The recv\_internal Message Handler**

This is the main entry point for the contract. It is triggered by the transfer\_notification from its own Jetton wallet. The logic proceeds through a sequence of rigorous checks before executing the mint.

Code snippet

;; \================= MAIN \=====================  
() recv\_internal(int my\_balance, int msg\_value, cell in\_msg\_full, slice in\_msg\_body) impure {  
    if (in\_msg\_body.slice\_empty?()) {  
        return ();  
    }  
    slice cs \= in\_msg\_full.begin\_parse();  
    int flags \= cs\~load\_uint(4);  
    slice sender\_address \= cs\~load\_msg\_addr();

    var (owner\_address, next\_item\_index, collection\_content, nft\_item\_code, beneficiary\_address, jetton\_master\_address, minted\_hashes) \= load\_data();

    int op \= in\_msg\_body\~load\_uint(32);  
    int query\_id \= in\_msg\_body\~load\_uint(64);

    if (op \== op::jetton\_transfer\_notification) {  
        int jetton\_amount \= in\_msg\_body\~load\_coins();  
        slice from\_address \= in\_msg\_body\~load\_msg\_addr();  
        slice forward\_payload \= in\_msg\_body\~load\_ref().begin\_parse();

        ;; 1\. CRITICAL SECURITY CHECK: Verify the notification sender is this collection's jetton wallet.  
        slice expected\_jetton\_wallet \= calculate\_jetton\_wallet\_address(my\_address(), jetton\_master\_address);  
        throw\_unless(403, equal\_slices(sender\_address, expected\_jetton\_wallet));

        ;; 2\. PAYMENT VALIDATION: Check if the sent amount matches the required price.  
        int username\_len \= slice\_bits(forward\_payload) / 8; ;; Assuming simple ASCII/UTF8 string  
        int required\_price \= calculate\_mint\_price(username\_len);  
        throw\_unless(406, jetton\_amount \== required\_price);

        ;; 3\. UNIQUENESS CHECK: Check if the username hash already exists.  
        int item\_index \= string\_hash(forward\_payload);  
        (slice \_, int found) \= minted\_hashes.udict\_get?(256, item\_index);  
        throw\_if(409, found); ;; 409 Conflict: Username already taken

        ;; 4\. MINT EXECUTION: All checks passed.  
        ;; 4a. Deploy the new NFT item, owned by the user.  
        cell item\_content \= begin\_cell().store\_slice(forward\_payload).end\_cell();  
        deploy\_new\_nft(query\_id, item\_index, from\_address, item\_content, nft\_item\_code, msg\_value \- my\_balance);

        ;; 4b. Update the on-chain registry of minted names.  
        minted\_hashes\~udict\_set(256, item\_index, begin\_cell().store\_uint(1, 1).end\_cell().begin\_parse());  
          
        ;; 4c. Update collection state and forward funds.  
        save\_data(owner\_address, next\_item\_index \+ 1, collection\_content, nft\_item\_code, beneficiary\_address, jetton\_master\_address, minted\_hashes);  
          
        ;; Forward the received jettons to the beneficiary  
        var msg \= begin\_cell()  
           .store\_uint(0x18, 6\)  
           .store\_slice(expected\_jetton\_wallet)  
           .store\_grams(0)  
           .store\_uint(1, 1 \+ 4 \+ 4 \+ 64 \+ 32 \+ 1 \+ 1\)  
           .store\_ref(  
                begin\_cell()  
                   .store\_uint(op::jetton\_transfer, 32\)  
                   .store\_uint(query\_id, 64\)  
                   .store\_coins(jetton\_amount)  
                   .store\_slice(beneficiary\_address)  
                   .store\_slice(my\_address()) ;; response\_destination  
                   .store\_maybe\_ref(null())   ;; custom\_payload  
                   .store\_coins(1)            ;; forward\_ton\_amount (minimal)  
                   .store\_maybe\_ref(null())   ;; forward\_payload  
               .end\_cell()  
            );  
        send\_raw\_message(msg.end\_cell(), 1); ;; mode 1: pay gas separately

        return ();  
    }

    ;; Handle administrative functions (e.g., change owner)  
    throw\_unless(401, equal\_slices(sender\_address, owner\_address));  
    ;;... admin logic here...

    throw(0xffff); ;; Unknown op  
}

#### **2.2.4. Get-Methods**

These methods provide a public, read-only interface to the contract's state, compliant with TEP-62.

Code snippet

;; \================= GET-METHODS \==================  
(int, cell, slice) get\_collection\_data() method\_id {  
    var (owner\_address, next\_item\_index, content, \_, \_, \_, \_) \= load\_data();  
    return (next\_item\_index, content, owner\_address);  
}

slice get\_nft\_address\_by\_index(int item\_index) method\_id {  
    var (\_, \_, \_, nft\_item\_code, \_, \_, \_) \= load\_data();  
    cell item\_data \= begin\_cell()  
       .store\_slice(my\_address())  
       .store\_uint(item\_index, 256\)  
       .store\_slice(address(0,0)) ;; Dummy owner for address calculation  
       .store\_ref(begin\_cell().end\_cell()) ;; Dummy content  
   .end\_cell();

    cell state\_init \= begin\_cell()  
       .store\_uint(4, 3\)  
       .store\_ref(nft\_item\_code)  
       .store\_ref(item\_data)  
   .end\_cell();

    return address(workchain(), cell\_hash(state\_init));  
}

### **2.3. The EtnItem NFT Contract (Revised) (contracts/etn-item.fc)**

This contract is now a lean representation of the NFT. It holds state and manages transfers but is no longer involved in the minting payment process.

#### **2.3.1. Storage Schema**

The storage schema is simplified, containing only the data essential for an NFT item according to TEP-62.

Code snippet

\#include "stdlib.fc";  
\#include "common.fc";

;; \================= STORAGE \==================  
;; (item\_index, collection\_address, owner\_address, content)  
(int, slice, slice, cell) load\_data() inline {  
    slice ds \= get\_data().begin\_parse();  
    return (  
        ds\~load\_uint(256),    ;; item\_index (256-bit hash)  
        ds\~load\_msg\_addr(),   ;; collection\_address  
        ds\~load\_msg\_addr(),   ;; owner\_address  
        ds\~load\_ref()         ;; content  
    );  
}

() save\_data(int item\_index, slice collection\_address, slice owner\_address, cell content) impure inline {  
    set\_data(  
        begin\_cell()  
          .store\_uint(item\_index, 256\)  
          .store\_slice(collection\_address)  
          .store\_slice(owner\_address)  
          .store\_ref(content)  
       .end\_cell()  
    );  
}

#### **2.3.2. recv\_internal and Get-Methods**

The recv\_internal function now primarily handles the standard op::transfer message. The get\_nft\_data method returns the item's state as per the TEP-62 standard.

Code snippet

;; \================= MAIN \=====================  
() recv\_internal(int my\_balance, int msg\_value, cell in\_msg\_full, slice in\_msg\_body) impure {  
    if (in\_msg\_body.slice\_empty?()) {  
        return ();  
    }  
    slice cs \= in\_msg\_full.begin\_parse();  
    int flags \= cs\~load\_uint(4);  
    slice sender\_address \= cs\~load\_msg\_addr();

    var (item\_index, collection\_address, owner\_address, content) \= load\_data();

    int op \= in\_msg\_body\~load\_uint(32);  
    int query\_id \= in\_msg\_body\~load\_uint(64);

    if (op \== op::transfer) {  
        throw\_unless(401, equal\_slices(sender\_address, owner\_address));  
          
        slice new\_owner\_address \= in\_msg\_body\~load\_msg\_addr();  
        slice response\_destination \= in\_msg\_body\~load\_msg\_addr();  
        in\_msg\_body\~load\_int(1); ;; custom\_payload  
        int forward\_amount \= in\_msg\_body\~load\_coins();  
        cell forward\_payload \= in\_msg\_body\~load\_ref();

        save\_data(item\_index, collection\_address, new\_owner\_address, content);

        if (forward\_amount \> 0\) {  
            var msg \= begin\_cell()  
               .store\_uint(0x18, 6\)  
               .store\_slice(new\_owner\_address)  
               .store\_coins(forward\_amount)  
               .store\_uint(0, 1 \+ 4 \+ 4 \+ 64 \+ 32 \+ 1 \+ 1\)  
               .store\_uint(op::ownership\_assigned, 32\)  
               .store\_uint(query\_id, 64\)  
               .store\_slice(owner\_address)  
               .store\_ref(forward\_payload);  
            send\_raw\_message(msg.end\_cell(), 64); ;; mode 64: pay fees separately, send remaining value  
        }

        if (response\_destination.preload\_uint(2)\!= 0\) {  
            var resp\_msg \= begin\_cell()  
               .store\_uint(0x10, 6\)  
               .store\_slice(response\_destination)  
               .store\_grams(0)  
               .store\_uint(0, 1 \+ 4 \+ 4 \+ 64 \+ 32 \+ 1 \+ 1\)  
               .store\_uint(op::excesses, 32\)  
               .store\_uint(query\_id, 64);  
            send\_raw\_message(resp\_msg.end\_cell(), 64);  
        }  
        return ();  
    }  
      
    throw(0xffff); ;; Unknown op  
}

;; \================= GET-METHODS \==================  
(int, int, slice, slice, cell) get\_nft\_data() method\_id {  
    var (item\_index, collection\_address, owner\_address, content) \= load\_data();  
    return (-1, item\_index, collection\_address, owner\_address, content); ;; \-1 for init? flag, indicating it is active  
}

### **2.4. Gas Optimization and Security Hardening**

The provided FunC code incorporates several best practices for gas optimization and security on the TON network.

* **Inline Functions:** Common helper functions like load\_data, save\_data, and calculate\_mint\_price are declared as inline. This instructs the FunC compiler to insert the function's code directly at the call site, eliminating the gas overhead associated with a standard function call (a CALL instruction followed by a RET). This is particularly effective for small, frequently used functions.29  
* **Storage Efficiency:** While dictionary operations can be more gas-intensive than simple storage reads/writes, using a dictionary for minted\_hashes is the only scalable method to ensure username uniqueness.4 The alternative, an on-chain list, would require linear-time iteration, leading to unbounded and rapidly escalating gas costs as the collection grows. The dictionary provides a logarithmic-time lookup, ensuring predictable and manageable gas fees even with millions of entries.  
* **Error Handling:** All throw\_unless and throw\_if statements use unique, non-zero error codes (e.g., 401, 403, 406, 409). This is a critical practice for off-chain debugging. When a transaction fails, the exit code is recorded on the blockchain. Off-chain clients, such as the frontend application or an indexer, can read this exit code and provide a specific, human-readable error message to the user (e.g., "Error 409: Username is already taken").1  
* **Bounced Messages:** In the EtnItem transfer logic, messages such as ownership\_assigned and excesses are sent with mode 64\. This mode ensures that if the destination contract cannot accept the message (e.g., it runs out of gas or rejects the transaction), the remaining value is bounced back to the sender, preventing loss of funds. Handling bounced messages is a cornerstone of robust development on an asynchronous network like TON.31

## **Section 3: Off-Chain Infrastructure and Tooling**

A robust on-chain protocol requires equally well-engineered off-chain components to provide a seamless user experience and a reliable development workflow. This section details the TypeScript wrappers, testing suite, metadata service, and frontend application that complete the ETN Username NFT system.

### **3.1. TypeScript Wrappers: The Anti-Corruption Layer**

Interacting directly with TON smart contracts from off-chain code requires manual serialization of messages into Cell objects and deserialization of stack results. This process is low-level, error-prone, and verbose. TypeScript wrappers serve as a crucial abstraction layer, often called an Anti-Corruption Layer, isolating the application logic from the complexities of TVM data structures.1

#### **3.1.1. EtnCollection.ts Wrapper**

This wrapper is updated to reflect the revised lazy minting architecture. It now includes a high-level sendMintUsername method that encapsulates the entire process of constructing the jetton\_transfer message.

TypeScript

import { Address, beginCell, Cell, Contract, contractAddress, ContractProvider, Sender, SendMode, toNano } from '@ton/core';

export type EtnCollectionConfig \= {  
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

    static createFromConfig(config: EtnCollectionConfig, code: Cell, workchain \= 0) {  
        const data \= etnCollectionConfigToCell(config);  
        const init \= { code, data };  
        return new EtnCollection(contractAddress(workchain, init), init);  
    }

    async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {  
        await provider.internal(via, {  
            value,  
            sendMode: SendMode.PAY\_GAS\_SEPARATELY,  
            body: beginCell().endCell(),  
        });  
    }

    // New method for user-initiated minting  
    async sendMintUsername(  
        provider: ContractProvider,  
        via: Sender,  
        opts: {  
            username: string;  
            mintPrice: bigint;  
            gasAmount?: bigint;  
            queryId?: number;  
        }  
    ) {  
        const forwardPayload \= beginCell().storeStringTail(opts.username).endCell();

        // This message is sent from the user's Jetton Wallet to the Collection's Jetton Wallet  
        // which then sends a notification to the Collection contract.  
        // The \`via\` sender here is the user's main wallet, which controls their Jetton wallet.  
        // The actual message body is for a \`jetton\_transfer\`.  
        const body \= beginCell()  
           .storeUint(0xf8a7ea5, 32) // op::jetton\_transfer  
           .storeUint(opts.queryId?? 0, 64)  
           .storeCoins(opts.mintPrice)  
           .storeAddress(this.address) // destination is the collection contract  
           .storeAddress(via.address) // response\_destination  
           .storeMaybeRef(null) // custom\_payload  
           .storeCoins(toNano('0.1')) // forward\_ton\_amount to trigger notification  
           .storeRef(forwardPayload)  
       .endCell();

        // We need to find the user's jetton wallet address  
        const { jetton\_master\_address } \= await this.getCollectionData(provider);  
        // A real implementation would require a get-method on the jetton master.  
        // For this example, we assume a standard way to calculate it or get it from an SDK.  
        // This part is illustrative and depends on the specific Jetton implementation.  
        const userJettonWalletAddress \= await someSdkFunctionToGetJettonWallet(via.address, jetton\_master\_address);

        await provider.internal(via, {  
            to: userJettonWalletAddress,  
            value: opts.gasAmount?? toNano('0.5'),  
            sendMode: SendMode.PAY\_GAS\_SEPARATELY,  
            body: body,  
        });  
    }  
      
    async getCollectionData(provider: ContractProvider) {  
        //... implementation from PRD...  
    }

    async getNftAddressByIndex(provider: ContractProvider, index: bigint): Promise\<Address\> {  
        //... implementation from PRD, but with bigint for index...  
    }  
}

// Placeholder for a real SDK function  
async function someSdkFunctionToGetJettonWallet(owner: Address, jettonMaster: Address): Promise\<Address\> {  
    // In a real scenario, this would involve a get-method call to the jettonMaster  
    // or using a library function that correctly calculates the address.  
    // This is a simplified placeholder.  
    console.warn("Using placeholder for user's Jetton Wallet address calculation.");  
    // This calculation is a common pattern but should be verified against the specific jetton wallet code.  
    const { stack } \= await provider.get('get\_wallet\_address', \[{ type: 'slice', cell: beginCell().storeAddress(owner).endCell() }\]);  
    return stack.readAddress();  
}

#### **3.1.2. EtnItem.ts Wrapper**

This wrapper remains largely unchanged from the PRD, as the EtnItem contract's public interface is stable. It provides a getNftData method to read the item's state.

TypeScript

import { Address, Builder, Cell, Contract, ContractProvider, Sender, SendMode } from '@ton/core';

export class EtnItem implements Contract {  
    constructor(readonly address: Address, readonly init?: { code: Cell; data: Cell }) {}

    static createFromAddress(address: Address) {  
        return new EtnItem(address);  
    }

    async getNftData(provider: ContractProvider) {  
        const result \= await provider.get('get\_nft\_data',);  
        return {  
            init: result.stack.readNumber(),  
            item\_index: result.stack.readBigNumber(),  
            collection\_address: result.stack.readAddress(),  
            owner\_address: result.stack.readAddress(),  
            content: result.stack.readCell(),  
        };  
    }  
}

### **3.2. Comprehensive Local Testing with @ton/sandbox**

Rigorous, automated testing is non-negotiable for smart contract development. The @ton/sandbox library, a core component of the Blueprint framework, provides a high-performance, in-memory blockchain emulator that enables instantaneous and cost-free execution of complex transaction flows.1 The test suite must be updated to validate the new lazy minting logic.

TypeScript

import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';  
import { Cell, toNano, beginCell, Address, Dictionary } from '@ton/core';  
import { EtnCollection } from '../wrappers/EtnCollection';  
import { EtnItem } from '../wrappers/EtnItem';  
import '@ton/test-utils';  
import { compile } from '@ton/blueprint';  
import { JettonMinter } from '../wrappers/JettonMinter'; // Assuming a standard Jetton wrapper  
import { JettonWallet } from '../wrappers/JettonWallet'; // Assuming a standard Jetton wrapper  
import { sha256 } from 'crypto-hash';

describe('EtnCollection Lazy Minting', () \=\> {  
    let blockchain: Blockchain;  
    let deployer: SandboxContract\<TreasuryContract\>;  
    let beneficiary: SandboxContract\<TreasuryContract\>;  
    let minterUser: SandboxContract\<TreasuryContract\>;  
    let etnCollection: SandboxContract\<EtnCollection\>;  
    let etnItemCode: Cell;  
    let jettonMinter: SandboxContract\<JettonMinter\>;  
    let collectionJettonWallet: SandboxContract\<JettonWallet\>;  
    let userJettonWallet: SandboxContract\<JettonWallet\>;

    beforeAll(async () \=\> {  
        //... (Setup code for blockchain, wallets, and Jetton deployment as in PRD)...  
        // Deploy ETN Username Collection with an empty dictionary for minted hashes  
        etnCollection \= blockchain.openContract(  
            EtnCollection.createFromConfig(  
                {  
                    ownerAddress: deployer.address,  
                    nextItemIndex: 0,  
                    collectionContent: beginCell().storeStringTail("https://u-nft.etnecosystem.org/api/").endCell(),  
                    nftItemCode: await compile('EtnItem'),  
                    beneficiaryAddress: beneficiary.address,  
                    jettonMasterAddress: jettonMinter.address,  
                    mintedHashes: Dictionary.empty(Dictionary.Keys.BigUint(256), Dictionary.Values.Cell())  
                },  
                await compile('EtnCollection')  
            )  
        );  
        await etnCollection.sendDeploy(deployer.getSender(), toNano('0.05'));  
        collectionJettonWallet \= blockchain.openContract(await jettonMinter.getWallet(etnCollection.address));  
    });

    it('should allow a user to mint a new username', async () \=\> {  
        const username \= "testuser";  
        const mintPrice \= toNano('500'); // Price for 7+ characters  
        const forwardPayload \= beginCell().storeStringTail(username).endCell();

        // User sends jettons to the collection contract  
        const mintResult \= await userJettonWallet.sendTransfer(  
            minterUser.getSender(),  
            toNano('0.5'), // gas  
            mintPrice,  
            etnCollection.address,  
            minterUser.address,  
            null,  
            toNano('0.1'),  
            forwardPayload  
        );

        // Check for the chain of transactions: UserWallet \-\> CollectionWallet \-\> Collection  
        expect(mintResult.transactions).toHaveTransaction({  
            from: userJettonWallet.address,  
            to: collectionJettonWallet.address,  
            success: true,  
        });  
        expect(mintResult.transactions).toHaveTransaction({  
            from: collectionJettonWallet.address,  
            to: etnCollection.address,  
            op: 0x7362d09c, // op::jetton\_transfer\_notification  
            success: true,  
        });

        // Check that a new NFT item was deployed  
        const usernameHash \= BigInt('0x' \+ await sha256(username));  
        const itemAddress \= await etnCollection.getNftAddressByIndex(usernameHash);  
        const itemContract \= blockchain.openContract(EtnItem.createFromAddress(itemAddress));  
        const itemData \= await itemContract.getNftData();  
          
        expect(itemData.owner\_address.equals(minterUser.address)).toBe(true);  
        expect(itemData.item\_index).toEqual(usernameHash);

        // Check that funds were forwarded to the beneficiary  
        const beneficiaryJettonWallet \= blockchain.openContract(await jettonMinter.getWallet(beneficiary.address));  
        const beneficiaryBalance \= await beneficiaryJettonWallet.getJettonBalance();  
        expect(beneficiaryBalance).toEqual(mintPrice);  
    });

    it('should fail to mint a username that is already taken', async () \=\> {  
        const username \= "taken-user";  
        const mintPrice \= toNano('500');  
        const forwardPayload \= beginCell().storeStringTail(username).endCell();

        // First mint is successful  
        await userJettonWallet.sendTransfer(minterUser.getSender(), toNano('0.5'), mintPrice, etnCollection.address, minterUser.address, null, toNano('0.1'), forwardPayload);

        // Second attempt to mint the same username  
        const mintResult \= await userJettonWallet.sendTransfer(minterUser.getSender(), toNano('0.5'), mintPrice, etnCollection.address, minterUser.address, null, toNano('0.1'), forwardPayload);

        // Check that the final transaction to the collection contract fails with the correct error code  
        expect(mintResult.transactions).toHaveTransaction({  
            from: collectionJettonWallet.address,  
            to: etnCollection.address,  
            success: false,  
            exitCode: 409 // 409 Conflict: Username already taken  
        });  
    });  
});

### **3.3. Metadata Service Architecture: Centralized vs. Decentralized**

The TEP-64 standard allows for NFT metadata to be stored either on-chain or off-chain.3 While on-chain storage offers maximum immutability, it is prohibitively expensive for rich content like high-resolution images. Therefore, an off-chain solution is necessary.

* **PRD Implementation (Python/FastAPI):** The guide specifies a centralized API built with Python and FastAPI to dynamically generate JSON metadata and PNG images.1 While this approach is fast and easy to implement, it introduces a single point of failure and a central point of control. If the server hosting the API goes down, all NFT metadata becomes inaccessible. This contradicts the principle of a "fully decentralized" system.  
* **Revised Recommendation (IPFS):** To align with decentralization, the metadata and images should be stored on the InterPlanetary File System (IPFS).4 IPFS is a peer-to-peer network for storing and sharing data in a distributed file system. Files are addressed by their content hash (CID), ensuring that the content cannot be tampered with without changing its address.  
  * **Implementation:** The dynamic image generation process described in the PRD can still be used, but instead of serving the images from a live API, the project owner would pre-generate an image for each minted username and upload it, along with its corresponding JSON metadata file, to a pinning service like Pinata. Pinning services ensure that the data remains available on the IPFS network. The collection\_content cell stored in the EtnCollection contract would then point to the base URI of the IPFS directory.  
* **TON Storage as a Future-Proof Alternative:** For maximum alignment with the TON ecosystem, TON Storage presents a native decentralized storage solution.40 It functions similarly to IPFS but is integrated directly into the TON network, with financial incentives for nodes to store data, potentially offering stronger long-term guarantees of data persistence.42 While tooling is still maturing, it represents the ideal future state for metadata storage for TON-native projects.

### **3.4. Frontend Minting Application (React & TON Connect)**

The frontend is a critical component of the user experience and the on-chain protocol. The revised architecture enables a more responsive and user-friendly minting process.

TypeScript

// src/App.tsx (Revised)  
import { useState, useEffect } from 'react';  
import { TonConnectButton, useTonAddress, useTonConnectUI, useTonClient } from '@tonconnect/ui-react';  
import { Address, toNano, beginCell } from '@ton/core';  
import { EtnCollection } from './wrappers/EtnCollection'; // Assuming wrappers are in the src folder  
import { sha256 } from 'crypto-hash';  
import './App.css';

// This must be replaced after deployment  
const COLLECTION\_ADDRESS \= 'YOUR\_DEPLOYED\_COLLECTION\_ADDRESS'; 

function App() {  
    const \[username, setUsername\] \= useState('');  
    const \[mintPrice, setMintPrice\] \= useState(0);  
    const \[isAvailable, setIsAvailable\] \= useState\<boolean | null\>(null);  
    const \[tonConnectUI\] \= useTonConnectUI();  
    const userAddress \= useTonAddress();  
    const client \= useTonClient();

    useEffect(() \=\> {  
        //... (price calculation logic from PRD)...  
    }, \[username\]);

    // Debounced availability check  
    useEffect(() \=\> {  
        if (username.length \< 3) {  
            setIsAvailable(null);  
            return;  
        }

        const handler \= setTimeout(async () \=\> {  
            if (\!client) return;  
            const collection \= EtnCollection.createFromAddress(Address.parse(COLLECTION\_ADDRESS));  
            const collectionContract \= client.open(collection);  
              
            const usernameHash \= BigInt('0x' \+ await sha256(username));  
            const itemAddress \= await collectionContract.getNftAddressByIndex(usernameHash);  
              
            const itemState \= await client.getContractState(itemAddress);  
            setIsAvailable(itemState.state\!== 'active');  
        }, 500); // 500ms debounce

        return () \=\> clearTimeout(handler);  
    }, \[username, client\]);

    const handleMint \= async () \=\> {  
        if (\!userAddress |

| mintPrice \=== 0 ||\!isAvailable) {  
            alert('Please connect wallet, enter a valid & available username.');  
            return;  
        }

        const forwardPayload \= beginCell().storeStringTail(username).endCell();

        // NOTE: This example uses a simplified jetton transfer message.  
        // A production app must integrate with a Jetton SDK or construct the message  
        // to be sent from the user's specific Jetton Wallet address, not their main wallet.  
        // The logic in the wrapper's \`sendMintUsername\` would need to be fully implemented.

        const transaction \= {  
            validUntil: Math.floor(Date.now() / 1000) \+ 600, // 10 minutes  
            messages:,  
        };

        try {  
            await tonConnectUI.sendTransaction(transaction);  
            alert('Mint transaction sent successfully\!');  
        } catch (error) {  
            console.error('Minting failed:', error);  
            alert('Minting failed. See console for details.');  
        }  
    };

    return (  
        \<div className\="App"\>  
            \<header className\="App-header"\>  
                \<TonConnectButton /\>  
                \<h1\>Mint ETN Username NFT\</h1\>  
                \<div className\="mint-form"\>  
                    \<input  
                        type\="text"  
                        placeholder\="Enter desired username"  
                        value\={username}  
                        onChange\={(e) \=\> setUsername(e.target.value.toLowerCase().replace(/\[^a-z0-9-\]/g, ''))}  
                    /\>  
                    {isAvailable \=== true && \<div className\="status-available"\>Available\!\</div\>}  
                    {isAvailable \=== false && \<div className\="status-taken"\>Taken\!\</div\>}  
                    \<div className\="price-display"\>  
                        Mint Price: {mintPrice \> 0? \`${mintPrice} ETN\` : 'N/A'}  
                    \</div\>  
                    \<button onClick\={handleMint} disabled\={\!userAddress |

| mintPrice \=== 0 ||\!isAvailable}\>  
                        Mint Username  
                    \</button\>  
                \</div\>  
            \</header\>  
        \</div\>  
    );  
}

export default App;

* **Username-to-Index Hashing:** The frontend now mirrors the on-chain logic by computing the SHA-256 hash of the username. This hash is used as the item\_index. This deterministic process is vital for the pre-mint availability check.  
* **Pre-Mint Availability Check:** A significant user experience enhancement is the addition of a debounced check that runs as the user types. The frontend calculates the potential item\_index (the hash), calls the get\_nft\_address\_by\_index get-method on the collection contract to find the deterministic address for that item, and then checks if a contract is already active at that address. This provides instant feedback on whether a username is available, preventing users from submitting transactions that are destined to fail.1

## **Section 4: Mainnet Deployment and Verification Protocol**

Deploying smart contracts to a mainnet is an irreversible action with significant financial implications. A minor error in a configuration parameter, such as a mistyped beneficiary address, can lead to a permanent and irrecoverable loss of all funds processed by the system. Therefore, the deployment process must be treated not as a simple script execution, but as a formal, meticulous protocol with multiple stages of verification.1

### **4.1. Pre-Flight Security Checklist**

Before any on-chain activity, a mandatory checklist must be completed and verified. This checklist serves as the single source of truth for all critical, immutable parameters that will be embedded into the smart contract's initial state.

| Parameter Name | Value (to be substituted) | Location(s) to Verify |
| :---- | :---- | :---- |
| Beneficiary Wallet Address | UQDqkn-Y1G77\_un13nqgx1jGh6XXH6deL737gdUxlpFhz9eF | /scripts/deployCollection.ts |
| ETN Jetton Master Address | EQAz\_XrD0hA4cqlprWkpS7TIAhCG4CknAfob1VQm-2mBf5VI | /scripts/deployCollection.ts |
| Metadata Service Base URL | https://u-nft.etnecosystem.org/api/ | /scripts/deployCollection.ts (for collection metadata) |
| Deployer Wallet Address | (Address of the wallet used for deployment) | (Verify in Tonkeeper/wallet before signing) |
| Target Network | mainnet | (Select in Blueprint interactive prompt) |

### **4.2. Staged Deployment Workflow (Testnet to Mainnet)**

The deployment workflow leverages the Blueprint SDK for a consistent and repeatable process, moving from a final testnet validation to the mainnet launch.

1. **Metadata Deployment:** The off-chain metadata service must be deployed first. If using the centralized FastAPI approach, the application is deployed to a production-grade cloud service (e.g., Render, Vercel). If using the recommended decentralized IPFS approach, the metadata directory is uploaded to a pinning service like Pinata. In either case, the final, public BASE\_URL must be obtained and verified before proceeding.  
2. **Smart Contract Compilation:** Ensure all smart contracts are compiled with the latest source code to generate up-to-date build artifacts.  
   Bash  
   npx blueprint build

3. **Deployment Script Preparation:** Create the deployment script at /scripts/deployCollection.ts. This script programmatically constructs the initial state of the EtnCollection contract using the parameters from the pre-flight checklist.  
   TypeScript  
   import { toNano, Address, beginCell, Dictionary } from '@ton/core';  
   import { EtnCollection, EtnCollectionConfig } from '../wrappers/EtnCollection';  
   import { compile, NetworkProvider } from '@ton/blueprint';

   export async function run(provider: NetworkProvider) {  
       const owner \= provider.sender();  
       const ownerAddress \= owner.address;  
       if (\!ownerAddress) {  
           throw new Error('No deployer address specified');  
       }

       // \--- Configuration from Pre-Flight Checklist \---  
       const beneficiaryAddress \= Address.parse('UQDqkn-Y1G77\_un13nqgx1jGh6XXH6deL737gdUxlpFhz9eF');  
       const jettonMasterAddress \= Address.parse('EQAz\_XrD0hA4cqlprWkpS7TIAhCG4CknAfob1VQm-2mBf5VI');  
       const metadataUrl \= "https://u-nft.etnecosystem.org/api/";

       const config: EtnCollectionConfig \= {  
           ownerAddress: ownerAddress,  
           nextItemIndex: 0,  
           collectionContent: beginCell().storeStringTail(metadataUrl).endCell(),  
           nftItemCode: await compile('EtnItem'),  
           beneficiaryAddress: beneficiaryAddress,  
           jettonMasterAddress: jettonMasterAddress,  
           mintedHashes: Dictionary.empty(Dictionary.Keys.BigUint(256), Dictionary.Values.Cell())  
       };

       const etnCollection \= provider.open(  
           EtnCollection.createFromConfig(config, await compile('EtnCollection'))  
       );

       await etnCollection.sendDeploy(provider.sender(), toNano('0.1'));  
       await provider.waitForDeploy(etnCollection.address);

       console.log('✅ ETN Username Collection deployed at:', etnCollection.address.toString());  
   }

4. **Mandatory Testnet Deployment:** The first deployment must target the testnet. This provides a final, live environment to validate the entire system's functionality with test funds before committing real assets.  
   Bash  
   npx blueprint run

   In the interactive prompt, select testnet. Scan the generated QR code with a testnet-configured wallet (e.g., Tonkeeper) funded from a faucet to approve the transaction.  
5. **Final Mainnet Deployment:** Only after exhaustive testing on the testnet, repeat the deployment command.  
   Bash  
   npx blueprint run

   In the interactive prompt, select mainnet. Scan the QR code with a mainnet wallet funded with real TON coin to approve the final, irreversible deployment transaction.

### **4.3. Post-Deployment On-Chain Verification**

Immediately after the mainnet deployment transaction is confirmed, a series of on-chain verifications must be performed using a block explorer like tonscan.org. This step is critical to confirm that the contract was deployed correctly and its state is as expected.

* **Navigate to Contract Address:** Use the contract address printed to the console by the deployment script.  
* **Verify Code Hash:** Locate the "Code Hash" on the block explorer. This value must exactly match the hash field in the local /build/EtnCollection.compiled.json file. A mismatch indicates that the wrong or an outdated version of the code was deployed.  
* **Verify Initial Data:** Inspect the contract's data cell. While the raw cell data is not human-readable on most explorers, tools or get-methods can be used to verify that the owner\_address, beneficiary\_address, jetton\_master\_address, and collection\_content URL have been set correctly according to the pre-flight checklist.

### **4.4. Full System Activation**

The final step is to deploy the user-facing web application and connect it to the newly deployed mainnet contract.

1. **Build Frontend:** Compile the React application for production.  
   Bash  
   npm run build

2. **Update Contract Address:** In the src/App.tsx file of the frontend code, replace the placeholder YOUR\_DEPLOYED\_COLLECTION\_ADDRESS with the actual mainnet address of the EtnCollection contract.  
3. **Deploy Frontend:** Deploy the contents of the dist folder to a static web hosting service (e.g., Vercel, Netlify, GitHub Pages).

The ETN Username NFT system is now live and ready for public minting.

## **Section 5: Conclusions and Recommendations**

The analysis and revision of the ETN Username NFT system have resulted in a comprehensive architectural blueprint that is fully decentralized, scalable, and secure. By adhering to established TON standards and incorporating best practices, the proposed system is production-ready.

**Key Architectural Revisions:**

1. **Adoption of True Lazy Minting:** The shift from a "Pre-Deployed Sale" model to a "True Lazy Minting" model is the most critical architectural change. This approach, where the user's transaction funds the deployment of the NFT item contract, is the only viable method to support an on-demand username system with a potentially infinite number of assets. It aligns costs with demand and removes the prohibitive upfront deployment burden from the project owner.  
2. **Centralized Minting Logic:** Moving all payment validation and deployment orchestration into the EtnCollection contract simplifies the EtnItem contract, reducing its complexity and attack surface. This creates a more robust and gas-efficient system.  
3. **Deterministic Indexing and On-Chain Registry:** The use of string\_hash(username) as the unique item\_index creates a trustless link between the off-chain username and the on-chain NFT. This is complemented by the implementation of an on-chain dictionary (minted\_hashes) within the collection contract to enforce username uniqueness in a scalable and decentralized manner.

**Recommendations for Implementation:**

* **Prioritize Security:** The security checks outlined, particularly the verification of the jetton\_transfer\_notification sender, are non-negotiable and must be implemented precisely as specified.  
* **Embrace Test-Driven Development:** The comprehensive test suite is not an optional component but a core part of the development lifecycle. All future modifications or extensions to the smart contracts must be accompanied by corresponding tests to prevent regressions.  
* **Adopt Decentralized Storage:** For long-term viability and to fully realize the goal of decentralization, the project should prioritize using IPFS for metadata storage, with a plan to migrate to TON Storage as the native ecosystem tooling matures.  
* **Follow the Deployment Protocol:** The staged deployment and verification protocol must be followed meticulously to mitigate the significant financial risks associated with mainnet smart contract deployment.

By implementing the architecture and code detailed in this guide, the ETN ecosystem can launch a username NFT system that is not only functional and user-friendly but also a benchmark for secure, scalable, and truly decentralized application development on The Open Network.

### **Works Cited**

1 ETN Username NFT System Guide.

*User Uploaded Document*.

Lazy Minting Explained: A Cost-Effective Way to Create NFTs. *Finextra*.

4 NFT minting guide.

*TON Docs*.

How to Lazy Mint an NFT on Rarible with Rarepress. *QuickNode*.

43 NFT Series Tutorial.

*NEAR Docs*.

43 NFT Series Tutorial.

*NEAR Docs*.

44 Gas Best Practices.

*Tact Docs*.

How to Implement Lazy Minting in Your NFT Contract. *Medium*.

45 stdlib.fc.

*GitHub*.

4 NFT minting guide.

*GitHub*.

6 NFT Development on TON Blockchain: A Complete Tutorial.

*Rock'n'Block*.

4 NFT minting guide.

*GitHub*.

4 NFT minting guide.

*TON Docs*.

4 NFT minting guide.

*TON Docs*.

4 NFT minting guide.

*TON Docs*.

4 NFT minting guide.

*TON Docs*.

4 NFT minting guide.

*TON Docs*.

4 NFT minting guide.

*TON Docs*.

4 NFT minting guide.

*TON Docs*.

46 Intro to Gas Optimization.

*Uniswap Docs*.

What Is Lazy Minting?. *GamesPad*.

47 Optimal Function Names.

*GitHub*.

3 How to develop non-fungible tokens (NFTs) on TON.

*Chainstack Docs*.

4 NFT minting guide.

*TON Docs*.

4 NFT minting guide.

*TON Docs*.

4 NFT minting guide.

*TON Docs*.

13 Function as a (More Secure) Service.

*F5 Blog*.

11 Best Practices for Smart Contract Development.

*Medium*.

4 NFT minting guide.

*TON Docs*.

4 NFT minting guide.

*TON Docs*.

4 NFT minting guide.

*TON Docs*.

4 NFT minting guide.

*TON Docs*.

4 NFT minting guide.

*TON Docs*.

4 NFT minting guide.

*TON Docs*.

19 Creating a New Contract From Another Contract in Solidity.

*EatTheBlocks*.

48 How to Mint an NFT on TON.

*Pinata Blog*.

48 How to Mint an NFT on TON.

*Pinata Blog*.

NFT Minting: Lazy Minting vs. Regular Minting Explained. *Pragmatic Coders*.

21 How to Create a New Contract from another Contract in Solidity.

*101 Blockchains*.

4 NFT minting guide.

*TON Docs*.

35 Free decentralized storage and bandwidth for NFTs on IPFS and Filecoin.

*Medium*.

49 Smart Contract Gas Optimization Guide.

*Medium*.

46 Intro to Gas Optimization.

*Uniswap Docs*.

48 How to Mint an NFT on TON.

*Pinata Blog*.

48 How to Mint an NFT on TON.

*Pinata Blog*.

6 NFT Development on TON Blockchain: A Complete Tutorial.

*Rock'n'Block*.

6 NFT Development on TON Blockchain: A Complete Tutorial.

*Rock'n'Block*.

18 How to Call Another Smart Contract From Your Solidity Code.

*QuickNode*.

9 Collators.

*TON Docs*.

29 Fees (Low-level).

*TON Docs*.

10 ETN Username NFT System Guide.

*User Uploaded Document*.

48 How to Mint an NFT on TON.

*Pinata Blog*.

27 13lesson/15min.md.

*GitHub*.

3 How to develop non-fungible tokens (NFTs) on TON.

*Chainstack Docs*.

6 NFT Development on TON Blockchain: A Complete Tutorial.

*Rock'n'Block*.

50 dns-manual-code.fc.

*GitHub*.

17 Is it possible to deploy a smart contract from another contract?.

*C\# Corner*.

6 NFT Development on TON Blockchain: A Complete Tutorial.

*Rock'n'Block*.

6 NFT Development on TON Blockchain: A Complete Tutorial.

*Rock'n'Block*.

6 NFT Development on TON Blockchain: A Complete Tutorial.

*Rock'n'Block*.

6 NFT Development on TON Blockchain: A Complete Tutorial.

*Rock'n'Block*.

6 NFT Development on TON Blockchain: A Complete Tutorial.

*Rock'n'Block*.

6 NFT Development on TON Blockchain: A Complete Tutorial.

*Rock'n'Block*.

6 NFT Development on TON Blockchain: A Complete Tutorial.

*Rock'n'Block*.

6 NFT Development on TON Blockchain: A Complete Tutorial.

*Rock'n'Block*.

6 NFT Development on TON Blockchain: A Complete Tutorial.

*Rock'n'Block*.

6 NFT Development on TON Blockchain: A Complete Tutorial.

*Rock'n'Block*.

6 NFT Development on TON Blockchain: A Complete Tutorial.

*Rock'n'Block*.

6 NFT Development on TON Blockchain: A Complete Tutorial.

*Rock'n'Block*.

NFT On-Chain vs. Off-Chain Data. *Curvegrid*.

6 NFT Development on TON Blockchain: A Complete Tutorial.

*Rock'n'Block*.

8 A Comparative Analysis of Distributed Ledger Technologies: TON vs. EVM-based Blockchains.

*Syndika*.

10 ETN Username NFT System Guide.

*User Uploaded Document*.

51 FunC contracts.

*LearnBlockchain.cn*.

How to Check if a Key Exists in a Python Dictionary. *GeeksforGeeks*.

52 How to start NFT development on TON Blockchain.

*Medium*.

52 How to start NFT development on TON Blockchain.

*Medium*.

26 Dictionaries in TON.

*TON Docs*.

39 TON Footsteps Issue \#7.

*GitHub*.

39 TON Footsteps Issue \#7.

*GitHub*.

39 TON Footsteps Issue \#7.

*GitHub*.

39 TON Footsteps Issue \#7.

*GitHub*.

39 TON Footsteps Issue \#7.

*GitHub*.

39 TON Footsteps Issue \#7.

*GitHub*.

33 Metadata parsing.

*TON Docs*.

How to Check if a Key Exists in a Python Dictionary. *GeeksforGeeks*.

How to Check if a Key Exists in a Python Dictionary. *GeeksforGeeks*.

4 NFT minting guide.

*TON Docs*.

53 Optimizing Storage Costs.

*Starknet Docs*.

23 TON Tact.

*Laisky's Blog*.

23 TON Tact.

*Laisky's Blog*.

23 TON Tact.

*Laisky's Blog*.

23 TON Tact.

*Laisky's Blog*.

23 TON Tact.

*Laisky's Blog*.

23 TON Tact.

*Laisky's Blog*.

23 TON Tact.

*Laisky's Blog*.

23 TON Tact.

*Laisky's Blog*.

23 TON Tact.

*Laisky's Blog*.

23 TON Tact.

*Laisky's Blog*.

23 TON Tact.

*Laisky's Blog*.

23 TON Tact.

*Laisky's Blog*.

4 NFT minting guide.

*TON Docs*.

How to Check if a Key Exists in a Python Dictionary. *Hostman*.

On-chain vs off-chain NFT art platforms. *Ethereum Stack Exchange*.

12 Secure Smart Contract Design Best Practices in Solidity Programming.

*Agilie*.

How to Mint an NFT. *Chainlink*.

2 NFT processing.

*TON Docs*.

How to check if a key exists in a Python Dictionary. *YouTube*.

Check if a Key exists in a Python Dictionary. *Python Shiksha*.

Check if a Key exists in a Python Dictionary. *Python Shiksha*.

54 Developers' Best Practices When Upgrading Smart Contracts.

*Medium*.

32 Secure Smart Contract Programming in FunC.

*TON Blog*.

55 What is Minting NFT?.

*LiteFinance Blog*.

55 What is Minting NFT?.

*LiteFinance Blog*.

55 What is Minting NFT?.

*LiteFinance Blog*.

55 What is Minting NFT?.

*LiteFinance Blog*.

55 What is Minting NFT?.

*LiteFinance Blog*.

55 What is Minting NFT?.

*LiteFinance Blog*.

55 What is Minting NFT?.

*LiteFinance Blog*.

55 What is Minting NFT?.

*LiteFinance Blog*.

55 What is Minting NFT?.

*LiteFinance Blog*.

55 What is Minting NFT?.

*LiteFinance Blog*.

55 What is Minting NFT?.

*LiteFinance Blog*.

55 What is Minting NFT?.

*LiteFinance Blog*.

40 TON Storage.

*TON Blog*.

31 Secure Smart Contract Programming.

*TON Docs*.

42 TON Storage.

*TON Blog*.

Off-chain vs. On-chain NFTs. *Block.co*.

How to Check if a Key Exists in a Python Dictionary. *Hostman*.

How to Check if a Key Exists in a Python Dictionary. *Hostman*.

56 Optimize names to save gas.

*AuditBase*.

Check If a Given Key Already Exists in a Dictionary in Python. *Interview Kickstart*.

Check If a Given Key Already Exists in a Dictionary in Python. *Interview Kickstart*.

Off-chain vs. On-chain NFTs. *Block.co*.

31 Secure Smart Contract Programming.

*TON Docs*.

2 NFT processing.

*TON Docs*.

16 SlowMist: Best Practices for Toncoin Smart Contract Security.

*Medium*.

2 NFT processing.

*TON Docs*.

30 Optimizing Smart Contracts with inline and inline\_ref in FunC.

*LearnBlockchain.cn*.

14 TEP-74: Jetton Standard.

*GitHub*.

16 SlowMist: Best Practices for Toncoin Smart Contract Security.

*Medium*.

6 NFT Development on TON Blockchain: A Complete Tutorial.

*Rock'n'Block*.

57 Introduction to TON Accounts, Tokens, Transactions, and Asset Security.

*Medium*.

57 Introduction to TON Accounts, Tokens, Transactions, and Asset Security.

*Medium*.

57 Introduction to TON Accounts, Tokens, Transactions, and Asset Security.

*Medium*.

57 Introduction to TON Accounts, Tokens, Transactions, and Asset Security.

*Medium*.

57 Introduction to TON Accounts, Tokens, Transactions, and Asset Security.

*Medium*.

57 Introduction to TON Accounts, Tokens, Transactions, and Asset Security.

*Medium*.

58 Fungible Tokens (Jettons).

*Tact Docs*.

How to Check if a Key Exists in a Python Dictionary. *Hostman*.

15 Secure Smart Contract Programming in Tact: Popular Mistakes in the TON.

*Certik*.

26 Dictionaries in TON.

*TON Docs*.

59 Understanding Function Dictionaries in C\# and Initialization Challenges.

*Medium*.

60 Python Dictionary.

*GeeksforGeeks*.

61 Data Structures.

*Python Docs*.

62 Make Dictionaries Functional.

*The Code Painter*.

63 Implementing a dictionary using first-class functions.

*Luke Plant's Blog*.

64 Declaring a Dictionary\<string,Func\<\>\> with Functions already inside them c\#.

*Stack Overflow*.

24 FunC Journey (Part 2).

*TON Blog*.

25 Blockchain of blockchains.

*TON Docs*.

26 Dictionaries in TON.

*TON Docs*.

27 13lesson/15min.md.

*GitHub*.

28 Smart contract addresses.

*TON Docs*.

3 How to develop non-fungible tokens (NFTs) on TON.

*Chainstack Docs*.

2 NFT processing.

*TON Docs*.

6 NFT Development on TON Blockchain: A Complete Tutorial.

*Rock'n'Block*.

7 TEP-62: NFT Standard.

*GitHub*.

5 TON.

*XP.NETWORK*.

65 How to develop fungible tokens (Jettons) on TON.

*Chainstack Docs*.

66 How to customize fungible tokens (Jettons) on TON.

*Chainstack Docs*.

67 What is Jetton Standard: Token Development on TON Blockchain.

*Medium*.

68 Tutorial \- Jetton.

*TonDynasty Docs*.

69 Jetton Standard.

*Tact by Example*.

#### **Works cited**

1. ETN Username NFT System Guide  
2. NFT processing | The Open Network \- TON Docs, accessed August 10, 2025, [https://docs.ton.org/v3/guidelines/dapps/asset-processing/nft-processing/nfts](https://docs.ton.org/v3/guidelines/dapps/asset-processing/nft-processing/nfts)  
3. TON: How to develop non-fungible tokens (NFT) \- Chainstack Docs, accessed August 10, 2025, [https://docs.chainstack.com/docs/ton-how-to-develop-non-fungible-tokens](https://docs.chainstack.com/docs/ton-how-to-develop-non-fungible-tokens)  
4. Step by step NFT collection minting | The Open Network \- TON Docs, accessed August 10, 2025, [https://docs.ton.org/v3/guidelines/dapps/tutorials/nft-minting-guide](https://docs.ton.org/v3/guidelines/dapps/tutorials/nft-minting-guide)  
5. XP.NETWORK and TON: moving NFTs to Polygon, Fantom, Avalanche, and more, accessed August 10, 2025, [https://xp.network/ton](https://xp.network/ton)  
6. Complete Tutorial for NFT Development on TON Blockchain \- Rock'n'Block, accessed August 10, 2025, [https://rocknblock.io/blog/nft-development-ton-blockchain-complete-tutorial](https://rocknblock.io/blog/nft-development-ton-blockchain-complete-tutorial)  
7. NFT Standard · Issue \#62 · ton-blockchain/TIPs \- GitHub, accessed August 10, 2025, [https://github.com/ton-blockchain/TIPs/issues/62](https://github.com/ton-blockchain/TIPs/issues/62)  
8. A comparative analysis: TON vs. EVM-based blockchains \- Syndika, accessed August 8, 2025, [https://syndika.co/blog/a-comparative-analysis-of-distributed-ledger-technologies-ton-vs-evm-based-blockchains/](https://syndika.co/blog/a-comparative-analysis-of-distributed-ledger-technologies-ton-vs-evm-based-blockchains/)  
9. Accelerator update | The Open Network \- TON Docs, accessed August 8, 2025, [https://docs.ton.org/v3/documentation/infra/nodes/validation/collators](https://docs.ton.org/v3/documentation/infra/nodes/validation/collators)  
10. accessed January 1, 1970, uploaded:ETN Username NFT System Guide  
11. Best Practices for Smart Contract Development | by Codezeros \- Medium, accessed August 8, 2025, [https://codezeros.medium.com/best-practices-for-smart-contract-development-84b35b3c62d4](https://codezeros.medium.com/best-practices-for-smart-contract-development-84b35b3c62d4)  
12. Secure Smart Contract Design: Best Practices in Solidity Programming \- Agilie, accessed August 8, 2025, [https://agilie.com/blog/secure-smart-contract-design-best-practices-in-solidity-programming](https://agilie.com/blog/secure-smart-contract-design-best-practices-in-solidity-programming)  
13. Function as a (More Secure) Service \- F5 Networks, accessed August 8, 2025, [https://www.f5.com/company/blog/function-as-a-more-secure-service](https://www.f5.com/company/blog/function-as-a-more-secure-service)  
14. Fungible tokens (Jettons) standard · Issue \#74 · ton-blockchain/TIPs \- GitHub, accessed August 8, 2025, [https://github.com/ton-blockchain/TIPs/issues/74](https://github.com/ton-blockchain/TIPs/issues/74)  
15. Secure Smart Contract Programming in Tact: Popular Mistakes in the TON Ecosystem, accessed August 10, 2025, [https://www.certik.com/resources/blog/secure-smart-contract-programming-in-tact-popular-mistakes-in-the-ton](https://www.certik.com/resources/blog/secure-smart-contract-programming-in-tact-popular-mistakes-in-the-ton)  
16. SlowMist: Best Practices for Toncoin Smart Contract Security, accessed August 8, 2025, [https://slowmist.medium.com/slowmist-best-practices-for-toncoin-smart-contract-security-df209eb19d08](https://slowmist.medium.com/slowmist-best-practices-for-toncoin-smart-contract-security-df209eb19d08)  
17. Is it Possible to Deploy a Smart Contract from Another Contract? \- C\# Corner, accessed August 8, 2025, [https://www.c-sharpcorner.com/article/is-it-possible-to-deploy-a-smart-contract-from-another-contract/](https://www.c-sharpcorner.com/article/is-it-possible-to-deploy-a-smart-contract-from-another-contract/)  
18. How to Call Another Smart Contract from your Solidity Code | QuickNode Guides, accessed August 8, 2025, [https://www.quicknode.com/guides/ethereum-development/smart-contracts/how-to-call-another-smart-contract-from-your-solidity-code](https://www.quicknode.com/guides/ethereum-development/smart-contracts/how-to-call-another-smart-contract-from-your-solidity-code)  
19. Creating a new Contract from another Contract in Solidity \- EatTheBlocks, accessed August 8, 2025, [https://eattheblocks.com/creating-a-new-contract-from-another-contract-in-solidity/](https://eattheblocks.com/creating-a-new-contract-from-another-contract-in-solidity/)  
20. Can smart contracts deploy other smart contracts? \- Stack Overflow, accessed August 8, 2025, [https://stackoverflow.com/questions/70209083/can-smart-contracts-deploy-other-smart-contracts](https://stackoverflow.com/questions/70209083/can-smart-contracts-deploy-other-smart-contracts)  
21. How to Create a New Contract from another Contract in Solidity? \- 101 Blockchains, accessed August 8, 2025, [https://101blockchains.com/create-contract-from-another-contract-in-solidity/](https://101blockchains.com/create-contract-from-another-contract-in-solidity/)  
22. Deploy and initialize a smart contract using another smart contract. \- Stellar Docs, accessed August 8, 2025, [https://developers.stellar.org/docs/build/smart-contracts/example-contracts/deployer](https://developers.stellar.org/docs/build/smart-contracts/example-contracts/deployer)  
23. Introduction to TON Technology and Tact Programming, accessed August 8, 2025, [https://blog.laisky.com/p/ton-tact/](https://blog.laisky.com/p/ton-tact/)  
24. FunC Journey: Part 2 \- TON Blog, accessed August 10, 2025, [https://blog.ton.org/func-journey-2](https://blog.ton.org/func-journey-2)  
25. Blockchain of blockchains | The Open Network \- TON Docs, accessed August 10, 2025, [https://docs.ton.org/v3/concepts/dive-into-ton/ton-blockchain/blockchain-of-blockchains](https://docs.ton.org/v3/concepts/dive-into-ton/ton-blockchain/blockchain-of-blockchains)  
26. Dictionaries in TON | The Open Network \- TON Docs, accessed August 10, 2025, [https://docs.ton.org/v3/documentation/smart-contracts/func/docs/dictionaries](https://docs.ton.org/v3/documentation/smart-contracts/func/docs/dictionaries)  
27. TonFunClessons\_Eng/13lesson/15min.md at main \- GitHub, accessed August 10, 2025, [https://github.com/romanovichim/TonFunClessons\_Eng/blob/main/13lesson/15min.md](https://github.com/romanovichim/TonFunClessons_Eng/blob/main/13lesson/15min.md)  
28. Smart contract addresses | The Open Network \- TON Docs, accessed August 10, 2025, [https://docs.ton.org/v3/concepts/dive-into-ton/ton-blockchain/smart-contract-addresses](https://docs.ton.org/v3/concepts/dive-into-ton/ton-blockchain/smart-contract-addresses)  
29. Low-level fees overview | The Open Network \- TON Docs, accessed August 8, 2025, [https://docs.ton.org/v3/documentation/smart-contracts/transaction-fees/fees-low-level](https://docs.ton.org/v3/documentation/smart-contracts/transaction-fees/fees-low-level)  
30. TVM Smart Contract Optimization: In-Depth Analysis of Inline and Inline\_ref Specifiers, accessed August 8, 2025, [https://learnblockchain.cn/article/9520](https://learnblockchain.cn/article/9520)  
31. Secure smart contract programming | The Open Network \- TON Docs, accessed August 8, 2025, [https://docs.ton.org/v3/guidelines/smart-contracts/security/secure-programming/](https://docs.ton.org/v3/guidelines/smart-contracts/security/secure-programming/)  
32. Secure Smart Contract Programming in FunC: Top 10 Tips for TON Developers, accessed August 8, 2025, [https://blog.ton.org/secure-smart-contract-programming-in-func](https://blog.ton.org/secure-smart-contract-programming-in-func)  
33. Metadata parsing | The Open Network \- TON Docs, accessed August 8, 2025, [https://docs.ton.org/v3/guidelines/dapps/asset-processing/nft-processing/metadata-parsing](https://docs.ton.org/v3/guidelines/dapps/asset-processing/nft-processing/metadata-parsing)  
34. NFTs with On-chain Metadata on TON: Tutorial | by Vladislav Lenskii | MiKi Blockchain, accessed August 8, 2025, [https://medium.com/miki-dev/nfts-with-on-chain-metadata-on-ton-tutorial-55ac0cbb17d5](https://medium.com/miki-dev/nfts-with-on-chain-metadata-on-ton-tutorial-55ac0cbb17d5)  
35. Free decentralized storage and bandwidth for NFTs on IPFS and Filecoin | by Srajan Gupta | Blockchain Vidhya | Medium, accessed August 8, 2025, [https://medium.com/blockchain-vidhya/free-decentralized-storage-and-bandwidth-for-nfts-on-ipfs-and-filecoin-b7f3ecbb390c](https://medium.com/blockchain-vidhya/free-decentralized-storage-and-bandwidth-for-nfts-on-ipfs-and-filecoin-b7f3ecbb390c)  
36. Storage \- Starton, accessed August 8, 2025, [https://www.starton.com/product/storage](https://www.starton.com/product/storage)  
37. Ultimate Guide to Web3 Storage: IPFS vs. On-Chain vs. Cloud \- thirdweb blog, accessed August 8, 2025, [https://blog.thirdweb.com/web3-storage/](https://blog.thirdweb.com/web3-storage/)  
38. NFT Storage: Comparing IPFS, Filecoin, and Arweave \- Bankless, accessed August 8, 2025, [https://www.bankless.com/nft-storage](https://www.bankless.com/nft-storage)  
39. Tutorials: How to create (mint) own NFT · Issue \#7 · ton-society/grants-and-bounties \- GitHub, accessed August 8, 2025, [https://github.com/ton-society/ton-footsteps/issues/7](https://github.com/ton-society/ton-footsteps/issues/7)  
40. TON Metaspace \- GitHub, accessed August 8, 2025, [https://github.com/tonmetaspace](https://github.com/tonmetaspace)  
41. TON Storage, accessed August 8, 2025, [https://blog.ton.org/ton-storage](https://blog.ton.org/ton-storage)  
42. TON blockchain launches decentralized file-sharing solution | The Block, accessed August 8, 2025, [https://www.theblock.co/post/199494/telegram-linked-ton-blockchain-launches-decentralized-file-sharing-solution](https://www.theblock.co/post/199494/telegram-linked-ton-blockchain-launches-decentralized-file-sharing-solution)  
43. Customizing the NFT Contract | NEAR Documentation, accessed August 8, 2025, [https://docs.near.org/tutorials/nfts/series](https://docs.near.org/tutorials/nfts/series)  
44. Gas best practices | Tact Documentation, accessed August 8, 2025, [https://docs.tact-lang.org/book/gas-best-practices/](https://docs.tact-lang.org/book/gas-best-practices/)  
45. blueprint/example/contracts/imports/stdlib.fc at main · ton-org/blueprint \- GitHub, accessed August 8, 2025, [https://github.com/ton-org/blueprint/blob/main/example/contracts/imports/stdlib.fc](https://github.com/ton-org/blueprint/blob/main/example/contracts/imports/stdlib.fc)  
46. An Introduction to Gas Optimization \- Uniswap Docs, accessed August 8, 2025, [https://docs.uniswap.org/blog/intro-to-gas-optimization](https://docs.uniswap.org/blog/intro-to-gas-optimization)  
47. Optimization on Ethereum: Make a Difference with Function Names \- GitHub, accessed August 8, 2025, [https://github.com/Laugharne/Optimal\_Function\_Names\_en](https://github.com/Laugharne/Optimal_Function_Names_en)  
48. How to Mint an NFT on TON \- Pinata, accessed August 8, 2025, [https://pinata.cloud/blog/how-to-mint-an-nft-on-ton/](https://pinata.cloud/blog/how-to-mint-an-nft-on-ton/)  
49. Gas Optimization Guide for Smart Contracts | by TRON Core Devs \- Medium, accessed August 8, 2025, [https://medium.com/tronnetwork/smart-contract-gas-optimization-guide-22958db86ccb](https://medium.com/tronnetwork/smart-contract-gas-optimization-guide-22958db86ccb)  
50. ton/crypto/smartcont/dns-manual-code.fc at master · ton-blockchain/ton \- GitHub, accessed August 8, 2025, [https://github.com/ton-blockchain/ton/blob/master/crypto/smartcont/dns-manual-code.fc](https://github.com/ton-blockchain/ton/blob/master/crypto/smartcont/dns-manual-code.fc)  
51. Deep Dive into the TON FunC Dict Tool: The Art of Key-Value Pair Management in Smart Contracts | 登链社区, accessed August 8, 2025, [https://learnblockchain.cn/article/9613](https://learnblockchain.cn/article/9613)  
52. How to Start NFT Development on TON Blockchain | by Rock'n'Block | Medium, accessed August 8, 2025, [https://rocknblock.medium.com/how-to-start-nft-development-on-ton-blockchain-8319033ea103](https://rocknblock.medium.com/how-to-start-nft-development-on-ton-blockchain-8319033ea103)  
53. Optimizing Storage Costs \- The Cairo Programming Language \- Starknet, accessed August 8, 2025, [https://www.starknet.io/cairo-book/ch103-01-optimizing-storage-costs.html](https://www.starknet.io/cairo-book/ch103-01-optimizing-storage-costs.html)  
54. Developers' Best Practices When Upgrading Smart Contracts | by Issa \- Medium, accessed August 8, 2025, [https://issa-1.medium.com/developers-best-practices-when-upgrading-smart-contracts-a5eed6f7af12](https://issa-1.medium.com/developers-best-practices-when-upgrading-smart-contracts-a5eed6f7af12)  
55. What is NFT Minting: Step-By-Step Guide on How to Mint NFTs | LiteFinance, accessed August 8, 2025, [https://www.litefinance.org/blog/for-beginners/how-to-trade-crypto/what-is-minting-nft/](https://www.litefinance.org/blog/for-beginners/how-to-trade-crypto/what-is-minting-nft/)  
56. Optimize names to save gas \- AuditBase Detectors, accessed August 8, 2025, [https://detectors.auditbase.com/optimize-names-solidity-gas-optimization](https://detectors.auditbase.com/optimize-names-solidity-gas-optimization)  
57. Introduction to TON: Accounts, Tokens, Transactions, and Security | by SlowMist | Medium, accessed August 8, 2025, [https://slowmist.medium.com/introduction-to-ton-accounts-tokens-transactions-and-asset-security-899a58619fb2](https://slowmist.medium.com/introduction-to-ton-accounts-tokens-transactions-and-asset-security-899a58619fb2)  
58. Fungible Tokens (Jettons) | Tact Documentation, accessed August 8, 2025, [https://docs.tact-lang.org/cookbook/jettons/](https://docs.tact-lang.org/cookbook/jettons/)  
59. Understanding Function Dictionaries in C\# and Initialization Challenges \- Medium, accessed August 10, 2025, [https://medium.com/@python-javascript-php-html-css/understanding-function-dictionaries-in-c-and-initialization-challenges-af62dc1dbfb6](https://medium.com/@python-javascript-php-html-css/understanding-function-dictionaries-in-c-and-initialization-challenges-af62dc1dbfb6)  
60. Dictionaries in Python \- GeeksforGeeks, accessed August 10, 2025, [https://www.geeksforgeeks.org/python/python-dictionary/](https://www.geeksforgeeks.org/python/python-dictionary/)  
61. 5\. Data Structures — Python 3.13.6 documentation, accessed August 10, 2025, [https://docs.python.org/3/tutorial/datastructures.html](https://docs.python.org/3/tutorial/datastructures.html)  
62. Functional Programming With C\# \- Make Dictionaries Functional\! \- Simon Painter, accessed August 10, 2025, [http://www.thecodepainter.co.uk/blog/20241219/makedictionarysfunctional.html](http://www.thecodepainter.co.uk/blog/20241219/makedictionarysfunctional.html)  
63. Implementing a dictionary using first class functions \- lukeplant.me.uk, accessed August 10, 2025, [https://lukeplant.me.uk/blog/posts/implementing-a-dictionary-using-first-class-functions/](https://lukeplant.me.uk/blog/posts/implementing-a-dictionary-using-first-class-functions/)  
64. Declaring a Dictionary  
65. TON: How to develop fungible tokens (Jettons) \- Chainstack Docs, accessed August 10, 2025, [https://docs.chainstack.com/docs/ton-how-to-develop-fungible-tokens-jettons](https://docs.chainstack.com/docs/ton-how-to-develop-fungible-tokens-jettons)  
66. TON: How to customize fungible tokens (Jettons) \- Chainstack Docs, accessed August 10, 2025, [https://docs.chainstack.com/docs/ton-how-to-customize-fungible-tokens-jettons](https://docs.chainstack.com/docs/ton-how-to-customize-fungible-tokens-jettons)  
67. Token Development on TON Blockchain | Jetton Token Standard \- Rock'n'Block, accessed August 10, 2025, [https://rocknblock.io/blog/token-development-on-ton-jetton-token-standard](https://rocknblock.io/blog/token-development-on-ton-jetton-token-standard)  
68. Tutorial \- Jetton | TonDynasty Contracts, accessed August 10, 2025, [https://ton-dynasty.github.io/docs.contracts/docs/category/tutorial---jetton/](https://ton-dynasty.github.io/docs.contracts/docs/category/tutorial---jetton/)  
69. Jetton Token \- Tact by example, accessed August 10, 2025, [https://tact-by-example.org/07-jetton-standard](https://tact-by-example.org/07-jetton-standard)