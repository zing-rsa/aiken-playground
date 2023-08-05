import { Lucid, Emulator, SpendingValidator, PrivateKey, Data, Address, UTxO, generatePrivateKey, getAddressDetails } from 'lucid'
import plutus from '../plutus.json' assert {type: "json"}

const lucidLib = await Lucid.new(undefined, "Custom");

const contractCode = plutus.validators.find(v => v.title == "<script>.spend")

if (!contractCode) throw new Error('Compiled validator not found'); 

const validator: SpendingValidator = {
    "type": "PlutusV2", 
    "script": contractCode.compiledCode 
}

const Datum = Data.Object({
//
}) 
type Datum = Data.Static<typeof Datum>;

async function lock(lucid: Lucid, userKey: PrivateKey, dtm: Datum, scriptAddr: Address) {
    lucid.selectWalletFromPrivateKey(userKey);

    const tx = await lucid
        .newTx()
        //.payToContract(scriptAddr, { inline: Data.to<Datum>(dtm, Datum)}, { lovelace: 1000000n })
        .complete()

    const txSigned = await tx.sign().complete()
    const txHash = await txSigned.submit()

    return txHash;
}

// create spend(lucid, user, )
async function spend(lucid: Lucid, userKey: PrivateKey, utxo: UTxO)   {
    lucid.selectWalletFromPrivateKey(userKey);

    const tx = await lucid
        .newTx()
        .collectFrom([utxo], Data.void())
        .attachSpendingValidator(validator)
         //.addSigner()      - addr1
         //.addSignerKey()   - pubkeyhash
         //.validFrom()
        .complete()
    const txSigned = await tx.sign().complete()
    const txHash = await txSigned.submit() 

    return txHash;
}


async function run(testParams: any) {

    const user1 = generatePrivateKey();
    const address1 = await lucidLib.selectWalletFromPrivateKey(user1).wallet.address();
    console.log('address1', address1)

    const user2 = generatePrivateKey();
    const address2 = await lucidLib.selectWalletFromPrivateKey(user2).wallet.address();
    console.log('address2', address2)

    const scriptAddress = lucidLib.utils.validatorToAddress(validator);

    const emulator = new Emulator([
        { address: address1, assets: { lovelace: 10000000n }}, 
        { address: address2, assets: { lovelace: 10000000n }},
    ]);
    const lucid = await Lucid.new(emulator);

    const dtm = {
        
    }

    const lockTx = await lock(lucid, user1, dtm, scriptAddress);
    console.log('locked: ', lockTx)

    const utxoToSpend = (await lucid.utxosAt(scriptAddress))
        .find(u => u.datum == Data.to<Datum>(dtm, Datum));

    if (!utxoToSpend) throw new Error("Expected Utxos!");
    console.log('utxo: ', utxoToSpend);

    const spendTx = await spend(lucid, user2, utxoToSpend);
    console.log('spent: ', spendTx)

}

async function testFails(
    test: any 
    ) {
        let throws = false;
        try {
            await test() 
        } catch (_e) {
            throws = true;
        }
        
        if (!throws) {
            throw new Error("Test did not fail as expected");
        }
}

    
 async function testSuceeds(
    test: any
    ) {
   await test() 
}

function main() {
   Deno.test('', () => testSuceeds(run));
   Deno.test('', () => testSuceeds(run));
   Deno.test('', () => testFails(run));
}

main();

