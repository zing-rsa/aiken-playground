import { Lucid, Emulator, SpendingValidator, PrivateKey, Data, Address, UTxO, generatePrivateKey, getAddressDetails } from 'lucid'
import plutus from '../plutus.json' assert {type: "json"}

const lucidLib = await Lucid.new(undefined, "Custom");

const vestingCode = plutus.validators.find(v => v.title == "vesting_old.spend")

if (!vestingCode) throw new Error('Compiled validator not found'); 

const vestingValidator: SpendingValidator = {
    "type": "PlutusV2", 
    "script": vestingCode.compiledCode 
}

const VestingDatum = Data.Object({
    deadline: Data.Integer(),
    beneficiary: Data.Bytes()
}) 
type VestingDatum = Data.Static<typeof VestingDatum>;
//const VestingDatum = VestingDatumSchema as unknown as VestingDatum;      

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
async function spend(lucid: Lucid, userKey: PrivateKey, utxo: UTxO, validAfter: number, dtm: VestingDatum)  {
    lucid.selectWalletFromPrivateKey(userKey);

    const tx = await lucid
        .newTx()
        .collectFrom([utxo], Data.void())
        //.addSigner(await lucid.wallet.address())
        .addSignerKey(dtm.beneficiary)
        .attachSpendingValidator(vestingValidator)
        .validFrom(validAfter)
        .complete()
    const txSigned = await tx.sign().complete()
    const txHash = await txSigned.submit() 

    return txHash;
}


async function run(deadline: bigint, slot: number) {

    const user1 = generatePrivateKey();
    const address1 = await lucidLib.selectWalletFromPrivateKey(user1).wallet.address();
    console.log('address1', address1)

    const user2 = generatePrivateKey();
    const address2 = await lucidLib.selectWalletFromPrivateKey(user2).wallet.address();
    const beneficiary = getAddressDetails(address2).paymentCredential?.hash;
    console.log('address2', address2)

    if (!beneficiary) throw new Error("Invalid Beneficiary");
    console.log('beneficiary: ', beneficiary);

    const vestingAddress = lucidLib.utils.validatorToAddress(vestingValidator);


    const emulator = new Emulator([
        { address: address1, assets: { lovelace: 10000000n }}, 
        { address: address2, assets: { lovelace: 10000000n }},
    ]);
    const lucid = await Lucid.new(emulator);

    const dtm = {
        deadline: BigInt(emulator.now()) + deadline,
        beneficiary 
    }
    console.log('current time: ', emulator.now())
    console.log('deadline: ', dtm.deadline)
    console.log('slot: ', emulator.slot)

    const lockTx = await lock(lucid, user1, dtm, vestingAddress);
    console.log('locked: ', lockTx)

    //const utxo = (await lucid.utxosAt(vestingAddress))[0];

    emulator.awaitSlot(slot);

    console.log('current time: ', emulator.now())
    console.log('slot: ', emulator.slot)

    const utxoToSpend = (await lucid.utxosAt(vestingAddress))
        .find(u => u.datum == Data.to<VestingDatum>(dtm, VestingDatum));

    if (!utxoToSpend) throw new Error("Expected Utxos!");
    console.log('utx: ', utxoToSpend);

    const spendTx = await spend(lucid, user2, utxoToSpend, emulator.now(), dtm);
    console.log('spent: ', spendTx)

}

async function testFails(
    test: (deadline: bigint, slot: number) => Promise<void>,
    deadline: bigint,
    slot: number) {
        let throws = false;
        try {
            await test(deadline, slot) 
        } catch (_e) {
            throws = true;
        }
        
        if (!throws) {
            throw new Error("Test did not fail as expected");
        }
}

    
 async function testSuceeds(
    test: (deadline: bigint, slot: number) => Promise<void>,
    deadline: bigint,
    slot: number) {
        
   await test(deadline, slot) 
}

function main() {
   Deno.test('deadline at 100, wait till 120', () => testSuceeds(run, 100n*1000n, 120));
   Deno.test('deadline at 100, wait till 500', () => testSuceeds(run, 100n*1000n, 500));

   Deno.test('deadline at 200, wait till 120', () => testFails(run, 200n*1000n, 100));
}

main();
