import { Lucid, Emulator, SpendingValidator, PrivateKey, Data, Address, UTxO, generatePrivateKey, getAddressDetails } from 'lucid'
import plutus from '../plutus.json' assert {type: "json"}

const lucidLib = await Lucid.new(undefined, "Custom");

const vestingCode = plutus.validators.find(v => v.title == "vesting.spend")

if (!vestingCode) throw new Error('Compiled validator not found'); 

const vestingValidator: SpendingValidator = {
    "type": "PlutusV2", 
    "script": vestingCode.compiledCode 
}

const VestingDatumSchema = Data.Object({
    deadline: Data.Integer(),
    beneficiary: Data.Bytes()
}) 
type VestingDatum = Data.Static<typeof VestingDatumSchema>;
const VestingDatum = VestingDatumSchema as unknown as VestingDatum;      

async function lock(lucid: Lucid, userKey: PrivateKey, dtm: VestingDatum, scriptAddr: Address) {
    lucid.selectWalletFromPrivateKey(userKey);

    const tx = await lucid
        .newTx()
        .payToContract(scriptAddr, { inline: Data.to<VestingDatum>(dtm, VestingDatum)}, { lovelace: 1000000n })
        .complete()

    const txSigned = await tx.sign().complete()
    const txHash = await txSigned.submit()

    return txHash;
}

// create spend(lucid, user, )
async function spend(lucid: Lucid, userKey: PrivateKey, utxo: UTxO, validAfter: number, dtm: VestingDatum){
    lucid.selectWalletFromPrivateKey(userKey);

    const tx = await lucid
        .newTx()
        .collectFrom([utxo], Data.void())
        .attachSpendingValidator(vestingValidator)
        .validFrom(validAfter)
        .addSignerKey(dtm.beneficiary)
        .complete()
    const txSigned = await tx.sign().complete()
    const txHash = await txSigned.submit() 

    return txHash;
}

async function run(deadline: bigint, slot: number) {

    const user1 = generatePrivateKey();
    const address1 = await lucidLib.selectWalletFromPrivateKey(user1).wallet.address();

    const user2 = generatePrivateKey();
    const address2 = await lucidLib.selectWalletFromPrivateKey(user1).wallet.address();
    const beneficiary = getAddressDetails(address2).paymentCredential?.hash;

    if (!beneficiary) throw new Error("Invalid Beneficiary");

    const dtm = {
        deadline,
        beneficiary 
    }

    const emulator = new Emulator([
        { address: address1, assets: { lovelace: 10000000n }}, 
        { address: address2, assets: { lovelace: 10000000n }}
    ]);
    const lucid = await Lucid.new(emulator);

    const vestingAddress = lucidLib.utils.validatorToAddress(vestingValidator);

    const lockTx = await lock(lucid, user1, dtm, vestingAddress);
    console.log('locked: ', lockTx)

    //const utxo = (await lucid.utxosAt(vestingAddress))[0];

    emulator.awaitSlot(slot);

    const utxoToSpend = (await lucid.utxosAt(vestingAddress))
        .find(u => u.datum == Data.to<VestingDatum>(dtm, VestingDatum));
    console.log('utxos: ', await lucid.utxosAt(vestingAddress))

    if (!utxoToSpend) throw new Error("Expected Utxos!");

    const spendTx = await spend(lucid, user2, utxoToSpend, emulator.now(), dtm);
    console.log('spent: ', spendTx)

    emulator.awaitBlock(10);

}

function main() {
   Deno.test('deadline at 100, wait till 120', async () => {await run(100n, 120)});
   Deno.test('deadline at 100, wait till 500', async () => {await run(100n, 500)});
   Deno.test('deadline at 200, wait till 120', async () => {await run(200n, 120)});
}

main();
