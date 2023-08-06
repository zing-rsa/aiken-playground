import plutus from '../plutus.json' assert {type: "json"}
import {
    Lucid,
    Emulator,
    SpendingValidator,
    PrivateKey,
    Data,
    Address,
    UTxO,
    generatePrivateKey,
    fromText,
    Unit,
getAddressDetails,
Assets,
TxHash
} from 'lucid'


const lucidLib = await Lucid.new(undefined, "Custom");

const contractCode = plutus.validators.find(v => v.title == "tokenswap.spend")

if (!contractCode) throw new Error('Compiled validator not found'); 

const validator: SpendingValidator = {
    "type": "PlutusV2", 
    "script": contractCode.compiledCode 
}

const Datum = Data.Object({
    seller: Data.Bytes(),
    price: Data.Integer()
}) 
type Datum = Data.Static<typeof Datum>;

// lock utxo
async function lock(lucid: Lucid, userKey: PrivateKey, dtm: Datum, scriptAddr: Address, asset: Assets) {
    lucid.selectWalletFromPrivateKey(userKey);

    const tx = await lucid
        .newTx()
        .payToContract(scriptAddr, { inline: Data.to<Datum>(dtm, Datum)}, asset)
        .complete()

    const txSigned = await tx.sign().complete()
    const txHash = await txSigned.submit()

    return txHash;
}

// spend utxo
async function spend(lucid: Lucid, userKey: PrivateKey, utxo: UTxO, pricePaid: bigint, address: Address, asset: Assets)   {
    lucid.selectWalletFromPrivateKey(userKey);

    console.log('paying addres: ', address, 'amount: ', pricePaid * 1000000n )

    const tx = await lucid
        .newTx()
        .collectFrom([utxo], Data.void())
        .attachSpendingValidator(validator)
        .payToAddress(address, { lovelace: pricePaid * 1000000n })
        .payToAddress(await lucid.wallet.address(), asset)
        .complete()

    const txSigned = await tx.sign().complete()
    console.log('spend tx:', txSigned)
    const txHash = await txSigned.submit() 

    return txHash;
}

async function claim(lucid: Lucid, userKey: PrivateKey, utxo: UTxO, asset: Assets) {
    lucid.selectWalletFromPrivateKey(userKey);

    const tx = await lucid
        .newTx()
        .collectFrom([utxo], Data.void())
        .attachSpendingValidator(validator)
        .addSignerKey(getAddressDetails(await lucid.wallet.address()).paymentCredential!.hash)
        .payToAddress(await lucid.wallet.address(), asset)
        .complete()

    const txSigned = await tx.sign().complete()
    const txHash = await txSigned.submit() 

    return txHash;
}

async function testFails(test: any, params: TestParams) {
        let throws = false;
        try {
            await test(params) 
        } catch (_e) {
            throws = true;
        }
        
        if (!throws) {
            throw new Error("Test did not fail as expected");
        }
}

 async function testSuceeds(test: any, params: TestParams) {
   await test(params) 
}

enum SpendType {
    Spend,
    Claim
}

interface TestParams {
    price: bigint
    pricePaid: bigint
    spendType: SpendType 
}

async function run(testParams: TestParams) {

    const user1 = generatePrivateKey();
    const address1 = await lucidLib.selectWalletFromPrivateKey(user1).wallet.address();
    const addresshash1 = getAddressDetails(address1).paymentCredential?.hash;
    console.log('address1', address1)

    const user2 = generatePrivateKey();
    const address2 = await lucidLib.selectWalletFromPrivateKey(user2).wallet.address();
    const addresshash2 = getAddressDetails(address2).paymentCredential?.hash;
    console.log('address2', address2)

    if (!addresshash1 || !addresshash2) throw new Error("Could not generate hashes for user accounts")

    const scriptAddress = lucidLib.utils.validatorToAddress(validator);
    
    const token: Unit = "4523c5e21d409b81c95b45b0aea275b8ea1406e6cafea5583b9f8a5f" + fromText("myToken")
    const asset: Assets = { [token]: 1n }

    const emulator = new Emulator([
        { address: address1, assets: { lovelace: 100000000n, ...asset}},
        { address: address2, assets: { lovelace: 100000000n }}
    ]);
    const lucid = await Lucid.new(emulator);

    const dtm = {
       seller: addresshash1,
       price: testParams.price
    }

    const lockTx = await lock(lucid, user1, dtm, scriptAddress, asset);
    console.log('locked: ', lockTx)

    emulator.awaitBlock(5);

    const utxoToSpend = (await lucid.utxosAt(scriptAddress))
        .find(u => u.datum == Data.to<Datum>(dtm, Datum));

    if (!utxoToSpend) throw new Error("Expected Utxos!");
    console.log('utxo: ', utxoToSpend);

    let spendTx: TxHash;

    switch(testParams.spendType){
        case SpendType.Claim: 
            spendTx = await claim(lucid, user1, utxoToSpend, asset);
            break;
        case SpendType.Spend:
            spendTx = await spend(lucid, user2, utxoToSpend, testParams.pricePaid, address1, asset);
            break;
    }

    console.log('spent: ', spendTx)
    
    emulator.awaitBlock(5)

    console.log('--------------------------------------------------------')
    console.log('script utxos: ', await lucid.utxosAt(scriptAddress))
    console.log('address1 utxos: ', await lucid.utxosAt(address1))
    console.log('address2 utxos: ', await lucid.utxosAt(address2))
    console.log('--------------------------------------------------------')

}

function main() {
   Deno.test('lock token, claim token, pay seller', 
             () => testSuceeds(run, {
                 pricePaid: 10n,
                 price: 10n,
                 spendType: SpendType.Spend
             }));
//   Deno.test('', () => testSuceeds(run));
//   Deno.test('', () => testFails(run));
}

main();

