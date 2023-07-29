use aiken/transaction.{OutputReference, ScriptContext, Transaction, ValidityRange} as tx
use aiken/transaction/credential.{VerificationKey}
use aiken/hash.{Blake2b_224, Hash}
use aiken/interval.{Finite}
use aikenplayground/types
use aiken/list.{and, or}

type POSIXTime = Int

type PubKeyHash = Hash<Blake2b_224, VerificationKey>

type VestingDatum {
    beneficiary: PubKeyHash,
    deadline: POSIXTime
}

validator {
 fn spend(dtm: VestingDatum, rdm: Void, ctx: ScriptContext) {
    when ctx.purpose is {
        Spend(_) -> deadlinePassed(dtm.deadline, ctx.valid_range) && signedByBeneficiary(dtm.beneficiary, ctx.transaction)
        _ -> False
    }
 }
}

fn deadlinePassed(deadline: POSIXTime, range: ValidityRange) -> Bool {
    when range.lower_bound.bound_type is {
        Finite(now) -> now >= deadline,
        _           -> False 
    }
}

fn signedByBeneficiary(ben: PubKeyHash, tx: Transaction ) {
   list.has(tx.extra_signatories, ben) 
}
