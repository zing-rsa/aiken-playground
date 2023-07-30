import { Blockfrost, Data, Lucid, SpendingValidator, TxHash, getAddressDetails } from "https://deno.land/x/lucid@0.9.8/mod.ts";
import keys from '../keyfile.json' assert {type: "json"}
import plutus from '../plutus.json' assert {type: "json"}

const lucid = await Lucid.new(
    new Blockfrost(
        "https://cardano-preprod.blockfrost.io/api/v0",
        keys.blockfrostKey
    ),
    "Preprod"
)

const vestingContract = plutus.validators.find(v => v.title == "hello.spend")?.compiledCode;

if (!vestingContract) throw new Error("Couldn't find vesting contract");

const VestingScript: SpendingValidator = {
    "type": "PlutusV2",
    "script": vestingContract
}

const VestingDatum = Data.Object({
    beneficiary: Data.Bytes(),
    deadline: Data.Integer()
})
type VestingDatum = Data.Static<typeof VestingDatum>;

async function lockFunds(dtm: VestingDatum, seed: string): Promise<TxHash> {
    lucid.selectWalletFromSeed(seed);

    const scriptAddr = lucid.utils.validatorToAddress(VestingScript)

    const lockingTx = await lucid
                        .newTx()
                        .payToContract(scriptAddr, { inline: Data.to<VestingDatum>(dtm, VestingDatum)}, { lovelace: BigInt(10000000) })
                        .complete()
    const signedTx = await lockingTx.sign().complete()
    const hash = await signedTx.submit();

    return hash;
}

async function claimFunds(dtm: VestingDatum, seed: string): Promise<TxHash> {
    lucid.selectWalletFromSeed(seed);

    const utxoToSpend = (await lucid.utxosAt(lucid.utils.validatorToAddress(VestingScript)))
        .find(u => u.datum == Data.to<VestingDatum>(dtm, VestingDatum));

    if (utxoToSpend !== undefined){
        const consumingTx = await lucid
                                .newTx()
                                .collectFrom([utxoToSpend], Data.void())
                                .attachSpendingValidator(VestingScript)
                                .validFrom(Date.now() - 10000)
                                .addSignerKey(dtm.beneficiary)
                                .complete()
        
        const signed = await consumingTx.sign().complete()
        const hash = await signed.submit();

        return hash;
    } else {
        throw new Error("utxo not found")
    }
}

async function run() {

    const beneficiary = getAddressDetails(await (await Lucid.new(undefined,"Preprod")).selectWalletFromSeed(keys.seed).wallet.address()).paymentCredential?.hash;

    if (beneficiary == undefined) throw new Error("Beneficiary hash not found");

    const deadline = BigInt(Date.now() + 30000)
    console.log("dealine was: ", deadline);

    const dtm = {
        beneficiary,
        deadline
    }

    const lockHash = await lockFunds(dtm, keys.seed);
    console.log("locked: ", lockHash)
    
    // wait 3 min for tx to finalize
    await new Promise((resolve) => setTimeout(resolve, 180 * 1000));
    console.log("waiting 3 min for transaction to propegate...")

    const consumeHash = await claimFunds(dtm, keys.seed);
    console.log("claimed: ", consumeHash)
}

run()
